from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dependencies import initialize_document_processor
from routes import chat, documents, conversations, health, cleanup

# Initialize FastAPI app
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await initialize_document_processor()
    yield
    # Shutdown (if needed)
    pass

app = FastAPI(
    title="Document Chatbot API",
    description="API for chatbot interactions with extracted document data",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(conversations.router)
app.include_router(health.router)
app.include_router(cleanup.router)

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Document Chatbot API",
        "version": "1.0.0",
        "endpoints": ["/chat", "/documents/summary", "/documents/search", "/documents/process", "/conversations", "/health", "/cleanup"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)