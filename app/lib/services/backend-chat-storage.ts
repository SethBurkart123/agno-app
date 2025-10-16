import type { AllChatsData, ChatData } from '@/lib/types/chat';
import * as py from '@/lib/services/python-client';

export class BackendChatStorageService {
  private static instance: BackendChatStorageService;

  private constructor() {}

  static getInstance(): BackendChatStorageService {
    if (!BackendChatStorageService.instance) {
      BackendChatStorageService.instance = new BackendChatStorageService();
    }
    return BackendChatStorageService.instance;
  }

  async load(): Promise<AllChatsData> {
    try {
      const data = await py.getAllChats();
      // Ensure shape matches AllChatsData
      return data as unknown as AllChatsData;
    } catch (e) {
      console.error('Failed to load chats from backend:', e);
      return { chats: {} };
    }
  }

  async createChat(title?: string, model?: string, chatId?: string): Promise<ChatData> {
    const result = await py.createChat({ id: chatId, title, model });
    return result as unknown as ChatData;
  }

  async updateChat(id: string, partial: Partial<ChatData>): Promise<ChatData> {
    // Map TS ChatData fields to expected command input (camelCase accepted)
    const body: any = { id };
    if (typeof partial.title === 'string') body.title = partial.title;
    if (Array.isArray(partial.messages)) body.messages = partial.messages;
    if (typeof partial.model === 'string') body.model = partial.model;
    const result = await py.updateChat(body);
    return result as unknown as ChatData;
  }

  async deleteChat(id: string): Promise<void> {
    await py.deleteChat({ id });
  }
}
