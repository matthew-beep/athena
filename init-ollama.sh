#!/bin/sh
# Wait for ollama service to be ready then pull the model

OLLAMA_HOST_ADDR=${OLLAMA_HOST:-ollama:11434}
MODEL=${OLLAMA_MODEL:-llama3.2:3b}

export OLLAMA_HOST="http://${OLLAMA_HOST_ADDR}"

echo "[init-ollama] Waiting for Ollama at ${OLLAMA_HOST}..."

until ollama list > /dev/null 2>&1; do
  echo "[init-ollama] Ollama not ready, retrying in 3s..."
  sleep 3
done

echo "[init-ollama] Ollama is ready. Checking for model: ${MODEL}"

if ollama list | grep -q "^${MODEL}"; then
  echo "[init-ollama] Model ${MODEL} already present. Skipping pull."
else
  echo "[init-ollama] Pulling model ${MODEL}..."
  ollama pull "${MODEL}"
  echo "[init-ollama] Model pull complete."
fi

EMBED_MODEL="nomic-embed-text"
echo "[init-ollama] Checking for embedding model: ${EMBED_MODEL}"
if ollama list | grep -q "^${EMBED_MODEL}"; then
  echo "[init-ollama] Model ${EMBED_MODEL} already present. Skipping pull."
else
  echo "[init-ollama] Pulling embedding model ${EMBED_MODEL}..."
  ollama pull "${EMBED_MODEL}"
  echo "[init-ollama] Embedding model pull complete."
fi

echo "[init-ollama] Done."
