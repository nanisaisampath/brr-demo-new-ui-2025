from fastapi import HTTPException
from document_processor import DocumentProcessor
from typing import Dict, List
import os
from pathlib import Path

# Global variables
document_processor: DocumentProcessor = None
conversation_history: Dict[str, List[Dict[str, str]]] = {}

# Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
DATA_DIRECTORY = r"c:\Users\ITSOLI\Downloads\brr-demo\chatbot\fixed_json"

def get_document_processor() -> DocumentProcessor:
    """Dependency to get the document processor instance."""
    if not document_processor:
        raise HTTPException(status_code=503, detail="Document processor not initialized")
    return document_processor

def get_conversation_history() -> Dict[str, List[Dict[str, str]]]:
    """Dependency to get the conversation history."""
    return conversation_history

async def initialize_document_processor():
    """Initialize the document processor on startup."""
    global document_processor
    
    if not GOOGLE_API_KEY:
        print("Warning: GOOGLE_API_KEY not set. Please set it in environment variables.")
        return
    
    try:
        document_processor = DocumentProcessor(api_key=GOOGLE_API_KEY)
        
        # Check if data directory exists
        if Path(DATA_DIRECTORY).exists():
            document_processor.build_index(DATA_DIRECTORY)
            print(f"Successfully loaded documents from {DATA_DIRECTORY}")
        else:
            print(f"Warning: Data directory not found: {DATA_DIRECTORY}")
    except Exception as e:
        print(f"Error initializing document processor: {e}")