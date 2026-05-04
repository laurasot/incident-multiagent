"""
Tavily Web Search Tool

Implements web search functionality using Tavily API with Strands @tool decorator.
"""

from typing import Dict, Any
from tavily import TavilyClient
from strands import tool


def create_web_search_tool(api_key: str):
    """
    Create Tavily web search tool for Strands agent.

    Args:
        api_key: Tavily API key

    Returns:
        Decorated tool function compatible with Strands Agent
    """
    tavily_client = TavilyClient(api_key=api_key)

    @tool
    def web_search_tavily(query: str, max_results: int = 5) -> Dict[str, Any]:
        """
        Search the web for AWS documentation, solutions, and best practices.

        Returns relevant articles, documentation links, and community discussions.

        Args:
            query: The search query. Be specific and include AWS service names,
                   error messages, or concepts.
            max_results: Maximum number of results to return (default: 5, max: 10)

        Returns:
            Dict with search results including titles, URLs, snippets, and AI summary
        """
        try:
            response = tavily_client.search(
                query=query,
                max_results=min(max_results, 10),
                search_depth="advanced",
                include_domains=[
                    "docs.aws.amazon.com",
                    "aws.amazon.com",
                    "repost.aws",
                    "stackoverflow.com",
                ],
            )

            return {
                "query": query,
                "results": [
                    {
                        "title": result.get("title"),
                        "url": result.get("url"),
                        "snippet": result.get("content"),
                        "score": result.get("score", 0),
                    }
                    for result in response.get("results", [])
                ],
                "answer": response.get("answer"),
            }

        except Exception as e:
            return {
                "error": str(e),
                "query": query,
                "results": [],
            }

    return web_search_tavily
