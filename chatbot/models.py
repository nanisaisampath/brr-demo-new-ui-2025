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
        valid_actions = ['all', 'reload', 'clear', 'selective']
        if v not in valid_actions:
            raise ValueError(f'Action must be one of: {", ".join(valid_actions)}')
        return v

class DocumentItem(BaseModel):
    filename: str
    filepath: str
    document_type: str
    size: Optional[int] = None
    last_modified: Optional[str] = None
    selected: bool = False

class SelectiveProcessRequest(BaseModel):
    action: str
    selected_files: List[str]
    
    @validator('action')
    def validate_action(cls, v):
        if v != 'selective':
            raise ValueError('Action must be "selective" for selective processing')
        return v
    
    @validator('selected_files')
    def validate_selected_files(cls, v):
        if not v or len(v) == 0:
            raise ValueError('At least one file must be selected')
        return v

class DocumentListResponse(BaseModel):
    documents: List[DocumentItem]
    total_count: int

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