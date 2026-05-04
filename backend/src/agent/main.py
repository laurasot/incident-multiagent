import os
import json
import boto3

from . import app, logger
from .common.gateway_client import create_gateway_client
from .monitoring.agent import MonitoringAgent
from .supervisor.agent import SupervisorAgent
from .websearch.agent import WebSearchAgent

logger.info("Initializing multi-agent system...")

project_name = os.environ.get("PROJECT_NAME", "incident-response")
env_name = os.environ.get("ENV_NAME", "dev")
secrets_client = boto3.client("secretsmanager")

AGENT_CARDS = {
    "monitoringAgent": {
        "agent_card": {
            "name": "monitoringAgent",
            "description": "AWS CloudWatch monitoring agent. Analyzes logs, metrics, and alarms for incident investigation.",
            "version": "1.0.0",
            "url": ""
        },
        "agent_card_url": ""
    },
    "webSearchAgent": {
        "agent_card": {
            "name": "webSearchAgent",
            "description": "Web search agent. Finds AWS documentation, best practices, and troubleshooting guides.",
            "version": "1.0.0",
            "url": ""
        },
        "agent_card_url": ""
    }
}

try:
    logger.info("Initializing gateway MCP client...")
    gateway_client = create_gateway_client()
    gateway_client.start()
    gateway_tools = gateway_client.list_tools_sync()

    logger.info("Initializing monitoring agent...")
    monitoring_agent = MonitoringAgent(gateway_tools=gateway_tools)

    logger.info("Initializing web search agent...")
    
    secret_name = f"{project_name}/tavily-api-key-{env_name}"
    secret_response = secrets_client.get_secret_value(SecretId=secret_name)
    tavily_api_key = secret_response["SecretString"]
    websearch_agent = WebSearchAgent(tavily_api_key=tavily_api_key)

    logger.info("Creating supervisor agent...")
    supervisor = SupervisorAgent(
        monitoring_tool=monitoring_agent.as_tool(),
        websearch_tool=websearch_agent.as_tool(),
    )

    logger.info("All agents initialized successfully")

except Exception as e:
    logger.error(f"FATAL: Failed to initialize multi-agent system: {str(e)}")
    logger.error("Full traceback:", exc_info=True)
    raise RuntimeError(f"Agent initialization failed: {str(e)}") from e


@app.entrypoint
async def call_agent(payload: dict, context):
    session_id = context.session_id
    actor_id = context.request_headers.get("x-amzn-bedrock-agentcore-runtime-custom-actorid", "default_actor_id")
    
    try:
        logger.info(f"Payload: {json.dumps(payload, indent=2)}")
        query = payload.get("prompt", "")
        if not query:
            raise KeyError("'prompt' field is required in payload")
        
        logger.info(f"session_id: {session_id}")
        logger.info(f"actor_id: {actor_id}")

        yield AGENT_CARDS
        
        async for event in supervisor.invoke_stream(
            user_message=query,
            session_id=session_id,
            actor_id=actor_id,
        ):
            yield event
    
    except KeyError as e:
        logger.error(f"Validation error: {e}", exc_info=True)
        yield {
            "type": "error",
            "error": f"Invalid request: {str(e)}",
            "error_code": "VALIDATION_ERROR",
            "agent": "runtime"
        }
    
    except Exception as e:
        logger.error(f"Runtime error: {e}", exc_info=True)
        yield {
            "type": "error",
            "error": "An unexpected error occurred. Please try again later.",
            "error_code": "INTERNAL_ERROR",
            "error_detail": str(e),
            "agent": "runtime"
        }

if __name__ == "__main__":
    app.run()
