"""
AgentCore Memory Hooks for Strands Agent

Implements memory management using AgentCore Memory API with Strands hooks.
"""

import os
import json
from typing import Any, Dict
import boto3
from bedrock_agentcore.memory import MemoryClient

from .aws_config import get_aws_region, get_memory_id


class SupervisorMemoryHooks:
    """
    Memory hooks for Supervisor Agent
    
    Integrates AgentCore Memory (short-term conversational + long-term semantic)
    with Strands agent lifecycle events.
    """
    
    def __init__(self):
        """Initialize memory clients"""
        self.memory_client = MemoryClient()
        self.region = get_aws_region()

        project_name = os.environ["PROJECT_NAME"]
        env_name = os.environ["ENV_NAME"]
        
        self.short_term_memory_id = get_memory_id(project_name, env_name, "short-term")
        self.long_term_incidents_memory_id = get_memory_id(project_name, env_name, "long-term-incidents")
        self.long_term_resolutions_memory_id = get_memory_id(project_name, env_name, "long-term-resolutions")
        
        # Current context
        self.session_id = None
        self.actor_id = None
    
    async def on_agent_initialized(self, event: Dict[str, Any]) -> None:
        """
        Hook called when agent is initialized
        
        Load relevant memory context for the session.
        """
        context = event.get("context", {})
        self.session_id = context.get("session_id")
        self.actor_id = context.get("actor_id")
        
        if not self.session_id or not self.actor_id:
            print("Warning: session_id or actor_id not provided in context")
            return
        
        # Load short-term conversational memory for this session
        try:
            memory_response = await self.memory_client.get_memory(
                memory_id=self.short_term_memory_id,
                session_id=self.session_id,
                region=self.region,
            )
            
            # Inject memory into agent context
            event["memory_context"] = memory_response.get("messages", [])
            print(f"Loaded {len(event['memory_context'])} messages from short-term memory")
            
        except Exception as e:
            print(f"Error loading short-term memory: {str(e)}")
    
    async def on_message_added(self, event: Dict[str, Any]) -> None:
        """
        Hook called when a message is added to conversation
        
        Save message to short-term conversational memory.
        """
        if not self.session_id:
            return
        
        message = event.get("message", {})
        role = message.get("role")
        content = message.get("content")
        
        try:
            await self.memory_client.save_message(
                memory_id=self.short_term_memory_id,
                session_id=self.session_id,
                role=role,
                content=content,
                region=self.region,
            )
            print(f"Saved {role} message to short-term memory")
            
        except Exception as e:
            print(f"Error saving message to short-term memory: {str(e)}")
    
    async def on_after_invocation(self, event: Dict[str, Any]) -> None:
        """
        Hook called after agent invocation completes
        
        Save structured learnings to long-term semantic memory.
        """
        if not self.actor_id:
            return
        
        response = event.get("response", {})
        metadata = event.get("metadata", {})
        
        # Check if this was an incident resolution
        if metadata.get("incident_resolved"):
            try:
                # Save to long-term incidents memory
                await self.memory_client.save_semantic_memory(
                    memory_id=self.long_term_incidents_memory_id,
                    actor_id=self.actor_id,
                    content=json.dumps({
                        "incident_description": metadata.get("incident_description"),
                        "root_cause": metadata.get("root_cause"),
                        "timestamp": metadata.get("timestamp"),
                    }),
                    region=self.region,
                )
                
                # Save to long-term resolutions memory
                await self.memory_client.save_semantic_memory(
                    memory_id=self.long_term_resolutions_memory_id,
                    actor_id=self.actor_id,
                    content=json.dumps({
                        "incident_description": metadata.get("incident_description"),
                        "resolution_steps": metadata.get("resolution_steps"),
                        "success": metadata.get("success"),
                        "timestamp": metadata.get("timestamp"),
                    }),
                    region=self.region,
                )
                
                print(f"Saved incident resolution to long-term memory for actor {self.actor_id}")
                
            except Exception as e:
                print(f"Error saving to long-term memory: {str(e)}")
    
    async def retrieve_similar_incidents(self, query: str) -> list:
        """
        Retrieve similar past incidents from long-term memory
        
        Args:
            query: Incident description to search for
            
        Returns:
            List of similar incidents with resolutions
        """
        if not self.actor_id:
            return []
        
        try:
            # Search long-term incidents memory
            incidents_response = await self.memory_client.search_semantic_memory(
                memory_id=self.long_term_incidents_memory_id,
                actor_id=self.actor_id,
                query=query,
                top_k=3,
                region=self.region,
            )
            
            # Search long-term resolutions memory
            resolutions_response = await self.memory_client.search_semantic_memory(
                memory_id=self.long_term_resolutions_memory_id,
                actor_id=self.actor_id,
                query=query,
                top_k=3,
                region=self.region,
            )
            
            return {
                "similar_incidents": incidents_response.get("results", []),
                "similar_resolutions": resolutions_response.get("results", []),
            }
            
        except Exception as e:
            print(f"Error retrieving similar incidents: {str(e)}")
            return []
