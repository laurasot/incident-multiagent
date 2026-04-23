from . import app, logger
import json
_supervisor = None


def _build_supervisor():
    """Instantiate all agents.

    Called inside @app.entrypoint so BedrockAgentCoreContext already has the
    workload access token set by the Runtime — @requires_access_token in
    create_gateway_client() will pick it up automatically.
    """
    import boto3
    from .common.gateway_client import create_gateway_client
    from .monitoring.agent import MonitoringAgent
    from .supervisor.agent import SupervisorAgent
    from .websearch.agent import WebSearchAgent

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
    monitoring_agent_instance = monitoring_agent.get_agent()
    websearch_agent_instance = websearch_agent.get_agent()
    
    logger.info(f"Sub-agents for supervisor: monitoring={monitoring_agent_instance.name}, websearch={websearch_agent_instance.name}")
    
    supervisor = SupervisorAgent(
        monitoring_agent=monitoring_agent_instance,
        websearch_agent=websearch_agent_instance,
    )
    
    logger.info("All agents initialized successfully")
    return supervisor


@app.entrypoint
async def call_agent(payload: dict, context):
    global _supervisor
    
    session_id = context.session_id
    actor_id = context.request_headers.get(
        "x-amzn-bedrock-agentcore-runtime-custom-actorid", "default_actor_id"
    )
    
    try:
        logger.info(f"Payload: {json.dumps(payload, indent=3)}")
        query = payload.get("prompt", "")
        if not query:
            raise KeyError("'prompt' field is required in payload")
        
        logger.info(f"Request session: {session_id}, actor: {actor_id}")
        
        if _supervisor is None:
            _supervisor = _build_supervisor()
        
        async for event in _supervisor.invoke_stream(
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
            "error_detail": str(e),  # Solo en dev, quítalo en prod
            "agent": "runtime"
        }

if __name__ == "__main__":
    app.run()
