import { InstanceClass, InstanceSize, InstanceType, IConnectable, IVpc } from "aws-cdk-lib/aws-ec2";
import { Secret } from "aws-cdk-lib/aws-ecs";
import { DatabaseInstance, DatabaseInstanceEngine, IInstanceEngine, MariaDbEngineVersion } from "aws-cdk-lib/aws-rds";
import { RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";

export interface WordpressDatabaseProps {
    readonly vpc: IVpc;
    readonly databaseName?: string;
    readonly engine?: IInstanceEngine;
    readonly allocatedStorage?: number;
    readonly instanceType?: InstanceType;
    readonly removalPolicy?: RemovalPolicy;
}

export class WordpressDatabase extends Construct {
    public readonly environment: Record<string, string>;
    public readonly secrets: Record<string, Secret>;
    private readonly instance: DatabaseInstance;

    constructor(scope: Construct, id: string, props: WordpressDatabaseProps) {
        super(scope, id);

        const databaseName = props.databaseName ?? "wordpress";

        //Storing A Ref becuase this construct is meant to be used in our main wrapper
        this.instance = new DatabaseInstance(scope, "Database", {
            databaseName,
            vpc: props.vpc,
            engine:
                props.engine ??
                DatabaseInstanceEngine.mariaDb({
                    version: MariaDbEngineVersion.VER_10_5,
                }),
            allocatedStorage: props.allocatedStorage ?? 10,
            instanceType: props.instanceType ?? InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MICRO),
            deleteAutomatedBackups: props.removalPolicy === RemovalPolicy.DESTROY,
            removalPolicy: props.removalPolicy,
        });

        this.environment = {
            WORDPRESS_DB_NAME: databaseName,
        };

        this.secrets = {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            WORDPRESS_DB_HOST: Secret.fromSecretsManager(this.instance.secret!, "host"),
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            WORDPRESS_DB_USER: Secret.fromSecretsManager(this.instance.secret!, "username"),
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            WORDPRESS_DB_PASSWORD: Secret.fromSecretsManager(this.instance.secret!, "password"),
        };
    }

    public allowDefaultPortFrom(other: IConnectable, description?: string): void {
        this.instance.connections.allowDefaultPortFrom(other, description);
    }

    public getDatabaseEndpoint() {
        return this.instance.dbInstanceEndpointAddress;
    }
}
