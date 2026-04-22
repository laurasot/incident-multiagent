"""
Monitoring Agent - CloudWatch Logs Specialist

Role: Specialized agent for AWS CloudWatch Logs investigation
Framework: Strands (Amazon Bedrock)
Model: Claude Haiku 3.5 (fast, cost-effective)
State: STATELESS (no memory, context provided by supervisor)

Responsibilities:
- Query CloudWatch logs via AgentCore Gateway (MCP protocol)
- Filter log events based on patterns and time ranges
- Analyze error patterns and anomalies
- Return structured log analysis to supervisor

Tools:
- filter_log_events (via Gateway MCP)
- get_log_events (via Gateway MCP)
- describe_log_groups (via Gateway MCP)
"""

import os
from typing import List, Any
from strands import Agent
from strands.models import BedrockModel
from .system_prompt import MONITORING_SYSTEM_PROMPT


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
            model_id="anthropic.claude-3-5-haiku-20241022-v1:0",
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
