from pydantic import BaseModel
from typing import Literal
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    knowledge_tier: Literal["ephemeral", "persistent"] = "ephemeral"
    search_all: bool = False


class ConversationOut(BaseModel):
    conversation_id: str
    title: str | None
    knowledge_tier: str
    started_at: datetime
    last_active: datetime


class MessageOut(BaseModel):
    message_id: str
    conversation_id: str
    role: str
    content: str
    model_used: str | None
    timestamp: datetime
