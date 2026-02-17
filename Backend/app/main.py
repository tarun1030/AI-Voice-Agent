from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
import os
import logging
import json

from app.config import get_settings
from app.services.knowledge_base import KnowledgeBaseService
from app.services.livekit_service import LiveKitService
from app.models.schemas import PromptUpdate, AgentConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()
app = FastAPI(title="Voice AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

kb_service = KnowledgeBaseService()
livekit_service = LiveKitService()

os.makedirs("uploads", exist_ok=True)
os.makedirs("data", exist_ok=True)


@app.get("/")
async def root():
    return {"message": "Voice AI Backend is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        file_path = os.path.join("uploads", file.filename)
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        result = await kb_service.ingest_document(file_path, file.filename)
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "Document uploaded and processed successfully",
                "filename": file.filename,
                "chunks": result["chunks"],
                "doc_id": result["doc_id"]
            }
        )
    except Exception as e:
        logger.error(f"Error uploading document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents")
async def list_documents():
    try:
        docs = await kb_service.list_documents()
        return {"documents": docs}
    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    try:
        # Get document info to find filename
        docs = await kb_service.list_documents()
        doc_to_delete = next((doc for doc in docs if doc["doc_id"] == doc_id), None)
        
        if doc_to_delete:
            filename = doc_to_delete["filename"]
            file_path = os.path.join("uploads", filename)
            
            # Delete file from uploads folder
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"Deleted file: {file_path}")
                except Exception as e:
                    logger.error(f"Error deleting file {file_path}: {e}")
        
        # Delete from knowledge base
        await kb_service.delete_document(doc_id)
        return {
            "status": "success",
            "message": "Document deleted successfully",
            "doc_id": doc_id
        }
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agent/prompt")
async def update_prompt(prompt_data: PromptUpdate):
    try:
        await livekit_service.update_system_prompt(prompt_data.prompt)
        return {"message": "Prompt updated successfully", "prompt": prompt_data.prompt}
    except Exception as e:
        logger.error(f"Error updating prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agent/prompt")
async def get_prompt():
    try:
        prompt = await livekit_service.get_system_prompt()
        return {"prompt": prompt}
    except Exception as e:
        logger.error(f"Error getting prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/livekit/token")
async def create_token(room_name: str = Form(...), participant_name: str = Form(...)):
    try:
        token = await livekit_service.create_token(room_name, participant_name)
        return {
            "token": token,
            "url": settings.livekit_url
        }
    except Exception as e:
        logger.error(f"Error creating token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agent/start")
async def start_agent(config: AgentConfig):
    try:
        result = await livekit_service.start_agent(config.room_name)
        return result
    except Exception as e:
        logger.error(f"Error starting agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agent/stop")
async def stop_agent(room_name: str = Form(...)):
    try:
        await livekit_service.stop_agent(room_name)
        return {"message": "Agent stopped successfully"}
    except Exception as e:
        logger.error(f"Error stopping agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agent/query")
async def query_agent(query_data: dict):
    """
    Process a text query through the RAG pipeline
    """
    try:
        query = query_data.get("query", "")
        room_name = query_data.get("room_name", "default")
        
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        # Retrieve relevant context from knowledge base
        rag_result = await kb_service.retrieve(query, top_k=3)
        
        # Import LLM service
        from app.services.llm_service import LLMService
        llm_service = LLMService()
        
        # Get system prompt
        system_prompt = await livekit_service.get_system_prompt()
        llm_service.set_system_prompt(system_prompt)
        
        # Generate response with RAG context
        response = await llm_service.generate_response(
            query=query,
            context_chunks=rag_result["chunks"],
            conversation_history=None
        )
        
        return {
            "response": response,
            "sources": rag_result["sources"],
            "chunks": rag_result["chunks"],
            "query": query
        }
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
async def get_config():
    """
    Get current configuration details
    Returns all configuration keys with their values
    """
    try:
        # Reload settings to get fresh values from JSON file
        fresh_settings = get_settings()
        config_dict = fresh_settings.to_dict()
        
        # Check if all required keys are configured (non-empty)
        required_keys = [
            "gemini_api_key",
            "livekit_url",
            "livekit_api_key",
            "livekit_api_secret",
            "deepgram_api_key"
        ]
        
        is_configured = all(config_dict.get(key) for key in required_keys)
        missing_keys = [key for key in required_keys if not config_dict.get(key)]
        
        return {
            "status": "success",
            "config": config_dict,
            "configured": is_configured,
            "missing_keys": missing_keys
        }
    except Exception as e:
        logger.error(f"Error getting config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/config")
async def update_config(config_data: Dict[str, Any]):
    """
    Add or update configuration details
    Replaces the entire configuration with provided values
    """
    try:
        # Get fresh settings instance
        current_settings = get_settings()
        
        # Update settings attributes
        for key, value in config_data.items():
            if hasattr(current_settings, key):
                setattr(current_settings, key, value)
        
        # Save to JSON file
        current_settings.save_config()
        
        return {
            "status": "success",
            "message": "Configuration updated successfully",
            "config": current_settings.to_dict()
        }
    except Exception as e:
        logger.error(f"Error updating config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/config")
async def update_config_partial(config_data: Dict[str, Any]):
    """
    Update specific configuration keys
    Only updates provided keys, rest remain unchanged
    """
    try:
        # Get fresh settings instance
        current_settings = get_settings()
        
        # Update only provided settings
        for key, value in config_data.items():
            if hasattr(current_settings, key):
                setattr(current_settings, key, value)
            else:
                logger.warning(f"Unknown configuration key: {key}")
        
        # Save to JSON file
        current_settings.save_config()
        
        return {
            "status": "success",
            "message": "Configuration updated successfully",
            "updated_keys": list(config_data.keys()),
            "config": current_settings.to_dict()
        }
    except Exception as e:
        logger.error(f"Error updating config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/documents")
async def delete_all_documents():
    """
    Delete all uploaded documents
    """
    try:
        deleted_files = []
        deleted_count = 0
        
        # Delete all files in uploads folder
        uploads_dir = "uploads"
        if os.path.exists(uploads_dir):
            for filename in os.listdir(uploads_dir):
                file_path = os.path.join(uploads_dir, filename)
                if os.path.isfile(file_path):
                    try:
                        os.remove(file_path)
                        deleted_files.append(filename)
                        deleted_count += 1
                        logger.info(f"Deleted file: {file_path}")
                    except Exception as e:
                        logger.error(f"Error deleting file {file_path}: {e}")
        
        # Clear knowledge base
        await kb_service.clear_all()
        
        return {
            "status": "success",
            "message": "All documents deleted successfully",
            "files_deleted": deleted_count,
            "deleted_files": deleted_files
        }
    except Exception as e:
        logger.error(f"Error deleting documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)