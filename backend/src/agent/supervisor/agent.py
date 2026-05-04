import os
from typing import Any, AsyncGenerator

from strands import Agent
from strands.models import BedrockModel

from .. import logger
from ..common.aws_config import get_aws_region
from .system_prompt import SUPERVISOR_SYSTEM_PROMPT


class SupervisorAgent:
    """
    Supervisor Agent using Strands framework.

    Orchestrates the multi-agent system; monitoring and websearch agents are
    registered as tools (agent-as-tool pattern) so no A2A protocol is needed.
    """

    def __init__(
        self,
        monitoring_tool,
        websearch_tool,
    ):
        """
        Initialize Supervisor Agent with tool-wrapped sub-agents.
        
        Args:
            monitoring_tool: Tool function (decorated with @tool) for monitoring tasks
            websearch_tool: Tool function (decorated with @tool) for web search tasks
        """
        self.model = BedrockModel(
            model_id=os.environ.get("MODEL_ID","us.anthropic.claude-sonnet-4-20250514-v1:0"),
            region_name=get_aws_region(),
        )

        self.agent = Agent(
            name="supervisorAgent",
            model=self.model,
            system_prompt=SUPERVISOR_SYSTEM_PROMPT,
            tools=[monitoring_tool, websearch_tool],
        )

    async def invoke_stream(
        self,
        user_message: str,
        session_id: str,
        actor_id: str,
    ) -> AsyncGenerator[Any, None]:
        """
        Stream response from supervisor agent.

        Emits transfer events when delegating to sub-agents so the frontend
        can display visual feedback (e.g. "→ Checking CloudWatch logs...").
        """
        try:
            async for event in self.agent.stream_async(user_message):
                if event.get("type") == "tool_use":
                    tool_name = event.get("name", "")
                    logger.info(f"Supervisor delegating to: {tool_name}")
                    
                    if tool_name == "monitoringAgent":
                        yield {"actions": {"transfer_to_agent": "monitoringAgent"}}
                    elif tool_name == "webSearchAgent":
                        yield {"actions": {"transfer_to_agent": "webSearchAgent"}}
                
                elif event.get("type") == "tool_result":
                    tool_name = event.get("name", "")
                    logger.info(f"Received result from: {tool_name}")

                yield event

        except Exception as exc:
            logger.error(f"Supervisor invocation error: {exc}", exc_info=True)
            yield {"type": "error", "error": str(exc), "agent": "supervisorAgent"}

    def get_agent(self) -> Agent:
        """Return the underlying Strands Agent instance."""
        return self.agent
