from __future__ import annotations

from typing import Any, Dict, List, Optional
import sys
from datetime import datetime
import uuid
from os import getenv

from pytauri import Commands, AppHandle
from pydantic import Field
from .types import _BaseModel
from . import db


PYTAURI_GEN_TS = getenv("PYTAURI_GEN_TS") != "0"
print(PYTAURI_GEN_TS)
commands = Commands(experimental_gen_ts=PYTAURI_GEN_TS)

class Person(_BaseModel):
    name: str
class Greeting(_BaseModel):
    message: str

@commands.command()
async def greet(body: Person) -> Greeting:
    return Greeting(
        message=f"Hello, {body.name}! You've been greeted from ur best friend: {sys.version}!"
    )

@commands.command()
async def get_version() -> str:
    return sys.version


# --- Chat storage models ---

class ToolCall(_BaseModel):
    id: str
    tool_name: str
    tool_args: Dict[str, Any]
    tool_result: Optional[str] = None
    is_completed: Optional[bool] = None


class ChatMessage(_BaseModel):
    id: str
    role: str
    content: str
    created_at: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None


class ChatData(_BaseModel):
    id: Optional[str] = None
    title: str
    messages: List[ChatMessage] = Field(default_factory=list)
    model: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


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
    messages: Optional[List[ChatMessage]] = None


class ChatId(_BaseModel):
    id: str


@commands.command()
async def get_all_chats(app_handle: AppHandle) -> AllChatsData:
    chats: Dict[str, ChatData] = {}
    sess = db.session(app_handle)
    try:
        for r in db.list_chats(sess):
            chat = ChatData(
                id=r.id,
                title=r.title,
                model=r.model,
                created_at=r.created_at,
                updated_at=r.updated_at,
                messages=[],  # do not load heavy messages list here
            )
            chats[chat.id or "unknown"] = chat
    finally:
        sess.close()
    return AllChatsData(chats=chats)


@commands.command()
async def create_chat(body: CreateChatInput, app_handle: AppHandle) -> ChatData:
    now = datetime.utcnow().isoformat()
    chat_id = body.id or str(uuid.uuid4())
    title = (body.title or "New Chat").strip() or "New Chat"
    sess = db.session(app_handle)
    try:
        db.create_chat(
            sess,
            id=chat_id,
            title=title,
            model=body.model,
            created_at=now,
            updated_at=now,
        )
    finally:
        sess.close()
    return ChatData(
        id=chat_id,
        title=title,
        model=body.model,
        created_at=now,
        updated_at=now,
        messages=[],
    )


@commands.command()
async def update_chat(body: UpdateChatInput, app_handle: AppHandle) -> ChatData:
    now = datetime.utcnow().isoformat()
    sess = db.session(app_handle)
    try:
        if body.messages is not None:
            db.replace_chat_messages(
                sess,
                chat_id=body.id,
                messages=[m.model_dump(by_alias=False) for m in body.messages],
            )
        db.update_chat(
            sess,
            id=body.id,
            title=body.title,
            model=body.model,
            updated_at=now,
        )

        # Rehydrate
        chat_row = sess.get(db.Chat, body.id)
        if not chat_row:
            return ChatData(id=body.id, title="New Chat", messages=[])

        return ChatData(
            id=chat_row.id,
            title=chat_row.title,
            model=chat_row.model,
            created_at=chat_row.created_at,
            updated_at=chat_row.updated_at,
            messages=[],
        )
    finally:
        sess.close()


@commands.command()
async def delete_chat(body: ChatId, app_handle: AppHandle) -> None:
    sess = db.session(app_handle)
    try:
        db.delete_chat(sess, chat_id=body.id)
    finally:
        sess.close()
    return None


@commands.command()
async def get_chat(body: ChatId, app_handle: AppHandle) -> Dict[str, Any]:
    sess = db.session(app_handle)
    try:
        msgs = db.get_chat_messages(sess, body.id)
    finally:
        sess.close()
    # Do not require a dedicated model for this simple shape
    return {"id": body.id, "messages": msgs}
