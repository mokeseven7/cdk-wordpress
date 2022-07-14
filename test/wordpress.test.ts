import { Wordpress } from "../lib/wordpress";
import { App, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { PublicHostedZone } from "aws-cdk-lib/aws-route53";

describe("Wordpress DNS Construct", () => {
    test("Construct Should Produce A CDN, Hosted Zone, And A Records", () => {
        const env = { account: "2383838383", region: "eu-west-1" };

        const app = new App();
        const stack = new Stack(app, "TestWordpressStack", { env });

        /**
         * Setup Constructs
         */
        const hostedZone = PublicHostedZone.fromLookup(stack, "HostedZone", {
            domainName: "example.org",
        });

        new Wordpress(stack, "Wordpress", {
            domainName: "blog.example.org",
            domainZone: hostedZone,
            removalPolicy: RemovalPolicy.DESTROY,
            offloadStaticContent: true, // Support for plugin e.g. `WP Offload Media for Amazon S3`
        });

        //------------- Asssertions
        const template = Template.fromStack(stack);

        template.hasResource("AWS::ECS::Service", {});
        template.hasResource("AWS::ECS::TaskDefinition", {});
        template.hasResource("AWS::ElasticLoadBalancingV2::LoadBalancer", {});
    });
});
