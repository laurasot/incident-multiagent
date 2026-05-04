import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cdk from 'aws-cdk-lib';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { AgentEcrConstruct } from '../agent-ecr';
import { CognitoConstruct } from '../cognito';
import { GatewayConstruct } from '../gateway';

export interface AgentCoreConstructProps {
  environment: string;
  isProd: boolean;
  projectName: string;
  ecrConstruct: AgentEcrConstruct;
  cognitoConstruct: CognitoConstruct;
  gatewayConstruct: GatewayConstruct;
  cognitoUserPoolDomain: string;
  logLevel: string;
  secondaryModelId: string;
}

/**
 * AgentCore Runtime Construct
 * 
 * Creates:
 * 1. AgentCore Runtime with container image (3 Strands agents)
 * 2. AgentCore Memory (short-term conversational + long-term semantic)
 * 3. IAM role with necessary permissions
 * 4. Secrets Manager secret for Tavily API key
 * 5. CloudWatch log group
 * 6. SSM parameters for runtime and memory IDs
 */
export class AgentCoreConstruct extends Construct {
  public readonly runtime: bedrockagentcore.CfnRuntime;
  public readonly runtimeArn: string;
  public readonly runtimeId: string;
  public readonly shortTermMemory: bedrockagentcore.CfnMemory;
  public readonly longTermIncidentsMemory: bedrockagentcore.CfnMemory;
  public readonly longTermResolutionsMemory: bedrockagentcore.CfnMemory;
  public readonly tavilyApiKeySecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: AgentCoreConstructProps) {
    super(scope, id);

    const {
      projectName,
      environment,
      isProd,
      ecrConstruct,
      cognitoConstruct,
      gatewayConstruct,
      cognitoUserPoolDomain,
      logLevel,
      secondaryModelId,
    } = props;
    
    const stack = Stack.of(this);

    // ────────────────────────────────────────────────────────────────────
    // 1. Secrets Manager - Tavily API Key
    // ────────────────────────────────────────────────────────────────────
    this.tavilyApiKeySecret = new secretsmanager.Secret(this, 'TavilyApiKeySecret', {
      secretName: `${projectName}/tavily-api-key-${environment}`,
      description: 'Tavily API key for web search agent',
      secretStringValue: cdk.SecretValue.unsafePlainText('valor_dummy'),
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // ────────────────────────────────────────────────────────────────────
    // 2. CloudWatch Log Group
    // ────────────────────────────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'RuntimeLogGroup', {
      logGroupName: `/aws/bedrock/agentcore/${projectName}-runtime-${environment}`,
      retention: isProd ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // ────────────────────────────────────────────────────────────────────
    // 3. IAM Role for AgentCore Runtime (single inline policy, Perimeter-style)
    // ────────────────────────────────────────────────────────────────────
    const runtimeAccessPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: 'ECRImageLayers',
          effect: iam.Effect.ALLOW,
          actions: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:BatchGetImage',
            'ecr:GetDownloadUrlForLayer',
          ],
          resources: [ecrConstruct.repository.repositoryArn],
        }),
        new iam.PolicyStatement({
          sid: 'CloudWatchLogs',
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:DescribeLogStreams',
            'logs:CreateLogGroup',
            'logs:DescribeLogGroups',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'ECRTokenAccess',
          effect: iam.Effect.ALLOW,
          actions: ['ecr:GetAuthorizationToken'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'CloudWatchAgentCoreMetrics',
          effect: iam.Effect.ALLOW,
          actions: ['cloudwatch:PutMetricData'],
          resources: ['*'],
          conditions: {
            StringEquals: { 'cloudwatch:namespace': 'bedrock-agentcore' },
          },
        }),
        new iam.PolicyStatement({
          sid: 'WorkloadAccessTokens',
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock-agentcore:GetWorkloadAccessToken',
            'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
            'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'BedrockModelInvoke',
          effect: iam.Effect.ALLOW,
          actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'AgentCoreMemory',
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:CreateMemory',
            'bedrock:GetMemory',
            'bedrock:UpdateMemory',
            'bedrock:DeleteMemory',
            'bedrock:ListMemories',
            'bedrock:InvokeMemory',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'GatewayOAuth2Token',
          effect: iam.Effect.ALLOW,
          actions: ['bedrock-agentcore:GetResourceOauth2Token'],
          resources: [
            `arn:aws:bedrock-agentcore:${stack.region}:${stack.account}:gateway/${gatewayConstruct.gatewayIdentifier}`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'CognitoDescribeGatewayClient',
          effect: iam.Effect.ALLOW,
          actions: ['cognito-idp:DescribeUserPoolClient'],
          resources: [cognitoConstruct.userPool.userPoolArn],
        }),
        new iam.PolicyStatement({
          sid: 'SSMGetGatewayUrl',
          effect: iam.Effect.ALLOW,
          actions: ['ssm:GetParameter'],
          resources: [
            `arn:aws:ssm:${stack.region}:${stack.account}:parameter/monitoragent/agentcore/gateway/gateway_url`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'SSMGetMemoryParams',
          effect: iam.Effect.ALLOW,
          actions: ['ssm:GetParameter'],
          resources: [
            `arn:aws:ssm:${stack.region}:${stack.account}:parameter/${projectName}/${environment}/memory/*`,
          ],
        }),
      ],
    });

    const runtimeRole = new iam.Role(this, 'RuntimeRole', {
      roleName: `${projectName}-runtime-role-${environment}`,
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'AgentCore Runtime execution role',
      inlinePolicies: {
        AgentCoreRuntimeAccess: runtimeAccessPolicy,
      },
    });

    // Secrets (includes KMS decrypt when secrets use CMK)
    this.tavilyApiKeySecret.grantRead(runtimeRole);
    cognitoConstruct.runtimeOAuth2Secret.grantRead(runtimeRole);
    cognitoConstruct.gatewayOAuth2Secret.grantRead(runtimeRole);

    // ────────────────────────────────────────────────────────────────────
    // 4. AgentCore Memory - Short-term (Conversational)
    // ────────────────────────────────────────────────────────────────────
    const memoryRole = this.createMemoryExecutionRole(
      `${projectName}-memory-execution-role-${environment}`
    );

    this.shortTermMemory = new bedrockagentcore.CfnMemory(this, 'ShortTermMemory', {
      name: this.sanitizeName(`short_term_memory_${environment}`, 'agent_memory'),
      eventExpiryDuration: 60,
      memoryExecutionRoleArn: memoryRole.roleArn,
      memoryStrategies: [
        {
          customMemoryStrategy: {
            name: 'ConversationalMemory',
            namespaces: ['/sessions/{sessionId}'],
            configuration: {
              semanticOverride: {
                extraction: {
                  appendToPrompt: 'Extract key incident details, AWS resources mentioned, and action items from the conversation.',
                  modelId: secondaryModelId,
                },
                consolidation: {
                  appendToPrompt: 'Consolidate incident information, maintaining timeline and resource relationships.',
                  modelId: secondaryModelId,
                },
              },
            },
          },
        },
      ],
    });

    // ────────────────────────────────────────────────────────────────────
    // 5. AgentCore Memory - Long-term (Semantic) for incidents
    // ────────────────────────────────────────────────────────────────────
    this.longTermIncidentsMemory = new bedrockagentcore.CfnMemory(this, 'LongTermIncidentsMemory', {
      name: this.sanitizeName(`incidents_memory_${environment}`, 'agent_memory'),
      eventExpiryDuration: 90,
      memoryExecutionRoleArn: memoryRole.roleArn,
      memoryStrategies: [
        {
          semanticMemoryStrategy: {
            name: 'IncidentKnowledge',
            namespaces: ['/incidents/{actorId}'],
          },
        },
      ],
    });

    // ────────────────────────────────────────────────────────────────────
    // 6. AgentCore Memory - Long-term (Semantic) for resolutions
    // ────────────────────────────────────────────────────────────────────
    this.longTermResolutionsMemory = new bedrockagentcore.CfnMemory(this, 'LongTermResolutionsMemory', {
      name: this.sanitizeName(`resolutions_memory_${environment}`, 'agent_memory'),
      eventExpiryDuration: 90,
      memoryExecutionRoleArn: memoryRole.roleArn,
      memoryStrategies: [
        {
          semanticMemoryStrategy: {
            name: 'ResolutionKnowledge',
            namespaces: ['/resolutions/{actorId}'],
          },
        },
      ],
    });

    // ────────────────────────────────────────────────────────────────────
    // 7. AgentCore Runtime
    // ────────────────────────────────────────────────────────────────────
    this.runtime = new bedrockagentcore.CfnRuntime(this, 'Runtime', {
      agentRuntimeName: this.sanitizeName(`supervisor_agent_${environment}`, 'agent_runtime', false),
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: ecrConstruct.imageUri,
        },
      },
      protocolConfiguration: 'HTTP',
      networkConfiguration: {
        networkMode: 'PUBLIC',
      },
      roleArn: runtimeRole.roleArn,
      // Match host_agent.yaml + frontend: Bearer Cognito JWT (not SigV4)
      authorizerConfiguration: {
        customJwtAuthorizer: {
          discoveryUrl: `https://cognito-idp.${stack.region}.amazonaws.com/${cognitoConstruct.userPoolId}/.well-known/openid-configuration`,
          allowedClients: [cognitoConstruct.webClientId],
        },
      },
      requestHeaderConfiguration: {
        requestHeaderAllowlist: ['X-Amzn-Bedrock-AgentCore-Runtime-Custom-Actorid'],
      },
      environmentVariables: {
        PROJECT_NAME: projectName,
        ENV_NAME: environment,
        USER_POOL_ID: cognitoConstruct.userPoolId,
        GATEWAY_CLIENT_ID: cognitoConstruct.gatewayClient.userPoolClientId,
        COGNITO_DOMAIN_PREFIX: cognitoUserPoolDomain,
      },
    });

    this.runtimeArn = this.runtime.attrAgentRuntimeArn;
    this.runtimeId = this.runtime.attrAgentRuntimeId;

    // Ensure runtime waits for image to be deployed to dedicated ECR repo
    this.runtime.node.addDependency(ecrConstruct.imageDeployment);

    // Create Runtime Endpoint
    new bedrockagentcore.CfnRuntimeEndpoint(this, 'RuntimeEndpoint', {
      agentRuntimeId: this.runtime.attrAgentRuntimeId,
      name: environment.toUpperCase(),
    });

    // ────────────────────────────────────────────────────────────────────
    // 8. CloudWatch Logs Delivery Configuration
    // ────────────────────────────────────────────────────────────────────
    // Configure delivery of runtime application logs to CloudWatch
    
    // Grant CloudWatch Logs delivery service permissions to write to log group
    logGroup.grant(
      new iam.ServicePrincipal('delivery.logs.amazonaws.com'),
      'logs:CreateLogStream',
      'logs:PutLogEvents'
    );

    // Delivery Source: Runtime application logs
    const appLogsSource = new logs.CfnDeliverySource(this, 'AppLogsDeliverySource', {
      name: `${projectName}-runtime-app-logs-${environment}`,
      logType: 'APPLICATION_LOGS',
      resourceArn: this.runtime.attrAgentRuntimeArn,
    });

    // Delivery Destination: CloudWatch Log Group
    const appLogsDestination = new logs.CfnDeliveryDestination(this, 'AppLogsDeliveryDestination', {
      name: `${projectName}-runtime-logs-dest-${environment}`,
      destinationResourceArn: logGroup.logGroupArn,
      deliveryDestinationType: 'CWL',
    });

    // Delivery: Connect source to destination
    const appLogsDelivery = new logs.CfnDelivery(this, 'AppLogsDelivery', {
      deliverySourceName: appLogsSource.name!,
      deliveryDestinationArn: appLogsDestination.attrArn,
    });

    // Ensure proper resource creation order
    appLogsDelivery.addDependency(appLogsSource);
    appLogsDelivery.addDependency(appLogsDestination);
    appLogsSource.node.addDependency(this.runtime);

    // ────────────────────────────────────────────────────────────────────
    // 9. SSM Parameters
    // ────────────────────────────────────────────────────────────────────
    new ssm.StringParameter(this, 'RuntimeIdParameter', {
      parameterName: `/${projectName}/${environment}/runtime/id`,
      stringValue: this.runtime.attrAgentRuntimeId,
      description: 'AgentCore Runtime ID',
    });

    new ssm.StringParameter(this, 'RuntimeArnParameter', {
      parameterName: `/${projectName}/${environment}/runtime/arn`,
      stringValue: this.runtime.attrAgentRuntimeArn,
      description: 'AgentCore Runtime ARN (for frontend)',
    });

    new ssm.StringParameter(this, 'ShortTermMemoryIdParameter', {
      parameterName: `/${projectName}/${environment}/memory/short-term/id`,
      stringValue: this.shortTermMemory.attrMemoryId,
      description: 'Short-term Memory ID',
    });

    new ssm.StringParameter(this, 'LongTermIncidentsMemoryIdParameter', {
      parameterName: `/${projectName}/${environment}/memory/long-term-incidents/id`,
      stringValue: this.longTermIncidentsMemory.attrMemoryId,
      description: 'Long-term Incidents Memory ID',
    });

    new ssm.StringParameter(this, 'LongTermResolutionsMemoryIdParameter', {
      parameterName: `/${projectName}/${environment}/memory/long-term-resolutions/id`,
      stringValue: this.longTermResolutionsMemory.attrMemoryId,
      description: 'Long-term Resolutions Memory ID',
    });
  }

  private sanitizeName(raw: string, fallback: string, toLower: boolean = true): string {
    let n = raw.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
    if (toLower) n = n.toLowerCase();
    if (n.length === 0) return fallback;
    if (!/^[a-zA-Z]/.test(n)) n = `a_${n}`;
    return n.slice(0, 48);
  }

  private createMemoryExecutionRole(roleId: string): iam.Role {
    return new iam.Role(this, roleId, {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'IAM role for AgentCore Memory execution',
      inlinePolicies: {
        MemoryExecutionPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'BedrockModelInvocation',
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              sid: 'LogStreamAccess',
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });
  }
}
