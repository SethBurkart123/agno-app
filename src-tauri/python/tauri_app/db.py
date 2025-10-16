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
    created_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Removed thinking_time persistence

    messages: Mapped[List["Message"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    chat_id: Mapped[str] = mapped_column(String, ForeignKey("chats.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tool_calls: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
    stmt = select(Chat).order_by(Chat.updated_at.desc().nulls_last(), Chat.created_at.desc().nulls_last())
    return list(sess.scalars(stmt))


def get_chat_messages(sess: Session, chat_id: str) -> List[Dict[str, Any]]:
    stmt = select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.asc().nulls_last())
    rows = list(sess.scalars(stmt))
    messages: List[Dict[str, Any]] = []
    for r in rows:
        tool_calls = json.loads(r.tool_calls) if r.tool_calls else None
        messages.append(
            {
                "id": r.id,
                "role": r.role,
                "content": r.content,
                "created_at": r.created_at,
                "tool_calls": tool_calls,
            }
        )
    return messages


def create_chat(
    sess: Session,
    *,
    id: str,
    title: str,
    model: Optional[str],
    created_at: str,
    updated_at: str,
) -> None:
    chat = Chat(
        id=id,
        title=title,
        model=model,
        created_at=created_at,
        updated_at=updated_at,
    )
    sess.add(chat)
    sess.commit()


def update_chat(
    sess: Session,
    *,
    id: str,
    title: Optional[str] = None,
    model: Optional[str] = None,
    updated_at: Optional[str] = None,
) -> None:
    chat: Optional[Chat] = sess.get(Chat, id)
    if not chat:
        return
    if title is not None:
        chat.title = title
    if model is not None:
        chat.model = model
    if updated_at is not None:
        chat.updated_at = updated_at
    sess.commit()


def replace_chat_messages(
    sess: Session,
    *,
    chat_id: str,
    messages: List[Dict[str, Any]],
) -> None:
    # Delete existing
    sess.query(Message).filter(Message.chat_id == chat_id).delete()
    # Insert new
    for m in messages:
        sess.add(
            Message(
                id=m.get("id"),
                chat_id=chat_id,
                role=m.get("role"),
                content=m.get("content"),
                created_at=m.get("created_at"),
                tool_calls=json.dumps(m.get("tool_calls")) if m.get("tool_calls") is not None else None,
            )
        )
    sess.commit()


def delete_chat(sess: Session, *, chat_id: str) -> None:
    chat = sess.get(Chat, chat_id)
    if chat:
        sess.delete(chat)
        sess.commit()
