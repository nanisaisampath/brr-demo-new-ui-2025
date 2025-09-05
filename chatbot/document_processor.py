import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class DocumentProcessor:
    """Handles document processing and LLM integration."""
    
    def __init__(self, api_key: str = None):
        """Initialize the document processor with Google Generative AI."""
        self.api_key = api_key or os.getenv('GOOGLE_API_KEY')
        if not self.api_key:
            raise ValueError("Google API key is required")
        
        # Configure Google Generative AI
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Storage for processed documents
        self.documents: List[Dict[str, Any]] = []
        self.document_texts: List[str] = []
        
    def load_json_files(self, directory_path: str) -> List[Dict]:
        """
        Load all JSON files from the specified directory.
        """
        json_files = []
        directory = Path(directory_path)
        
        if not directory.exists():
            raise FileNotFoundError(f"Directory not found: {directory_path}")
            
        for json_file in directory.glob("*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    json_files.append({
                        'filename': json_file.name,
                        'filepath': str(json_file),
                        'data': data
                    })
            except Exception as e:
                print(f"Error loading {json_file}: {e}")
                
        return json_files
    
    def convert_to_documents(self, json_data: List[Dict]) -> None:
        """Convert JSON data to document format for processing."""
        self.documents = []
        self.document_texts = []
        
        for item in json_data:
            filename = item.get('filename', 'unknown')
            data = item.get('data', {})
            
            # Convert JSON data to text
            text_content = self._json_to_text(data)
            
            # Store document with metadata
            doc_info = {
                'filename': filename,
                'filepath': item.get('filepath', ''),
                'document_type': self._detect_document_type(data),
                'source': 'extracted_text_files',
                'text': text_content
            }
            
            self.documents.append(doc_info)
            self.document_texts.append(text_content)
    
    def _extract_document_type(self, filename: str) -> str:
        """
        Extract document type from filename.
        """
        # Map common prefixes to document types
        type_mapping = {
            'ATR': 'Analytical Testing Report',
            'BRS': 'Batch Record Summary',
            'CCI': 'Container Closure Integrity',
            'CC': 'Certificate of Compliance',
            'CLR': 'Certificate of Laboratory Report',
            'COA': 'Certificate of Analysis',
            'CS': 'Certificate of Sterilization',
            'CVR': 'Certificate of Validation Report',
            'DR': 'Deviation Report',
            'ECR': 'Environmental Control Report',
            'EMR': 'Equipment Maintenance Report',
            'IR': 'Inspection Report',
            'MRSL': 'Material Release Summary Log',
            'MRS': 'Material Release Summary',
            'PCTD': 'Process Control Test Data',
            'PR': 'Production Report'
        }
        
        for prefix, doc_type in type_mapping.items():
            if filename.startswith(prefix):
                return doc_type
                
        return 'Unknown Document Type'
    
    def build_index(self, json_directory: str):
        """
        Prepare documents for querying (simplified without vector indexing).
        """
        # Load JSON files
        json_data = self.load_json_files(json_directory)
        print(f"Loaded {len(json_data)} JSON files")
        
        # Convert to documents
        self.convert_to_documents(json_data)
        print(f"Created {len(self.documents)} documents")
        
        # Prepare for querying
        if self.documents:
            print(f"Prepared {len(self.documents)} documents for querying")
            print("Documents ready for chat interactions")
        else:
            raise ValueError("No documents found to index")
    
    def query_documents(self, question: str, conversation_history: List[Dict[str, str]] = None) -> str:
        """
        Query the documents using Google Generative AI with conversation context.
        """
        if not self.documents:
            raise ValueError("No documents loaded. Call build_index() first.")
            
        try:
            # Check if API key is valid (not dummy)
            if not self.api_key or self.api_key == "AIzaSyDummy_Key_For_Testing":
                # Fallback response when API key is not valid
                doc_list = [doc['filename'] for doc in self.documents[:5]]
                return f"I have access to {len(self.documents)} documents including: {', '.join(doc_list)}. However, I need a valid Google API key to provide detailed responses. Please set up your GOOGLE_API_KEY environment variable."
            
            # Create context from relevant documents
            context = "\n\n".join([f"Document: {doc['filename']}\n{doc['text'][:1000]}" for doc in self.documents[:5]])
            
            # Build conversation context
            conversation_context = ""
            if conversation_history and len(conversation_history) > 1:
                # Get last few exchanges (excluding current question)
                recent_history = conversation_history[-6:-1]  # Last 3 exchanges
                conversation_context = "\n".join([
                    f"{msg['role'].title()}: {msg['message']}" for msg in recent_history
                ])
                conversation_context = f"\n\nPrevious conversation:\n{conversation_context}\n"
            
            prompt = f"""You are a helpful assistant that answers questions based on document content. Use the conversation history to provide contextual and varied responses.

Documents:
{context}{conversation_context}

Current Question: {question}

Please provide a helpful and contextual answer based on the documents and conversation history:"""
            
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            # Fallback response for any API errors
            doc_list = [doc['filename'] for doc in self.documents[:5]]
            return f"I have access to {len(self.documents)} documents including: {', '.join(doc_list)}. However, I encountered an error with the AI service: {str(e)}"
    
    def _json_to_text(self, data: Dict) -> str:
        """
        Convert JSON data to readable text format.
        """
        if isinstance(data, dict):
            text_parts = []
            for key, value in data.items():
                if isinstance(value, (dict, list)):
                    text_parts.append(f"{key}: {json.dumps(value, indent=2)}")
                else:
                    text_parts.append(f"{key}: {value}")
            return "\n".join(text_parts)
        else:
            return json.dumps(data, indent=2)
    
    def _detect_document_type(self, data: Dict) -> str:
        """
        Detect document type from JSON data structure.
        """
        # Look for common keys that indicate document type
        if 'certificate' in str(data).lower():
            return 'Certificate'
        elif 'report' in str(data).lower():
            return 'Report'
        elif 'analysis' in str(data).lower():
            return 'Analysis'
        else:
            return 'Document'
    
    def summarize_documents(self, document_type: str = None) -> str:
        """
        Generate a summary of documents, optionally filtered by type.
        """
        if not self.documents:
            raise ValueError("No documents loaded. Call build_index() first.")
        
        # Filter documents by type if specified
        docs_to_summarize = self.documents
        if document_type:
            docs_to_summarize = [
                doc for doc in self.documents 
                if doc.get('document_type', '').lower() == document_type.lower()
            ]
        
        if not docs_to_summarize:
            return f"No documents found for type: {document_type}"
        
        # Create summary prompt
        doc_texts = [doc['text'][:500] for doc in docs_to_summarize[:5]]  # Limit for context
        combined_text = "\n\n".join(doc_texts)
        
        prompt = f"""Please provide a comprehensive summary of the following documents:
        
        {combined_text}
        
        Summary:"""
        
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error generating summary: {str(e)}"
    
    def get_document_summary(self) -> Dict:
        """
        Get a summary of loaded documents.
        """
        if not self.documents:
            return {"total_documents": 0, "document_types": {}}
            
        doc_types = {}
        for doc in self.documents:
            doc_type = doc.get('document_type', 'Unknown')
            doc_types[doc_type] = doc_types.get(doc_type, 0) + 1
            
        return {
            "total_documents": len(self.documents),
            "document_types": doc_types,
            "filenames": [doc.get('filename', 'Unknown') for doc in self.documents]
        }
    
    def search_by_document_type(self, doc_type: str) -> List[Dict]:
        """
        Search documents by type.
        """
        matching_docs = []
        for doc in self.documents:
            if doc_type.lower() in doc.get('document_type', '').lower():
                matching_docs.append({
                    'filename': doc.get('filename'),
                    'document_type': doc.get('document_type'),
                    'filepath': doc.get('filepath', ''),
                    'content_preview': doc['text'][:200] + "..." if len(doc['text']) > 200 else doc['text']
                })
        return matching_docs