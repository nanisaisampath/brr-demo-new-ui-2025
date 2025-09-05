from fastapi import APIRouter, HTTPException, Depends
from models import MessageResponse
from dependencies import get_document_processor, get_conversation_history
from document_processor import DocumentProcessor
from pathlib import Path
import shutil
import os
import json
import ast
import re
from typing import Dict, List, Any

router = APIRouter(prefix="/cleanup", tags=["cleanup"])

# Extraction functions integrated from process_extracted_files.py
def fix_json_manually(content: str) -> Dict[str, Any]:
    """
    Manually fix JSON format issues as a fallback.
    """
    # Replace triple quotes with proper JSON strings
    def replace_triple_quotes(match):
        text = match.group(1)
        # Escape quotes and newlines for JSON
        text = text.replace('"', '\\"')
        text = text.replace('\n', '\\n')
        text = text.strip()
        return f'"{text}"'
    
    # Pattern to match triple-quoted strings
    pattern = r'"""([\s\S]*?)"""'
    fixed_content = re.sub(pattern, replace_triple_quotes, content)
    
    try:
        return json.loads(fixed_content)
    except Exception as e:
        print(f"Manual fix also failed: {e}")
        return {}

def parse_python_style_json(file_path: str) -> Dict[str, Any]:
    """
    Parse JSON files that use Python-style triple quotes.
    """
    # Read the file as Python code and evaluate it safely
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Use ast.literal_eval to safely parse the Python-style JSON
    try:
        data = ast.literal_eval(content)
        return data
    except Exception as e:
        print(f"Error parsing {file_path} with ast.literal_eval: {e}")
        # Fallback: try to manually fix the format
        return fix_json_manually(content)

def extract_text_content(extracted_data: Dict[str, Any]) -> str:
    """
    Extract and combine text content from all pages in the extracted JSON.
    """
    combined_text = ""
    
    for page_key, page_content in extracted_data.items():
        if page_key.startswith('page_'):
            if isinstance(page_content, str):
                # Clean up the text content
                cleaned_content = page_content.replace('\\n', '\n').replace('\\"', '"')
                combined_text += cleaned_content + "\n\n"
            elif isinstance(page_content, dict):
                # Handle nested page content
                for key, value in page_content.items():
                    if isinstance(value, str):
                        cleaned_content = value.replace('\\n', '\n').replace('\\"', '"')
                        combined_text += cleaned_content + "\n\n"
    
    return combined_text.strip()

def create_fixed_format(filename: str, text_content: str) -> Dict[str, Any]:
    """
    Create the fixed format structure expected by the chatbot.
    """
    # Extract document type from filename prefix
    doc_type = filename.split('_')[0] if '_' in filename else 'unknown'
    
    # Create simplified structure focusing on text content
    fixed_format = {
        "document_info": {
            "filename": filename,
            "document_type": doc_type,
            "source": "extracted_text_processing"
        },
        "content": {
            "full_text": text_content,
            "processed_date": "2024-01-15",
            "processing_method": "automated_extraction"
        }
    }
    
    return fixed_format

def process_extracted_files_to_fixed_json() -> int:
    """
    Process extracted files and convert them to fixed_json format.
    Returns the number of files processed.
    """
    try:
        # Define paths relative to the chatbot directory
        extracted_dir = Path("../classification/data/ITSoli-BRR/extracted_text_files")
        fixed_dir = Path("fixed_json")
        
        # Ensure directories exist
        if not extracted_dir.exists():
            print(f"Error: Extracted files directory not found: {extracted_dir}")
            return 0
        
        try:
            fixed_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"Error creating fixed_json directory: {str(e)}")
            return 0
        
        # Process each extracted JSON file
        processed_count = 0
        error_count = 0
        
        try:
            json_files = list(extracted_dir.glob("*.json"))
        except Exception as e:
            print(f"Error accessing extracted files: {str(e)}")
            return 0
        
        if not json_files:
            print(f"No JSON files found in {extracted_dir}")
            return 0
        
        for json_file in json_files:
            try:
                print(f"Processing: {json_file.name}")
                
                # Parse the Python-style JSON file
                try:
                    extracted_data = parse_python_style_json(json_file)
                except Exception as e:
                    print(f"Error parsing JSON file {json_file.name}: {str(e)}")
                    error_count += 1
                    continue
                
                # Extract text content
                try:
                    text_content = extract_text_content(extracted_data)
                except Exception as e:
                    print(f"Error extracting text content from {json_file.name}: {str(e)}")
                    error_count += 1
                    continue
                
                if not text_content:
                    print(f"Warning: No text content found in {json_file.name}")
                    error_count += 1
                    continue
                
                # Create fixed format
                try:
                    output_filename = json_file.name.replace('_extracted', '')
                    fixed_data = create_fixed_format(output_filename, text_content)
                except Exception as e:
                    print(f"Error creating fixed format for {json_file.name}: {str(e)}")
                    error_count += 1
                    continue
                
                # Save to fixed_json directory
                try:
                    output_path = fixed_dir / output_filename
                    with open(output_path, 'w', encoding='utf-8') as f:
                        json.dump(fixed_data, f, indent=2, ensure_ascii=False)
                    
                    print(f"✓ Created: {output_path}")
                    processed_count += 1
                except Exception as e:
                    print(f"Error saving file {output_filename}: {str(e)}")
                    error_count += 1
                    continue
                
            except Exception as e:
                print(f"Unexpected error processing {json_file.name}: {str(e)}")
                error_count += 1
                continue
        
        if error_count > 0:
            print(f"\nProcessing complete with {error_count} errors. {processed_count} files processed successfully.")
        else:
            print(f"\nProcessing complete. {processed_count} files processed successfully.")
        
        return processed_count
        
    except Exception as e:
        print(f"Critical error in process_extracted_files_to_fixed_json: {str(e)}")
        return 0

@router.delete("/conversations", response_model=MessageResponse)
async def clear_all_conversations(
    conversation_history: Dict[str, List[Dict[str, str]]] = Depends(get_conversation_history)
):
    """Clear all conversation history."""
    try:
        count = len(conversation_history)
        conversation_history.clear()
        return MessageResponse(message=f"Cleared {count} conversations successfully")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing conversations: {str(e)}")

@router.delete("/documents", response_model=MessageResponse)
async def clear_documents(
    document_processor: DocumentProcessor = Depends(get_document_processor)
):
    """Clear all loaded documents from memory."""
    try:
        count = len(document_processor.documents)
        document_processor.documents.clear()
        document_processor.document_texts.clear()
        return MessageResponse(message=f"Cleared {count} documents from memory successfully")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing documents: {str(e)}")

@router.delete("/fixed-json", response_model=MessageResponse)
async def clear_fixed_json_files():
    """Clear all files in the fixed_json directory."""
    try:
        fixed_json_dir = Path("fixed_json")
        if not fixed_json_dir.exists():
            return MessageResponse(message="fixed_json directory does not exist")
        
        files_deleted = 0
        for file_path in fixed_json_dir.glob("*.json"):
            try:
                file_path.unlink()
                files_deleted += 1
            except Exception as e:
                print(f"Error deleting {file_path}: {e}")
        
        return MessageResponse(message=f"Deleted {files_deleted} files from fixed_json directory")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing fixed_json files: {str(e)}")

@router.delete("/all", response_model=MessageResponse)
async def clear_all_data(
    document_processor: DocumentProcessor = Depends(get_document_processor),
    conversation_history: Dict[str, List[Dict[str, str]]] = Depends(get_conversation_history)
):
    """Clear all chatbot data: conversations, documents, and fixed_json files."""
    try:
        # Clear conversations
        conv_count = len(conversation_history)
        conversation_history.clear()
        
        # Clear documents from memory
        doc_count = len(document_processor.documents)
        document_processor.documents.clear()
        document_processor.document_texts.clear()
        
        # Clear fixed_json files
        fixed_json_dir = Path("fixed_json")
        files_deleted = 0
        if fixed_json_dir.exists():
            for file_path in fixed_json_dir.glob("*.json"):
                try:
                    file_path.unlink()
                    files_deleted += 1
                except Exception as e:
                    print(f"Error deleting {file_path}: {e}")
        
        return MessageResponse(
            message=f"Complete cleanup: cleared {conv_count} conversations, {doc_count} documents from memory, and deleted {files_deleted} files from fixed_json directory"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during complete cleanup: {str(e)}")

@router.post("/reload-documents", response_model=MessageResponse)
async def reload_documents(
    document_processor: DocumentProcessor = Depends(get_document_processor)
):
    """Reload documents from the fixed_json directory. Auto-populate if empty."""
    try:
        # Clear existing documents
        document_processor.documents.clear()
        document_processor.document_texts.clear()
        
        # Check if fixed_json directory exists and has files
        fixed_json_dir = Path("fixed_json")
        if not fixed_json_dir.exists():
            fixed_json_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if directory is empty
        json_files_list = list(fixed_json_dir.glob("*.json"))
        
        if not json_files_list:
            print("fixed_json directory is empty. Auto-populating from extracted files...")
            processed_count = process_extracted_files_to_fixed_json()
            if processed_count == 0:
                return MessageResponse(message="No extracted files found to process - fixed_json remains empty")
            print(f"Auto-populated {processed_count} files to fixed_json directory")
        
        # Reload documents
        json_files = document_processor.load_json_files(str(fixed_json_dir))
        document_processor.convert_to_documents(json_files)
        
        # Print status messages like build_index does
        print(f"Loaded {len(json_files)} JSON files")
        print(f"Created {len(document_processor.documents)} documents")
        print(f"Prepared {len(document_processor.documents)} documents for querying")
        print("Documents ready for chat interactions")
        
        return MessageResponse(
            message=f"Reloaded {len(document_processor.documents)} documents from fixed_json directory"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reloading documents: {str(e)}")