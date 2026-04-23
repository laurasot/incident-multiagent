import json
import os
from typing import Any, AsyncGenerator

from strands import Agent
from strands.models import BedrockModel

from .. import logger
from .system_prompt import SUPERVISOR_SYSTEM_PROMPT


class SupervisorAgent:
    """
    Supervisor Agent using Strands framework.

    Orchestrates the multi-agent system; monitoring and websearch agents are
    registered as tools (agent-as-tool pattern) so no A2A protocol is needed.
    """

    def __init__(
        self,
        monitoring_agent: Agent,
        websearch_agent: Agent,
    ):
        self.model = BedrockModel(
            model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
            region_name=os.environ.get("AWS_REGION", "us-west-2"),
        )

        self.agent = Agent(
            name="supervisorAgent",
            model=self.model,
            system_prompt=SUPERVISOR_SYSTEM_PROMPT,
            tools=[monitoring_agent, websearch_agent],
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
                    tool_input = event.get("input", {})

                    logger.info(f"Supervisor delega a: {tool_name.upper()}")
                    logger.info(f"Input enviado: {json.dumps(tool_input, indent=2, ensure_ascii=False)}")
                    
                    if tool_name == "monitoringAgent":
                        yield {"actions": {"transfer_to_agent": "monitoringAgent"}}
                    elif tool_name == "webSearchAgent":
                        yield {"actions": {"transfer_to_agent": "webSearchAgent"}}
                
                elif event.get("type") == "tool_result":
                    tool_name = event.get("name", "")
                    tool_result = event.get("result", {})
                    
                    logger.info(f"{tool_name.upper()} devuelve a Supervisor: {json.dumps(tool_result, indent=2, ensure_ascii=False)}")
                    logger.info(f"Resultado recibido: {json.dumps(tool_result, indent=2, ensure_ascii=False)}")

                yield event

        except Exception as exc:
            logger.error(f"Supervisor invocation error: {exc}", exc_info=True)
            yield {"type": "error", "error": str(exc), "agent": "supervisorAgent"}

    def get_agent(self) -> Agent:
        """Return the underlying Strands Agent instance."""
        return self.agent
