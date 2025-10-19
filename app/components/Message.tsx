"use client";

import React, { useEffect, useRef } from "react";
import clsx from "clsx";
import ToolCall from "./ToolCall";
import ThinkingCall from "./ThinkingCall";

import "katex/dist/katex.min.css";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { ContentBlock } from "@/lib/types/chat";

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  isStreaming?: boolean;
}

export default React.memo(function ChatMessage({
  role,
  content,
  isStreaming,
}: ChatMessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Effect to place the cursor indicator at the end of streaming text
  useEffect(() => {
    if (!contentRef.current) return;

    const existingIndicators = contentRef.current.querySelectorAll(
      ".inline-typewriter-indicator"
    );
    existingIndicators.forEach((el) => el.remove());

    // Show cursor indicator if streaming and has content
    const hasContent =
      typeof content === "string"
        ? content !== ""
        : Array.isArray(content) && content.length > 0;

    if (isStreaming && hasContent) {
      // Find the last text node
      const walker = document.createTreeWalker(
        contentRef.current,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (node.nodeValue?.trim() === "") return NodeFilter.FILTER_SKIP;
            const parentEl = (
              node as unknown as ChildNode & { parentElement: Element | null }
            ).parentElement;
            if (parentEl && parentEl.closest("[data-toolcall]")) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      let lastTextNode: Text | null = null;
      while (walker.nextNode()) {
        lastTextNode = walker.currentNode as Text;
      }

      if (lastTextNode && lastTextNode.parentNode) {
        const indicatorSpan = document.createElement("span");
        indicatorSpan.classList.add("inline-typewriter-indicator");

        if (lastTextNode.nextSibling) {
          lastTextNode.parentNode.insertBefore(
            indicatorSpan,
            lastTextNode.nextSibling
          );
        } else {
          lastTextNode.parentNode.appendChild(indicatorSpan);
        }
      }
    }

    return () => {
      if (contentRef.current) {
        const indicators = contentRef.current.querySelectorAll(
          ".inline-typewriter-indicator"
        );
        indicators.forEach((el) => el.remove());
      }
    };
  }, [isStreaming, content]);

  useEffect(() => {
    console.log("================================================");
    console.log(content);
    console.log(isStreaming);
    console.log("================================================");
  }, [content, isStreaming]);

  return (
    <div
      className={clsx(
        "flex w-full",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={clsx(
          "rounded-3xl text-base leading-relaxed overflow-hidden max-w-full min-w-0",
          role === "user"
            ? "bg-muted text-muted-foreground px-5 py-2.5 mb-2"
            : "text-card-foreground",
          role === "assistant" &&
            "prose prose-zinc dark:prose-invert prose-p:my-2 prose-li:my-0.5 px-2 py-2.5 pb-8 w-full"
        )}
      >
        {role === "user" && <p>{typeof content === "string" ? content : ""}</p>}

        {role === "assistant" && (
          <div
            ref={contentRef}
            className="relative assistant-message w-full prose !max-w-none dark:prose-invert prose-zinc"
          >
            {Array.isArray(content) && (
              <>
                {/* Show indicator when run started but no content yet */}
                {content.length === 1 &&
                content[0].type === "text" &&
                content[0].content === "" &&
                isStreaming ? (
                  <div className="inline-block">
                    <div className="size-[0.65rem] bg-primary rounded-full animate-pulse"></div>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const blocks = content as ContentBlock[];
                      const rendered: React.ReactNode[] = [];

                      for (let i = 0; i < blocks.length; i++) {
                        const block = blocks[i];

                        // Check if this is a text block
                        if (block.type === "text") {
                          const text = block.content;
                          if (text && text.trim() !== "") {
                            rendered.push(
                              <MarkdownRenderer
                                key={`text-${i}`}
                                content={text}
                              />
                            );
                          }
                          continue;
                        }

                        // For tool_call or reasoning blocks, check if we can group with consecutive ones
                        if (
                          block.type === "tool_call" ||
                          block.type === "reasoning"
                        ) {
                          const start = i;
                          const group: ContentBlock[] = [];
                          let j = i;

                          // Gather consecutive tool_call/reasoning blocks (allowing whitespace text in between)
                          while (j < blocks.length) {
                            const b = blocks[j];
                            if (
                              b.type === "tool_call" ||
                              b.type === "reasoning"
                            ) {
                              group.push(b);
                              j++;
                              continue;
                            }
                            if (b.type === "text" && b.content.trim() === "") {
                              j++;
                              continue;
                            }
                            break;
                          }

                          i = j - 1; // for-loop will increment

                          const groupItems = group.map((b, idx) => {
                            if (b.type === "tool_call") {
                              return (
                                <ToolCall
                                  key={b.id}
                                  toolName={b.toolName}
                                  toolArgs={b.toolArgs}
                                  toolResult={b.toolResult}
                                  isCompleted={b.isCompleted}
                                  isGrouped={group.length > 1}
                                  isFirst={idx === 0}
                                  isLast={idx === group.length - 1}
                                />
                              );
                            } else if (b.type === "reasoning") {
                              // reasoning block
                              return (
                                <ThinkingCall
                                  key={`think-${start}-${idx}`}
                                  content={b.content}
                                  isCompleted={b.isCompleted}
                                  isGrouped={group.length > 1}
                                  isFirst={idx === 0}
                                  isLast={idx === group.length - 1}
                                  active={!b.isCompleted && !!isStreaming}
                                />
                              );
                            }
                            return null;
                          });

                          // Render single item standalone, or multiple items in a grouped container
                          if (group.length === 1) {
                            rendered.push(groupItems[0]);
                          } else if (group.length > 1) {
                            rendered.push(
                              <div
                                key={`group-${start}`}
                                className="my-3 not-prose"
                              >
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
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
