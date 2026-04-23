from . import app, logger
import json
from .common.gateway_client import create_gateway_client
from .monitoring.agent import MonitoringAgent
from .supervisor.agent import SupervisorAgent
from .websearch.agent import WebSearchAgent

logger.info("Initializing multi-agent system...")

try:
    logger.info("Initializing gateway MCP client...")
    gateway_client = create_gateway_client()
    gateway_client.start()
    gateway_tools = gateway_client.list_tools_sync()

    logger.info("Initializing monitoring agent...")
    monitoring_agent = MonitoringAgent(gateway_tools=gateway_tools)

    logger.info("Initializing web search agent...")
    tavily_api_key = "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"
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
