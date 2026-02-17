from pydantic import BaseModel
from typing import Optional, List


class PromptUpdate(BaseModel):
    prompt: str


class AgentConfig(BaseModel):
    room_name: str
    system_prompt: Optional[str] = None


class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    chunks: int
    created_at: str


class RAGContext(BaseModel):
    chunks: List[str]
    sources: List[str]
    scores: List[float]


class TranscriptMessage(BaseModel):
    role: str
    content: str
    timestamp: float
    is_final: bool = True
