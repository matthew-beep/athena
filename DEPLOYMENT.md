# Deployment

## MacBook (development)

```bash
cp .env.example .env
# OLLAMA_MODEL=qwen2.5:7b is already set in .env.example
docker compose up --build
```

## Desktop (RTX 5060 Ti)

```bash
cp .env.example .env
```

Edit `.env` and set:
```
OLLAMA_MODEL=qwen3.5:4b
NEXT_PUBLIC_OLLAMA_MODEL=qwen3.5:4b
```

Then spin up with GPU:
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

> `init-ollama` will pull the model automatically on first boot — no manual `ollama pull` needed.

## Switching models

Only two lines in `.env` need to change:
```
OLLAMA_MODEL=<model>
NEXT_PUBLIC_OLLAMA_MODEL=<model>
```

| Machine | Model | Notes |
|---------|-------|-------|
| MacBook | `qwen2.5:7b` | Limited by Docker Desktop memory (~7.6 GiB VM) |
| Desktop | `qwen3.5:4b` | Runs on GPU via `docker-compose.gpu.yml` |
