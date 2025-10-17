from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import Field

from ..types import _BaseModel


class ToolCall(_BaseModel):
    id: str
    toolName: str
    toolArgs: Dict[str, Any]
    toolResult: Optional[str] = None
    isCompleted: Optional[bool] = None


class ChatMessage(_BaseModel):
    id: str
    role: str
    content: str
    createdAt: Optional[str] = None
    toolCalls: Optional[List[ToolCall]] = None


class ChatData(_BaseModel):
    id: Optional[str] = None
    title: str
    messages: List[ChatMessage] = Field(default_factory=list)
    model: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class AllChatsData(_BaseModel):
    chats: Dict[str, ChatData]


class CreateChatInput(_BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    model: Optional[str] = None


class UpdateChatInput(_BaseModel):
    id: str
    title: Optional[str] = None
    model: Optional[str] = None


class ChatId(_BaseModel):
    id: str


class ChatStreamRequest(_BaseModel):
    messages: List[ChatMessage]
    modelId: str
    chatId: Optional[str] = None


class ChatEvent(_BaseModel):
    # Discriminator field for event name
    event: str
    # Optional fields
    content: Optional[str] = None
    reasoningContent: Optional[str] = None
    sessionId: Optional[str] = None
    tool: Optional[Dict[str, Any]] = None

