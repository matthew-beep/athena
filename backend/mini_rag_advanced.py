# mini_rag_advanced.py - Enhanced version
from sentence_transformers import SentenceTransformer
import numpy as np
from numpy import dot
from numpy.linalg import norm
from datetime import datetime

class MiniRAG:
    """A simple RAG system"""

    def __init__(self, model_name='all-MiniLM-L6-v2'):
        print(f"Loading embedding model: {model_name}...")
        self.model = SentenceTransformer(model_name)
        self.documents = []
        self.embeddings = None
        print("Model loaded! ✅\n")

    def add_document(self, text, metadata=None):
        """Add a document to the database"""
        doc_id = len(self.documents)
        self.documents.append({
            'id': doc_id,
            'text': text,
            'metadata': metadata or {},
            'added_at': datetime.now().isoformat()
        })

        # Re-embed all documents (in real system, just embed new one)
        self._reindex()

        return doc_id

    def add_documents(self, texts):
        """Add multiple documents at once"""
        for text in texts:
            self.documents.append({
                'id': len(self.documents),
                'text': text,
                'metadata': {},
                'added_at': datetime.now().isoformat()
            })
        self._reindex()

    def _reindex(self):
        """Re-create embeddings for all documents"""
        if not self.documents:
            return

        texts = [doc['text'] for doc in self.documents]
        self.embeddings = self.model.encode(texts)
        print(f"Indexed {len(self.documents)} documents")

    def search(self, query, top_k=3, min_score=0.0):
        """Search for documents similar to query"""
        if not self.documents:
            return []

        # Embed query
        query_embedding = self.model.encode([query])[0]

        # Calculate similarities
        similarities = []
        for i, doc_emb in enumerate(self.embeddings):
            sim = dot(query_embedding, doc_emb) / (norm(query_embedding) * norm(doc_emb))

            # Only include if above minimum score
            if sim >= min_score:
                similarities.append({
                    'doc_id': i,
                    'score': float(sim),
                    'text': self.documents[i]['text'],
                    'metadata': self.documents[i]['metadata']
                })

        # Sort by similarity
        similarities.sort(key=lambda x: x['score'], reverse=True)

        return similarities[:top_k]

    def chat(self, question, top_k=3, show_prompt=True):
        """
        RAG chat: retrieve relevant docs and build LLM prompt
        """
        print(f"\n{'='*80}")
        print(f"💬 Question: {question}")
        print(f"{'='*80}\n")

        # Retrieve relevant documents
        results = self.search(question, top_k=top_k)

        if not results:
            print("❌ No relevant documents found!")
            return None

        # Show retrieved documents
        print(f"🔍 Retrieved {len(results)} relevant documents:\n")
        for i, result in enumerate(results, 1):
            print(f"  {i}. [Score: {result['score']:.3f}] {result['text'][:100]}...")
        print()

        # Build context
        context = "\n\n".join([r['text'] for r in results])

        # Build LLM prompt
        prompt = f"""You are a helpful AI assistant. Answer the question based ONLY on the provided context. If the answer is not in the context, say "I don't have enough information to answer that."

Context:
{context}

Question: {question}

Answer:"""

        if show_prompt:
            print("📝 Generated prompt for LLM:")
            print("-" * 80)
            print(prompt)
            print("-" * 80)
            print("\n💡 [This prompt would be sent to Ollama/LLM]")

        return {
            'question': question,
            'retrieved_docs': results,
            'context': context,
            'prompt': prompt
        }

    def stats(self):
        """Show database statistics"""
        print(f"\n📊 Database Statistics:")
        print(f"  Total documents: {len(self.documents)}")
        if self.embeddings is not None:
            print(f"  Embedding dimension: {self.embeddings.shape[1]}")
        print()


# Example usage
if __name__ == "__main__":
    # Initialize RAG system
    rag = MiniRAG()

    # Add documents
    print("Adding documents to database...\n")
    rag.add_documents([
        "Backpropagation is an algorithm used to train neural networks by computing gradients.",
        "The chain rule from calculus is essential for backpropagation to work.",
        "Gradient descent is an optimization algorithm that uses gradients to update weights.",
        "Neural networks consist of layers of interconnected nodes called neurons.",
        "The learning rate controls how big the steps are during gradient descent.",
        "Overfitting occurs when a model learns the training data too well and fails to generalize.",
        "Regularization techniques like L1 and L2 help prevent overfitting.",
        "Activation functions like ReLU introduce non-linearity into neural networks.",
    ])

    # Show stats
    rag.stats()

    # Test searches
    print("\n" + "="*80)
    print("TEST 1: Simple search")
    print("="*80)
    results = rag.search("What is backpropagation?")
    for r in results:
        print(f"Score: {r['score']:.3f} - {r['text']}")

    # Test chat
    print("\n\n" + "="*80)
    print("TEST 2: Chat with RAG")
    print("="*80)
    rag.chat("How does the chain rule relate to backpropagation?")

    print("\n\n" + "="*80)
    print("TEST 3: Another chat")
    print("="*80)
    rag.chat("What prevents overfitting?")

    # Test with question not in docs
    print("\n\n" + "="*80)
    print("TEST 4: Question not in documents")
    print("="*80)
    rag.chat("What is quantum computing?")
