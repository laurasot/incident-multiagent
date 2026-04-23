import os
from typing import List, Any
from strands import Agent, tool
from strands.models import BedrockModel
from .system_prompt import MONITORING_SYSTEM_PROMPT
from .. import logger


class MonitoringAgent:
    """
    Monitoring Agent using Strands framework

    Specialized in CloudWatch Logs investigation via AgentCore Gateway.
    Receives ready-to-use MCP tools from the supervisor (main.py) so this
    class stays stateless and testable.
    """

    def __init__(self, gateway_tools: List[Any]):
        """
        Initialize Monitoring Agent

        Args:
            gateway_tools: List of Strands tools generated from the MCP gateway
                           (obtained via MCPClient.list_tools_sync() in main.py).
        """
        self.model = BedrockModel(
            model_id="us.anthropic.claude-haiku-4-5-20251001-v1:0",
            region_name=os.environ.get("AWS_REGION", "us-west-2"),
        )

        self.agent = Agent(
            name="monitoringAgent",
            model=self.model,
            system_prompt=MONITORING_SYSTEM_PROMPT,
            tools=gateway_tools,
        )
    
    def get_agent(self) -> Agent:
        """Return the Strands Agent instance (to be used as agent-as-tool)"""
        return self.agent
    
    def as_tool(self):
        """
        Return a @tool decorated function that wraps this agent.
        This provides explicit control over the tool interface.
        """
        agent_instance = self.agent
        
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
                logger.info(f"Calling monitoringAgent: {query}")
                result = agent_instance(query)
                result_str = str(result)
                logger.info(f"monitoringAgent completed ({len(result_str)} chars)")
                return result_str
            except Exception as e:
                error_msg = f"Error in monitoring agent: {str(e)}"
                logger.error(f"monitoringAgent error: {error_msg}", exc_info=True)
                return error_msg
        
        return monitoringAgent
