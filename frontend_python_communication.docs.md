# PyTauri Data Sharing APIs

Complete documentation for sharing data between the frontend (JavaScript) and backend (Python) in PyTauri.

***

## 1. Commands - Frontend Calls Python

Commands allow your frontend to invoke Python functions and receive responses. This is the primary way to call backend logic from the frontend.

### Python Backend

```python
from pytauri import Commands, AppHandle
from pytauri.ipc import InvokeException, Headers
from pydantic import BaseModel
from typing import Annotated

commands = Commands()

# Simple command
@commands.command()
async def greet(body: str) -> str:
    return f"Hello, {body}!"

# Command with structured data
class UserInput(BaseModel):
    name: str
    age: int

class UserOutput(BaseModel):
    message: str
    user_id: int

@commands.command()
async def create_user(body: UserInput, app_handle: AppHandle) -> UserOutput:
    return UserOutput(message=f"Created {body.name}", user_id=123)

# Command with error handling
@commands.command()
async def risky_operation() -> None:
    raise InvokeException("Something went wrong!")

# Command with binary data and headers
@commands.command()
async def upload_file(body: bytes, headers: Headers) -> None:
    print(f"Received {len(body)} bytes")
    print(f"Content-Type: {headers.get('content-type')}")

# Register commands with app
from anyio.from_thread import start_blocking_portal
from pytauri import builder_factory, context_factory

with start_blocking_portal("asyncio") as portal:
    builder = builder_factory()
    app = builder.build(
        context_factory(),
        invoke_handler=commands.generate_handler(portal),
    )
    app.run()
```

### JavaScript Frontend

```javascript
// Using auto-generated functions (recommended)
import { greet, getVersion } from "@/python/apiClient";

// Type-safe function calls
const greeting = await greet({ name: "World" });
console.log(greeting.message); // "Hello, World!"

const version = await getVersion();
console.log(version); // Python version string

// Direct pyInvoke usage (if needed)
import { pyInvoke } from "tauri-plugin-pytauri-api";

// Simple invocation
const greeting = await pyInvoke("greet", "World");
console.log(greeting); // "Hello, World!"

// Structured data
const result = await pyInvoke("create_user", {
    name: "Alice",
    age: 30
});
console.log(result.message);

// Error handling
try {
    await pyInvoke("risky_operation");
} catch (error) {
    console.error("Command failed:", error);
}

// Using global Tauri object (if app.withGlobalTauri = true)
const { pyInvoke } = window.__TAURI__.pytauri;
const result = await pyInvoke("greet", "World");
```

***

## 2. Channels - Python Streams to Frontend

Channels are optimized for fast, ordered data streaming like download progress, AI responses, or real-time updates.

### Python Backend

```python
from pydantic import RootModel, BaseModel
from pytauri import Commands
from pytauri.ipc import Channel, JavaScriptChannelId
from pytauri.webview import WebviewWindow

commands = Commands()

# Define message type
Msg = RootModel[str]

# Stream messages to frontend
@commands.command()
async def stream_data(
    body: JavaScriptChannelId[Msg],
    webview_window: WebviewWindow
) -> None:
    channel: Channel[Msg] = body.channel_on(webview_window.as_ref_webview())
    
    # Send multiple messages
    for i in range(10):
        channel.send_model(Msg(f"Message {i}"))
        await asyncio.sleep(0.1)

# Streaming AI chat responses
class ChatChunk(BaseModel):
    text: str
    done: bool

@commands.command()
async def stream_ai_chat(
    body: JavaScriptChannelId[ChatChunk],
    webview_window: WebviewWindow
) -> None:
    channel: Channel[ChatChunk] = body.channel_on(webview_window.as_ref_webview())
    
    # Simulate AI streaming
    response_chunks = ["Hello", " there", "!", " How", " can", " I", " help?"]
    for chunk in response_chunks:
        channel.send_model(ChatChunk(text=chunk, done=False))
        await asyncio.sleep(0.05)
    
    channel.send_model(ChatChunk(text="", done=True))
```

### JavaScript Frontend

```javascript
import { pyInvoke } from "tauri-plugin-pytauri-api";
import { Channel } from "@tauri-apps/api/core";

// Receive streamed messages
const channel = new Channel((msg) => {
    console.log("Received:", msg);
});
await pyInvoke("stream_data", channel);

// Stream AI chat
let fullResponse = "";
const chatChannel = new Channel((chunk) => {
    if (!chunk.done) {
        fullResponse += chunk.text;
        document.getElementById("chat").textContent = fullResponse;
    } else {
        console.log("Streaming complete");
    }
});
await pyInvoke("stream_ai_chat", chatChannel);
```

***

## 3. Event System - Bi-directional Communication

Events enable pub/sub patterns for multi-producer, multi-consumer scenarios. Unlike commands, events have no type safety and always use JSON.

### Python Backend (Emitter)

```python
from pytauri import AppHandle, Emitter, EventTarget
from pytauri.webview import WebviewWindow
import json

# Emit to all windows
def notify_all(app_handle: AppHandle) -> None:
    payload = json.dumps({"status": "updated", "count": 42})
    Emitter.emit_str(app_handle, "data-updated", payload)

# Emit to specific window
def notify_window(webview_window: WebviewWindow) -> None:
    payload = json.dumps({"message": "Hello from backend"})
    Emitter.emit_str_to(
        webview_window,
        EventTarget.AnyLabel("main-window"),
        "notification",
        payload
    )

# Emit with filter
def notify_filtered(app_handle: AppHandle) -> None:
    payload = json.dumps({"priority": "high"})
    Emitter.emit_str_filter(
        app_handle,
        "alert",
        payload,
        lambda target: True  # Custom filter logic
    )
```

### Python Backend (Listener)

```python
from pytauri import AppHandle, Listener, Event
from pydantic import BaseModel

class FrontendMessage(BaseModel):
    action: str
    data: dict

def setup_listeners(app_handle: AppHandle) -> None:
    # Listen to event
    def handler(event: Event):
        print(f"Event ID: {event.id}")
        msg = FrontendMessage.model_validate_json(event.payload)
        print(f"Action: {msg.action}, Data: {msg.data}")
    
    event_id = Listener.listen(app_handle, "frontend-action", handler)
    
    # Listen once
    Listener.once(app_handle, "init-complete", lambda e: print("Init done"))
    
    # Listen to any target
    Listener.listen_any(app_handle, "global-event", handler)
    
    # Unlisten later
    Listener.unlisten(app_handle, event_id)
```

### JavaScript Frontend

```javascript
import { emit, listen, once } from "@tauri-apps/api/event";

// Listen to backend events
const unlisten = await listen("data-updated", (event) => {
    console.log("Payload:", event.payload);
    console.log("Status:", event.payload.status);
});

// Listen once
await once("notification", (event) => {
    alert(event.payload.message);
});

// Emit to backend
await emit("frontend-action", {
    action: "save",
    data: { key: "value" }
});

// Cleanup
unlisten();

// Using global Tauri (if app.withGlobalTauri = true)
const { emit, listen } = window.__TAURI__.event;
```

***

## 4. State Management - Backend State Storage

State management allows you to store and share data globally across your Python backend.

### Python Backend

```python
from dataclasses import dataclass
from typing import Annotated
from pytauri import App, AppHandle, Manager, Commands, State

# Define state classes
@dataclass
class AppState:
    counter: int = 0
    user_name: str = ""

@dataclass
class ChatState:
    messages: list = None
    current_chat_id: str = ""
    
    def __post_init__(self):
        if self.messages is None:
            self.messages = []

# Initialize state
def setup_app(app: App) -> None:
    app_state = AppState()
    chat_state = ChatState()
    
    Manager.manage(app, app_state)
    Manager.manage(app, chat_state)

# Access state in commands
commands = Commands()

@commands.command()
async def increment_counter(
    app_state: Annotated[AppState, State()]
) -> int:
    app_state.counter += 1
    return app_state.counter

@commands.command()
async def add_message(
    message: str,
    chat_state: Annotated[ChatState, State()],
    app_handle: AppHandle
) -> None:
    chat_state.messages.append(message)
    
    # Can also access state via Manager
    retrieved_state = Manager.state(app_handle, ChatState)
    assert retrieved_state is chat_state

@commands.command()
async def get_user_info(
    app_state: Annotated[AppState, State()],
    chat_state: Annotated[ChatState, State()]
) -> dict:
    return {
        "counter": app_state.counter,
        "user": app_state.user_name,
        "message_count": len(chat_state.messages)
    }
```

### JavaScript Frontend

```javascript
import { pyInvoke } from "tauri-plugin-pytauri-api";

// Commands automatically have access to state
const newCount = await pyInvoke("increment_counter");
console.log("Counter is now:", newCount);

await pyInvoke("add_message", "Hello from frontend!");

const info = await pyInvoke("get_user_info");
console.log(info);
```

***

## 5. Direct JavaScript Evaluation

Execute JavaScript code directly from Python backend.

### Python Backend

```python
from pytauri.webview import WebviewWindow

async def run_js(webview_window: WebviewWindow) -> None:
    # Execute JavaScript
    await webview_window.eval("console.log('Hello from Python!');")
    
    # Manipulate DOM
    await webview_window.eval("""
        document.getElementById('status').textContent = 'Updated from backend';
    """)
    
    # Call frontend functions
    await webview_window.eval("window.updateUI({ data: 'new value' });")
```

***

## API Comparison

| API | Direction | Use Case | Type Safety | Performance |
|-----|-----------|----------|-------------|-------------|
| **Commands** | Frontend → Python | RPC calls, queries | ✅ Strong (Pydantic) | Good |
| **Channels** | Python → Frontend | Streaming, real-time data | ✅ Strong | Excellent |
| **Events** | Bi-directional | Pub/sub, notifications | ❌ JSON only | Good |
| **State** | Backend only | Shared backend state | ✅ Strong | N/A |
| **JS Eval** | Python → Frontend | Direct DOM manipulation | ❌ String-based | Fair |

***

## Best Practices

**For AI Chat Applications:**
1. Use **State** to store chat history in backend
2. Use **Commands** for user message submissions
3. Use **Channels** to stream AI responses in real-time
4. Use **Events** to notify about connection status

**General Guidelines:**
- Prefer **Commands** for request/response patterns
- Use **Channels** for high-throughput streaming (downloads, AI, logs)
- Use **Events** for notifications and pub/sub patterns
- Use **State** to share data between Python commands
- Avoid **JS Eval** unless absolutely necessary

All APIs support async/await patterns and integrate with PyTauri's anyio-based async runtime.