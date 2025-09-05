from fastapi import APIRouter, HTTPException, Depends
from models import ConversationResponse, MessageResponse
from dependencies import get_conversation_history
from typing import Dict, List

router = APIRouter(prefix="/conversations", tags=["conversations"])

@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    conversation_history: Dict[str, List[Dict[str, str]]] = Depends(get_conversation_history)
):
    """Get conversation history by ID."""
    # Validate conversation ID format
    if not conversation_id or not conversation_id.strip():
        raise HTTPException(status_code=400, detail="Conversation ID cannot be empty")
    
    if conversation_id not in conversation_history:
        raise HTTPException(status_code=404, detail=f"Conversation '{conversation_id}' not found")
    
    return ConversationResponse(
        conversation_id=conversation_id,
        messages=conversation_history[conversation_id]
    )

@router.delete("/{conversation_id}", response_model=MessageResponse)
async def delete_conversation(
    conversation_id: str,
    conversation_history: Dict[str, List[Dict[str, str]]] = Depends(get_conversation_history)
):
    """Delete conversation history by ID."""
    # Validate conversation ID format
    if not conversation_id or not conversation_id.strip():
        raise HTTPException(status_code=400, detail="Conversation ID cannot be empty")
    
    if conversation_id not in conversation_history:
        raise HTTPException(status_code=404, detail=f"Conversation '{conversation_id}' not found")
    
    del conversation_history[conversation_id]
    return MessageResponse(message=f"Conversation '{conversation_id}' deleted successfully")