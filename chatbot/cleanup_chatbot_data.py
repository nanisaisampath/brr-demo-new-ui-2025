#!/usr/bin/env python3
"""
Chatbot Data Cleanup Script

This script provides comprehensive cleanup functionality for the chatbot system:
1. Clears the fixed_json directory
2. Optionally clears extracted text files
3. Provides options for selective cleanup

Usage:
    python cleanup_chatbot_data.py [options]
    
Options:
    --all                   Clean everything (fixed_json + extracted files)
    --fixed-json-only       Clean only fixed_json directory (default)
    --extracted-only        Clean only extracted text files
    --interactive           Interactive mode with prompts
    --dry-run              Show what would be deleted without actually deleting
"""

import argparse
import os
import shutil
from pathlib import Path
from typing import List

def get_file_count(directory: Path, pattern: str = "*.json") -> int:
    """Get count of files matching pattern in directory."""
    if not directory.exists():
        return 0
    return len(list(directory.glob(pattern)))

def delete_files_in_directory(directory: Path, pattern: str = "*.json", dry_run: bool = False) -> int:
    """Delete files matching pattern in directory."""
    if not directory.exists():
        print(f"Directory does not exist: {directory}")
        return 0
    
    files_to_delete = list(directory.glob(pattern))
    
    if dry_run:
        print(f"Would delete {len(files_to_delete)} files from {directory}:")
        for file_path in files_to_delete:
            print(f"  - {file_path.name}")
        return len(files_to_delete)
    
    deleted_count = 0
    for file_path in files_to_delete:
        try:
            file_path.unlink()
            deleted_count += 1
            print(f"Deleted: {file_path.name}")
        except Exception as e:
            print(f"Error deleting {file_path.name}: {e}")
    
    return deleted_count

def cleanup_fixed_json(dry_run: bool = False) -> int:
    """Clean up the fixed_json directory."""
    fixed_json_dir = Path("chatbot/fixed_json")
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Cleaning fixed_json directory...")
    
    if not fixed_json_dir.exists():
        print("fixed_json directory does not exist.")
        return 0
    
    return delete_files_in_directory(fixed_json_dir, "*.json", dry_run)

def cleanup_extracted_files(dry_run: bool = False) -> int:
    """Clean up the extracted text files directory."""
    extracted_dir = Path("classification/data/ITSoli-BRR/extracted_text_files")
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Cleaning extracted text files...")
    
    if not extracted_dir.exists():
        print("extracted_text_files directory does not exist.")
        return 0
    
    return delete_files_in_directory(extracted_dir, "*.json", dry_run)

def interactive_cleanup():
    """Interactive cleanup with user prompts."""
    print("\n=== Interactive Chatbot Data Cleanup ===")
    
    # Show current state
    fixed_json_dir = Path("chatbot/fixed_json")
    extracted_dir = Path("classification/data/ITSoli-BRR/extracted_text_files")
    
    fixed_json_count = get_file_count(fixed_json_dir)
    extracted_count = get_file_count(extracted_dir)
    
    print(f"\nCurrent state:")
    print(f"  - Fixed JSON files: {fixed_json_count} files")
    print(f"  - Extracted text files: {extracted_count} files")
    
    if fixed_json_count == 0 and extracted_count == 0:
        print("\nNo files to clean up.")
        return
    
    print("\nWhat would you like to clean up?")
    print("1. Fixed JSON files only")
    print("2. Extracted text files only")
    print("3. Both fixed JSON and extracted files")
    print("4. Cancel")
    
    choice = input("\nEnter your choice (1-4): ").strip()
    
    if choice == "1":
        if fixed_json_count > 0:
            confirm = input(f"Delete {fixed_json_count} fixed JSON files? (y/N): ").strip().lower()
            if confirm == 'y':
                deleted = cleanup_fixed_json()
                print(f"\nDeleted {deleted} fixed JSON files.")
        else:
            print("No fixed JSON files to delete.")
    
    elif choice == "2":
        if extracted_count > 0:
            confirm = input(f"Delete {extracted_count} extracted text files? (y/N): ").strip().lower()
            if confirm == 'y':
                deleted = cleanup_extracted_files()
                print(f"\nDeleted {deleted} extracted text files.")
        else:
            print("No extracted text files to delete.")
    
    elif choice == "3":
        total_files = fixed_json_count + extracted_count
        if total_files > 0:
            confirm = input(f"Delete all {total_files} files ({fixed_json_count} fixed JSON + {extracted_count} extracted)? (y/N): ").strip().lower()
            if confirm == 'y':
                deleted_fixed = cleanup_fixed_json()
                deleted_extracted = cleanup_extracted_files()
                print(f"\nDeleted {deleted_fixed + deleted_extracted} files total.")
        else:
            print("No files to delete.")
    
    elif choice == "4":
        print("Cleanup cancelled.")
    
    else:
        print("Invalid choice. Cleanup cancelled.")

def main():
    parser = argparse.ArgumentParser(
        description="Clean up chatbot data files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument("--all", action="store_true", help="Clean everything")
    parser.add_argument("--fixed-json-only", action="store_true", help="Clean only fixed_json directory")
    parser.add_argument("--extracted-only", action="store_true", help="Clean only extracted text files")
    parser.add_argument("--interactive", action="store_true", help="Interactive mode")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted")
    
    args = parser.parse_args()
    
    # Change to the script's directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print("Chatbot Data Cleanup Script")
    print("===========================")
    
    if args.interactive:
        interactive_cleanup()
        return
    
    # Default to fixed-json-only if no specific option is given
    if not any([args.all, args.fixed_json_only, args.extracted_only]):
        args.fixed_json_only = True
    
    total_deleted = 0
    
    if args.all or args.fixed_json_only:
        total_deleted += cleanup_fixed_json(args.dry_run)
    
    if args.all or args.extracted_only:
        total_deleted += cleanup_extracted_files(args.dry_run)
    
    if args.dry_run:
        print(f"\n[DRY RUN] Would delete {total_deleted} files total.")
    else:
        print(f"\nCleanup complete. Deleted {total_deleted} files total.")

if __name__ == "__main__":
    main()