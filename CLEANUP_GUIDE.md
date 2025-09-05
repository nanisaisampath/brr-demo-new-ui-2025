# Chatbot Data Cleanup Guide

This guide explains how to clean up chatbot data including conversations, documents, and processed files.

## Overview

The chatbot system stores data in several locations:
- **Conversations**: Chat history stored in memory and potentially in a database
- **Documents**: Processed documents loaded into the chatbot's memory for querying
- **Fixed JSON Files**: Processed document files in the `chatbot/fixed_json/` directory
- **Extracted Text Files**: Raw extracted text files in the `extracted_text_files/` directory

## Cleanup Methods

### 1. Frontend UI Cleanup (Recommended)

The chatbot interface includes built-in cleanup buttons:

1. **Open the chatbot** by clicking the chat icon in the bottom-right corner
2. **Navigate to the main menu** if you're in a chat session
3. **Find the "Data Management" section** at the bottom of the menu
4. **Choose your cleanup option**:
   - **Clear Conversations**: Removes only chat history
   - **Clear All Data**: Removes conversations, documents from memory, and fixed_json files

### 2. API Endpoints

You can also use the REST API directly:

```bash
# Clear only conversations
curl -X DELETE http://localhost:8000/cleanup/conversations

# Clear only documents from memory
curl -X DELETE http://localhost:8000/cleanup/documents

# Clear only fixed_json files
curl -X DELETE http://localhost:8000/cleanup/fixed-json

# Clear all data (conversations + documents + fixed_json files)
curl -X DELETE http://localhost:8000/cleanup/all

# Reload documents after cleanup
curl -X POST http://localhost:8000/cleanup/reload-documents
```

### 3. Command Line Script

Use the standalone cleanup script for more control:

```bash
# Navigate to the project root
cd C:\Users\ITSOLI\Downloads\brr-demo

# Clear all data (interactive mode)
python cleanup_chatbot_data.py --all --interactive

# Clear only fixed_json files
python cleanup_chatbot_data.py --fixed-json-only

# Dry run to see what would be deleted
python cleanup_chatbot_data.py --all --dry-run

# Clear everything including extracted text files
python cleanup_chatbot_data.py --all --include-extracted
```

#### Script Options:
- `--all`: Clear all chatbot data
- `--fixed-json-only`: Clear only the fixed_json directory
- `--include-extracted`: Also clear extracted_text_files directory
- `--interactive`: Ask for confirmation before each action
- `--dry-run`: Show what would be deleted without actually deleting

## What Gets Cleaned

### Clear Conversations
- Removes chat history from memory
- Resets conversation state

### Clear Documents
- Removes loaded documents from chatbot memory
- Documents need to be reloaded to chat about them again

### Clear Fixed JSON
- Deletes all files in `chatbot/fixed_json/` directory
- These are the processed document files used by the chatbot

### Clear All Data
- Combines all the above cleanup operations
- Provides a complete reset of the chatbot system

## Important Notes

⚠️ **Warning**: Cleanup operations are **irreversible**. Make sure you have backups if needed.

✅ **Safe Operations**:
- Clearing conversations only affects chat history
- Clearing documents only affects memory, files remain intact
- The original extracted text files are preserved unless explicitly included

🔄 **After Cleanup**:
- The chatbot will automatically reload available documents
- You may need to reprocess documents if you cleared the fixed_json directory
- Use the "Process All Documents" feature to rebuild the fixed_json files

## Troubleshooting

### Backend Server Issues
If cleanup operations fail:
1. Ensure the backend server is running on `http://localhost:8000`
2. Check the terminal for error messages
3. Restart the backend server if needed:
   ```bash
   cd chatbot
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Permission Issues
If you get permission errors when deleting files:
1. Make sure no applications are using the files
2. Run the command prompt as administrator (Windows)
3. Check file permissions

### Frontend Issues
If the cleanup buttons don't work:
1. Check the browser console for errors
2. Ensure the frontend can connect to the backend
3. Refresh the page and try again

## Automation

You can automate cleanup using scheduled tasks or cron jobs:

```bash
# Example: Daily cleanup of conversations only
python cleanup_chatbot_data.py --conversations-only --non-interactive

# Example: Weekly full cleanup
python cleanup_chatbot_data.py --all --non-interactive
```

## Recovery

If you accidentally delete important data:
1. **Fixed JSON files**: Use "Process All Documents" to regenerate from extracted text files
2. **Extracted text files**: Re-run the document extraction process
3. **Conversations**: Cannot be recovered unless backed up separately

For questions or issues, check the application logs or contact the development team.