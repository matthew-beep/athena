from fastapi import FastAPI

app = FastAPI(
    title="Athena Learning Platform API",
    description="AI-powered learning assistant API",
    version="0.1.0"
)

@app.get("/",
    summary="Root endpoint",
    description="Returns a welcome message"
)
def read_root():
    return {"message": "Hello Athena"}

@app.get("/chat",
    summary="Chat with your materials",
    description="Ask a question and get an answer based on your uploaded documents"
)
def chat(question: str):
    """
    Chat endpoint that will use RAG to answer questions.

    - **question**: The question you want to ask about your materials
    """
    return {
        "question": question,
        "answer": "This will use LLM later"
    }
