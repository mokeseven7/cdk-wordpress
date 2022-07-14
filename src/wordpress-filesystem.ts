import { IConnectable, IVpc } from "aws-cdk-lib/aws-ec2";
import { EfsVolumeConfiguration } from "aws-cdk-lib/aws-ecs";
import { FileSystem, PerformanceMode, LifecyclePolicy, ThroughputMode } from "aws-cdk-lib/aws-efs";
import { RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";

/**
 * The Properties of an EFS mount being used for a wordpress site. Must pass in a vpc
 */
export interface WordpressFilesystemProps {
    readonly vpc: IVpc;
    readonly name?: string;
    readonly removalPolicy?: RemovalPolicy;
}

export class WordpressFilesystem extends Construct {
    public readonly name: string;
    public readonly efsVolumeConfiguration: EfsVolumeConfiguration;

    //Store a ref to the resolved construct, so it can be access in the parent easily
    private readonly fileSystem: FileSystem;

    constructor(scope: Construct, id: string, props: WordpressFilesystemProps) {
        super(scope, id);

        this.fileSystem = new FileSystem(this, "FileSystem", {
            vpc: props.vpc,
            performanceMode: PerformanceMode.GENERAL_PURPOSE,
            lifecyclePolicy: LifecyclePolicy.AFTER_30_DAYS,
            throughputMode: ThroughputMode.BURSTING,
            encrypted: true,
            removalPolicy: props.removalPolicy,
        });

        const fileSystemAccessPoint = this.fileSystem.addAccessPoint("AccessPoint");

        this.name = props.name ?? "efs";

        this.efsVolumeConfiguration = {
            fileSystemId: this.fileSystem.fileSystemId,
            transitEncryption: "ENABLED",
            authorizationConfig: {
                accessPointId: fileSystemAccessPoint.accessPointId,
            },
        };
    }

    /**
     *
     * Alot of the CDK constructs have a "connections" property, through which the network connects to the resource can be managed
     * This is just a helper function that i've added to a few of the construct classes to reduce a few lines of code
     *
     * @param {IConnectable} -
     * @param {string} - A short description about what the port binding is for.
     */
    public allowDefaultPortFrom(other: IConnectable, description?: string): void {
        this.fileSystem.connections.allowDefaultPortFrom(other, description);
    }
}
