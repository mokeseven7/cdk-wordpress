import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Wordpress } from ".";
import { PublicHostedZone, IHostedZone } from "aws-cdk-lib/aws-route53";
import { RemovalPolicy, CfnOutput } from "aws-cdk-lib";

export interface WordpressStackProps {
    zone: string;
}

export class WordpressStack extends Stack {
    readonly domainZone: IHostedZone;

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        this.domainZone = PublicHostedZone.fromLookup(this, "HostedZone", {
            domainName: "undefinedfn.com",
        });

        const wordpress = new Wordpress(this, "ServerlessWordpressStack", {
            domainName: "undefinedfn.com",
            domainZone: this.domainZone,
            removalPolicy: RemovalPolicy.DESTROY,
            offloadStaticContent: false, // Support for plugin e.g. `WP Offload Media for Amazon S3`
        });

        new CfnOutput(this, "VpcID", {
            value: wordpress.application.domainName,
        });
    }
}
