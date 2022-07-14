import { WordpressCertificate } from "./wordpress-certificate";
import { BackupPlan, BackupResource } from "aws-cdk-lib/aws-backup";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { ContainerImage, LogDriver, Secret } from "aws-cdk-lib/aws-ecs";
import { IHostedZone } from "aws-cdk-lib/aws-route53";
import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
//Package Constructs
import { Construct } from "constructs";
import { WordpressDatabase } from "./wordpress-database";
import { WordpressApplication, StaticContentOffload } from "./wordpress-application";
import { WordpressFilesystem } from "./wordpress-filesystem";

/**
 * Properties Of A Wordpress Site
 */
export interface WordpressProps {
    /**
     * Domain name is technically optional, if none passed a random subdomain will be generated in the provided hosted zone
     */
    readonly domainName: string;
    /**
     * The return value from either a new HostedZone (aws-cdk-lib/aws-route53), or the result of a PublicHostedZone.fromLookup() call
     */
    readonly domainZone: IHostedZone;
    /**
     * Any desired CNAMES
     */
    readonly subjectAlternativeNames?: string[];

    /**
     * We can either start fresh, or
     */
    readonly vpc?: IVpc;
    readonly filesystem?: WordpressFilesystem;
    readonly database?: WordpressDatabase;
    readonly image?: ContainerImage;
    readonly environment?: Record<string, string>;
    readonly secrets?: Record<string, Secret>;
    readonly serviceName?: string;
    readonly memoryLimitMiB?: number;
    readonly logDriver?: LogDriver;
    readonly backupPlan?: BackupPlan;
    readonly cloudFrontHashHeader?: string;
    readonly offloadStaticContent?: boolean;
    readonly removalPolicy?: RemovalPolicy;
}

export class Wordpress extends Construct {
    public readonly application: WordpressApplication;
    public readonly database: WordpressDatabase;
    public readonly filesystem: WordpressFilesystem;
    public readonly staticContentOffload?: StaticContentOffload;
    public readonly domainZone: IHostedZone;
    public readonly domainName: string;

    constructor(scope: Construct, id: string, props: WordpressProps) {
        super(scope, id);

        const stack = Stack.of(this);
        this.domainZone = props.domainZone;
        this.domainName = props.domainName;

        //This value will become the ARecord of the cloudfront CDN.
        const staticContentDomainName = `static.${this.domainName}`;

        //In addition to "static.domain.com", you may pass in any desired alias'es
        const subjectAlternativeNames = props.subjectAlternativeNames ?? [];

        //This is a wordpress specific setting to assist with caching
        if (props.offloadStaticContent) {
            subjectAlternativeNames.push(staticContentDomainName);
        }

        //The VPC should be passed in when this construct is instanciated. The below default is not suitable for production, but its there for testing
        const vpc = props.vpc ?? new Vpc(this, "Vpc", { maxAzs: 3, natGateways: 1 });

        //The Database should be passed in when this construct is instanciated. The below default is not suitable for production, but its there for testing
        this.database = props.database ?? new WordpressDatabase(this, "WordpressDatabase", { vpc });

        //See the wordpress-filesystem.ts wrapper construct in this same directory for more information.
        this.filesystem = props.filesystem ?? new WordpressFilesystem(this, "WordpressVolume", { vpc });

        const certificate = new WordpressCertificate(this, "WordpressSSLCertificate", { domainName: this.domainName, domainZone: this.domainZone }).certificate;

        //See "wordpress-application.ts" wrapper construct in this same directory for more information.
        this.application = new WordpressApplication(this, "Application", {
            domainName: this.domainName,
            domainZone: this.domainZone,
            certificate,
            vpc,
            filesystem: this.filesystem,
            database: this.database,
            image: props.image,
            serviceName: props.serviceName,
            memoryLimitMiB: props.memoryLimitMiB,
            environment: props.environment,
            secrets: props.secrets,
            logDriver: props.logDriver,
            cloudFrontHashHeader: props.cloudFrontHashHeader,
            removalPolicy: props.removalPolicy,
        });

        this.database.allowDefaultPortFrom(this.application.service);
        this.filesystem.allowDefaultPortFrom(this.application.service);

        if (props.offloadStaticContent) {
            this.staticContentOffload = this.application.enableStaticContentOffload(staticContentDomainName, certificate);
        }

        //Allow for a removal policy to be set, at what functionally amounts to the global level.
        if (props.backupPlan) {
            if (props.removalPolicy) {
                props.backupPlan.applyRemovalPolicy(props.removalPolicy);
            }
            props.backupPlan.addSelection("BackupPlanSelection", {
                resources: [BackupResource.fromConstruct(this)],
            });
        }

        //Shell output on completion
        new CfnOutput(this, "Application Domain", {
            value: this.application.domainName,
        });
    }
}
