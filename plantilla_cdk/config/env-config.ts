import * as dotenv from 'dotenv';

export interface EnvironmentConfig {
  account?: string;
  region?: string;
}

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;

export interface ParamsConfig {
  envName: string;
  projectName: string;
  isProd: boolean;
  awsAccount: string;
  awsRegion: string;
  tavilyApiKey: string;
  cognitoUserPoolDomain: string;
  /** Python logging level for the agent runtime (forward as env LOG_LEVEL on AgentCore). */
  logLevel: string;
}

export interface AppConfig {
  env: EnvironmentConfig;
  params: ParamsConfig;
}

export function loadEnvironment(): AppConfig {
  dotenv.config();

  if (!process.env.ENV_NAME || !process.env.PROJECT_NAME) {
    console.error('Error: Required environment variables (ENV_NAME or PROJECT_NAME) are not defined');
    process.exit(1);
  }

  if (!process.env.TAVILY_API_KEY) {
    console.error('Error: TAVILY_API_KEY environment variable is required');
    process.exit(1);
  }

  const rawLog = (process.env.LOG_LEVEL ?? 'INFO').trim().toUpperCase();
  const normalizedLog = rawLog === 'WARN' ? 'WARNING' : rawLog;
  if (!LOG_LEVELS.includes(normalizedLog as (typeof LOG_LEVELS)[number])) {
    console.error(
      `Error: LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')} or WARN (got "${process.env.LOG_LEVEL}")`,
    );
    process.exit(1);
  }

  const env: EnvironmentConfig = {
    account: process.env.AWS_ACCOUNT_ID,
    region: process.env.AWS_REGION || 'us-west-2',
  };

  const params: ParamsConfig = {
    envName: process.env.ENV_NAME,
    projectName: process.env.PROJECT_NAME,
    isProd: process.env.ENV_NAME === 'prod',
    awsAccount: process.env.AWS_ACCOUNT_ID || '',
    awsRegion: process.env.AWS_REGION || 'us-west-2',
    tavilyApiKey: process.env.TAVILY_API_KEY,
    cognitoUserPoolDomain: process.env.COGNITO_USER_POOL_DOMAIN || `${process.env.PROJECT_NAME}-m2m-${process.env.ENV_NAME}`,
    logLevel: normalizedLog,
  };

  return { env, params };
}

export const config: AppConfig = loadEnvironment();
