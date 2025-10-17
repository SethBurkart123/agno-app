export interface ChatData {
  id?: string;
  title: string;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AllChatsData {
  chats: {
    [chatId: string]: ChatData;
  };
}

export interface ChatContextType {
  chatId: string;
  chatTitle: string;
  chatIds: string[];
  chatsData: AllChatsData['chats'];
  startNewChat: () => void;
  switchChat: (id: string) => void;
  deleteChat: (id: string) => Promise<void>;
  renameChat: (id: string, newTitle: string) => Promise<void>;
  refreshChats: () => Promise<void>;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: string[];
}
