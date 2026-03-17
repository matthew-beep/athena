# Deployment

## Mac (bare metal)

Uses `docker-compose.mac.yml` — no GPU config, Ollama runs CPU-only inside Docker.

```bash
cp .env.example .env
docker compose -f docker-compose.mac.yml up --build
```

## PC with NVIDIA GPU

Uses the standard `docker-compose.yml` — includes NVIDIA GPU passthrough for Ollama.

```bash
cp .env.example .env
docker compose up --build
```

> `init-ollama` will pull the model automatically on first boot — no manual `ollama pull` needed.

## Switching models

Only one line in `.env` needs to change:

```
OLLAMA_MODEL=<model>
```

| Machine | Model | Notes |
|---------|-------|-------|
| Mac | `qwen2.5:7b` | CPU-only inside Docker |
| Desktop (RTX 5060 Ti) | `qwen2.5:7b` | Runs on GPU |
