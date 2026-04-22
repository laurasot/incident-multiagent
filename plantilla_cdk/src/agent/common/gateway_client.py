"""
AgentCore Gateway MCP Client

Creates MCP client for Gateway communication using direct Cognito M2M OAuth2.

The client_secret is read live from Cognito via DescribeUserPoolClient instead of
Secrets Manager, so it is always fresh regardless of CDK deploy order or Lambda
Custom Resource failures.

Required env vars (all set by CDK agentcore/index.ts):
  USER_POOL_ID         - Cognito User Pool ID
  GATEWAY_CLIENT_ID    - Cognito Gateway M2M client ID
  COGNITO_DOMAIN_PREFIX - Cognito hosted-UI domain prefix
  AWS_REGION           - AWS region
"""

import base64
import json
import os
from datetime import timedelta

import boto3
import urllib3
from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp.mcp_client import MCPClient

from .. import logger

_cognito_client = boto3.client("cognito-idp")
_ssm_client = boto3.client("ssm")
_http = urllib3.PoolManager()


def _get_gateway_url() -> str:
    """Retrieve gateway URL from SSM Parameter Store."""
    response = _ssm_client.get_parameter(
        Name="/monitoragent/agentcore/gateway/gateway_url",
        WithDecryption=True,
    )
    url = response["Parameter"]["Value"]
    logger.info("Gateway URL loaded from SSM: %s", url)
    return url


def _get_client_secret() -> str:
    """
    Get the Cognito gateway client secret directly via DescribeUserPoolClient.

    More reliable than reading from Secrets Manager because it's always current —
    no dependency on the CDK Custom Resource Lambda having run successfully.
    """
    user_pool_id = os.environ["USER_POOL_ID"]
    client_id = os.environ["GATEWAY_CLIENT_ID"]

    response = _cognito_client.describe_user_pool_client(
        UserPoolId=user_pool_id,
        ClientId=client_id,
    )
    client_secret = response["UserPoolClient"].get("ClientSecret")
    if not client_secret:
        raise ValueError(
            f"Cognito client {client_id} does not have a client secret. "
            "Ensure it was created with generateSecret: true."
        )
    logger.info("Gateway client secret obtained from Cognito")
    return client_secret


def _get_cognito_access_token() -> str:
    """
    Obtain an OAuth2 access token from Cognito using client_credentials grant.
    Token endpoint is constructed from env vars (always correct).
    """
    client_id = os.environ["GATEWAY_CLIENT_ID"]
    client_secret = _get_client_secret()
    domain_prefix = os.environ["COGNITO_DOMAIN_PREFIX"]
    region = os.environ.get("AWS_REGION", "us-west-2")

    token_endpoint = (
        f"https://{domain_prefix}.auth.{region}.amazoncognito.com/oauth2/token"
    )
    logger.info("Cognito token endpoint: %s", token_endpoint)

    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

    response = _http.request(
        "POST",
        token_endpoint,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {credentials}",
        },
        body="grant_type=client_credentials",
    )

    if response.status != 200:
        raise RuntimeError(
            f"Failed to get Cognito access token: HTTP {response.status} — "
            f"{response.data.decode()}"
        )

    token_data = json.loads(response.data.decode())
    access_token = token_data["access_token"]
    logger.info("Cognito M2M access token obtained for Gateway")
    return access_token


def create_gateway_client() -> MCPClient:
    """
    Create MCP gateway client authenticated with a Cognito M2M OAuth2 token.

    Returns:
        Configured MCPClient instance (not yet started).
    """
    gateway_access_token = _get_cognito_access_token()
    gateway_url = _get_gateway_url()

    return MCPClient(
        lambda: streamablehttp_client(
            url=gateway_url,
            headers={"Authorization": f"Bearer {gateway_access_token}"},
            timeout=timedelta(seconds=120),
        )
    )
