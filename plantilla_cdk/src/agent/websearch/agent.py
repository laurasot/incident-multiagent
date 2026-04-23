import os
from strands import Agent, tool
from strands.models import BedrockModel
from .system_prompt import WEBSEARCH_SYSTEM_PROMPT
from .tools import create_web_search_tool
from .. import logger


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
            model_id="anthropic.claude-3-5-haiku-20241022-v1:0",
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
    
    def as_tool(self):
        """
        Return a @tool decorated function that wraps this agent.
        This provides explicit control over the tool interface.
        """
        agent_instance = self.agent
        
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
                logger.info(f"Calling webSearchAgent: {query}")
                result = agent_instance(query)
                result_str = str(result)
                logger.info(f"webSearchAgent completed ({len(result_str)} chars)")
                return result_str
            except Exception as e:
                error_msg = f"Error in web search agent: {str(e)}"
                logger.error(f"webSearchAgent error: {error_msg}", exc_info=True)
                return error_msg
        
        return webSearchAgent
