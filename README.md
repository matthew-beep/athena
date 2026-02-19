# Athena Learning Platform

An AI-powered learning assistant that uses RAG (Retrieval-Augmented Generation) to help you study smarter.

## 🎯 What is Athena?

Athena is a learning platform that:
- Processes your study materials (PDFs, documents)
- Lets you chat with your materials using AI
- Generates quizzes to test your knowledge
- Tracks your progress and weak areas

## 🚀 Features

- **RAG-Powered Chat**: Ask questions and get answers based on YOUR materials
- **Vector Search**: Semantic search finds relevant content by meaning
- **Real LLM Integration**: Uses Ollama for local AI responses
- **Beautiful UI**: Clean web interface for chatting

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python)
- **AI/ML**:
  - Sentence Transformers (embeddings)
  - Ollama (LLM)
- **Frontend**: HTML/CSS/JavaScript
- **Future**:
  - Qdrant (vector database)
  - PostgreSQL (metadata storage)
  - React (frontend framework)

## 📦 Installation

### Prerequisites
- Python 3.11+
- Ollama

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/athena-practice.git
cd athena-practice
```

2. **Create virtual environment**
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Install and start Ollama**
- Download from https://ollama.com
- Run: `ollama pull llama3.2:3b`

5. **Start the backend**
```bash
cd backend
uvicorn athena_api:app --reload --host 0.0.0.0 --port 8000
# or: fastapi dev athena_api.py
```

6. **Open the frontend**
- Open `frontend/frontend.html` in your browser
- Start chatting!

## 🎓 Usage

### Ask Questions
```
You: "What is backpropagation?"
Athena: "Based on your materials, backpropagation is..."
```

### Add Documents (via API)
```bash
curl -X POST "http://localhost:8000/documents" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your study material here"}'
```

## 📁 Project Structure

```
athena-practice/
├── backend/
│   ├── athena_api.py      # FastAPI + RAG + LLM API
│   ├── mini_rag.py        # Basic RAG prototype
│   ├── mini_rag_advanced.py # Enhanced RAG with MiniRAG class
│   └── test.py            # Simple FastAPI test
├── frontend/
│   └── frontend.html      # Chat UI
├── docs/
├── requirements.txt
└── README.md
```

## 📚 Project Status

- [x] Basic RAG implementation
- [x] FastAPI backend
- [x] Ollama LLM integration
- [x] Simple web UI
- [ ] PDF upload
- [ ] Quiz generation
- [ ] Knowledge graph
- [ ] User authentication
- [ ] Vector database (Qdrant)

## 🗺️ Roadmap

**Phase 1 (Current)**: Basic RAG + Chat  
**Phase 2**: Quiz generation  
**Phase 3**: Knowledge graph  
**Phase 4**: Autonomous research  
**Phase 5**: Production deployment  

## 🤝 Contributing

This is a personal learning project, but suggestions are welcome!

## 📝 License

MIT License
