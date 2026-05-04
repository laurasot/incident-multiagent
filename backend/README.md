# Multi-Agent Incident Response System

AWS multi-agent incident response system using **Amazon Bedrock AgentCore** and **Strands Agents SDK**.

## Architecture

Single AgentCore Runtime with 3 Strands agents:

- **Supervisor Agent** (Claude Sonnet 3.5) - Orchestrator with memory
- **Monitoring Agent** (Claude Haiku 3.5) - CloudWatch via Gateway MCP
- **WebSearch Agent** (Claude Haiku 3.5) - Tavily API

## Prerequisites

- Node.js 22+ and npm
- Python 3.13+
- AWS CLI configured
- AWS Account with:
  - Bedrock model access (Claude Sonnet 3.5, Claude Haiku 3.5)
  - AgentCore enabled
  - IAM permissions for CDK deployment
- Tavily API key ([Get one here](https://tavily.com))

## Quick Start

### 1. Install Dependencies

```bash
# CDK dependencies
npm install

# Python agent dependencies (for local development)
cd src/agent
python3.13 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
ENV_NAME=dev
PROJECT_NAME=incident-response
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-west-2
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_USER_POOL_DOMAIN=incident-response-m2m-dev
```

### 3. Deploy Infrastructure

```bash
# Bootstrap CDK (first time only)
npx cdk bootstrap

# Synthesize CloudFormation template
npm run synth

# Deploy stack
npm run deploy
```

### 4. Get Stack Outputs

After deployment, note these outputs for the frontend:

- `RuntimeArn` - For frontend `VITE_AGENT_ARN`
- `UserPoolId` - For frontend Cognito config
- `UserPoolClientId` - For frontend Cognito config

## Project Structure

```
plantilla_cdk/
├── bin/
│   └── incident-response.ts          # CDK app entry point
├── lib/
│   ├── stack/
│   │   └── incident-response-stack.ts # Main stack
│   └── construct/
│       ├── agent-ecr/                 # ECR for container
│       ├── cognito/                   # User Pool + OAuth2
│       ├── gateway/                   # AgentCore Gateway (MCP)
│       └── agentcore/                 # Runtime + Memory
├── src/
│   ├── agent/
│   │   ├── supervisor/                # Supervisor agent
│   │   ├── monitoring/                # Monitoring agent
│   │   ├── websearch/                 # Web search agent
│   │   ├── common/                    # Shared utilities
│   │   ├── handler.py                 # Entry point
│   │   ├── requirements.txt           # Python deps
│   │   └── Dockerfile                 # Container image
│   └── smithy/
│       └── monitoring-service.json    # Gateway Smithy model
├── config/
│   └── env-config.ts                  # Environment config
├── package.json
├── cdk.json
└── .env
```

## Key Features

- **Unified Framework**: All agents use Strands (no Google ADK, no OpenAI Agents SDK)
- **Single Runtime**: One AgentCore runtime for all 3 agents
- **Centralized Memory**: Supervisor maintains short-term + long-term semantic memory
- **Gateway MCP**: Monitoring agent accesses CloudWatch via Smithy-defined tools
- **Transfer Events**: Frontend receives visual feedback when delegating to sub-agents
- **Security Best Practices**: Secrets Manager for API keys, least privilege IAM, no hardcoded values

## Development

### Local Testing

```bash
# Test agents locally (requires AWS credentials)
cd src/agent
source venv/bin/activate
python handler.py
```

### Build Container Locally

```bash
cd src/agent
docker build -t incident-response-agent .
docker run -e AWS_REGION=us-west-2 incident-response-agent
```

### Update Agents

After modifying agent code:

```bash
npm run deploy  # CDK will rebuild and push new container image
```

## Observability

All runtime logs go to CloudWatch Logs:

```
/aws/bedrock/agentcore/incident-response-runtime-{env}
```

View logs:

```bash
aws logs tail /aws/bedrock/agentcore/incident-response-runtime-dev --follow
```

## Secrets Management

Secrets are stored in AWS Secrets Manager:

- `/incident-response/runtime/oauth2-config-{env}` - Runtime OAuth2 credentials
- `/incident-response/gateway/oauth2-config-{env}` - Gateway OAuth2 credentials
- `/incident-response/tavily-api-key-{env}` - Tavily API key

## Clean Up

```bash
npm run destroy
```

This will delete all resources (except retained secrets if `ENV_NAME=prod`).

## Cost Estimation

Approximate monthly costs (us-west-2, dev environment):

- AgentCore Runtime: ~$100-200/month (based on usage)
- Bedrock model invocations: ~$20-100/month (varies by usage)
- Cognito: Free tier (up to 50K MAU)
- CloudWatch Logs: ~$5-10/month
- S3, SSM, Secrets Manager: < $5/month

**Total: ~$130-320/month** for dev environment with moderate usage.

## Troubleshooting

### Deployment Fails

1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify Bedrock model access in AWS console
3. Check CDK bootstrap: `npx cdk bootstrap`

### Agent Not Responding

1. Check CloudWatch logs for errors
2. Verify environment variables in Runtime
3. Check IAM role permissions

### Gateway MCP Errors

1. Verify Smithy model uploaded to S3
2. Check Gateway OAuth2 credentials in Secrets Manager
3. Verify Gateway IAM role has CloudWatch permissions

## Contributing

Follow the coding standards in `.cursor/rules/rules.mdc`:

- Descriptive, self-explanatory names
- No hardcoded values
- Least privilege IAM policies
- Python PEP 8 style
- Type hints required
- Structured logging

## License

Proprietary
