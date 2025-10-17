from __future__ import annotations

from datetime import datetime
import uuid
from typing import Any, Dict

from pytauri import AppHandle

from .. import db
from ..models.chat import (
    AllChatsData,
    ChatData,
    ChatId,
    CreateChatInput,
    UpdateChatInput,
)
from . import commands


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
                createdAt=r.createdAt,
                updatedAt=r.updatedAt,
                messages=[],  # do not load heavy messages list here
            )
            chats[chat.id or "unknown"] = chat
    finally:
        sess.close()
    return AllChatsData(chats=chats)


@commands.command()
async def create_chat(body: CreateChatInput, app_handle: AppHandle) -> ChatData:
    now = datetime.utcnow().isoformat()
    chatId = body.id or str(uuid.uuid4())
    title = (body.title or "New Chat").strip() or "New Chat"
    sess = db.session(app_handle)
    try:
        db.create_chat(
            sess,
            id=chatId,
            title=title,
            model=body.model,
            createdAt=now,
            updatedAt=now,
        )
    finally:
        sess.close()
    return ChatData(
        id=chatId,
        title=title,
        model=body.model,
        createdAt=now,
        updatedAt=now,
        messages=[],
    )


@commands.command()
async def update_chat(body: UpdateChatInput, app_handle: AppHandle) -> ChatData:
    now = datetime.utcnow().isoformat()
    sess = db.session(app_handle)
    try:
        db.update_chat(
            sess,
            id=body.id,
            title=body.title,
            model=body.model,
            updatedAt=now,
        )

        # Rehydrate
        chatRow = sess.get(db.Chat, body.id)
        if not chatRow:
            return ChatData(id=body.id, title="New Chat", messages=[])

        return ChatData(
            id=chatRow.id,
            title=chatRow.title,
            model=chatRow.model,
            createdAt=chatRow.createdAt,
            updatedAt=chatRow.updatedAt,
            messages=[],
        )
    finally:
        sess.close()


@commands.command()
async def delete_chat(body: ChatId, app_handle: AppHandle) -> None:
    sess = db.session(app_handle)
    try:
        db.delete_chat(sess, chatId=body.id)
    finally:
        sess.close()
    return None


@commands.command()
async def get_chat(body: ChatId, app_handle: AppHandle) -> Dict[str, Any]:
    sess = db.session(app_handle)
    try:
        msgs = db.get_chat_messages(sess, chatId=body.id)
    finally:
        sess.close()
    return {"id": body.id, "messages": msgs}

