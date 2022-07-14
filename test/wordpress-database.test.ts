import { WordpressDatabase } from "../lib/wordpress-database";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

describe("Wordpress DNS Construct", () => {
    test("Construct Should Produce A CDN, Hosted Zone, And A Records", () => {
        const app = new App();
        const stack = new Stack(app, "TestDnsStack");

        const vpc = new Vpc(stack, "TestVPC", { maxAzs: 1 });
        const database = new WordpressDatabase(stack, "TestDatabase", { vpc });

        //------------- Asssertions
        const template = Template.fromStack(stack);
        template.hasResource("AWS::RDS::DBInstance", {});
    });
});
