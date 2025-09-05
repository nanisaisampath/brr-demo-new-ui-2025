from fastapi import APIRouter, Depends
from models import HealthResponse
from dependencies import get_conversation_history, GOOGLE_API_KEY, DATA_DIRECTORY
from pathlib import Path
from typing import Dict, List
import dependencies

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/", response_model=HealthResponse)
@router.get("", response_model=HealthResponse)
async def health_check(
    conversation_history: Dict[str, List[Dict[str, str]]] = Depends(get_conversation_history)
):
    """Detailed health check."""
    return HealthResponse(
        status="healthy",
        document_processor_initialized=dependencies.document_processor is not None,
        documents_loaded=len(dependencies.document_processor.documents) if dependencies.document_processor else 0,
        google_api_key_set=bool(GOOGLE_API_KEY),
        data_directory_exists=Path(DATA_DIRECTORY).exists(),
        active_conversations=len(conversation_history)
    )