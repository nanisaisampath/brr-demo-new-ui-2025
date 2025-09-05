from fastapi import APIRouter, HTTPException, Depends
from models import DocumentSummary, DocumentSearchRequest, ProcessRequest
from dependencies import get_document_processor
from document_processor import DocumentProcessor
from pathlib import Path

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/summary", response_model=DocumentSummary)
async def get_document_summary(
    document_processor: DocumentProcessor = Depends(get_document_processor)
):
    """Get summary of loaded documents."""
    try:
        summary = document_processor.get_document_summary()
        return DocumentSummary(**summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting summary: {str(e)}")

@router.post("/search")
async def search_documents(
    request: DocumentSearchRequest,
    document_processor: DocumentProcessor = Depends(get_document_processor)
):
    """Search documents by type."""
    # Validate input
    if not request.document_type or not request.document_type.strip():
        raise HTTPException(status_code=400, detail="Document type cannot be empty")
    
    try:
        results = document_processor.search_by_document_type(request.document_type)
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching documents: {str(e)}")

@router.post("/process")
async def process_documents(
    request: ProcessRequest,
    document_processor: DocumentProcessor = Depends(get_document_processor)
):
    """Process all documents. Auto-populate if no documents loaded."""
    try:
        # Check if documents are loaded, if not try to auto-populate
        if not document_processor.documents:
            print("No documents loaded. Checking for auto-population...")
            
            # Check if fixed_json directory has files
            fixed_json_dir = Path("fixed_json")
            if fixed_json_dir.exists():
                json_files_list = list(fixed_json_dir.glob("*.json"))
                if json_files_list:
                    # Load existing files
                    json_files = document_processor.load_json_files(str(fixed_json_dir))
                    document_processor.convert_to_documents(json_files)
                    print(f"Auto-loaded {len(document_processor.documents)} existing documents")
                else:
                    # Try to populate from extracted files
                    try:
                        from .cleanup import process_extracted_files_to_fixed_json
                        processed_count = process_extracted_files_to_fixed_json()
                        if processed_count > 0:
                            json_files = document_processor.load_json_files(str(fixed_json_dir))
                            document_processor.convert_to_documents(json_files)
                            print(f"Auto-populated and loaded {len(document_processor.documents)} documents")
                        else:
                            print("No files were processed during auto-population attempt")
                    except Exception as e:
                        print(f"Error during auto-population: {str(e)}")
                        # Continue without auto-population if it fails
            
            # If still no documents after auto-population attempt
            if not document_processor.documents:
                return {
                    "message": "No documents available to process. Please ensure extracted files exist in classification/data/ITSoli-BRR/extracted_text_files/",
                    "documents_loaded": 0
                }
        
        if request.action == "all":
            summary = document_processor.get_document_summary()
            return {
                "message": "Processing all documents",
                "summary": summary
            }
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Use 'all'")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing documents: {str(e)}")