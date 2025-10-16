import type { AllChatsData, ChatData } from '@/lib/types/chat';
import type { BackendChatMessage } from '@/lib/services/backend-api';

async function invoke<T = any>(cmd: string, body?: any): Promise<T> {
  const { pyInvoke } = await import('tauri-plugin-pytauri-api');
  return pyInvoke(cmd, body as any) as Promise<T>;
}

export async function getAllChats(): Promise<AllChatsData> {
  return invoke<AllChatsData>('get_all_chats');
}

export async function createChat(input: { id?: string; title?: string; model?: string }): Promise<ChatData> {
  return invoke<ChatData>('create_chat', input);
}

export async function updateChat(input: {
  id: string;
  title?: string;
  model?: string;
  messages?: BackendChatMessage[];
}): Promise<ChatData> {
  return invoke<ChatData>('update_chat', input);
}

export async function deleteChat(input: { id: string }): Promise<void> {
  return invoke<void>('delete_chat', input);
}

export async function getChat(input: { id: string }): Promise<{ id: string; messages: BackendChatMessage[] }> {
  return invoke<{ id: string; messages: BackendChatMessage[] }>('get_chat', input);
}
