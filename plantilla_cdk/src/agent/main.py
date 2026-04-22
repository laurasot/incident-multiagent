"""
Multi-Agent Incident Response System - AgentCore Runtime Entry Point

Uses BedrockAgentCoreApp pattern (same as host_adk_agent in the original project).
Protocol: HTTP (supervisor receives requests directly from frontend).
Sub-agents (monitoring, websearch) run as Strands agent-as-tool inside the same process.

Workload identity token is managed automatically by AgentCore Runtime:
- Runtime injects it into BedrockAgentCoreContext before calling @app.entrypoint
- @requires_access_token in gateway_client.py reads it from there transparently
- We never read it from request headers manually
"""

import logging
import os
import sys

from bedrock_agentcore import BedrockAgentCoreApp

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp()

# Lazy-initialized on first invocation (cold-start)
_supervisor = None


def _build_supervisor():
    """Instantiate all agents.

    Called inside @app.entrypoint so BedrockAgentCoreContext already has the
    workload access token set by the Runtime — @requires_access_token in
    create_gateway_client() will pick it up automatically.
    """
    import boto3
    from common.gateway_client import create_gateway_client
    from monitoring.agent import MonitoringAgent
    from supervisor.agent import SupervisorAgent
    from websearch.agent import WebSearchAgent

    logger.info("Initializing gateway MCP client...")
    gateway_client = create_gateway_client()
    gateway_client.start()
    gateway_tools = gateway_client.list_tools_sync()

    logger.info("Initializing monitoring agent...")
    monitoring_agent = MonitoringAgent(gateway_tools=gateway_tools)

    logger.info("Initializing web search agent...")
    # Read Tavily API key from Secrets Manager
    #secrets_client = boto3.client("secretsmanager")
    #tavily_secret_arn = os.environ["TAVILY_API_KEY_SECRET_ARN"]
    #tavily_secret_response = secrets_client.get_secret_value(SecretId=tavily_secret_arn)
    tavily_api_key = "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"
    websearch_agent = WebSearchAgent(tavily_api_key=tavily_api_key)

    logger.info("Initializing supervisor agent...")
    supervisor = SupervisorAgent(
        monitoring_agent=monitoring_agent.get_agent(),
        websearch_agent=websearch_agent.get_agent(),
    )

    logger.info("All agents initialized successfully")
    return supervisor


@app.entrypoint
async def call_agent(payload: dict, context):
    global _supervisor

    session_id = context.session_id
    actor_id = context.request_headers.get(
        "x-amzn-bedrock-agentcore-runtime-custom-actorid", "unknown"
    )

    query = payload.get("prompt", "")
    if not query:
        raise KeyError("'prompt' field is required in payload")

    logger.info("Request — session: %s, actor: %s", session_id, actor_id)
    logger.debug("Query: %s", query)

    # Cold-start: build agents on first invocation.
    # BedrockAgentCoreContext already has the workload token at this point.
    if _supervisor is None:
        _supervisor = _build_supervisor()

    async for event in _supervisor.invoke_stream(
        user_message=query,
        session_id=session_id,
        actor_id=actor_id,
    ):
        yield event


if __name__ == "__main__":
    app.run()
