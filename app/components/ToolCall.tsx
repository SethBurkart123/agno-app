"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Wrench } from "lucide-react";

interface ToolCallProps {
  toolName: string;
  toolArgs: Record<string, any>;
  toolResult?: string;
  isCompleted: boolean;
  isGrouped?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

export default function ToolCall({ 
  toolName, 
  toolArgs, 
  toolResult, 
  isCompleted,
  isGrouped = false,
  isFirst = false,
  isLast = false 
}: ToolCallProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isGrouped) {
    return (
      <div className="relative" data-toolcall>
        <div className="absolute left-7 top-0 bottom-0 z-10 w-px bg-border" style={{ 
          top: isFirst ? '2.2rem' : '0',
          bottom: isLast ? 'calc(100% - 0.7rem)' : '0',
        }} />
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-border/30 transition-colors relative ${!isCompleted ? 'shimmer' : ''}`}
        >
          <div className="flex items-center gap-2">
            <div className="size-6 p-0.5 flex justify-center items-center relative z-10">
              <Wrench size={16} className="text-muted-foreground" />
            </div>
            <span className="text-sm font-mono text-foreground ml-2">{toolName}</span>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={16} className="text-muted-foreground" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 270, damping: 30 }}
              className="overflow-hidden"
            >
              <div className={`px-4 pb-3 space-y-3 ${isLast ? 'border-t border-border' : ''} pt-3 pl-9`}>

                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Arguments
                  </div>
                  <pre className="w-full text-xs bg-muted p-2 rounded overflow-x-auto !mt-1">
                    <code className="!bg-transparent">{JSON.stringify(toolArgs, null, 2)}</code>
                  </pre>
                </div>

                {isCompleted && toolResult && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Result
                    </div>
                    <pre className="w-full text-xs bg-muted p-2 rounded overflow-x-auto !mt-1 !mb-0 max-h-64 overflow-y-auto">
                      <code className="!bg-transparent">{typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="my-3 not-prose" data-toolcall>
      <div
        className="border border-border rounded-lg overflow-hidden bg-card"
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors ${!isCompleted ? 'shimmer' : ''}`}
        >
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-muted-foreground" />
            <span className="text-sm font-mono text-foreground">{toolName}</span>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={16} className="text-muted-foreground" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 270, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-3 border-t border-border pt-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Arguments
                  </div>
                  <pre className="w-full text-xs bg-muted p-2 rounded overflow-x-auto !mt-1">
                    <code className="!bg-transparent">{JSON.stringify(toolArgs, null, 2)}</code>
                  </pre>
                </div>

                {isCompleted && toolResult && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Result
                    </div>
                    <pre className="w-full text-xs bg-muted p-2 rounded overflow-x-auto !mt-1 !mb-0 max-h-64 overflow-y-auto">
                      <code className="!bg-transparent">{typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
