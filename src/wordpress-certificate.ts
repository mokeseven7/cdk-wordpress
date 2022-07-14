import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";
import { AaaaRecord, ARecord, IHostedZone, RecordTarget, HostedZone } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";

export interface WordpressCertificateProps {
    /**
     * A Domain Name In A Hosted Zone
     */
    readonly domainName: string;

    readonly domainZone: IHostedZone;
}

export class WordpressCertificate extends Construct {
    //Store a ref to the DNS validated certificate so it can be referenced anywhere in the stack
    public readonly certificate: ICertificate;

    constructor(scope: Construct, id: string, props: WordpressCertificateProps) {
        super(scope, id);

        //Cert MUST exist in us-east-1
        this.certificate = new DnsValidatedCertificate(this, "DistributionCertificate", {
            domainName: props.domainName,
            hostedZone: props.domainZone,
            region: "us-east-1",
        });
    }

    toCertificate(): ICertificate {
        return this.certificate;
    }
}
