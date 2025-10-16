"use client";

import * as React from "react";
import { MoreVertical, PlusIcon, Pencil, Trash2, Settings, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { backendApiService } from "@/lib/services/backend-api";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import clsx from "clsx";
import { useChat } from "@/app/contexts/chat-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useEffect, useState } from "react";
import { SettingsDialog } from "@/components/settings-dialog";
import { useUserProfile } from "@/lib/hooks/useUserProfile"

/**
 * Sidebar that shows all stored chats and offers
 * a "New Chat" button. Uses the central ChatContext for data.
 */
export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const { profile: userProfile, loading: profileLoading } = useUserProfile();
  const {
    chatId: currentChatId,
    visualChatId,
    chatIds,
    chatsData,
    startNewChat,
    switchChat,
    deleteChat,
    renameChat
   } = useChat();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const handleSignOut = async () => {
    await backendApiService.logout();
    window.location.href = '/login';
  };

  const handleRenameConfirm = async (id: string) => {
    if (editTitle.trim()) {
      try {
        await renameChat(id, editTitle.trim());
      } catch (error) {
        console.error('Failed to rename chat:', error);
      }
    }
    // Always exit editing mode after confirm/blur
    setEditingId(null);
    setEditTitle("");
  };

  const handleRenameCancel = () => {
      setEditingId(null);
      setEditTitle("");
  };

  // chatIds are already sorted newest first from context
  const orderedChatIds = chatIds;


  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" variant="outline" asChild>
              <button
                onClick={startNewChat}
                className="flex w-full items-center gap-3"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <PlusIcon className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none text-left">
                  <span className="font-medium text-sidebar-foreground">New Chat</span>
                  <span className="text-xs text-muted-foreground">
                    Start fresh
                  </span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="gap-1 px-2 flex flex-col">
          {orderedChatIds.map((id: string) => {
            const isActive = visualChatId === id;
            const title = chatsData[id]?.title || `Chat #${chatIds.indexOf(id) + 1}`;

            return (
              <SidebarMenuItem key={id}>
                <div className="group/chat relative flex w-full items-center">
                  {editingId === id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleRenameConfirm(id);
                        }
                        if (e.key === "Escape") {
                            handleRenameCancel();
                        }
                      }}
                      onBlur={() => handleRenameConfirm(id)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-background text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-ring h-auto text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => switchChat(id)}
                        className={clsx(
                          "flex-1 truncate py-1.5 px-3 rounded-lg text-left text-sm",
                          isActive
                           ? "bg-sidebar-accent/80 text-sidebar-accent-foreground"
                           : "hover:bg-muted/50",
                          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        )}
                        title={title}
                      >
                        <span className="truncate">{title}</span>
                      </button>
                      <div className="absolute right-1 top-0 bottom-0 flex items-center opacity-0 group-hover/chat:opacity-100 transition-opacity duration-150">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className={clsx(
                                "p-1 rounded-lg hover:bg-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground"
                              )}
                              aria-label={`Chat options for ${title}`}
                            >
                              <MoreVertical className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingId(id);
                                setEditTitle(title);
                              }}
                            >
                              <Pencil className="mr-2 size-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await deleteChat(id);
                                } catch (error) {
                                  console.error('Failed to delete chat:', error);
                                }
                              }}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  )}
                </div>
              </SidebarMenuItem>
            );
          })}

          {orderedChatIds.length === 0 && (
            <SidebarMenuItem>
              <span className="px-4 py-2 text-sm text-muted-foreground italic">
                No chats yet
              </span>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex justify-between items-center w-full">
          <span className="flex min-w-0 items-center gap-3">
            <img 
              src={userProfile?.avatar_url || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"} 
              className="size-10 rounded-full" 
              alt="Profile" 
            />
            <span className="min-w-0">
              <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                {userProfile?.name || userProfile?.email?.split('@')[0] || 'Loading...'}
              </span>
              <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                {userProfile?.email || 'Loading...'}
              </span>
            </span>
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 rounded-lg hover:bg-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="User menu"
                >
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SidebarFooter>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  );
}