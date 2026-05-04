import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import { ECRDeployment, DockerImageName } from 'cdk-ecr-deployment';
import * as path from 'path';
import { RemovalPolicy } from 'aws-cdk-lib';

export interface AgentEcrConstructProps {
  environment: string;
  isProd: boolean;
  projectName: string;
  /** Baked into the image as AWS_REGION / AWS_DEFAULT_REGION (must match stack region). */
  awsRegion: string;
  /** Baked into the image as LOG_LEVEL (aligns with AgentCore runtime env). */
  logLevel: string;
}

/**
 * Amazon ECR Construct for Agent Container Image
 * 
 * Creates:
 * 1. Dedicated ECR repository: {projectName}-agent-{environment}
 * 2. Docker image asset (built by CDK)
 * 3. ECR deployment to copy image from assets repo to dedicated repo with 'latest' tag
 * 
 * This matches the original project's architecture with a clean, dedicated ECR repo.
 */
export class AgentEcrConstruct extends Construct {
  public readonly repository: ecr.Repository;
  public readonly imageUri: string;
  public readonly ecrAsset: ecr_assets.DockerImageAsset;
  public readonly imageDeployment: ECRDeployment;

  constructor(scope: Construct, id: string, props: AgentEcrConstructProps) {
    super(scope, id);

    const { projectName, environment, isProd, awsRegion, logLevel } = props;

    // ────────────────────────────────────────────────────────────────────
    // 1. Create dedicated ECR Repository (IMMUTABLE for AgentCore caching)
    // ────────────────────────────────────────────────────────────────────
    this.repository = new ecr.Repository(this, 'AgentRepository', {
      repositoryName: `${projectName}-agent-${environment}`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteImages: !isProd,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
        },
      ],
    });

    // ────────────────────────────────────────────────────────────────────
    // 2. Build Docker image (published to CDK assets repo)
    // ────────────────────────────────────────────────────────────────────
    this.ecrAsset = new ecr_assets.DockerImageAsset(
      this,
      `${projectName}-agent-image-${environment}`,
      {
        directory: path.join(__dirname, '../../../src/agent'),
        platform: ecr_assets.Platform.LINUX_ARM64,
        buildArgs: {
          PYTHON_VERSION: '3.13',
          AWS_REGION: awsRegion,
          LOG_LEVEL: logLevel,
        },
      }
    );

    // ────────────────────────────────────────────────────────────────────
    // 3. Copy image from CDK assets repo to dedicated repo with unique tag
    //    (Using asset hash ensures immutability + AgentCore detects changes)
    // ────────────────────────────────────────────────────────────────────
    const imageTag = this.ecrAsset.assetHash;
    
    this.imageDeployment = new ECRDeployment(this, 'ImageDeployment', {
      src: new DockerImageName(this.ecrAsset.imageUri),
      dest: new DockerImageName(`${this.repository.repositoryUri}:${imageTag}`),
    });

    // Final image URI pointing to dedicated repo with immutable hash tag
    this.imageUri = `${this.repository.repositoryUri}:${imageTag}`;
  }
}
