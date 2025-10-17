from __future__ import annotations

import sys

from ..types import _BaseModel
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

