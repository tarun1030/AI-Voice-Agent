import logging
import google.generativeai as genai
from typing import Optional, List, Dict

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class LLMService:
    """LLM service using Google Gemini Flash 2.5"""
    
    def __init__(self):
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        self.system_prompt = "You are a helpful AI assistant."
    
    def set_system_prompt(self, prompt: str):
        """Update the system prompt"""
        self.system_prompt = prompt
        logger.info(f"Updated system prompt: {prompt[:50]}...")
    
    async def generate_response(
        self,
        query: str,
        context_chunks: Optional[List[str]] = None,
        conversation_history: Optional[List[Dict]] = None
    ) -> str:
        """
        Generate a response using Gemini with optional RAG context
        
        Args:
            query: User's question
            context_chunks: Retrieved context from knowledge base
            conversation_history: Previous conversation turns
            
        Returns:
            Generated response text
        """
        try:
            # Build the prompt with context
            prompt_parts = [self.system_prompt]
            
            if context_chunks and len(context_chunks) > 0:
                context_text = "\n\n".join([f"Context {i+1}:\n{chunk}" 
                                           for i, chunk in enumerate(context_chunks)])
                prompt_parts.append(f"\nRelevant Context:\n{context_text}")
            
            if conversation_history:
                history_text = "\n".join([f"{msg['role']}: {msg['content']}" 
                                         for msg in conversation_history[-5:]])
                prompt_parts.append(f"\nConversation History:\n{history_text}")
            
            prompt_parts.append(f"\nUser Question: {query}")
            prompt_parts.append("\nAssistant Response:")
            
            full_prompt = "\n".join(prompt_parts)
            
            # Generate response
            response = self.model.generate_content(full_prompt)
            
            result_text = response.text
            logger.info(f"Generated response for query: {query[:50]}...")
            
            return result_text
        
        except Exception as e:
            logger.error(f"Error generating LLM response: {e}")
            return f"I apologize, but I encountered an error: {str(e)}"
    
    async def generate_stream(
        self,
        query: str,
        context_chunks: Optional[List[str]] = None
    ):
        """
        Generate streaming response using Gemini
        
        Args:
            query: User's question
            context_chunks: Retrieved context from knowledge base
            
        Yields:
            Response text chunks
        """
        try:
            prompt_parts = [self.system_prompt]
            
            if context_chunks and len(context_chunks) > 0:
                context_text = "\n\n".join([f"Context {i+1}:\n{chunk}" 
                                           for i, chunk in enumerate(context_chunks)])
                prompt_parts.append(f"\nRelevant Context:\n{context_text}")
            
            prompt_parts.append(f"\nUser Question: {query}")
            prompt_parts.append("\nAssistant Response:")
            
            full_prompt = "\n".join(prompt_parts)
            
            response = self.model.generate_content(full_prompt, stream=True)
            
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        
        except Exception as e:
            logger.error(f"Error in streaming LLM response: {e}")
            yield f"Error: {str(e)}"
