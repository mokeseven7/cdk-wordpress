import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";
import { AaaaRecord, ARecord, HostedZone, IHostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";

export interface WordpressDnsProps {
    /**
     * A Domain Name In A Hosted Zone
     */
    readonly domainName: string;
    /**
     * A valid hosted zone
     */
    readonly domainZone: IHostedZone;
    /**
     * Cloudfront distro
     */
    readonly distribution: IDistribution;
}

export class WordpressDns extends Construct {
    public readonly zone: IHostedZone;

    constructor(scope: Construct, id: string, props: WordpressDnsProps) {
        super(scope, id);

        const stack = Stack.of(this);

        this.zone = props.domainZone;

        new ARecord(this, "ARecord", {
            zone: this.zone,
            recordName: props.domainName,
            target: RecordTarget.fromAlias(new CloudFrontTarget(props.distribution)),
        });

        new AaaaRecord(this, "AaaaRecord", {
            zone: this.zone,
            recordName: props.domainName,
            target: RecordTarget.fromAlias(new CloudFrontTarget(props.distribution)),
        });
    }
}
