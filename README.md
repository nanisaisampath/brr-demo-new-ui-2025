# BRR Demo - Document Analysis Web Application

A full-stack web application for document analysis and chatbot interactions, built with Next.js frontend and FastAPI backend.

## Prerequisites

### Required Software
- **Node.js** LTS 18.18+ or 20.x
- **Python** 3.8+ (recommended: 3.11+)
- **pnpm** (via Corepack)

### Enable pnpm with Corepack (Windows PowerShell)

```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

## Setup Instructions

### 1) Clone and Navigate to Project

```powershell
# If cloning from repository
git clone <repository-url>
cd brr-demo

# Or if extracting from archive
cd brr-demo
```

### 2) Frontend Setup

Install Node.js dependencies:

```powershell
pnpm install --frozen-lockfile
```

### 3) Backend Setup

Set up Python virtual environment and install dependencies:

```powershell
# Create virtual environment
python -m venv .venv

# Activate virtual environment
.venv\Scripts\Activate.ps1

# Install Python dependencies
cd chatbot
pip install -r requirements_simple.txt
cd ..
```

### 4) Environment Configuration

Copy the example environment file and configure as needed:

```powershell
copy env.example .env.local
```

**Note**: Environment variables are optional for basic functionality.

### 5) Start the Application

#### Option A: Start Both Services Together (Recommended)

```powershell
# Ensure virtual environment is activated
.venv\Scripts\Activate.ps1

# Start both frontend and backend
pnpm dev
```

This will start:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

#### Option B: Start Services Separately

**Terminal 1 - Backend:**
```powershell
.venv\Scripts\Activate.ps1
cd chatbot
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```powershell
pnpm run dev:frontend
```

## Application Features

### Frontend (Next.js)
- **Document Analysis Interface**: Upload and analyze documents
- **Interactive Chatbot**: Ask questions about processed documents
- **PDF Viewer**: Built-in PDF viewing capabilities
- **S3 Browser**: Browse and manage cloud storage
- **Classification Results**: View document classification outcomes

### Backend (FastAPI)
- **Document Processing API**: Process and analyze documents
- **Chat API**: Handle chatbot interactions with document context
- **Document Management**: CRUD operations for documents
- **Health Monitoring**: System health and status endpoints
- **Cleanup Utilities**: Data cleanup and maintenance tools

## API Endpoints

Once running, the backend API will be available at `http://localhost:8000` with the following key endpoints:

- `GET /` - API information and available endpoints
- `POST /chat/` - Chat with documents
- `GET /documents/summary` - Get document summaries
- `POST /documents/process` - Process new documents
- `GET /health` - Health check
- `POST /cleanup` - Data cleanup operations

**API Documentation**: Visit `http://localhost:8000/docs` for interactive API documentation.

## Project Structure

```
brr-demo/
├── app/                    # Next.js app directory
├── components/             # React components
├── chatbot/               # Python backend
│   ├── routes/            # API route handlers
│   ├── fixed_json/        # Processed document data
│   └── main.py           # FastAPI application
├── classification/        # Document classification logic
├── lib/                   # Utility libraries
└── public/               # Static assets
```

## Development Commands

```powershell
# Start development servers
pnpm dev

# Start only frontend
pnpm run dev:frontend

# Start only backend (from chatbot directory)
python -m uvicorn main:app --reload

# Run tests
pnpm test              # End-to-end tests
pnpm run test:api      # Backend API tests

# Build for production
pnpm build
pnpm start
```

## Troubleshooting

### Common Issues

**Installation Problems:**
```powershell
# Clear caches and reinstall
pnpm install --force
rm -rf .next node_modules
pnpm install
```

**Backend Not Starting:**
```powershell
# Ensure virtual environment is activated
.venv\Scripts\Activate.ps1

# Check Python dependencies
cd chatbot
pip install -r requirements_simple.txt

# Verify port 8000 is available
netstat -an | findstr :8000
```

**Chat Functionality Issues:**
- Ensure both frontend and backend are running
- Check that documents are loaded in `chatbot/fixed_json/`
- Verify API connectivity at `http://localhost:8000/health`

**PDF Viewer Problems:**
- Confirm the PDF worker file exists at `public/pdf.worker.min.mjs`
- Check browser console for JavaScript errors
- Ensure PDF files are accessible

### Getting Help

1. Check the browser console for frontend errors
2. Check the terminal output for backend errors
3. Visit `http://localhost:8000/docs` for API documentation
4. Ensure all prerequisites are properly installed

## Sharing the Project

**Recommended**: Share via Git repository (excludes `node_modules`, `.next`, etc.)

**Alternative**: Create archive excluding:
- `node_modules/`
- `.next/`
- `.turbo/`
- `__pycache__/`
- `.venv/`

Ensure `package.json`, `pnpm-lock.yaml`, and `requirements_simple.txt` are included for reproducible installs.


