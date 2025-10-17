from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Tuple

from ..config import get_env, require_env

# Defer import so unit tests or environments without openai can still import module
_openai_client = None


def _ensure_openai():
    global _openai_client
    if _openai_client is not None:
        return _openai_client

    # Import lazily
    try:
        from openai import OpenAI  # type: ignore
    except Exception as e:  # pragma: no cover - need runtime dependency
        raise RuntimeError(
            "The 'openai' package is required. Add it to src-tauri/pyproject.toml and install."
        ) from e

    api_key = require_env("OPENAI_API_KEY")
    # Prefer OPENAI_API_BASE_URL, fallback to OPENAI_BASE_URL for compatibility
    base_url = get_env("OPENAI_API_BASE_URL") or get_env("OPENAI_BASE_URL")
    _openai_client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)
    return _openai_client


def normalize_messages(messages: List[Dict]) -> List[Dict]:
    """Transform internal message dictionaries to OpenAI Chat API format.

    Expects keys: id, role, content. Additional keys are ignored.
    """
    out: List[Dict] = []
    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if not role or content is None:
            # Skip invalid entries
            continue
        out.append({"role": role, "content": content})
    # Debug: print summary of normalized messages
    try:
        print(
            "[openai_service.normalize_messages] count=", len(out),
            " roles=", [mm.get("role") for mm in out],
        )
    except Exception:
        pass
    return out


def stream_chat_completion(
    *,
    model: str,
    messages: List[Dict],
) -> Iterable[Tuple[Optional[str], bool]]:
    """Yield streamed text chunks from OpenAI Chat Completions API.

    Returns an iterator of (content_delta, done_flag) tuples. content_delta may be None.
    Always yields (None, True) on completion or error.
    """
    client = _ensure_openai()

    try:
        # Using the Chat Completions API with stream=True
        # Each chunk has structure similar to: chunk.choices[0].delta.content
        stream = client.chat.completions.create(
            model=model,
            messages=normalize_messages(messages),
            stream=True,
        )

        completion_signaled = False
        
        for chunk in stream:
            try:
                choice = chunk.choices[0]
            except Exception:
                continue

            # End of stream
            if getattr(choice, "finish_reason", None) is not None:
                completion_signaled = True
                yield (None, True)
                break

            delta = getattr(choice, "delta", None)
            if not delta:
                continue
            part = getattr(delta, "content", None)
            if part:
                yield (str(part), False)
        
        # Ensure completion is always signaled
        if not completion_signaled:
            yield (None, True)
            
    except Exception as e:
        # On any error, signal completion so stream doesn't hang
        print(f"[openai_service] Error during streaming: {e}")
        yield (None, True)
        raise
