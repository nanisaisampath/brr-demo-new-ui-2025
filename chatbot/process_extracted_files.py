#!/usr/bin/env python3
"""
Script to process extracted JSON files and convert them to the format expected by the chatbot.
This script reads files from classification/data/ITSoli-BRR/extracted_text_files/
and processes them into the fixed_json directory.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any

def fix_json_manually(content: str) -> Dict[str, Any]:
    """
    Manually fix JSON format issues as a fallback.
    """
    import re
    
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
    import ast
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

def process_extracted_files():
    """
    Main function to process all extracted files.
    """
    # Define paths
    extracted_dir = Path("classification/data/ITSoli-BRR/extracted_text_files")
    fixed_dir = Path("chatbot/fixed_json")
    
    # Ensure directories exist
    if not extracted_dir.exists():
        print(f"Error: Extracted files directory not found: {extracted_dir}")
        return
    
    fixed_dir.mkdir(parents=True, exist_ok=True)
    
    # Process each extracted JSON file
    processed_count = 0
    
    for json_file in extracted_dir.glob("*.json"):
        try:
            print(f"Processing: {json_file.name}")
            
            # Parse the Python-style JSON file
            extracted_data = parse_python_style_json(json_file)
            
            # Extract text content
            text_content = extract_text_content(extracted_data)
            
            if not text_content:
                print(f"Warning: No text content found in {json_file.name}")
                continue
            
            # Create fixed format
            output_filename = json_file.name.replace('_extracted', '')
            fixed_data = create_fixed_format(output_filename, text_content)
            
            # Save to fixed_json directory
            output_path = fixed_dir / output_filename
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(fixed_data, f, indent=2, ensure_ascii=False)
            
            print(f"✓ Created: {output_path}")
            processed_count += 1
            
        except Exception as e:
            print(f"Error processing {json_file.name}: {e}")
    
    print(f"\nProcessing complete. {processed_count} files processed.")
    print(f"Fixed files saved to: {fixed_dir.absolute()}")

if __name__ == "__main__":
    # Change to the project root directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print("Starting extraction and processing...")
    process_extracted_files()
    print("Done!")