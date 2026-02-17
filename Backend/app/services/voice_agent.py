import logging
import asyncio
from typing import Optional, Dict, List
from datetime import datetime

from app.services.stt_service import STTService
from app.services.llm_service import LLMService
from app.services.tts_service import TTSService
from app.services.knowledge_base import KnowledgeBaseService
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class VoiceAgent:
    """
    Orchestrates the complete voice AI pipeline:
    STT -> LLM (with RAG) -> TTS
    """
    
    def __init__(self, room_name: str, system_prompt: Optional[str] = None):
        self.room_name = room_name
        self.stt_service = STTService(settings.deepgram_api_key)
        self.llm_service = LLMService()
        self.tts_service = TTSService()
        self.kb_service = KnowledgeBaseService()
        
        if system_prompt:
            self.llm_service.set_system_prompt(system_prompt)
        
        self.conversation_history: List[Dict] = []
        self.is_running = False
        self.sources_used: List[str] = []
    
    async def initialize(self):
        """Initialize all services"""
        try:
            await self.stt_service.initialize()
            await self.tts_service.initialize()
            self.is_running = True
            logger.info(f"Voice agent initialized for room: {self.room_name}")
        except Exception as e:
            logger.error(f"Error initializing voice agent: {e}")
            raise
    
    async def process_audio_input(self, audio_data: bytes) -> Dict:
        """
        Process incoming audio through the complete pipeline
        
        Args:
            audio_data: Raw audio bytes from user
            
        Returns:
            Dict containing response audio and metadata
        """
        try:
            # Step 1: STT - Convert speech to text
            user_text = await self.stt_service.transcribe(audio_data)
            
            if not user_text:
                return {
                    "response_audio": None,
                    "transcript": "",
                    "sources": []
                }
            
            logger.info(f"User said: {user_text}")
            
            # Add to conversation history
            self.conversation_history.append({
                "role": "user",
                "content": user_text,
                "timestamp": datetime.now().isoformat()
            })
            
            # Step 2: RAG - Retrieve relevant context
            rag_result = await self.kb_service.retrieve(user_text, top_k=3)
            context_chunks = rag_result["chunks"]
            self.sources_used = rag_result["sources"]
            
            # Step 3: LLM - Generate response with context
            response_text = await self.llm_service.generate_response(
                query=user_text,
                context_chunks=context_chunks,
                conversation_history=self.conversation_history
            )
            
            logger.info(f"Assistant response: {response_text}")
            
            # Add to conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": response_text,
                "timestamp": datetime.now().isoformat()
            })
            
            # Step 4: TTS - Convert response to speech
            response_audio = await self.tts_service.synthesize(response_text)
            
            return {
                "response_audio": response_audio,
                "transcript": response_text,
                "sources": self.sources_used,
                "user_text": user_text
            }
        
        except Exception as e:
            logger.error(f"Error processing audio input: {e}")
            return {
                "response_audio": None,
                "transcript": f"Error: {str(e)}",
                "sources": []
            }
    
    async def process_text_query(self, query: str) -> Dict:
        """
        Process a text query (useful for testing)
        
        Args:
            query: User's text question
            
        Returns:
            Dict containing response and metadata
        """
        try:
            # Retrieve context
            rag_result = await self.kb_service.retrieve(query, top_k=3)
            context_chunks = rag_result["chunks"]
            sources = rag_result["sources"]
            
            # Generate response
            response = await self.llm_service.generate_response(
                query=query,
                context_chunks=context_chunks,
                conversation_history=self.conversation_history
            )
            
            return {
                "response": response,
                "sources": sources,
                "chunks": context_chunks
            }
        
        except Exception as e:
            logger.error(f"Error processing text query: {e}")
            return {
                "response": f"Error: {str(e)}",
                "sources": [],
                "chunks": []
            }
    
    def update_system_prompt(self, prompt: str):
        """Update the system prompt"""
        self.llm_service.set_system_prompt(prompt)
        logger.info(f"Updated system prompt for room {self.room_name}")
    
    def get_conversation_history(self) -> List[Dict]:
        """Get the conversation history"""
        return self.conversation_history
    
    def clear_conversation_history(self):
        """Clear the conversation history"""
        self.conversation_history = []
        logger.info(f"Cleared conversation history for room {self.room_name}")
    
    async def shutdown(self):
        """Shutdown the agent and cleanup resources"""
        try:
            self.is_running = False
            await self.stt_service.close()
            logger.info(f"Voice agent shutdown for room: {self.room_name}")
        except Exception as e:
            logger.error(f"Error shutting down voice agent: {e}")
