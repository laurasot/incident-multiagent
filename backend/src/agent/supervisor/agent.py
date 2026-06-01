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

    # Sub-agent tool names — used to detect delegation events
    AGENT_TOOL_NAMES = {"monitoringAgent", "webSearchAgent"}

    def _extract_tool_name(self, event: dict) -> str | None:
        """
        Extract tool name from a Strands/Bedrock streaming event.

        Strands SDK may emit tool-use info in two formats:
        1. Strands format:  {"type": "tool_use", "name": "<tool>", ...}
        2. Bedrock format:  {"event": {"contentBlockStart": {"start": {"toolUse": {"name": "<tool>"}}}}}

        Returns the tool name string or None if not a tool-use event.
        """
        # Strands native format
        if event.get("type") == "tool_use":
            return event.get("name") or None

        # Bedrock nested format
        inner = event.get("event")
        if isinstance(inner, dict):
            cbs = inner.get("contentBlockStart", {})
            tool_use = cbs.get("start", {}).get("toolUse", {})
            name = tool_use.get("name")
            if name:
                return name

        return None

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
        Handles both Strands-native and Bedrock-native event formats.
        """
        emitted_transfers: set[str] = set()

        try:
            async for event in self.agent.stream_async(user_message):
                tool_name = self._extract_tool_name(event)

                if tool_name and tool_name in self.AGENT_TOOL_NAMES:
                    # Emit transfer signal once per agent call (avoid duplicates
                    # if both Strands and Bedrock formats arrive for the same tool)
                    if tool_name not in emitted_transfers:
                        emitted_transfers.add(tool_name)
                        logger.info(f"Supervisor delegating to: {tool_name}")
                        yield {"actions": {"transfer_to_agent": tool_name}}

                elif event.get("type") == "tool_result":
                    tool_name_result = event.get("name", "")
                    logger.info(f"Received result from: {tool_name_result}")
                    # Reset so the same agent can be called again later
                    emitted_transfers.discard(tool_name_result)

                yield event

        except Exception as exc:
            logger.error(f"Supervisor invocation error: {exc}", exc_info=True)
            yield {"type": "error", "error": str(exc), "agent": "supervisorAgent"}

    def get_agent(self) -> Agent:
        """Return the underlying Strands Agent instance."""
        return self.agent
