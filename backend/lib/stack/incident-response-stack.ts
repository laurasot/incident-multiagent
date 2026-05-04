import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ParamsConfig } from '../../config/env-config';
import { AgentEcrConstruct } from '../construct/agent-ecr';
import { CognitoConstruct } from '../construct/cognito';
import { AgentCoreConstruct } from '../construct/agentcore';
import { GatewayConstruct } from '../construct/gateway';

interface IncidentResponseStackProps extends cdk.StackProps {
  params: ParamsConfig;
}

/**
 * Multi-Agent Incident Response System Stack
 * 
 * Architecture:
 * - Single AgentCore Runtime with 3 Strands agents:
 *   - Supervisor Agent (stateful, orchestrator)
 *   - Monitoring Agent (stateless, CloudWatch via Gateway MCP)
 *   - WebSearch Agent (stateless, Tavily API)
 * 
 * Infrastructure:
 * - Amazon ECR: Agent Docker image
 * - Amazon Cognito: User authentication (frontend JWT) + M2M OAuth2 (Gateway)
 * - AgentCore Runtime: Managed agent execution environment
 * - AgentCore Gateway: MCP protocol for CloudWatch access
 * - AgentCore Memory: Short-term conversational + long-term semantic
 * - AWS Secrets Manager: API keys and OAuth2 credentials
 * - AWS Systems Manager Parameter Store: Runtime/Gateway IDs
 * - Amazon S3: Smithy model for Gateway tools
 * - CloudWatch Logs: Centralized observability
 */
export class IncidentResponseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IncidentResponseStackProps) {
    super(scope, id, props);

    const { params } = props;
    const {
      envName,
      projectName,
      isProd,
      cognitoUserPoolDomain,
      logLevel,
      awsRegion,
      secondaryModelId,
    } = params;

    // ────────────────────────────────────────────────────────────────────
    // 1. ECR Repository for Agent Container
    // ────────────────────────────────────────────────────────────────────
    const ecrConstruct = new AgentEcrConstruct(this, 'AgentEcrConstruct', {
      environment: envName,
      isProd,
      projectName,
      awsRegion,
      logLevel,
    });

    // ────────────────────────────────────────────────────────────────────
    // 2. Cognito User Pool for Authentication
    //    - User Pool: Frontend user authentication (JWT)
    //    - M2M Clients: OAuth2 for Runtime and Gateway
    // ────────────────────────────────────────────────────────────────────
    const cognitoConstruct = new CognitoConstruct(this, 'CognitoConstruct', {
      environment: envName,
      isProd,
      projectName,
      userPoolDomain: cognitoUserPoolDomain,
    });

    // ────────────────────────────────────────────────────────────────────
    // 3. AgentCore Gateway (MCP Protocol for CloudWatch Access)
    //    - Gateway resource for monitoring agent
    //    - Smithy model defining CloudWatch tools
    //    - OAuth2 credential provider for authentication
    // ────────────────────────────────────────────────────────────────────
    const gatewayConstruct = new GatewayConstruct(this, 'GatewayConstruct', {
      environment: envName,
      isProd,
      projectName,
      cognitoConstruct,
    });

    // ────────────────────────────────────────────────────────────────────
    // 4. AgentCore Runtime with 3 Strands Agents
    //    - Supervisor Agent (Claude Sonnet 3.5) - orchestrator, stateful
    //    - Monitoring Agent (Claude Haiku 3.5) - CloudWatch, stateless
    //    - WebSearch Agent (Claude Haiku 3.5) - Tavily, stateless
    // ────────────────────────────────────────────────────────────────────
    const agentCoreConstruct = new AgentCoreConstruct(this, 'AgentCoreConstruct', {
      environment: envName,
      isProd,
      projectName,
      ecrConstruct,
      cognitoConstruct,
      gatewayConstruct,
      cognitoUserPoolDomain,
      logLevel,
      secondaryModelId,
    });

    // Ensure Gateway is created before AgentCore Runtime
    agentCoreConstruct.node.addDependency(gatewayConstruct);

    // ────────────────────────────────────────────────────────────────────
    // Stack Outputs
    // ────────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'RuntimeArn', {
      value: agentCoreConstruct.runtimeArn,
      description: 'AgentCore Runtime ARN (for frontend VITE_AGENT_ARN)',
      exportName: `${projectName}-runtime-arn-${envName}`,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: cognitoConstruct.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${projectName}-user-pool-id-${envName}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: cognitoConstruct.webClientId,
      description: 'Cognito Web Client ID (for frontend)',
      exportName: `${projectName}-web-client-id-${envName}`,
    });

    new cdk.CfnOutput(this, 'GatewayId', {
      value: gatewayConstruct.gatewayIdentifier,
      description: 'AgentCore Gateway ID',
      exportName: `${projectName}-gateway-id-${envName}`,
    });
  }
}
