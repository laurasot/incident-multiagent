import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { RemovalPolicy, Annotations } from 'aws-cdk-lib';
import { CognitoConstruct } from '../cognito';

export interface GatewayConstructProps {
  environment: string;
  isProd: boolean;
  projectName: string;
  cognitoConstruct: CognitoConstruct;
}

/**
 * GatewayConstruct - Creates Bedrock AgentCore Gateway for MCP tool access
 * 
 * The Gateway allows agents to call external tools (CloudWatch Logs)
 * through MCP protocol using Smithy model definitions.
 */
export class GatewayConstruct extends Construct {
  public readonly gateway: bedrockagentcore.CfnGateway;
  public readonly gatewayTarget: bedrockagentcore.CfnGatewayTarget;
  public readonly gatewayIdentifier: string;
  public readonly gatewayUrl: string;
  public readonly smithyModelBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: GatewayConstructProps) {
    super(scope, id);

    const { environment, isProd, projectName, cognitoConstruct } = props;
    const region = cdk.Stack.of(this).region;
    const accountId = cdk.Aws.ACCOUNT_ID;

    // ────────────────────────────────────────────────────────────────────
    // 1. S3 Bucket for Smithy models
    // ────────────────────────────────────────────────────────────────────
    this.smithyModelBucket = new s3.Bucket(
      this,
      `${projectName}-SmithyModelBucket-${environment}`,
      {
        bucketName: `${projectName.toLowerCase()}-smithy-models-${environment}-${accountId}-v2`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        autoDeleteObjects: !isProd,
      }
    );

    // ────────────────────────────────────────────────────────────────────
    // 2. Deploy Smithy model to S3
    // ────────────────────────────────────────────────────────────────────
    const smithyModelDeployment = new s3deploy.BucketDeployment(
      this,
      `${projectName}-SmithyModelDeployment-${environment}`,
      {
        sources: [s3deploy.Source.asset('src/smithy')],
        destinationBucket: this.smithyModelBucket,
        destinationKeyPrefix: 'smithy-models/',
      }
    );

    // ────────────────────────────────────────────────────────────────────
    // 3. IAM Role for Gateway
    // ────────────────────────────────────────────────────────────────────
    const gatewayRole = new iam.Role(
      this,
      `${projectName}-GatewayRole-${environment}`,
      {
        assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
        description: 'IAM role for Bedrock AgentCore Gateway',
      }
    );

    // Gateway needs access to CloudWatch Logs
    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogsAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
          'logs:FilterLogEvents',
          'logs:GetLogEvents',
        ],
        resources: ['*'],
      })
    );

    // Gateway needs S3 access to read Smithy model
    gatewayRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'S3SmithyModelAccess',
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject'],
        resources: [`${this.smithyModelBucket.bucketArn}/smithy-models/*`],
      })
    );

    // ────────────────────────────────────────────────────────────────────
    // 4. Bedrock AgentCore Gateway
    // ────────────────────────────────────────────────────────────────────
    this.gateway = new bedrockagentcore.CfnGateway(
      this,
      `${projectName}-MonitoringGateway-${environment}`,
      {
        name: this.sanitizeGatewayName(`${projectName}-monitoring-gateway-${environment}`),
        description: 'Monitoring Gateway for CloudWatch Logs access',
        authorizerConfiguration: {
          customJwtAuthorizer: {
            discoveryUrl: `https://cognito-idp.${region}.amazonaws.com/${cognitoConstruct.userPoolId}/.well-known/openid-configuration`,
            allowedClients: [cognitoConstruct.gatewayClient.userPoolClientId],
          },
        },
        authorizerType: 'CUSTOM_JWT',
        protocolConfiguration: {
          mcp: {
            searchType: 'SEMANTIC',
          },
        },
        protocolType: 'MCP',
        roleArn: gatewayRole.roleArn,
      }
    );

    this.gatewayIdentifier = this.gateway.attrGatewayIdentifier;
    this.gatewayUrl = this.gateway.attrGatewayUrl;

    // ────────────────────────────────────────────────────────────────────
    // 5. Gateway Target pointing to Smithy model
    // ────────────────────────────────────────────────────────────────────
    this.gatewayTarget = new bedrockagentcore.CfnGatewayTarget(
      this,
      `${projectName}-MonitoringGatewayTarget-${environment}`,
      {
        name: this.sanitizeGatewayName(`${projectName}-monitoring-target-${environment}`),
        description: 'Monitoring Smithy Model Target',
        gatewayIdentifier: this.gateway.attrGatewayIdentifier,
        credentialProviderConfigurations: [
          {
            credentialProviderType: 'GATEWAY_IAM_ROLE',
          },
        ],
        targetConfiguration: {
          mcp: {
            smithyModel: {
              s3: {
                uri: `s3://${this.smithyModelBucket.bucketName}/smithy-models/monitoring-service.json`,
              },
            },
          },
        },
      }
    );

    // CRITICAL: GatewayTarget must wait for the S3 file to be deployed
    this.gatewayTarget.node.addDependency(smithyModelDeployment);

    Annotations.of(this).addInfoV2(
      'MonitoringGateway',
      'Gateway logs: use CloudWatch Log groups for Bedrock AgentCore (search /aws/bedrock-agentcore/); custom vendedlogs delivery is not configured.'
    );

    // ────────────────────────────────────────────────────────────────────
    // 6. SSM Parameters for Gateway info
    // ────────────────────────────────────────────────────────────────────
    new ssm.StringParameter(this, `${projectName}-GatewayUrlParameter-${environment}`, {
      parameterName: '/monitoragent/agentcore/gateway/gateway_url',
      stringValue: this.gateway.attrGatewayUrl,
      description: 'Monitoring Gateway URL',
    });

    new ssm.StringParameter(this, `${projectName}-GatewayIdentifierParameter-${environment}`, {
      parameterName: `/${projectName}/${environment}/gateway/identifier`,
      stringValue: this.gateway.attrGatewayIdentifier,
      description: 'Monitoring Gateway Identifier',
    });

    // ────────────────────────────────────────────────────────────────────
    // 7. Stack Outputs
    // ────────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'MonitoringGatewayArn', {
      value: this.gateway.attrGatewayArn,
      description: 'Monitoring Gateway ARN',
    });

    new cdk.CfnOutput(this, 'MonitoringGatewayId', {
      value: this.gateway.attrGatewayIdentifier,
      description: 'Monitoring Gateway ID',
    });

    new cdk.CfnOutput(this, 'MonitoringGatewayUrl', {
      value: this.gateway.attrGatewayUrl,
      description: 'Monitoring Gateway URL',
    });

    new cdk.CfnOutput(this, 'MonitoringGatewayLogsHint', {
      value: `Open AgentCore gateway in console > Observability, or CloudWatch Log groups prefixed /aws/bedrock-agentcore/ (gateway id: ${this.gateway.attrGatewayIdentifier})`,
      description: 'Where to find gateway logs (standard AgentCore log groups only)',
    });
  }

  /**
   * Gateway names must match ^([0-9a-zA-Z][-]?){1,100}$ (max 100 chars, allows hyphens, NO underscores).
   */
  private sanitizeGatewayName(raw: string): string {
    let n = raw.replace(/_/g, '-').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    // Remove consecutive hyphens
    n = n.replace(/-+/g, '-');
    // Remove leading/trailing hyphens
    n = n.replace(/^-+|-+$/g, '');
    if (n.length === 0) {
      return 'monitoring-gateway';
    }
    if (!/^[a-zA-Z0-9]/.test(n)) {
      n = `g-${n}`;
    }
    return n.slice(0, 100);
  }
}
