import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy, Duration, CustomResource } from 'aws-cdk-lib';

export interface CognitoConstructProps {
  environment: string;
  isProd: boolean;
  projectName: string;
  userPoolDomain: string;
}

/**
 * Amazon Cognito User Pool Construct
 * 
 * Creates:
 * 1. User Pool for frontend authentication (JWT)
 * 2. Web Client (public, PKCE flow)
 * 3. M2M Runtime Client (OAuth2 client_credentials for AgentCore)
 * 4. M2M Gateway Client (OAuth2 client_credentials for Gateway)
 * 5. Resource Server with custom scopes
 * 6. Secrets Manager secrets with OAuth2 credentials
 */
export class CognitoConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolId: string;
  public readonly webClient: cognito.UserPoolClient;
  public readonly webClientId: string;
  public readonly runtimeClient: cognito.UserPoolClient;
  public readonly gatewayClient: cognito.UserPoolClient;
  public readonly runtimeOAuth2Secret: secretsmanager.Secret;
  public readonly gatewayOAuth2Secret: secretsmanager.Secret;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: CognitoConstructProps) {
    super(scope, id);

    const { projectName, environment, isProd, userPoolDomain: domainPrefix } = props;
    const region = cdk.Stack.of(this).region;

    // ────────────────────────────────────────────────────────────────────
    // 1. User Pool
    // ────────────────────────────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${projectName}-user-pool-${environment}`,
      selfSignUpEnabled: false, // Admin-created users only
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.userPoolId = this.userPool.userPoolId;

    // ────────────────────────────────────────────────────────────────────
    // 2. User Pool Domain
    // ────────────────────────────────────────────────────────────────────
    this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix,
      },
    });

    // ────────────────────────────────────────────────────────────────────
    // 3. Resource Server with custom scopes
    // ────────────────────────────────────────────────────────────────────
    const readScope: cognito.ResourceServerScope = {
      scopeName: 'read',
      scopeDescription: 'Read access to resources',
    };
    
    const writeScope: cognito.ResourceServerScope = {
      scopeName: 'write',
      scopeDescription: 'Write access to resources',
    };
    
    const runtimeScope: cognito.ResourceServerScope = {
      scopeName: 'runtime',
      scopeDescription: 'AgentCore runtime access',
    };
    
    const gatewayScope: cognito.ResourceServerScope = {
      scopeName: 'gateway',
      scopeDescription: 'AgentCore gateway access',
    };

    const resourceServer = new cognito.UserPoolResourceServer(this, 'ResourceServer', {
      userPool: this.userPool,
      identifier: `${projectName}-resource-server`,
      userPoolResourceServerName: `${projectName} Resource Server`,
      scopes: [readScope, writeScope, runtimeScope, gatewayScope],
    });

    // ────────────────────────────────────────────────────────────────────
    // 4. Web Client (Public Client - PKCE flow for frontend)
    // ────────────────────────────────────────────────────────────────────
    this.webClient = new cognito.UserPoolClient(this, 'WebClient', {
      userPool: this.userPool,
      userPoolClientName: 'web-client',
      generateSecret: false, // Public client (no secret)
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.resourceServer(resourceServer, readScope),
          cognito.OAuthScope.resourceServer(resourceServer, writeScope),
        ],
        callbackUrls: [
          'http://localhost:5173/',
          'http://localhost:5173/callback',
          'https://localhost:5173/',
        ],
        logoutUrls: [
          'http://localhost:5173/',
          'https://localhost:5173/',
        ],
      },
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });

    this.webClientId = this.webClient.userPoolClientId;

    // ────────────────────────────────────────────────────────────────────
    // 5. Runtime M2M Client (OAuth2 client_credentials)
    // ────────────────────────────────────────────────────────────────────
    this.runtimeClient = new cognito.UserPoolClient(this, 'RuntimeClient', {
      userPool: this.userPool,
      userPoolClientName: 'runtime-client',
      generateSecret: true, // Confidential client
      authFlows: {
        custom: false,
      },
      oAuth: {
        flows: {
          clientCredentials: true,
        },
        scopes: [
          cognito.OAuthScope.resourceServer(resourceServer, readScope),
          cognito.OAuthScope.resourceServer(resourceServer, writeScope),
          cognito.OAuthScope.resourceServer(resourceServer, runtimeScope),
        ],
      },
      accessTokenValidity: Duration.hours(1),
      preventUserExistenceErrors: true,
    });

    // ────────────────────────────────────────────────────────────────────
    // 6. Gateway M2M Client (OAuth2 client_credentials)
    // ────────────────────────────────────────────────────────────────────
    this.gatewayClient = new cognito.UserPoolClient(this, 'GatewayClient', {
      userPool: this.userPool,
      userPoolClientName: 'gateway-client',
      generateSecret: true, // Confidential client
      authFlows: {
        custom: false,
      },
      oAuth: {
        flows: {
          clientCredentials: true,
        },
        scopes: [
          cognito.OAuthScope.resourceServer(resourceServer, readScope),
          cognito.OAuthScope.resourceServer(resourceServer, gatewayScope),
        ],
      },
      accessTokenValidity: Duration.hours(1),
      preventUserExistenceErrors: true,
    });

    // ────────────────────────────────────────────────────────────────────
    // 7. Secrets Manager - Runtime OAuth2 credentials
    // ────────────────────────────────────────────────────────────────────
    this.runtimeOAuth2Secret = new secretsmanager.Secret(this, 'RuntimeOAuth2Secret', {
      secretName: `${projectName}/runtime/oauth2-config-${environment}`,
      description: 'AgentCore Runtime OAuth2 credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          client_id: this.runtimeClient.userPoolClientId,
          user_pool_id: this.userPool.userPoolId,
          token_endpoint: `https://${domainPrefix}.auth.${region}.amazoncognito.com/oauth2/token`,
          discovery_url: `https://cognito-idp.${region}.amazonaws.com/${this.userPool.userPoolId}/.well-known/openid-configuration`,
        }),
        generateStringKey: 'client_secret',
      },
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // ────────────────────────────────────────────────────────────────────
    // 8. Secrets Manager - Gateway OAuth2 credentials
    // ────────────────────────────────────────────────────────────────────
    this.gatewayOAuth2Secret = new secretsmanager.Secret(this, 'GatewayOAuth2Secret', {
      secretName: `${projectName}/gateway/oauth2-config-${environment}`,
      description: 'AgentCore Gateway OAuth2 credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          client_id: this.gatewayClient.userPoolClientId,
          user_pool_id: this.userPool.userPoolId,
          token_endpoint: `https://${domainPrefix}.auth.${region}.amazoncognito.com/oauth2/token`,
          discovery_url: `https://cognito-idp.${region}.amazonaws.com/${this.userPool.userPoolId}/.well-known/openid-configuration`,
        }),
        generateStringKey: 'client_secret',
      },
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // ────────────────────────────────────────────────────────────────────
    // 9. Custom Resource Lambda to extract client_secret
    // ────────────────────────────────────────────────────────────────────
    const secretExtractorRole = new iam.Role(this, 'SecretExtractorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    secretExtractorRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:DescribeUserPoolClient'],
        resources: [this.userPool.userPoolArn],
      })
    );

    secretExtractorRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:UpdateSecret', 'secretsmanager:GetSecretValue'],
        resources: [
          this.runtimeOAuth2Secret.secretArn,
          this.gatewayOAuth2Secret.secretArn,
        ],
      })
    );

    const secretExtractorLambda = new lambda.Function(this, 'SecretExtractorLambda', {
      functionName: `${projectName}-cognito-secret-extractor-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      role: secretExtractorRole,
      timeout: Duration.seconds(60),
      code: lambda.Code.fromInline(`
import json
import boto3
import urllib3

def lambda_handler(event, context):
    try:
        print(f"Received event: {json.dumps(event)}")
        
        request_type = event['RequestType']
        if request_type == 'Delete':
            send_response(event, context, 'SUCCESS', {})
            return
        
        properties = event['ResourceProperties']
        user_pool_id = properties['UserPoolId']
        client_id = properties['ClientId']
        secret_arn = properties['SecretArn']
        client_type = properties['ClientType']
        
        cognito_client = boto3.client('cognito-idp')
        secrets_client = boto3.client('secretsmanager')
        
        response = cognito_client.describe_user_pool_client(
            UserPoolId=user_pool_id,
            ClientId=client_id
        )
        
        user_pool_client = response['UserPoolClient']
        
        if 'ClientSecret' in user_pool_client:
            client_secret = user_pool_client['ClientSecret']
            
            secret_response = secrets_client.get_secret_value(SecretId=secret_arn)
            secret_data = json.loads(secret_response['SecretString'])
            secret_data['client_secret'] = client_secret
            
            secrets_client.update_secret(
                SecretId=secret_arn,
                SecretString=json.dumps(secret_data, indent=2)
            )
            
            print(f"Successfully updated {client_type} client secret")
            send_response(event, context, 'SUCCESS', {'ClientSecretUpdated': 'true'})
        else:
            print(f"{client_type} is a public client (no secret)")
            send_response(event, context, 'SUCCESS', {'ClientSecretUpdated': 'false'})
            
    except Exception as e:
        print(f"Error: {str(e)}")
        send_response(event, context, 'FAILED', {'Error': str(e)})

def send_response(event, context, response_status, response_data):
    response_body = {
        'Status': response_status,
        'Reason': f'See CloudWatch Log Stream: {context.log_stream_name}',
        'PhysicalResourceId': context.log_stream_name,
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'Data': response_data
    }
    
    json_response_body = json.dumps(response_body)
    
    headers = {
        'content-type': '',
        'content-length': str(len(json_response_body))
    }
    
    http = urllib3.PoolManager()
    response = http.request('PUT', event['ResponseURL'], body=json_response_body, headers=headers)
    print(f"Response status: {response.status}")
`),
    });

    // Custom Resource for Runtime Client
    new CustomResource(this, 'RuntimeSecretUpdater', {
      serviceToken: secretExtractorLambda.functionArn,
      properties: {
        UserPoolId: this.userPool.userPoolId,
        ClientId: this.runtimeClient.userPoolClientId,
        SecretArn: this.runtimeOAuth2Secret.secretArn,
        ClientType: 'Runtime',
      },
    });

    // Custom Resource for Gateway Client
    new CustomResource(this, 'GatewaySecretUpdater', {
      serviceToken: secretExtractorLambda.functionArn,
      properties: {
        UserPoolId: this.userPool.userPoolId,
        ClientId: this.gatewayClient.userPoolClientId,
        SecretArn: this.gatewayOAuth2Secret.secretArn,
        ClientType: 'Gateway',
      },
    });
  }
}
