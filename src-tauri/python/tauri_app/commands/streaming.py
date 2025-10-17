from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from pytauri import AppHandle
from pytauri.ipc import Channel, JavaScriptChannelId, Headers
from pytauri.webview import WebviewWindow

from .. import db
from ..models.chat import ChatEvent, ChatMessage
from ..config import get_env
from ..services.openai_service import stream_chat_completion
from . import commands


@commands.command()
async def stream_chat(
    body: JavaScriptChannelId[ChatEvent],
    headers: Headers,
    webview_window: WebviewWindow,
    app_handle: AppHandle,
) -> None:
    """Stream chat completions via a Channel to the frontend.
    
    Saves messages incrementally to DB:
    - User message saved immediately
    - Assistant message created and updated as content streams
    """
    ch: Channel[ChatEvent] = body.channel_on(webview_window.as_ref_webview())

    # Parse payload from headers
    payloadRaw: Optional[str] = None
    try:
        try:
            items = headers.items()  # type: ignore[attr-defined]
        except Exception:
            items = headers  # type: ignore[assignment]
        for k, v in items:  # type: ignore[misc]
            ks = (k.decode("utf-8", "ignore") if isinstance(k, (bytes, bytearray)) else str(k)).lower()
            if ks == "x-stream-payload":
                payloadRaw = (
                    v.decode("utf-8", "ignore") if isinstance(v, (bytes, bytearray)) else str(v)
                )
                break
    except Exception:
        payloadRaw = None

    messages: List[ChatMessage] = []
    modelId: Optional[str] = None
    chatId: Optional[str] = None
    
    if payloadRaw:
        try:
            import json
            data: Dict[str, Any] = json.loads(payloadRaw)
            if isinstance(data.get("messages"), list):
                msgs: List[Dict[str, Any]] = data["messages"]
                messages = [
                    ChatMessage(
                        id=m.get("id"),
                        role=m.get("role"),
                        content=m.get("content", ""),
                        createdAt=m.get("createdAt"),
                        toolCalls=m.get("toolCalls"),
                    )
                    for m in msgs
                ]
            modelId = data.get("modelId")
            chatId = data.get("chatId")
        except Exception:
            pass

    # Create new chat if needed
    if not chatId:
        chatId = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        sess = db.session(app_handle)
        try:
            db.create_chat(
                sess,
                id=chatId,
                title="New Chat",
                model=modelId,
                createdAt=now,
                updatedAt=now,
            )
        finally:
            sess.close()

    # Save user message to DB immediately
    if messages and messages[-1].role == "user":
        userMessage = messages[-1]
        sess = db.session(app_handle)
        try:
            db.append_message(
                sess,
                id=userMessage.id,
                chatId=chatId,
                role=userMessage.role,
                content=userMessage.content,
                createdAt=userMessage.createdAt or datetime.utcnow().isoformat(),
                toolCalls=userMessage.toolCalls,
            )
        finally:
            sess.close()

    sessionId = chatId
    ch.send_model(ChatEvent(event="RunStarted", sessionId=sessionId))

    # Create assistant message placeholder
    assistantMessageId = str(uuid.uuid4())
    assistantContent = ""
    sess = db.session(app_handle)
    try:
        db.append_message(
            sess,
            id=assistantMessageId,
            chatId=chatId,
            role="assistant",
            content="",
            createdAt=datetime.utcnow().isoformat(),
        )
    finally:
        sess.close()

    # Stream from OpenAI and update DB incrementally
    try:
        if not modelId:
            modelId = get_env("OPENAI_MODEL") or "gpt-4o-mini"
        
        for part, done in stream_chat_completion(
            model=modelId, 
            messages=[m.model_dump(by_alias=False) for m in messages]
        ):
            if done:
                ch.send_model(ChatEvent(event="RunCompleted"))
                break
            if part:
                assistantContent += part
                # Update DB with accumulated content
                sess = db.session(app_handle)
                try:
                    db.update_message_content(
                        sess,
                        messageId=assistantMessageId,
                        content=assistantContent,
                    )
                finally:
                    sess.close()
                
                ch.send_model(ChatEvent(event="RunContent", content=part))
    except Exception as e:
        errorMsg = f"\n\n[Error: {e}]"
        assistantContent += errorMsg
        # Save error to DB
        sess = db.session(app_handle)
        try:
            db.update_message_content(
                sess,
                messageId=assistantMessageId,
                content=assistantContent,
            )
        finally:
            sess.close()
        ch.send_model(ChatEvent(event="RunCompleted", content=errorMsg))
