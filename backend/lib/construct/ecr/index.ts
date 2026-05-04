import { Construct } from 'constructs/lib/construct';
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets'
import * as path from 'path';

export interface ECRConstructProps {
  environment: string;
  isProd: boolean;
  projectName: string;
}

export class ECRConstruct extends Construct {
    public readonly ecrAsset: ecr_assets.DockerImageAsset;
    // public readonly ecrRepository: ecr.Repository;

    constructor(scope: Construct, id: string, props: ECRConstructProps) {
        super(scope, id);

        const { projectName, environment } = props;

        // this.ecrRepository = new ecr.Repository(this, "AgentRepository", {
        //     repositoryName: `${projectName}-agentcore-agent-repo-${environment}`
        // });

        this.ecrAsset = new ecr_assets.DockerImageAsset(
            this,
            `${projectName}-AgentCoreImage-${environment}`,
            {
                directory: path.join(__dirname, "../../../src/agentcore/asicom-agent"),
                platform: ecr_assets.Platform.LINUX_ARM64
            }
        );
    }
}