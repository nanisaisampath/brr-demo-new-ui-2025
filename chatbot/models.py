from pydantic import BaseModel, validator
from typing import List, Dict, Optional

class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    sources: Optional[List[str]] = None

class DocumentSummary(BaseModel):
    total_documents: int
    document_types: Dict[str, int]
    filenames: List[str]

class DocumentSearchRequest(BaseModel):
    document_type: str

class ProcessRequest(BaseModel):
    action: str
    
    @validator('action')
    def validate_action(cls, v):
        valid_actions = ['all', 'reload', 'clear']
        if v not in valid_actions:
            raise ValueError(f'Action must be one of: {", ".join(valid_actions)}')
        return v  # "all"

class HealthResponse(BaseModel):
    status: str
    document_processor_initialized: bool
    documents_loaded: int
    google_api_key_set: bool
    data_directory_exists: bool
    active_conversations: int

class ConversationResponse(BaseModel):
    conversation_id: str
    messages: List[Dict[str, str]]

class MessageResponse(BaseModel):
    message: str