from . import app, logger
import json
_supervisor = None


def _build_supervisor():
    """Instantiate all agents using @tool decorator pattern.

    Called inside @app.entrypoint so BedrockAgentCoreContext already has the
    workload access token set by the Runtime — @requires_access_token in
    create_gateway_client() will pick it up automatically.
    """
    import boto3
    from strands import tool
    from .common.gateway_client import create_gateway_client
    from .monitoring.agent import MonitoringAgent
    from .supervisor.agent import SupervisorAgent
    from .websearch.agent import WebSearchAgent

    logger.info("Initializing gateway MCP client...")
    gateway_client = create_gateway_client()
    gateway_client.start()
    gateway_tools = gateway_client.list_tools_sync()

    logger.info("Initializing monitoring agent...")
    monitoring_agent_obj = MonitoringAgent(gateway_tools=gateway_tools)
    monitoring_agent_instance = monitoring_agent_obj.get_agent()

    logger.info("Initializing web search agent...")
    tavily_api_key = "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"
    websearch_agent_obj = WebSearchAgent(tavily_api_key=tavily_api_key)
    websearch_agent_instance = websearch_agent_obj.get_agent()
    
    logger.info("Creating tool wrappers for agents...")
    
    # Wrap monitoring agent in a @tool decorator for explicit control
    @tool
    def monitoringAgent(query: str) -> str:
        """
        Call the monitoring agent to handle CloudWatch logs, metrics, alarms, and AWS monitoring tasks.
        
        Use this tool when you need to:
        - List or search CloudWatch log groups
        - Query CloudWatch logs for errors or patterns
        - Check CloudWatch metrics (CPU, memory, network, etc.)
        - Review CloudWatch alarms and their states
        
        Args:
            query: The monitoring question or task to perform (e.g., "list all log groups", 
                   "find errors in /aws/lambda/my-function", "check EC2 CPU metrics")
        
        Returns:
            The monitoring agent's analysis and findings as a string.
        """
        try:
            logger.info("=" * 80)
            logger.info("🔄 TOOL WRAPPER: monitoringAgent called")
            logger.info(f"Query: {query}")
            logger.info("=" * 80)
            
            # Call the monitoring agent synchronously
            result = monitoring_agent_instance(query)
            result_str = str(result)
            
            logger.info("=" * 80)
            logger.info("✅ TOOL WRAPPER: monitoringAgent completed")
            logger.info(f"Result length: {len(result_str)} chars")
            logger.info(f"Result preview: {result_str[:200]}...")
            logger.info("=" * 80)
            
            return result_str
        except Exception as e:
            error_msg = f"Error in monitoring agent: {str(e)}"
            logger.error(f"❌ TOOL WRAPPER ERROR: {error_msg}", exc_info=True)
            return error_msg
    
    # Wrap websearch agent in a @tool decorator for explicit control
    @tool
    def webSearchAgent(query: str) -> str:
        """
        Call the web search agent to find AWS documentation, best practices, and troubleshooting guides.
        
        Use this tool when you need to:
        - Find AWS service documentation
        - Search for error message solutions
        - Look up AWS best practices
        - Find troubleshooting guides and Stack Overflow discussions
        
        Args:
            query: The search question or topic (e.g., "how to optimize Lambda memory", 
                   "AWS RDS connection timeout solutions", "S3 bucket policy examples")
        
        Returns:
            The web search agent's findings and recommendations as a string.
        """
        try:
            logger.info("=" * 80)
            logger.info("🔄 TOOL WRAPPER: webSearchAgent called")
            logger.info(f"Query: {query}")
            logger.info("=" * 80)
            
            # Call the websearch agent synchronously
            result = websearch_agent_instance(query)
            result_str = str(result)
            
            logger.info("=" * 80)
            logger.info("✅ TOOL WRAPPER: webSearchAgent completed")
            logger.info(f"Result length: {len(result_str)} chars")
            logger.info(f"Result preview: {result_str[:200]}...")
            logger.info("=" * 80)
            
            return result_str
        except Exception as e:
            error_msg = f"Error in web search agent: {str(e)}"
            logger.error(f"❌ TOOL WRAPPER ERROR: {error_msg}", exc_info=True)
            return error_msg
    
    logger.info("Creating supervisor agent with tool-wrapped sub-agents...")
    supervisor = SupervisorAgent(
        monitoring_tool=monitoringAgent,
        websearch_tool=webSearchAgent,
    )
    
    logger.info("All agents initialized successfully (using @tool decorator pattern)")
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
