import sys
# mini_rag.py - Your RAG prototype
from sentence_transformers import SentenceTransformer
import numpy as np
from numpy import dot
from numpy.linalg import norm

print("Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model loaded! ✅\n")

# Your "document database" (in memory for now)
documents = [
    "Backpropagation is an algorithm used to train neural networks by computing gradients.",
    "The chain rule from calculus is essential for backpropagation to work.",
    "Gradient descent is an optimization algorithm that uses gradients to update weights.",
    "Neural networks consist of layers of interconnected nodes called neurons.",
    "The learning rate controls how big the steps are during gradient descent."
]

# Embed all documents
print("Embedding documents...")
doc_embeddings = model.encode(documents)
print(f"Embedded {len(documents)} documents ✅")
print(f"Embedding dimension: {doc_embeddings.shape[1]}\n")

def search(query, top_k=3):
    """Search for documents similar to the query"""
    # Embed the query
    query_embedding = model.encode([query])[0]

    # Calculate similarities
    similarities = []
    for i, doc_emb in enumerate(doc_embeddings):
        sim = dot(query_embedding, doc_emb) / (norm(query_embedding) * norm(doc_emb))
        similarities.append((i, sim, documents[i]))

    # Sort by similarity (highest first)
    similarities.sort(key=lambda x: x[1], reverse=True)

    return similarities[:top_k]



def chat(question, top_k=3):
    """
    Simulate RAG chat - retrieves relevant docs and builds LLM prompt
    """
    print(f"\n{'='*80}")
    print(f"Question: {question}")
    print(f"{'='*80}\n")

    # 1. Search for relevant docs
    print("🔍 Searching for relevant documents...\n")
    results = search(question, top_k=top_k)

    # Show what we retrieved
    print("Retrieved documents:")
    for idx, score, doc in results:
        print(f"  [{score:.3f}] {doc}")
    print()

    # 2. Build context from top results
    context = "\n\n".join([doc for _, _, doc in results])

    # 3. Build prompt for LLM (this is what we'd send to Ollama)
    prompt = f"""Answer the question based ONLY on this context:

Context:
{context}

Question: {question}

Answer:"""

    print("📝 Generated prompt for LLM:")
    print("-" * 80)
    print(prompt)
    print("-" * 80)
    print("\n[In real Athena, this prompt would go to Ollama LLM]")
    print("[The LLM would generate an answer based on the context]\n")

    return results

# Test it!
if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Join all arguments after script name into one query
        query = " ".join(sys.argv[1:])
    else:
        # Default query if none provided
        query = "How does backpropagation calculate gradients?"

    results = search(query)

    print(f"Query: {query}\n")
    print("Top results:")
    print("-" * 80)
    for idx, score, doc in results:
        print(f"Score: {score:.3f} | Doc {idx}: {doc}")
    print("-" * 80)

        # Now test chat
    print("\n\n" + "="*80)
    print("TESTING CHAT FUNCTION")
    print("="*80)
    chat("What is the chain rule used for?")

        # Another test
    chat("Explain the learning rate")
