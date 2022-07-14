import { WordpressCertificate } from "./wordpress-certificate";
import { DnsValidatedCertificate, ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";
import {
    IDistribution,
    OriginRequestPolicy,
    OriginRequestQueryStringBehavior,
    OriginRequestCookieBehavior,
    OriginRequestHeaderBehavior,
    IOrigin,
    Distribution,
    AllowedMethods,
    CachedMethods,
    ViewerProtocolPolicy,
    BehaviorOptions,
    HttpVersion,
    PriceClass,
    OriginSslPolicy,
    OriginProtocolPolicy,
    AddBehaviorOptions,
} from "aws-cdk-lib/aws-cloudfront";
import { AaaaRecord, ARecord, HostedZone, IHostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";

export interface WorpdressDistributionProps {
    readonly domainName: string;
    readonly domainZone: IHostedZone;
    readonly origin: IOrigin;
    readonly certificate: ICertificate;
}

export class WorpdressDistribution extends Construct {
    public readonly domainName: string;
    public readonly distribution: Distribution;
    public readonly zone: IHostedZone;
    public readonly origin: IOrigin;
    public readonly certificate: ICertificate;

    constructor(scope: Construct, id: string, props: WorpdressDistributionProps) {
        super(scope, id);

        this.domainName = props.domainName;
        this.zone = props.domainZone;
        this.origin = props.origin;
        this.certificate = props.certificate;

        //Defining some restrictions for the wp-admin pages (load balancer to cloudfront)
        const wpAdminBehavior = this.addBehavior("wp-admin/*", this.origin);

        //Some basic protections for the login page, these rules apply to ALB to Cloudfront communication
        const wpSettingsBehavior = this.addBehavior("wp-login.php", this.origin);

        /**
         * Cloudfront is assuming a bigger role in the security model, as such, where placing some limitation on what the client can do.
         * Number one, requests for certain resources may only originate from an origin we own (eg. the load balancer)
         * Number two, there are requirements to headers and cookies that must be present to request certain objects
         */
        const originRequestPolicy = new OriginRequestPolicy(this, "OriginRequestPolicy", {
            originRequestPolicyName: "WordpressDefaultBehavior",
            cookieBehavior: OriginRequestCookieBehavior.allowList("comment_*", "wordpress_*", "wp-settings-*"),
            headerBehavior: OriginRequestHeaderBehavior.allowList(
                "Host",
                "CloudFront-Forwarded-Proto",
                "CloudFront-Is-Mobile-Viewer",
                "CloudFront-Is-Tablet-Viewer",
                "CloudFront-Is-Desktop-Viewer",
            ),
            queryStringBehavior: OriginRequestQueryStringBehavior.all(),
        });

        this.distribution = new Distribution(this, "WordpressCloudfrontDistrubution", {
            comment: "Cloudfront CDN For Wordpress",
            certificate: this.certificate,
            defaultBehavior: {
                origin: props.origin,
                originRequestPolicy,
                allowedMethods: AllowedMethods.ALLOW_ALL,
                cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            additionalBehaviors: { ...wpAdminBehavior, ...wpSettingsBehavior },
            enableIpv6: true,
            httpVersion: HttpVersion.HTTP2,
            domainNames: [this.domainName],
            priceClass: PriceClass.PRICE_CLASS_100,
        });
    }

    /**
     * If the certificate returns no results, or a result other than in us-east-1, default to what cloudfront gives you
     * Which will be [randomstring].cloudfront.com
     *
     * @param {string} domainName  get an IHostedZone by search for the domain that it defines
     * @returns {DnsValidatedCertificate}
     */
    public sslCertificateLookup(domainName: string): DnsValidatedCertificate {
        const zone = HostedZone.fromLookup(this, "WordpressHostedZone", {
            domainName,
        });

        //Cert MUST exist in us-east-1
        const certificate = new DnsValidatedCertificate(this, "DistributionCertificate", {
            domainName: this.domainName,
            hostedZone: zone,
            region: "us-east-1",
        });

        return certificate;
    }

    public addBehavior(key: string, origin: IOrigin, options?: AddBehaviorOptions): Record<string, BehaviorOptions> {
        const behaviorOptions = {
            [key]: {
                origin: origin,
                originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
                allowedMethods: AllowedMethods.ALLOW_ALL,
                cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
        };

        return behaviorOptions;
    }

    public getCertificate() {
        return this.certificate;
    }
}
