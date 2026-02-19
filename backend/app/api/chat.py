import json
import uuid
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

from app.models.chat import ChatRequest, ConversationOut, MessageOut
from app.core.security import get_current_user
from app.config import get_settings
from app.db import postgres

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = """You are Athena, a personal AI assistant. You are helpful, concise, and thoughtful.
You remember the context of this conversation and build on it naturally.
Keep responses clear and well-structured."""


async def _get_or_create_conversation(
    conversation_id: str | None, user_id: int, knowledge_tier: str
) -> str:
    if conversation_id:
        row = await postgres.fetch_one(
            "SELECT conversation_id FROM conversations WHERE conversation_id = $1 AND user_id = $2",
            conversation_id,
            user_id,
        )
        if row:
            return conversation_id

    new_id = f"conv_{uuid.uuid4().hex[:16]}"
    await postgres.execute(
        """INSERT INTO conversations (conversation_id, user_id, title, knowledge_tier)
           VALUES ($1, $2, $3, $4)""",
        new_id,
        user_id,
        "New Conversation",
        knowledge_tier,
    )
    return new_id


async def _load_history(conversation_id: str) -> list[dict]:
    rows = await postgres.fetch_all(
        """SELECT role, content FROM messages
           WHERE conversation_id = $1
           ORDER BY timestamp ASC
           LIMIT 40""",
        conversation_id,
    )
    return [{"role": r["role"], "content": r["content"]} for r in rows]


async def _save_message(
    conversation_id: str, role: str, content: str, model: str | None = None
) -> str:
    msg_id = f"msg_{uuid.uuid4().hex[:16]}"
    await postgres.execute(
        """INSERT INTO messages (message_id, conversation_id, role, content, model_used)
           VALUES ($1, $2, $3, $4, $5)""",
        msg_id,
        conversation_id,
        role,
        content,
        model,
    )
    await postgres.execute(
        "UPDATE conversations SET last_active = NOW() WHERE conversation_id = $1",
        conversation_id,
    )
    return msg_id


async def _update_title(conversation_id: str, first_message: str) -> None:
    title = first_message[:50].strip()
    if len(first_message) > 50:
        title += "..."
    await postgres.execute(
        """UPDATE conversations SET title = $1
           WHERE conversation_id = $2 AND title = 'New Conversation'""",
        title,
        conversation_id,
    )


@router.post("")
async def chat(body: ChatRequest, current_user: dict = Depends(get_current_user)):
    settings = get_settings()
    start_time = time.monotonic()

    conversation_id = await _get_or_create_conversation(
        body.conversation_id, current_user["id"], body.knowledge_tier
    )

    history = await _load_history(conversation_id)
    await _save_message(conversation_id, "user", body.message)
    await _update_title(conversation_id, body.message)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": body.message})

    async def stream_response():
        full_response: list[str] = []
        model = settings.ollama_model

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_base_url}/api/chat",
                    json={"model": model, "messages": messages, "stream": True},
                ) as resp:
                    if resp.status_code != 200:
                        error_body = await resp.aread()
                        logger.error(f"Ollama error {resp.status_code}: {error_body}")
                        yield f"data: {json.dumps({'type': 'error', 'content': 'Model unavailable'})}\n\n"
                        return

                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            full_response.append(token)
                            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

                        if chunk.get("done"):
                            break

        except httpx.ConnectError:
            logger.error("Cannot connect to Ollama")
            yield f"data: {json.dumps({'type': 'error', 'content': 'Cannot connect to Ollama. Is it running?'})}\n\n"
            return
        except Exception as e:
            logger.exception(f"Streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': 'Streaming error occurred'})}\n\n"
            return

        complete_response = "".join(full_response)
        if complete_response:
            await _save_message(conversation_id, "assistant", complete_response, model)

        latency_ms = int((time.monotonic() - start_time) * 1000)
        done_event = {
            "type": "done",
            "conversation_id": conversation_id,
            "model_tier": 1,
            "model": model,
            "latency_ms": latency_ms,
        }
        yield f"data: {json.dumps(done_event)}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    current_user: dict = Depends(get_current_user),
) -> list[ConversationOut]:
    rows = await postgres.fetch_all(
        """SELECT conversation_id, title, knowledge_tier, started_at, last_active
           FROM conversations
           WHERE user_id = $1
           ORDER BY last_active DESC
           LIMIT 50""",
        current_user["id"],
    )
    return [ConversationOut(**dict(r)) for r in rows]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[MessageOut]:
    conv = await postgres.fetch_one(
        "SELECT conversation_id FROM conversations WHERE conversation_id = $1 AND user_id = $2",
        conversation_id,
        current_user["id"],
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    rows = await postgres.fetch_all(
        """SELECT message_id, conversation_id, role, content, model_used, timestamp
           FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC""",
        conversation_id,
    )
    return [MessageOut(**dict(r)) for r in rows]
