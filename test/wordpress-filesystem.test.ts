import { Vpc } from "aws-cdk-lib/aws-ec2";
import { WordpressFilesystem } from "../lib/wordpress-filesystem";
import { App, Stack } from "aws-cdk-lib";
import { Template, Capture, Match } from "aws-cdk-lib/assertions";

describe("Wordpress File System", () => {
    it("Should Create EFS Resources", function () {
        const stack = new Stack(new App(), "TestingStack");

        const vpc = new Vpc(stack, "TestVpc", { maxAzs: 1 });
        const filesystem = new WordpressFilesystem(stack, "Filesystem", { vpc });

        const template = Template.fromStack(stack);
        //------------- Asssertions
        template.hasResource("AWS::EFS::FileSystem", {});
        template.hasResource("AWS::EFS::AccessPoint", {});
        template.hasResource("AWS::EFS::MountTarget", {});
    });
});
