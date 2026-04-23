import os
from strands import Agent
from strands.models import BedrockModel
from .system_prompt import WEBSEARCH_SYSTEM_PROMPT
from .tools import create_web_search_tool


class WebSearchAgent:
    """
    Web Search Agent using Strands framework
    
    Specialized in web research for AWS solutions and best practices.
    """
    
    def __init__(self, tavily_api_key: str):
        """
        Initialize Web Search Agent
        
        Args:
            tavily_api_key: Tavily API key for web search
        """
        self.model = BedrockModel(
            model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
            region_name=os.environ.get("AWS_REGION", "us-west-2"),
        )
        
        web_search_tool = create_web_search_tool(tavily_api_key)
        
        self.agent = Agent(
            name="webSearchAgent",
            model=self.model,
            system_prompt=WEBSEARCH_SYSTEM_PROMPT,
            tools=[web_search_tool],
        )
    
    def get_agent(self) -> Agent:
        """Return the Strands Agent instance (to be used as agent-as-tool)"""
        return self.agent
