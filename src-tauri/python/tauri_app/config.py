from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

try:
    # Optional dependency for local dev to load .env
    from dotenv import load_dotenv  # type: ignore
except Exception:  # pragma: no cover - optional
    load_dotenv = None  # type: ignore


_ENV_LOADED = False


def load_env() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    # Best-effort load .env in dev; on production, env should be provided
    if load_dotenv is not None:
        try:
            # Attempt default resolution first (cwd)
            load_dotenv()
        except Exception:
            pass
        try:
            # Also attempt to load from repo root: ../../..
            here = Path(__file__).resolve()
            repo_root = here.parents[3] if len(here.parents) >= 4 else here.parent
            env_path = repo_root / ".env"
            if env_path.exists():
                load_dotenv(env_path)
        except Exception:
            pass
    _ENV_LOADED = True


def get_env(key: str, default: Optional[str] = None) -> Optional[str]:
    load_env()
    return os.getenv(key, default)


def require_env(key: str) -> str:
    value = get_env(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value
