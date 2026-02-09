# athena_api.py - FastAPI with RAG + Real LLM
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from sentence_transformers import SentenceTransformer
import numpy as np
from numpy import dot
from numpy.linalg import norm
import ollama

# Initialize FastAPI
app = FastAPI(
    title="Athena Learning Platform API",
    description="RAG-powered learning assistant with real LLM",
    version="0.1.0"
)

# Enable CORS (so frontend can access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize embedding model (happens once at startup)
print("Loading embedding model...")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
print("Embedding model loaded! ✅")

# In-memory document storage (will use Qdrant later)
documents = []
doc_embeddings = []

# Pydantic models for request/response
class DocumentUpload(BaseModel):
    text: str
    metadata: Optional[dict] = {}

class ChatRequest(BaseModel):
    question: str
    top_k: int = 3

class ChatResponse(BaseModel):
    question: str
    answer: str
    sources: List[dict]
    context_used: str

class SearchResult(BaseModel):
    doc_id: int
    score: float
    text: str

# Helper function: Search documents
def search_documents(query: str, top_k: int = 3) -> List[dict]:
    """Search for relevant documents using vector similarity"""
    if not documents:
        return []

    # Embed query
    query_embedding = embedding_model.encode([query])[0]

    # Calculate similarities
    similarities = []
    for i, doc_emb in enumerate(doc_embeddings):
        sim = dot(query_embedding, doc_emb) / (norm(query_embedding) * norm(doc_emb))
        similarities.append({
            'doc_id': i,
            'score': float(sim),
            'text': documents[i]['text'],
            'metadata': documents[i].get('metadata', {})
        })

    # Sort and return top k
    similarities.sort(key=lambda x: x['score'], reverse=True)
    return similarities[:top_k]

# Helper function: Call LLM
def call_llm(prompt: str, model: str = "llama3.2:3b") -> str:
    """Call Ollama LLM with a prompt"""
    try:
        response = ollama.chat(
            model=model,
            messages=[
                {
                    'role': 'user',
                    'content': prompt
                }
            ]
        )
        return response['message']['content']
    except Exception as e:
        return f"Error calling LLM: {str(e)}"

# API Endpoints

@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Athena Learning Platform API",
        "status": "running",
        "documents_loaded": len(documents)
    }

@app.post("/documents")
def add_document(doc: DocumentUpload):
    """Add a document to the knowledge base"""
    # Add to storage
    doc_id = len(documents)
    documents.append({
        'id': doc_id,
        'text': doc.text,
        'metadata': doc.metadata
    })

    # Embed the document
    embedding = embedding_model.encode([doc.text])[0]
    doc_embeddings.append(embedding)

    return {
        "doc_id": doc_id,
        "message": "Document added successfully",
        "total_documents": len(documents)
    }

@app.get("/documents")
def list_documents():
    """List all documents"""
    return {
        "total": len(documents),
        "documents": [
            {
                "id": doc['id'],
                "text": doc['text'][:100] + "..." if len(doc['text']) > 100 else doc['text'],
                "metadata": doc.get('metadata', {})
            }
            for doc in documents
        ]
    }

@app.post("/search")
def search(query: str, top_k: int = 3) -> List[SearchResult]:
    """Search for relevant documents"""
    results = search_documents(query, top_k)
    return results

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    """
    RAG-powered chat endpoint

    1. Search for relevant documents
    2. Build context from top results
    3. Send to LLM with prompt
    4. Return answer with sources
    """
    if not documents:
        raise HTTPException(status_code=400, detail="No documents in knowledge base. Upload documents first!")

    # 1. Search for relevant documents
    results = search_documents(request.question, request.top_k)

    if not results:
        raise HTTPException(status_code=404, detail="No relevant documents found")

    # 2. Build context
    context = "\n\n".join([r['text'] for r in results])

    # 3. Build prompt for LLM
    prompt = f"""You are a helpful AI assistant. Answer the question based ONLY on the provided context. If the answer is not in the context, say "I don't have enough information to answer that question based on the provided materials."

Context:
{context}

Question: {request.question}

Answer:"""

    # 4. Call LLM
    print(f"\n🤖 Calling LLM with question: {request.question}")
    answer = call_llm(prompt)
    print(f"✅ LLM response received\n")

    # 5. Return response
    return ChatResponse(
        question=request.question,
        answer=answer,
        sources=results,
        context_used=context
    )

# Startup event - load sample documents
@app.on_event("startup")
def load_sample_documents():
    """Load sample documents on startup"""
    print("\n📚 Loading sample documents...")

    sample_docs = [
        "Backpropagation is an algorithm used to train neural networks by computing gradients using the chain rule from calculus.",
        "The chain rule from calculus is essential for backpropagation to work by allowing gradient computation through layers.",
        "Gradient descent is an optimization algorithm that uses gradients to update weights in neural networks.",
        "Neural networks consist of layers of interconnected nodes called neurons that process information.",
        "The learning rate controls how big the steps are during gradient descent optimization.",
        "Overfitting occurs when a model learns the training data too well and fails to generalize to new data.",
        "Regularization techniques like L1 and L2 help prevent overfitting by adding penalties to the loss function.",
        "Activation functions like ReLU introduce non-linearity into neural networks enabling them to learn complex patterns.",
    ]

    for doc_text in sample_docs:
        documents.append({
            'id': len(documents),
            'text': doc_text,
            'metadata': {'source': 'sample'}
        })

    # Embed all at once
    global doc_embeddings
    doc_embeddings = embedding_model.encode([doc['text'] for doc in documents])

    print(f"✅ Loaded {len(documents)} sample documents\n")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
