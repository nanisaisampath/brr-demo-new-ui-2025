from fastapi import APIRouter, HTTPException, Depends
from models import ChatMessage, ChatResponse
from dependencies import get_document_processor, get_conversation_history
from document_processor import DocumentProcessor
from typing import Dict, List

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/", response_model=ChatResponse)
async def chat(
    message: ChatMessage,
    document_processor: DocumentProcessor = Depends(get_document_processor),
    conversation_history: Dict[str, List[Dict[str, str]]] = Depends(get_conversation_history)
):
    """Handle chat messages and return responses."""
    # Validate input message
    if not message.message or not message.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    if not document_processor.documents:
        raise HTTPException(status_code=503, detail="No documents loaded")
    
    try:
        # Generate conversation ID if not provided
        conv_id = message.conversation_id or f"conv_{len(conversation_history)}"
        
        # Store conversation history
        if conv_id not in conversation_history:
            conversation_history[conv_id] = []
        
        conversation_history[conv_id].append({"role": "user", "message": message.message})
        
        # Query the documents with conversation history
        response = document_processor.query_documents(message.message, conversation_history[conv_id])
        
        # Store assistant response
        conversation_history[conv_id].append({"role": "assistant", "message": response})
        
        return ChatResponse(
            response=response,
            conversation_id=conv_id,
            sources=[doc.get('filename', 'Unknown') for doc in document_processor.documents[:3]]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")