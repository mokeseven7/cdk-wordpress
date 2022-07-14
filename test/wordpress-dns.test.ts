import { Vpc } from "aws-cdk-lib/aws-ec2";
import { LoadBalancerV2Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { App, Stack } from "aws-cdk-lib";
import { WordpressDns } from "./../lib/wordpress-dns";
import { Template } from "aws-cdk-lib/assertions";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import { HostedZone } from "aws-cdk-lib/aws-route53";

import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
describe("DNS Related Entitites", () => {
    const app = new App();
    const env = {
        account: "1234567890",
        region: "us-east-1",
    };
    const stack = new Stack(app, "TestDnsStack", { env });

    it("Should be able to create an instance of WordpressDns Construct", () => {
        const domainName = "test.example.com";

        const loadBalancer = new ApplicationLoadBalancer(stack, "Loadbalancer", {
            vpc: new Vpc(stack, "TestVpc"),
        });

        const origin = new LoadBalancerV2Origin(loadBalancer);
        const domainZone = new HostedZone(stack, "TestDomainZone", {
            zoneName: "TestZone",
        });

        const distribution = new Distribution(stack, "TestDistro", {
            defaultBehavior: {
                origin,
            },
        });

        const construct = new WordpressDns(stack, "WordpressDNSTest", {
            domainName,
            domainZone,
            distribution,
        });

        const template = Template.fromStack(stack);

        //------------- Asssertions
        template.hasResource("AWS::CloudFront::Distribution", {});
        template.hasResource("AWS::Route53::HostedZone", {});
        template.hasResource("AWS::Route53::RecordSet", {});
        template.resourceCountIs("AWS::Route53::RecordSet", 2);
    });
});
