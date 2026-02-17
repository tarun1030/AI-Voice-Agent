import logging
from livekit import api, rtc
from typing import Optional, Dict
import asyncio
import json

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class LiveKitService:
    def __init__(self):
        self.system_prompt = "You are a helpful AI assistant. Answer questions based on the provided context."
        self.active_agents = {}
    
    async def create_token(self, room_name: str, participant_name: str) -> str:
        """Create a LiveKit access token for a participant"""
        try:
            token = api.AccessToken(
                settings.livekit_api_key,
                settings.livekit_api_secret
            )
            
            token.with_identity(participant_name)
            token.with_name(participant_name)
            token.with_grants(api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            ))
            
            jwt_token = token.to_jwt()
            logger.info(f"Created token for {participant_name} in room {room_name}")
            
            return jwt_token
        
        except Exception as e:
            logger.error(f"Error creating token: {e}")
            raise
    
    async def update_system_prompt(self, prompt: str):
        """Update the system prompt for the agent"""
        self.system_prompt = prompt
        logger.info(f"Updated system prompt: {prompt[:50]}...")
    
    async def get_system_prompt(self) -> str:
        """Get the current system prompt"""
        return self.system_prompt
    
    async def start_agent(self, room_name: str) -> Dict:
        """Start an agent in a LiveKit room"""
        try:
            if room_name in self.active_agents:
                return {
                    "message": "Agent already running in this room",
                    "room_name": room_name
                }
            
            self.active_agents[room_name] = {
                "status": "running",
                "started_at": asyncio.get_event_loop().time()
            }
            
            logger.info(f"Started agent in room {room_name}")
            
            return {
                "message": "Agent started successfully",
                "room_name": room_name,
                "status": "running"
            }
        
        except Exception as e:
            logger.error(f"Error starting agent: {e}")
            raise
    
    async def stop_agent(self, room_name: str):
        """Stop an agent in a LiveKit room"""
        try:
            if room_name in self.active_agents:
                del self.active_agents[room_name]
                logger.info(f"Stopped agent in room {room_name}")
            else:
                logger.warning(f"No agent found in room {room_name}")
        
        except Exception as e:
            logger.error(f"Error stopping agent: {e}")
            raise
