"use client";

import React, { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import ToolCall from "./ToolCall";
import ThinkingCall from "./ThinkingCall";

import "katex/dist/katex.min.css";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface ToolCallData {
  id: string;
  toolName: string;
  toolArgs: Record<string, any>;
  toolResult?: string;
  isCompleted: boolean;
}

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  thinkingTimeMs?: number;
  toolCalls?: ToolCallData[];
}

export default React.memo(function ChatMessage({ role, content, isStreaming, thinkingTimeMs, toolCalls }: ChatMessageProps) {
  // Parse <think> blocks and inline tool markers for rendering
  let displayContent = content;

  // Track open <think> timing to power the timer in the UI
  const thinkStartRef = useRef<number | null>(null);
  const [thinkElapsedMs, setThinkElapsedMs] = useState<number | null>(null);

  // Helper: extract <think> blocks while preserving text in between
  type PreSegment = { type: 'text'; value: string } | { type: 'think'; value: string; open: boolean };
  const extractThinkSegments = (input: string): PreSegment[] => {
    const segs: PreSegment[] = [];
    let pos = 0;
    while (pos < input.length) {
      const start = input.indexOf('<think>', pos);
      if (start === -1) {
        const tail = input.slice(pos);
        if (tail) segs.push({ type: 'text', value: tail });
        break;
      }
      const before = input.slice(pos, start);
      if (before) segs.push({ type: 'text', value: before });
      const afterStart = start + '<think>'.length;
      const end = input.indexOf('</think>', afterStart);
      if (end === -1) {
        const thinkBody = input.slice(afterStart);
        segs.push({ type: 'think', value: thinkBody, open: true });
        break;
      }
      const thinkBody = input.slice(afterStart, end);
      segs.push({ type: 'think', value: thinkBody, open: false });
      pos = end + '</think>'.length;
    }
    return segs.length > 0 ? segs : [{ type: 'text', value: input }];
  };

  const hasOpenThink = React.useMemo(() => {
    // Open think exists if any unmatched <think> without closing was parsed
    const pre = extractThinkSegments(displayContent);
    return pre.some(s => s.type === 'think' && s.open);
  }, [displayContent]);

  useEffect(() => {
    if (isStreaming && hasOpenThink && thinkStartRef.current == null) {
      thinkStartRef.current = Date.now();
      setThinkElapsedMs(null);
    }
    if (!hasOpenThink && thinkStartRef.current != null && thinkElapsedMs == null) {
      setThinkElapsedMs(Date.now() - thinkStartRef.current);
    }
  }, [isStreaming, hasOpenThink, thinkElapsedMs]);

  // Split content into text/tool/think segments
  // Tool marker format: <<TOOL:{toolCallId}>> (inserted during streaming)
  type Segment =
    | { type: 'text'; value: string }
    | { type: 'tool'; id: string }
    | { type: 'think'; value: string; open: boolean };
  const TOOL_REGEX = /(<<TOOL:[^>]+>>)/g;
  const segments: Segment[] = React.useMemo(() => {
    const pre = extractThinkSegments(displayContent);
    const out: Segment[] = [];
    for (const seg of pre) {
      if (seg.type === 'text') {
        const parts = seg.value.split(TOOL_REGEX);
        for (const part of parts) {
          if (!part) continue;
          const match = part.match(/^<<TOOL:([^>]+)>>$/);
          if (match) {
            out.push({ type: 'tool', id: match[1] });
          } else {
            out.push({ type: 'text', value: part });
          }
        }
      } else {
        out.push({ type: 'think', value: seg.value, open: seg.open });
      }
    }
    return out.length > 0 ? out : [{ type: 'text', value: '' }];
  }, [displayContent]);

  // Helper for grouping
  const isWhitespaceOnly = (s: Segment) => s.type === 'text' && s.value.trim() === '';

  // Add a ref to find the last text node
  const contentRef = React.useRef<HTMLDivElement>(null);
  
  // Effect to place the indicator at the end of the text
  React.useEffect(() => {
    if (!contentRef.current) return;    

    const existingIndicators = contentRef.current.querySelectorAll('.inline-typewriter-indicator');
    existingIndicators.forEach(el => el.remove());
    
    // Skip the DOM manipulation if content is empty - we'll handle it in the render method
    if (isStreaming && content !== "") {
      // Find the last text node
      const walker = document.createTreeWalker(
        contentRef.current,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip empty text nodes
            if (node.nodeValue?.trim() === '') return NodeFilter.FILTER_SKIP;
            // Skip any text nodes inside tool call UI blocks
            const parentEl = (node as unknown as ChildNode & { parentElement: Element | null }).parentElement;
            if (parentEl && parentEl.closest('[data-toolcall]')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      
      let lastTextNode: Text | null = null;
      while (walker.nextNode()) {
        lastTextNode = walker.currentNode as Text;
      }
      
      if (lastTextNode && lastTextNode.parentNode) {
        // Create a span for the indicator
        const indicatorSpan = document.createElement('span');
        indicatorSpan.classList.add('inline-typewriter-indicator');
        
        // Insert after the last text node
        if (lastTextNode.nextSibling) {
          lastTextNode.parentNode.insertBefore(indicatorSpan, lastTextNode.nextSibling);
        } else {
          lastTextNode.parentNode.appendChild(indicatorSpan);
        }
      }
    }
    
    // Cleanup function
    return () => {
      if (contentRef.current) {
        const indicators = contentRef.current.querySelectorAll('.inline-typewriter-indicator');
        indicators.forEach(el => el.remove());
      }
    };
  }, [isStreaming, content]);
  
  return (
    <div
      className={clsx(
        "flex w-full",
        role === "user" ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={clsx(
          "rounded-3xl text-base leading-relaxed overflow-hidden max-w-full min-w-0",
          role === "user"
            ? "bg-muted text-muted-foreground px-5 py-2.5 mb-2"
            : "text-card-foreground",
          role === "assistant" &&
            "prose prose-zinc dark:prose-invert prose-p:my-2 prose-li:my-0.5 px-2 py-2.5 pb-8 w-full",
        )}
      >
        {/* User messages (simple text) */}
        {role === "user" && (
          <p>{content}</p>
        )}

        {/* Assistant messages with Markdown */}
        {role === "assistant" && (
          <div ref={contentRef} className="relative assistant-message w-full prose !max-w-none dark:prose-invert prose-zinc">
            {/* Show indicator when run started but no content or tool calls yet */}
            {content === "" && isStreaming && (!toolCalls || toolCalls.length === 0) ? (
              <div className="inline-block">
                <div className="size-[0.65rem] bg-primary rounded-full animate-pulse"></div>
              </div>
            ) : (
              <>
                {/* If inline markers exist, render inline segments; otherwise fallback to top-grouped toolCalls + content */}
                {segments.some(s => s.type === 'tool' || s.type === 'think') ? (
                  <>
                    {(() => {
                      const rendered: React.ReactNode[] = [];
                      for (let i = 0; i < segments.length; i++) {
                        const seg = segments[i];
                        if (seg.type === 'text') {
                          const text = seg.value;
                          if (text && text.trim() !== '') {
                            rendered.push(
                              <MarkdownRenderer key={`text-${i}`} content={text} />
                            );
                          }
                        } else {
                          // Gather consecutive groupable segments (tool or think), allowing whitespace-only
                          // text segments between them so they still group/"join".
                          const start = i;
                          const group: (Segment & { __kind: 'tool' | 'think' })[] = [];
                          let j = i;
                          while (j < segments.length) {
                            const s = segments[j];
                            if (s.type === 'tool') {
                              group.push({ ...(s as any), __kind: 'tool' });
                              j++;
                              continue;
                            }
                            if (s.type === 'think') {
                              group.push({ ...(s as any), __kind: 'think' });
                              j++;
                              continue;
                            }
                            if (isWhitespaceOnly(s)) {
                              j++;
                              continue;
                            }
                            break;
                          }
                          i = j - 1; // step back because for-loop will increment
                          const toolData = (id: string) => toolCalls?.find(t => t.id === id);

                          const groupItems = group.map((g, idx) => {
                            if (g.__kind === 'tool') {
                              const td = toolData((g as any).id);
                              if (!td) return null;
                              return (
                                <ToolCall
                                  key={`tool-${start}-${td.id}`}
                                  toolName={td.toolName}
                                  toolArgs={td.toolArgs}
                                  toolResult={td.toolResult}
                                  isCompleted={td.isCompleted}
                                  isGrouped={group.length > 1}
                                  isFirst={idx === 0}
                                  isLast={idx === group.length - 1}
                                />
                              );
                            } else {
                              // think block
                              const isOpen = (g as any).open as boolean;
                              return (
                                <ThinkingCall
                                  key={`think-${start}-${idx}`}
                                  content={(g as any).value}
                                  isCompleted={!isOpen}
                                  isGrouped={group.length > 1}
                                  isFirst={idx === 0}
                                  isLast={idx === group.length - 1}
                                  active={isOpen && !!isStreaming}
                                  startAt={isOpen && !!isStreaming && thinkStartRef.current ? thinkStartRef.current : undefined}
                                  finalElapsedMs={!isOpen && thinkElapsedMs != null ? thinkElapsedMs : undefined}
                                />
                              );
                            }
                          }).filter(Boolean);

                          if (group.length === 1) {
                            if (groupItems.length === 1) rendered.push(groupItems[0]!);
                          } else if (group.length > 1) {
                            rendered.push(
                              <div key={`group-${start}`} className="my-3 not-prose">
                                <div className="border border-border rounded-lg overflow-hidden bg-card">
                                  {groupItems}
                                </div>
                              </div>
                            );
                          }
                        }
                      }
                      return rendered;
                    })()}
                  </>
                ) : (
                  <>
                    {toolCalls && toolCalls.length > 0 && (
                      <div className="mb-4">
                        {toolCalls.length === 1 ? (
                          <ToolCall
                            key={toolCalls[0].id}
                            toolName={toolCalls[0].toolName}
                            toolArgs={toolCalls[0].toolArgs}
                            toolResult={toolCalls[0].toolResult}
                            isCompleted={toolCalls[0].isCompleted}
                          />
                        ) : (
                          <div className="my-3 not-prose">
                            <div className="border border-border rounded-lg overflow-hidden bg-card">
                              {toolCalls.map((toolCall, index) => (
                                <ToolCall
                                  key={toolCall.id}
                                  toolName={toolCall.toolName}
                                  toolArgs={toolCall.toolArgs}
                                  toolResult={toolCall.toolResult}
                                  isCompleted={toolCall.isCompleted}
                                  isGrouped={true}
                                  isFirst={index === 0}
                                  isLast={index === toolCalls.length - 1}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {displayContent !== "" && (
                      <MarkdownRenderer content={displayContent} />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
