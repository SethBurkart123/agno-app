from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, Iterator

from pydantic import BaseModel
from pytauri import AppHandle
from pytauri.ipc import Channel, JavaScriptChannelId
from pytauri.webview import WebviewWindow
from agno.agent import RunOutputEvent, RunEvent

from .. import db
from ..models.chat import ChatEvent, ChatMessage
from ..services.agent_factory import create_agent_for_chat
from . import commands


class StreamChatRequest(BaseModel):
    """Request model for stream_chat command."""
    channel: JavaScriptChannelId[ChatEvent]
    messages: List[Dict[str, Any]]
    modelId: Optional[str] = None
    chatId: Optional[str] = None


@commands.command()
async def stream_chat(
    body: StreamChatRequest,
    webview_window: WebviewWindow,
    app_handle: AppHandle,
) -> None:
    """Stream chat completions via a Channel to the frontend.
    
    Saves messages incrementally to DB:
    - User message saved immediately
    - Assistant message created and updated as content streams
    """
    # Convert JavaScriptChannelId to Channel
    ch: Channel[ChatEvent] = body.channel.channel_on(webview_window.as_ref_webview())

    # Parse messages from request body
    messages: List[ChatMessage] = [
        ChatMessage(
            id=m.get("id"),
            role=m.get("role"),
            content=m.get("content", ""),
            createdAt=m.get("createdAt"),
            toolCalls=m.get("toolCalls"),
        )
        for m in body.messages
    ]
    
    modelId = body.modelId
    chatId = body.chatId

    # Parse provider and model from modelId (format: "provider:modelId")
    provider = "openai"
    actual_model_id = "gpt-4o-mini"
    if modelId and ":" in modelId:
        parts = modelId.split(":", 1)
        provider = parts[0]
        actual_model_id = parts[1]
    elif modelId:
        # Fallback: try to guess provider or use as-is
        actual_model_id = modelId

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
            # Load default tools from database and snapshot them for this chat
            default_tool_ids = db.get_default_tool_ids(sess)
            
            config = {
                "provider": provider,
                "model_id": actual_model_id,
                "tool_ids": default_tool_ids,
                "instructions": [],
            }
            db.update_chat_agent_config(sess, chatId=chatId, config=config)
        finally:
            sess.close()
    else:
        # For existing chat, only ensure config exists
        # Don't overwrite tool_ids - those are managed by toggleChatTools
        sess = db.session(app_handle)
        try:
            config = db.get_chat_agent_config(sess, chatId)
            if not config:
                # Chat exists but has no config - create one with defaults
                default_tool_ids = db.get_default_tool_ids(sess)
                config = {
                    "provider": provider,
                    "model_id": actual_model_id,
                    "tool_ids": default_tool_ids,
                    "instructions": [],
                }
                db.update_chat_agent_config(sess, chatId=chatId, config=config)
            # If config exists, don't touch it - agent_factory will read it as-is
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

    # Stream from Agno agent and update DB incrementally
    try:
        # Create fresh Agno agent instance for this request
        agent = create_agent_for_chat(chatId, app_handle)
        
        # Get the last user message
        if not messages or messages[-1].role != "user":
            raise ValueError("No user message found in request")
        
        user_message = messages[-1].content
        
        # Run with streaming - returns Iterator[RunOutputEvent]
        response_stream: Iterator[RunOutputEvent] = agent.run(
            user_message, 
            stream=True,
            stream_intermediate_steps=True  # Critical: enables tool events
        )
        
        content_blocks = []
        current_text_buffer = ""
        tool_call_counter = 0
        
        def flush_text_block():
            """Add accumulated text as a content block if non-empty."""
            nonlocal current_text_buffer
            if current_text_buffer:
                content_blocks.append({
                    "type": "text",
                    "content": current_text_buffer
                })
                current_text_buffer = ""
        
        # Process stream events
        for chunk in response_stream:
            # Content chunks
            if chunk.event == RunEvent.run_content:
                if chunk.content:
                    assistantContent += chunk.content
                    current_text_buffer += chunk.content
                    
                    # Don't save structured blocks during streaming - just save raw text for incremental updates
                    sess = db.session(app_handle)
                    try:
                        db.update_message_content(
                            sess,
                            messageId=assistantMessageId,
                            content=assistantContent,
                        )
                    finally:
                        sess.close()
                    
                    ch.send_model(ChatEvent(event="RunContent", content=chunk.content))
            
            # Tool execution started
            elif chunk.event == RunEvent.tool_call_started:
                tool_id = f"{assistantMessageId}-tool-{tool_call_counter}"
                print(f"[DEBUG] Tool started: {chunk.tool.tool_name} with args {chunk.tool.tool_args}")
                
                ch.send_model(ChatEvent(
                    event="ToolCallStarted",
                    tool={
                        "id": tool_id,
                        "toolName": chunk.tool.tool_name,
                        "toolArgs": chunk.tool.tool_args,
                        "isCompleted": False,
                    }
                ))
            
            # Tool execution completed
            elif chunk.event == RunEvent.tool_call_completed:
                # Flush any pending text before adding tool block
                flush_text_block()
                
                tool_id = f"{assistantMessageId}-tool-{tool_call_counter}"
                tool_call_counter += 1
                
                tool_call_block = {
                    "type": "tool_call",
                    "id": tool_id,
                    "toolName": chunk.tool.tool_name,
                    "toolArgs": chunk.tool.tool_args,
                    "toolResult": str(chunk.tool.result) if chunk.tool.result is not None else None,
                    "isCompleted": True,
                }
                
                print(f"[DEBUG] Tool completed: {tool_call_block}")
                content_blocks.append(tool_call_block)
                
                ch.send_model(ChatEvent(
                    event="ToolCallCompleted",
                    tool=tool_call_block
                ))
            
            # Run completed
            elif chunk.event == RunEvent.run_completed:
                print(f"[DEBUG] Run completed with {len([b for b in content_blocks if b['type'] == 'tool_call'])} tool calls")
                
                # Flush any remaining text
                flush_text_block()
                
                # Ensure we have at least one content block
                if not content_blocks:
                    content_blocks = [{"type": "text", "content": ""}]
                
                # Final DB update with structured content blocks
                sess = db.session(app_handle)
                try:
                    db.update_message_content(
                        sess,
                        messageId=assistantMessageId,
                        content=json.dumps(content_blocks),
                        toolCalls=None,  # No longer needed - tools are in content blocks
                    )
                finally:
                    sess.close()
                
                ch.send_model(ChatEvent(event="RunCompleted"))
            
            # Errors
            elif chunk.event == RunEvent.run_error:
                print(f"[ERROR] Run error: {chunk}")
                errorMsg = f"\n\n[Error: {chunk}]"
                assistantContent += errorMsg
                current_text_buffer += errorMsg
                
                # Flush any remaining text including error
                flush_text_block()
                
                # Ensure we have at least one content block
                if not content_blocks:
                    content_blocks = [{"type": "text", "content": errorMsg}]
                
                sess = db.session(app_handle)
                try:
                    db.update_message_content(
                        sess,
                        messageId=assistantMessageId,
                        content=json.dumps(content_blocks),
                    )
                finally:
                    sess.close()
                
                ch.send_model(ChatEvent(event="RunCompleted", content=errorMsg))
        
    except Exception as e:
        import traceback
        print(f"[stream_chat] Error: {e}")
        print(traceback.format_exc())
        
        errorMsg = f"\n\n[Error: {e}]"
        assistantContent += errorMsg
        
        # Build error content block
        error_content_blocks = []
        if assistantContent.strip():
            error_content_blocks.append({
                "type": "text",
                "content": assistantContent
            })
        else:
            error_content_blocks.append({
                "type": "text",
                "content": errorMsg
            })
        
        # Save error to DB
        sess = db.session(app_handle)
        try:
            db.update_message_content(
                sess,
                messageId=assistantMessageId,
                content=json.dumps(error_content_blocks),
            )
        finally:
            sess.close()
        
        ch.send_model(ChatEvent(event="RunCompleted", content=errorMsg))
