import json
from pydantic import BaseModel, model_validator
from typing import Any, Literal
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    knowledge_tier: Literal["ephemeral", "persistent"] = "ephemeral"
    search_all: bool = False
    document_ids: list[str] = []  # attach + scope these docs on the first message


class BatchAttachRequest(BaseModel):
    document_ids: list[str]


class ConversationOut(BaseModel):
    conversation_id: str
    title: str | None
    knowledge_tier: str
    started_at: datetime
    last_active: datetime
    token_count: int = 0


class MessageOut(BaseModel):
    message_id: str
    conversation_id: str
    role: str
    content: str
    model_used: str | None
    timestamp: datetime
    rag_sources: list[Any] | None = None

    @model_validator(mode='before')
    @classmethod
    def parse_rag_sources(cls, values: Any) -> Any:
        # asyncpg may return JSONB as a string depending on version
        if isinstance(values, dict):
            raw = values.get('rag_sources')
            if isinstance(raw, str):
                try:
                    values['rag_sources'] = json.loads(raw)
                except (json.JSONDecodeError, ValueError):
                    values['rag_sources'] = None
        return values



class SuggestionsRequest(BaseModel):
    conversation_id: str
    last_user_message: str
    last_assistant_message: str
    history: list[dict] | None = None  # optional, trimmed recent turns


class SuggestionsResponse(BaseModel):
    suggestions: list[str]