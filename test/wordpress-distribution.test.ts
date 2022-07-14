import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Certificate, DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import { WorpdressDistribution } from "../src";
import { FakeCloudfront } from "./../src/integ.default";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

describe("Wordpress Distrubution Should Be Created", () => {
    const app = new App();
    const env = {
        account: "1234567890",
        region: "us-east-1",
    };

    const stack = new Stack(app, "TestWordpressDistributionStack", { env });

    test("Construct Should Produce A CDN, Hosted Zone, And A Records", () => {
        // //Setup Deps for the wordpress distrubution construct.

        const { origin, domainZone, domainName, certificate } = new FakeCloudfront(stack);

        const wodpressDistribution = new WorpdressDistribution(stack, "WordpressDistrubutionMock", { domainName, domainZone, origin, certificate });

        // //Make a cloudformation template instance
        const template = Template.fromStack(stack);
        console.log(template.toJSON());
        // //------------- Asssertions
        template.hasResource("AWS::CloudFront::Distribution", {});
        template.hasResource("AWS::CloudFront::OriginRequestPolicy", {});
        template.hasResource("AWS::ElasticLoadBalancingV2::LoadBalancer", {});
    });
});
