"use client";

import React, { useEffect, useRef, useState } from "react";
import { useChat } from "@/contexts/chat-context";
import ChatMessageList from "./ChatMessageList";
import { api, type Message } from "@/lib/services/api";

interface ChatProps {
  messages: Message[];
  isLoading: boolean;
}

export default function Chat({ messages, isLoading }: ChatProps) {
  const AssistantMessageActions = () => {
    return null;
  };

  return (
    <div className="flex-1 px-4 py-6 max-w-[50rem] w-full mx-auto">
      <ChatMessageList 
        messages={messages}
        isLoading={isLoading}
        thinkingTimes={undefined}
        AssistantMessageActions={AssistantMessageActions}
      />
    </div>
  );
}

export function useChatInput() {
  const {
    chatId,
    selectedModel,
    refreshChats,
  } = useChat();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Abort stream and clear input when switching chats
  useEffect(() => {
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort(); } catch {}
      abortControllerRef.current = null;
      setIsLoading(false);
    }
    setInput("");
  }, [chatId]);

  // Load messages when chatId changes
  useEffect(() => {
    const loadChatMessages = async () => {
      if (!chatId) {
        setMessages([]);
        return;
      }
      
      try {
        const fullChat = await api.getChat(chatId);
        setMessages(fullChat.messages || []);
      } catch (error) {
        console.error('Failed to load chat messages:', error);
        setMessages([]);
      }
    };
    
    loadChatMessages();
  }, [chatId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const currentChatId = chatId;
    const userMessageContent = input.trim();

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessageContent,
      createdAt: new Date().toISOString(),
    };

    // Optimistically show user message
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    abortControllerRef.current = new AbortController();
    let sessionId: string | null = null;

    try {
      const response = await api.streamChat(
        newMessages,
        selectedModel,
        currentChatId || undefined
      );

      if (!response.ok) {
        throw new Error(`Failed to stream chat: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      const assistantMessageId = crypto.randomUUID();
      let messageContent = "";
      let reasoningContent = "";
      let isReasoningClosed = false;
      
      const buildAssistantContent = () => {
        const trimmedReasoning = reasoningContent.trim();
        let combined = "";
        if (trimmedReasoning !== "") {
          combined += `<think>${trimmedReasoning}`;
          if (isReasoningClosed) {
            combined += "</think>\n\n";
          }
        }
        combined += messageContent;
        return combined;
      };

      // Coalesce streaming updates to ~1 per frame
      const framePendingRef = { current: false } as { current: boolean };
      const updateAssistantMessage = () => {
        if (framePendingRef.current) return;
        framePendingRef.current = true;
        requestAnimationFrame(() => {
          framePendingRef.current = false;
          const combined = buildAssistantContent();
          setMessages(prev => {
            const withoutLast = prev.filter(m => m.id !== assistantMessageId);
            return [
              ...withoutLast,
              {
                id: assistantMessageId,
                role: "assistant",
                content: combined,
              },
            ];
          });
        });
      };

      updateAssistantMessage();

      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              
              if (currentEvent === "RunStarted" && parsed.sessionId) {
                sessionId = parsed.sessionId;
                // If we got a sessionId and didn't have a chatId, update the URL and refresh sidebar
                if (!currentChatId && sessionId) {
                  window.history.replaceState(null, '', `/?chatId=${sessionId}`);
                  // Refresh sidebar to show new chat immediately
                  refreshChats();
                }
                updateAssistantMessage();
              } else if (currentEvent === "RunContent") {
                let needsUpdate = false;
                if (typeof parsed.reasoningContent === "string" && parsed.reasoningContent.trim() !== "") {
                  const incoming = parsed.reasoningContent;
                  if (incoming !== reasoningContent || isReasoningClosed) {
                    reasoningContent = incoming;
                    if (isReasoningClosed) {
                      isReasoningClosed = false;
                    }
                    needsUpdate = true;
                  }
                }
                if (parsed.content) {
                  if (reasoningContent.trim() !== "" && !isReasoningClosed) {
                    isReasoningClosed = true;
                  }
                  messageContent += parsed.content;
                  needsUpdate = true;
                }
                if (needsUpdate) {
                  updateAssistantMessage();
                }
              } else if (currentEvent === "RunCompleted") {
                let needsUpdate = false;
                if (typeof parsed.reasoningContent === "string" && parsed.reasoningContent.trim() !== "") {
                  const incoming = parsed.reasoningContent;
                  if (incoming !== reasoningContent) {
                    reasoningContent = incoming;
                    needsUpdate = true;
                  }
                }
                if (reasoningContent.trim() !== "" && !isReasoningClosed) {
                  isReasoningClosed = true;
                  needsUpdate = true;
                }
                if (parsed.content) {
                  messageContent += parsed.content;
                  needsUpdate = true;
                }
                if (needsUpdate) {
                  updateAssistantMessage();
                }
              }
            } catch (err) {
              console.error("Failed to parse SSE data:", err, "Line:", line);
            }
          }
        }
      }

      // Reload messages from backend after streaming completes
      // This ensures we have the authoritative version
      if (sessionId || currentChatId) {
        const finalChatId = sessionId || currentChatId;
        try {
          const fullChat = await api.getChat(finalChatId!);
          setMessages(fullChat.messages || []);
        } catch (error) {
          console.error('Failed to reload messages after streaming:', error);
        }
      }
      
    } catch (error) {
      console.error("Error streaming chat:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, there was an error processing your request.",
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return {
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    inputRef,
    messages,
  };
}
