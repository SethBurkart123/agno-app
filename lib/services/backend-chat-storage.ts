import { AllChatsData, ChatData } from '@/lib/types/chat';
import type { Message } from 'ai';
import { backendApiService } from './backend-api';

export class BackendChatStorageService {
  private static instance: BackendChatStorageService;
  private cachedData: AllChatsData = { chats: {} };

  private constructor() {}

  static getInstance(): BackendChatStorageService {
    if (!BackendChatStorageService.instance) {
      BackendChatStorageService.instance = new BackendChatStorageService();
    }
    return BackendChatStorageService.instance;
  }

  async load(): Promise<AllChatsData> {
    try {
      const chats = await backendApiService.getUserChats();
      const chatsMap: { [key: string]: ChatData } = {};

      chats.forEach(chat => {
        if (chat.id) {
          chatsMap[chat.id] = {
            id: chat.id,
            title: chat.title,
            messages: chat.messages.map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              toolCalls: msg.toolCalls,
            })),
            thinkingTime: chat.thinkingTime,
            model: chat.model,
            createdAt: chat.created_at,
            updatedAt: chat.updated_at,
          };
        }
      });

      this.cachedData = { chats: chatsMap };
      return this.cachedData;
    } catch (error) {
      console.error('Failed to load chats:', error);
      return { chats: {} };
    }
  }

  async save(data: AllChatsData): Promise<void> {
    this.cachedData = data;
  }

  async saveImmediate(data: AllChatsData): Promise<void> {
    this.cachedData = data;
  }

  async createChat(title?: string, model?: string, chatId?: string): Promise<ChatData> {
    try {
      const backendChat = await backendApiService.createChat({
        title: title || 'New Chat',
        model,
      });
      
      const chat: ChatData = {
        id: chatId || backendChat.id,
        title: backendChat.title,
        messages: [],
        thinkingTime: [],
        model: backendChat.model,
        createdAt: backendChat.created_at,
        updatedAt: backendChat.updated_at,
      };
      
      this.cachedData.chats[chat.id!] = chat;
      return chat;
    } catch (error) {
      console.error('Failed to create chat:', error);
      const id = chatId || crypto.randomUUID();
      const now = new Date().toISOString();
      const fallbackChat: ChatData = {
        id,
        title: title || 'New Chat',
        messages: [],
        thinkingTime: [],
        model,
        createdAt: now,
        updatedAt: now,
      };
      this.cachedData.chats[id] = fallbackChat;
      return fallbackChat;
    }
  }

  async updateChat(chatId: string, updates: Partial<ChatData>): Promise<ChatData> {
    const existing = this.cachedData.chats[chatId];
    if (!existing) throw new Error('Chat not found');
    
    try {
      if (updates.title) {
        const { agnoApiService } = await import('./agno-api');
        await agnoApiService.renameSession(chatId, updates.title);
      }
      
      const updated: ChatData = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
        messages: updates.messages ? updates.messages as Message[] : existing.messages,
        thinkingTime: updates.thinkingTime ?? existing.thinkingTime,
      };
      
      this.cachedData.chats[chatId] = updated;
      return updated;
    } catch (error) {
      console.error('Failed to update chat:', error);
      const updated: ChatData = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
        messages: updates.messages ? updates.messages as Message[] : existing.messages,
        thinkingTime: updates.thinkingTime ?? existing.thinkingTime,
      };
      this.cachedData.chats[chatId] = updated;
      return updated;
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      await backendApiService.deleteChat(chatId);
      delete this.cachedData.chats[chatId];
    } catch (error) {
      console.error('Failed to delete chat:', error);
      delete this.cachedData.chats[chatId];
    }
  }

  async getChat(chatId: string): Promise<ChatData | null> {
    if (this.cachedData.chats[chatId]) {
      return this.cachedData.chats[chatId];
    }
    
    try {
      const backendChat = await backendApiService.getChat(chatId);
      const chat: ChatData = {
        id: backendChat.id,
        title: backendChat.title,
        messages: backendChat.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          toolCalls: msg.toolCalls,
        })),
        thinkingTime: backendChat.thinkingTime,
        model: backendChat.model,
        createdAt: backendChat.created_at,
        updatedAt: backendChat.updated_at,
      };
      this.cachedData.chats[chatId] = chat;
      return chat;
    } catch (error) {
      console.error('Failed to get chat:', error);
      return null;
    }
  }

  cancelPendingSaves(): void {}

  getCachedData(): AllChatsData {
    return this.cachedData;
  }
}
