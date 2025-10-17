from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pytauri import App, AppHandle, Manager
from pytauri.ffi.webview import WebviewWindow
from pytauri.path import PathResolver
from sqlalchemy import String, Text, ForeignKey, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker, Session


class Base(DeclarativeBase):
    pass


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    createdAt: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updatedAt: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    messages: Mapped[List["Message"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    chatId: Mapped[str] = mapped_column(String, ForeignKey("chats.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    toolCalls: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    chat: Mapped[Chat] = relationship(back_populates="messages")


_engine = None
_Session = None
_db_path_override: Optional[Path] = None


def set_db_path(path: Path) -> None:
    global _db_path_override
    path.parent.mkdir(parents=True, exist_ok=True)
    _db_path_override = path


def get_db_path(app: Union[App, AppHandle, WebviewWindow]) -> Path:
    # Fallback if not set via init_database
    return _db_path_override or (get_resource_dir(app) / "app.db")

def get_resource_dir(manager: Union[App, AppHandle, WebviewWindow]) -> Path:
    path_resolver: PathResolver = Manager.path(manager)
    return path_resolver.resource_dir()

def _ensure_engine(app: Union[App, AppHandle, WebviewWindow]):
    global _engine, _Session
    if _engine is None:
        db_path = get_db_path(app)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(_engine)
        _Session = sessionmaker(bind=_engine, expire_on_commit=False)


def init_database(app: Union[App, AppHandle, WebviewWindow]) -> Path:
    """Ensure the database engine and schema exist. Returns DB path."""
    _ensure_engine(app)
    return get_db_path(app)


def session(app: Union[App, AppHandle, WebviewWindow]) -> Session:
    _ensure_engine(app)
    assert _Session is not None
    return _Session()


def list_chats(sess: Session) -> List[Chat]:
    stmt = select(Chat).order_by(Chat.updatedAt.desc().nulls_last(), Chat.createdAt.desc().nulls_last())
    return list(sess.scalars(stmt))


def get_chat_messages(sess: Session, chatId: str) -> List[Dict[str, Any]]:
    stmt = select(Message).where(Message.chatId == chatId).order_by(Message.createdAt.asc().nulls_last())
    rows = list(sess.scalars(stmt))
    messages: List[Dict[str, Any]] = []
    for r in rows:
        toolCalls = json.loads(r.toolCalls) if r.toolCalls else None
        messages.append(
            {
                "id": r.id,
                "role": r.role,
                "content": r.content,
                "createdAt": r.createdAt,
                "toolCalls": toolCalls,
            }
        )
    return messages


def create_chat(
    sess: Session,
    *,
    id: str,
    title: str,
    model: Optional[str],
    createdAt: str,
    updatedAt: str,
) -> None:
    chat = Chat(
        id=id,
        title=title,
        model=model,
        createdAt=createdAt,
        updatedAt=updatedAt,
    )
    sess.add(chat)
    sess.commit()


def update_chat(
    sess: Session,
    *,
    id: str,
    title: Optional[str] = None,
    model: Optional[str] = None,
    updatedAt: Optional[str] = None,
) -> None:
    chat: Optional[Chat] = sess.get(Chat, id)
    if not chat:
        return
    if title is not None:
        chat.title = title
    if model is not None:
        chat.model = model
    if updatedAt is not None:
        chat.updatedAt = updatedAt
    sess.commit()


def append_message(
    sess: Session,
    *,
    id: str,
    chatId: str,
    role: str,
    content: str,
    createdAt: str,
    toolCalls: Optional[List[Dict[str, Any]]] = None,
) -> None:
    """Append a new message to a chat."""
    sess.add(
        Message(
            id=id,
            chatId=chatId,
            role=role,
            content=content,
            createdAt=createdAt,
            toolCalls=json.dumps(toolCalls) if toolCalls is not None else None,
        )
    )
    sess.commit()


def update_message_content(
    sess: Session,
    *,
    messageId: str,
    content: str,
    toolCalls: Optional[List[Dict[str, Any]]] = None,
) -> None:
    """Update the content of an existing message (for streaming updates)."""
    message: Optional[Message] = sess.get(Message, messageId)
    if not message:
        return
    message.content = content
    if toolCalls is not None:
        message.toolCalls = json.dumps(toolCalls)
    sess.commit()


def delete_chat(sess: Session, *, chatId: str) -> None:
    chat = sess.get(Chat, chatId)
    if chat:
        sess.delete(chat)
        sess.commit()
