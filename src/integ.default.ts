import { Vpc } from "aws-cdk-lib/aws-ec2";
import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { LoadBalancerV2Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { App, Stack, CfnOutput } from "aws-cdk-lib";
import { Wordpress } from "./index";
import { HostedZone, PublicHostedZone, IHostedZone } from "aws-cdk-lib/aws-route53";
import { RemovalPolicy } from "aws-cdk-lib";
import { IOrigin, OriginProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { WordpressCertificate } from "./wordpress-certificate";
/**
 * Functionally, this is just for testing, when in a testing context, the CDK knows not to make real infra.
 * However this is also
 */
export class IntegTesting {
    readonly stack: Stack;

    constructor() {
        const app = new App();

        const env = {
            account: process.env.CDK_DEFAULT_ACCOUNT,
            region: process.env.CDK_CERTIFICATE_REGION,
        };

        const stack = new Stack(app, "testing-stack", { env });

        const hostedZone = PublicHostedZone.fromLookup(stack, "HostedZone", {
            domainName: "wordpress-test.com",
        });

        const wordpress = new Wordpress(stack, "ServerlessWordpressStack", {
            domainName: "blog.wordpress-test.com",
            domainZone: hostedZone,
            removalPolicy: RemovalPolicy.DESTROY,
            offloadStaticContent: true, // Support for plugin e.g. `WP Offload Media for Amazon S3`
        });

        new CfnOutput(stack, "VpcID", {
            value: wordpress.application.domainName,
        });

        this.stack = stack;
    }
}

export class FakeCloudfront {
    public readonly CUSTOM_HTTP_HEADER: string = "X_Request_From_CloudFront";
    public readonly stack: Stack;
    public readonly origin: IOrigin;
    public readonly domainName: string;
    public readonly domainZone: IHostedZone;

    public readonly certificate: ICertificate;

    constructor(stack: Stack) {
        this.stack = stack;
        this.domainName = "example.com";

        this.domainZone = PublicHostedZone.fromLookup(this.stack, "HostedZone", {
            domainName: this.domainName,
        });

        this.origin = new LoadBalancerV2Origin(
            new ApplicationLoadBalancer(this.stack, "Loadbalancer", {
                vpc: new Vpc(this.stack, "TestVpc"),
            }),
        );

        this.certificate = new WordpressCertificate(this.stack, "WordpressSSLCertificate", {
            domainName: this.domainName,
            domainZone: this.domainZone,
        }).certificate;
    }
}
