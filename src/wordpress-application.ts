import { CertificateValidation, Certificate, ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { LoadBalancerV2Origin, S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
    Distribution,
    OriginProtocolPolicy,
    AllowedMethods,
    CachedMethods,
    ViewerProtocolPolicy,
    HttpVersion,
    PriceClass,
    IDistribution,
    OriginSslPolicy,
} from "aws-cdk-lib/aws-cloudfront";

import { IVpc, Port } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, FargateService, FargateTaskDefinition, LogDriver, Secret } from "aws-cdk-lib/aws-ecs";
import {
    ApplicationListener,
    ApplicationLoadBalancer,
    ApplicationProtocol,
    ApplicationTargetGroup,
    ListenerAction,
    ListenerCertificate,
    ListenerCondition,
    SslPolicy,
    TargetType,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { IHostedZone } from "aws-cdk-lib/aws-route53";
import { Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { RemovalPolicy, Stack, Duration } from "aws-cdk-lib";
import { WordpressDatabase } from "./wordpress-database";
import { WordpressFilesystem } from "./wordpress-filesystem";
import { WordpressDns } from "./wordpress-dns";
import { Construct } from "constructs";
import { WorpdressDistribution } from "./wordpress-distribution";

export interface WordpressApplicationProps {
    readonly domainName: string;
    readonly domainZone: IHostedZone;
    readonly certificate: ICertificate;
    readonly vpc: IVpc;
    readonly filesystem: WordpressFilesystem;
    readonly database: WordpressDatabase;
    readonly image?: ContainerImage;
    readonly serviceName?: string;
    readonly memoryLimitMiB?: number;
    readonly environment?: Record<string, string>;
    readonly secrets?: Record<string, Secret>;
    readonly logDriver?: LogDriver;
    readonly cloudFrontHashHeader?: string;
    readonly removalPolicy?: RemovalPolicy;
}

const CUSTOM_HTTP_HEADER = "X_Request_From_CloudFront";

export interface StaticContentOffload {
    readonly domainName: string;
    readonly distribution: IDistribution;
}

export class WordpressApplication extends Construct {
    //Should be passed in, made via the wordpress-dns construct
    public readonly domainName: string;

    //Should be passed in, created via the wordpress-dns construct
    public readonly domainZone: IHostedZone;

    //Should be passed in, can create with the wordpress-distribution construct
    public readonly distribution: IDistribution;

    //The service where the container is deployed
    public readonly service: FargateService;

    //ALB's use rules to route traffic to target groups, this is a representation of the target group
    public readonly targetGroup: ApplicationTargetGroup;

    //ALBs use rules to route traffic to target groups, this is a representation of a rule.
    public readonly listener: ApplicationListener;

    //Used for secure communication between cloudfront and various other entities.
    private readonly cloudFrontHashHeader: string;

    //Dictates what should happen to the stack if something fails. Choices are retain, destroy, snapshot
    private readonly removalPolicy?: RemovalPolicy;

    public readonly certificate: ICertificate;

    constructor(scope: Construct, id: string, props: WordpressApplicationProps) {
        super(scope, id);

        //This is whats known as a "pseudo parameter" in cloudformation. Its essentially a value that will be passed in at runtime.
        //In a practical sense, in this context, its a way to get the name of whatever stack is instanciating this construct
        const stack = Stack.of(this);

        this.domainName = props.domainName;
        this.domainZone = props.domainZone;
        this.certificate = props.certificate;

        this.cloudFrontHashHeader = props.cloudFrontHashHeader ?? Buffer.from(`${stack.stackName}.${this.domainName}`).toString("base64");
        this.removalPolicy = props.removalPolicy;

        /**
         * Create The ECS Cluster
         */
        const cluster = new Cluster(this, "Cluster", {
            containerInsights: true,
            vpc: props.vpc,
        });

        /**
         * Create a Target Group To Associate with the ALB, which will sit inbetween the internet, and our deployed container
         */
        this.targetGroup = new ApplicationTargetGroup(this, "TargetGroup", {
            vpc: props.vpc,
            port: 80,
            targetType: TargetType.IP,
            stickinessCookieDuration: Duration.days(7),
            healthCheck: {
                path: "/wp-includes/images/blank.gif",
                interval: Duration.minutes(1),
            },
        });

        /**
         * Regular App load balancers are used to route traffic to an ECS task running on fargate
         */
        const loadBalancer = new ApplicationLoadBalancer(this, "Loadbalancer", {
            vpc: props.vpc,
            internetFacing: true,
            http2Enabled: true,
        });

        /**
         * The App Load balancers use what are called listeners, to do things like terminal ssl, or redirect requests on 80 to 443.
         */
        this.listener = loadBalancer.addListener("Listener", {
            port: 443,
            protocol: ApplicationProtocol.HTTPS,
            certificates: [
                ListenerCertificate.fromCertificateManager(
                    new Certificate(this, "LBCertificate", {
                        domainName: this.domainName,
                        validation: CertificateValidation.fromDns(this.domainZone),
                    }),
                ),
            ],
            sslPolicy: SslPolicy.FORWARD_SECRECY_TLS12,
            defaultAction: ListenerAction.fixedResponse(403, {
                contentType: "text/plain",
                messageBody: "Access denied",
            }),
        });

        this.listener.addAction("Cloudfront", {
            action: ListenerAction.forward([this.targetGroup]),
            conditions: [ListenerCondition.httpHeader(CUSTOM_HTTP_HEADER, [this.cloudFrontHashHeader])],
            priority: 100,
        });

        /**
         * This is our main Fargate Task definition. Note the volume thats passed.
         * Gets minimal data to start, but will have methods called on it post instantiation
         */
        const taskDefinition = new FargateTaskDefinition(this, "TaskDefinition", {
            memoryLimitMiB: props.memoryLimitMiB ?? 512,
            cpu: 256,
            volumes: [props.filesystem],
        });

        /**
         * Now that we have a task, the addcontainer method lets us configure some properties about its deployment
         */
        const container = taskDefinition.addContainer("Wordpress", {
            image: props.image ?? ContainerImage.fromRegistry("wordpress:5.8-apache"),
            environment: {
                ...props.environment,
                ...props.database.environment,
            },
            secrets: {
                ...props.secrets,
                ...props.database.secrets,
            },
            logging:
                props.logDriver ??
                LogDriver.awsLogs({
                    streamPrefix: `${stack.stackName}WordpressContainerLog`,
                    logRetention: RetentionDays.ONE_MONTH,
                }),
        });

        container.addPortMappings({
            containerPort: 80,
        });

        //This is essentially what amounts to a docker volume, but using EFS instead of a disk on the container
        container.addMountPoints({
            containerPath: "/var/www/html",
            readOnly: false,
            sourceVolume: props.filesystem.name,
        });

        //The deployment target of our container. Fargate is basically serverless ec2
        this.service = new FargateService(this, "Service", {
            cluster,
            serviceName: props.serviceName,
            taskDefinition,
            desiredCount: 2,
        });

        this.service.connections.allowFrom(loadBalancer, Port.tcp(80));
        this.targetGroup.addTarget(this.service);

        /**
         * The new load balancers have a concept of listeners, where traiffic can be routed based on conditions about the request
         * The below construct represents one of these listener rules, and is for cloudfront specifically
         */
        const origin = new LoadBalancerV2Origin(loadBalancer, {
            originSslProtocols: [OriginSslPolicy.TLS_V1_2],
            customHeaders: {
                [CUSTOM_HTTP_HEADER]: this.cloudFrontHashHeader,
            },
            readTimeout: Duration.seconds(60),
            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
        });

        //On certs in us-east-1 are allowed for cloudfront distro's so we have two options
        //Create a cert in us-east-1 for any domains needed, or allow a default of [randomstring]*.cloudfront.com
        this.distribution = new WorpdressDistribution(this, "WorpdressDistribution", {
            domainName: this.domainName,
            domainZone: this.domainZone,
            origin,
            certificate: this.certificate,
        }).distribution;

        new WordpressDns(this, "WordpressDns", {
            domainName: this.domainName,
            domainZone: this.domainZone,
            distribution: this.distribution,
        });
    }

    public enableStaticContentOffload(domainName: string, certificate: ICertificate): StaticContentOffload {
        const bucket = new Bucket(this, "Bucket", {
            encryption: BucketEncryption.S3_MANAGED,
            versioned: true,
            removalPolicy: this.removalPolicy,
            autoDeleteObjects: this.removalPolicy === RemovalPolicy.DESTROY,
        });

        bucket.grantReadWrite(this.service.taskDefinition.taskRole);

        this.service.taskDefinition.taskRole.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["s3:GetBucketLocation"],
                resources: [bucket.bucketArn],
            }),
        );

        const distribution = new Distribution(this, "StaticContentDistribution", {
            comment: "static content cdn",
            defaultBehavior: {
                origin: new S3Origin(bucket),
                allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: CachedMethods.CACHE_GET_HEAD,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            enableIpv6: true,
            httpVersion: HttpVersion.HTTP2,
            certificate,
            domainNames: [domainName],
            priceClass: PriceClass.PRICE_CLASS_100,
        });

        new WordpressDns(this, "StaticContentDns", {
            domainName: domainName,
            domainZone: this.domainZone,
            distribution,
        });

        return {
            domainName,
            distribution,
        };
    }
}
