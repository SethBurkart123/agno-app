from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import ProviderSettings


def get_provider_settings(sess: Session, provider: str) -> Optional[Dict[str, Any]]:
    """
    Get settings for a specific provider.
    
    Args:
        sess: Database session
        provider: Provider name (openai, anthropic, groq, ollama)
        
    Returns:
        Provider settings dict or None if not found
    """
    settings: Optional[ProviderSettings] = sess.get(ProviderSettings, provider)
    if not settings:
        return None
    
    return {
        "provider": settings.provider,
        "api_key": settings.api_key,
        "base_url": settings.base_url,
        "enabled": settings.enabled,
    }


def get_all_provider_settings(sess: Session) -> Dict[str, Dict[str, Any]]:
    """
    Get all provider settings.
    
    Args:
        sess: Database session
        
    Returns:
        Dict mapping provider name to settings dict
    """
    stmt = select(ProviderSettings)
    rows = list(sess.scalars(stmt))
    
    result = {}
    for row in rows:
        result[row.provider] = {
            "provider": row.provider,
            "api_key": row.api_key,
            "base_url": row.base_url,
            "enabled": row.enabled,
        }
    return result


def save_provider_settings(
    sess: Session,
    *,
    provider: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    enabled: bool = True,
) -> None:
    """
    Save or update provider settings.
    
    Args:
        sess: Database session
        provider: Provider name (openai, anthropic, groq, ollama)
        api_key: API key for the provider
        base_url: Base URL for the provider (optional, for custom endpoints)
        enabled: Whether the provider is enabled
    """
    settings: Optional[ProviderSettings] = sess.get(ProviderSettings, provider)
    
    if settings:
        # Update existing
        if api_key is not None:
            settings.api_key = api_key
        if base_url is not None:
            settings.base_url = base_url
        settings.enabled = enabled
    else:
        # Create new
        settings = ProviderSettings(
            provider=provider,
            api_key=api_key,
            base_url=base_url,
            enabled=enabled,
        )
        sess.add(settings)
    
    sess.commit()

