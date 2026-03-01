import json
import uuid
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

from app.models.chat import ChatRequest, ConversationOut, MessageOut
from app.core.security import get_current_user
from app.core.context import build_messages, count_tokens_text, MAX_MESSAGE_TOKENS, save_message
from app.core import rag as rag_module
from app.config import get_settings
from app.db import postgres

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ── Conversation helpers ────────────────────────────────────────────────────────

async def create_conversation(
    user_id: int,
    knowledge_tier: str = "ephemeral",
    title: str = "New Conversation",
) -> str:
    """Create a new conversation row and return its ID."""
    new_id = f"conv_{uuid.uuid4().hex[:16]}"
    await postgres.execute(
        """INSERT INTO conversations (conversation_id, user_id, title, knowledge_tier, mode)
           VALUES ($1, $2, $3, $4, 'general')""",
        new_id,
        user_id,
        title,
        knowledge_tier,
    )
    return new_id


async def get_conversation(conversation_id: str, user_id: int) -> dict | None:
    """Return the conversation row or None if not found / not owned by this user."""
    return await postgres.fetch_one(
        "SELECT * FROM conversations WHERE conversation_id = $1 AND user_id = $2",
        conversation_id,
        user_id,
    )


async def _get_or_create_conversation(
    conversation_id: str | None,
    user_id: int,
    knowledge_tier: str,
) -> str:
    """
    Verify an existing conversation belongs to the user, or create a fresh one.
    Returns the conversation_id string. Raises 404 if the given ID is not found.
    """
    if conversation_id:
        row = await get_conversation(conversation_id, user_id)
        if not row:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation_id

    return await create_conversation(user_id, knowledge_tier)


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


# ── Document attachment helpers ─────────────────────────────────────────────────

async def attach_documents(conversation_id: str, document_ids: list[str]) -> None:
    """Attach one or more documents to a conversation."""
    if not document_ids:
        return
    insert_sql = """INSERT INTO conversation_documents (conversation_id, document_id)
                   VALUES ($1, $2) ON CONFLICT DO NOTHING"""
    if len(document_ids) == 1:
        await postgres.execute(insert_sql, conversation_id, document_ids[0])
    else:
        await postgres.execute_many(
            insert_sql,
            [(conversation_id, doc_id) for doc_id in document_ids],
        )


async def detach_documents(conversation_id: str, document_ids: list[str]) -> None:
    """Remove one or more documents from a conversation."""
    if not document_ids:
        return
    delete_sql = """DELETE FROM conversation_documents
                   WHERE conversation_id = $1 AND document_id = $2"""
    if len(document_ids) == 1:
        await postgres.execute(delete_sql, conversation_id, document_ids[0])
    else:
        await postgres.execute_many(
            delete_sql,
            [(conversation_id, doc_id) for doc_id in document_ids],
        )


async def get_conversation_document_ids(conversation_id: str) -> list[str]:
    """Fetch all document IDs currently attached to a conversation."""
    rows = await postgres.fetch_all(
        """SELECT document_id FROM conversation_documents
           WHERE conversation_id = $1
           ORDER BY added_at ASC""",
        conversation_id,
    )
    return [r["document_id"] for r in rows]


# ── Routes — literal paths defined before parameterized paths ───────────────────

@router.post("")
async def chat(body: ChatRequest, current_user: dict = Depends(get_current_user)):
    settings = get_settings()
    start_time = time.monotonic()

    # Pre-flight token check before streaming starts — can't change status mid-stream
    current_tokens = count_tokens_text(body.message)
    if current_tokens > MAX_MESSAGE_TOKENS:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "message_too_long",
                "tokens": current_tokens,
                "max": MAX_MESSAGE_TOKENS,
                "message": "Message too long — try splitting code and question into separate messages",
            },
        )

    conversation_id = await _get_or_create_conversation(
        body.conversation_id,
        current_user["id"],
        body.knowledge_tier,
    )

    # Title update: separate DB fetch since _get_or_create_conversation only returns the ID
    conv = await get_conversation(conversation_id, current_user["id"])
    if conv and conv.get("title") == "New Conversation":
        await _update_title(conversation_id, body.message)

    async def stream_response():
        model = settings.ollama_model

        # DB is the source of truth for which documents are in scope.
        # Ownership is enforced by the conversation_documents join — only docs
        # attached to this user's conversation are ever returned.
        doc_ids = await get_conversation_document_ids(conversation_id)

        if body.search_all:
            rag_sources = await rag_module.retrieve(
                body.message,
                current_user["id"],
                search_all=True,
            )
            
            rag_context = rag_module.format_rag_context(rag_sources) if rag_sources else None

        elif doc_ids:
            rag_sources = await rag_module.retrieve(
                body.message,
                current_user["id"],
                document_ids=doc_ids,
            )
            rag_context = rag_module.format_rag_context(rag_sources) if rag_sources else None
        else:
            rag_sources = []
            rag_context = None

        try:
            chat_messages, will_summarize, total_tokens = await build_messages(
                conversation_id=conversation_id,
                current_message=body.message,
                rag_context=rag_context,
            )
        except HTTPException as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': exc.detail.get('message', 'Request error')})}\n\n"
            return

        if will_summarize:
            yield f"data: {json.dumps({'type': 'status', 'content': 'summarizing context...'})}\n\n"

        yield f"data: {json.dumps({'type': 'context_debug', 'tokens': total_tokens, 'budget': 8192})}\n\n"

        full_response: list[str] = []

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_base_url}/api/chat",
                    json={"model": model, "messages": chat_messages, "stream": True},
                ) as resp:
                    if resp.status_code != 200:
                        error_body = await resp.aread()
                        logger.error("Ollama error {}: {}", resp.status_code, error_body)
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
            logger.exception("Streaming error: {}", e)
            yield f"data: {json.dumps({'type': 'error', 'content': 'Streaming error occurred'})}\n\n"
            return

        complete_response = "".join(full_response)
        if complete_response:
            await save_message(conversation_id, "user", body.message)
            await save_message(conversation_id, "assistant", complete_response, model)

        latency_ms = int((time.monotonic() - start_time) * 1000)
        done_event = {
            "type": "done",
            "conversation_id": conversation_id,
            "model_tier": 1,
            "model": model,
            "latency_ms": latency_ms,
            "rag_sources": [
                {
                    "filename": s["filename"],
                    "score": s["score"],
                    "chunk_index": s["chunk_index"],
                    "document_id": s["document_id"],
                    "text": s["text"],
                }
                for s in rag_sources
            ],
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


@router.get("/{conversation_id}/documents")
async def get_conversation_documents(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """List documents currently attached to a conversation."""
    conv = await get_conversation(conversation_id, current_user["id"])
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    rows = await postgres.fetch_all(
        """SELECT d.document_id, d.filename, d.file_type, d.word_count, cd.added_at
           FROM conversation_documents cd
           JOIN documents d ON cd.document_id = d.document_id
           WHERE cd.conversation_id = $1
           ORDER BY cd.added_at ASC""",
        conversation_id,
    )
    return {"documents": [dict(r) for r in rows]}


@router.post("/{conversation_id}/documents/{document_id}")
async def attach_document(
    conversation_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Attach a document to an existing conversation."""
    conv = await get_conversation(conversation_id, current_user["id"])
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await attach_documents(conversation_id, [document_id])
    doc_ids = await get_conversation_document_ids(conversation_id)
    return {"conversation_id": conversation_id, "document_ids": doc_ids}


@router.delete("/{conversation_id}/documents/{document_id}")
async def detach_document(
    conversation_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a document from a conversation."""
    conv = await get_conversation(conversation_id, current_user["id"])
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await detach_documents(conversation_id, [document_id])
    doc_ids = await get_conversation_document_ids(conversation_id)
    return {"conversation_id": conversation_id, "document_ids": doc_ids}
