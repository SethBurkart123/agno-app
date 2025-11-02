from __future__ import annotations

import sys

from pytauri import AppHandle

from .. import db
from ..types import _BaseModel
from ..models.chat import (
    AvailableModelsResponse,
    ModelInfo,
    AllProvidersResponse,
    ProviderConfig,
    SaveProviderConfigInput,
    DefaultToolsResponse,
    SetDefaultToolsInput,
    AutoTitleSettings,
    SaveAutoTitleSettingsInput,
)
from ..services.model_factory import (
    get_available_models as get_models_from_factory,
)
from ..config import get_env
from . import commands


class Person(_BaseModel):
    name: str


class Greeting(_BaseModel):
    message: str


@commands.command()
async def greet(body: Person) -> Greeting:
    return Greeting(message=f"Hello, {body.name}! You've been greeted from Python: {sys.version}!")


@commands.command()
async def get_version() -> str:
    return sys.version


@commands.command()
async def get_available_models(app_handle: AppHandle) -> AvailableModelsResponse:
    """
    Get list of available models based on configured providers.
    
    Checks both environment variables and database provider settings.
    
    Returns:
        List of available models with provider, modelId, displayName, and isDefault
    """
    models_data = get_models_from_factory(app_handle)
    models = [
        ModelInfo(
            provider=m["provider"],
            modelId=m["modelId"],
            displayName=m["displayName"],
            isDefault=m["isDefault"],
        )
        for m in models_data
    ]
    return AvailableModelsResponse(models=models)


@commands.command()
async def get_provider_settings(app_handle: AppHandle) -> AllProvidersResponse:
    """
    Get all configured provider settings.
    
    Returns:
        List of provider configurations
    """
    # Load provider settings from DB
    sess = db.session(app_handle)
    try:
        db_settings = db.get_all_provider_settings(sess)
    finally:
        sess.close()

    # Also include environment-based configurations so the UI can prefill
    env_settings: dict[str, dict] = {}

    # OpenAI
    openai_key = get_env("OPENAI_API_KEY")
    if openai_key:
        env_settings["openai"] = {
            "api_key": openai_key,
            "base_url": get_env("OPENAI_API_BASE_URL") or get_env("OPENAI_BASE_URL"),
            "enabled": True,
        }

    # Anthropic
    anthropic_key = get_env("ANTHROPIC_API_KEY")
    if anthropic_key:
        env_settings["anthropic"] = {
            "api_key": anthropic_key,
            "enabled": True,
        }

    # Groq
    groq_key = get_env("GROQ_API_KEY")
    if groq_key:
        env_settings["groq"] = {
            "api_key": groq_key,
            "enabled": True,
        }

    # Ollama (local) — expose host for convenience
    ollama_host = get_env("OLLAMA_HOST") or "http://localhost:11434"
    env_settings["ollama"] = {
        "base_url": ollama_host,
        "enabled": True,
    }

    # Merge env + DB with DB taking precedence
    merged: dict[str, dict] = {**env_settings, **db_settings}

    providers = []
    for provider, config in merged.items():
        providers.append(
            ProviderConfig(
                provider=provider,
                api_key=config.get("api_key"),
                base_url=config.get("base_url"),
                enabled=config.get("enabled", True),
            )
        )

    return AllProvidersResponse(providers=providers)


@commands.command()
async def save_provider_settings(body: SaveProviderConfigInput, app_handle: AppHandle) -> None:
    """
    Save or update provider settings.
    
    Args:
        body: Provider configuration to save
        app_handle: Tauri app handle
    """
    sess = db.session(app_handle)
    try:
        db.save_provider_settings(
            sess,
            provider=body.provider,
            api_key=body.api_key,
            base_url=body.base_url,
            enabled=body.enabled,
        )
    finally:
        sess.close()
    
    return None


@commands.command()
async def get_default_tools(app_handle: AppHandle) -> DefaultToolsResponse:
    """
    Get default tool IDs for new chats.
    
    Returns:
        List of default tool IDs
    """
    sess = db.session(app_handle)
    try:
        tool_ids = db.get_default_tool_ids(sess)
    finally:
        sess.close()
    
    return DefaultToolsResponse(toolIds=tool_ids)


@commands.command()
async def set_default_tools(body: SetDefaultToolsInput, app_handle: AppHandle) -> None:
    """
    Set default tool IDs for new chats.
    
    Args:
        body: Contains list of tool IDs to set as defaults
        app_handle: Tauri app handle
    """
    sess = db.session(app_handle)
    try:
        db.set_default_tool_ids(sess, body.toolIds)
    finally:
        sess.close()
    
    return None


@commands.command()
async def get_auto_title_settings(app_handle: AppHandle) -> AutoTitleSettings:
    """
    Get auto-title generation settings.
    
    Returns:
        Auto-title settings including enabled, prompt, and model configuration
    """
    with db.db_session(app_handle) as sess:
        settings = db.get_auto_title_settings(sess)
    
    return AutoTitleSettings(
        enabled=settings.get("enabled", True),
        prompt=settings.get("prompt", "Generate a brief, descriptive title (max 6 words) for this conversation based on the user's message: {{ message }}\n\nReturn only the title, nothing else."),
        modelMode=settings.get("model_mode", "current"),
        provider=settings.get("provider", "openai"),
        modelId=settings.get("model_id", "gpt-4o-mini"),
    )


@commands.command()
async def save_auto_title_settings(body: SaveAutoTitleSettingsInput, app_handle: AppHandle) -> None:
    """
    Save auto-title generation settings.
    
    Args:
        body: Auto-title settings to save
        app_handle: Tauri app handle
    """
    with db.db_session(app_handle) as sess:
        settings = {
            "enabled": body.enabled,
            "prompt": body.prompt,
            "model_mode": body.modelMode,
            "provider": body.provider,
            "model_id": body.modelId,
        }
        db.save_auto_title_settings(sess, settings)
    
    return None
