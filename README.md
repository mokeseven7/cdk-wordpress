# Wordpress CDK Construct

[![Node Package CI](https://github.com/APGTeam/cdk-wordpress/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/APGTeam/cdk-wordpress/actions/workflows/publish.yml)

This is a Level Three (L3) wrapper construct for the AWS CDK. It represents all the resources needed to deploy a container running wordpress to ECS via Fargate.

## Goals

The code contained in this repository aims to assist in the creation of a repeatable, and cost effective way to create wordpress sites. The infrastructure created by this construct follows best practices from the well artictected examples for each respective resource.

For more information on the CDK, as well as patterns used in this repo, please see the [References And Documentation](##-references-and-documentation) section, near the bottom of this readme.

## General Information

The following construct is a wrapper component, representing all of the required resources for a wordpress installation to run. This includes:

-   Elastic Container Registry (ECS) -
-   ECS Fargate
-   RDS Database
-   EFS Persistent filesystem

The above resources are represented using the AWS CDK, and the main wrapper component is distributed via an NPM package which is built using a github runner. (See .github/workflows/publish.yml for details)

## Usage

To use this construct in an existing stack, you may follow the directions below to install it as an NPM module. If you would like to alter the construct code itself, see [Development](##-development)

> Note: The package is private so you will need to authenticate with github via SSH bofore installing the package. There are instructions on how to do so for both the usage and development contexts in each respective section.

### Installation

Before you can install the NPM package, you'll have to tell your local machine how to authenticate against github. This can be done by adding an ".npmrc" file to the root directory of your project:

```zsh
$ touch .npmrc && vim .npmrc
```

Once you have the file, add the following contents, substituting in your personal access token from github as the value in the authToken key/value pair.

```zsh
# Create or Append to a file named .npmrc
//npm.pkg.github.com/:_authToken=ghp_123xxx
```

Next, login to npm with the shell you'll be running npm install with, ensuring to pass the @<organization> scope:

```zsh
# Login to NPM passing the org scope if applicable
$ npm login —registry=https://npm.pkg.github.com —scope=@yourscope
```

You will be prestend wit a few login prompts. Enter your normal github login credentials.

```zsh
# Still under heavy development, for now just use the next tag
$ npm install @mokeseven7/cdk-wordpress@latest
```

For more details on the package, [see the package page](TODO) in the github registry

### Using In A Stack

The below example assumes you are using the construct in a stack, The wrapper class stack can be named anything you want

```typescript
import { Wordpress } from "../lib/wordpress";
import { App, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { PublicHostedZone } from "aws-cdk-lib/aws-route53";

export class WordpressWrapperStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        const hostedZone = PublicHostedZone.fromLookup(this, "HostedZone", {
            domainName: "<example.com>",
        });

        new Wordpress(this, "Wordpress", {
            domainName: "blog.<example>.com",
            domainZone: hostedZone,
            removalPolicy: RemovalPolicy.DESTROY,
            offloadStaticContent: true,
        });
    }
}
```

When ready to deploy, use the normal cdk commands

```console
$ cdk synth
```

```console
$ cdk deploy
```

## Development

If you would like to develop/build this package locally, start by either cloning or forking the repository:

```bash
$ git clone <repo_url>
```

```bash
$ cd cdk-wordpress
```

Build The project

```bash
npm run build
```

Run The Tests:

```bash
npm run test
```

## References and Documenation

**Section References:**

> -   [Construct best practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html#best-practices-constructs)
>
> -   [Aws CDK Concepts](https://docs.aws.amazon.com/cdk/v2/guide/core_concepts.html)
>
> -   [CDK Patterns/Well Architected](https://cdkpatterns.com/patterns/well-architected/)
