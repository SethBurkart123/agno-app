import { supabase } from '@/lib/supabase';

export interface BackendMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  toolCalls?: Array<{
    id: string;
    toolName: string;
    toolArgs: Record<string, any>;
    toolResult?: string;
    isCompleted: boolean;
  }>;
}

export interface BackendThinkingTime {
  index: number;
  time: number;
}

export interface BackendChatData {
  id: string;
  user_id: string;
  title: string;
  messages: BackendMessage[];
  model?: string;
  thinkingTime: BackendThinkingTime[];
  created_at: string;
  updated_at: string;
}

export interface CreateChatRequest {
  title?: string;
  model?: string;
}

export interface UpdateChatRequest {
  title?: string;
  messages?: BackendMessage[];
  model?: string;
  thinkingTime?: BackendThinkingTime[];
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface UpdateProfileRequest {
  name?: string;
  avatar_url?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user_id?: string;
  token?: string;
}

class BackendApiService {
  private static instance: BackendApiService;
  private authToken: string | null = null; // compatibility marker only

  private constructor() {}

  static getInstance(): BackendApiService {
    if (!BackendApiService.instance) {
      BackendApiService.instance = new BackendApiService();
    }
    return BackendApiService.instance;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  clearAuthToken() {
    this.authToken = null;
  }

  // Chat operations (using Agno sessions)
  async getUserChats(): Promise<BackendChatData[]> {
    const { agnoApiService } = await import('./agno-api');
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id;
    
    const response = await agnoApiService.getSessions({
      user_id: userId,
      type: 'agent',
      limit: 100,
    });

    return response.data.map(session => ({
      id: session.session_id,
      user_id: session.user_id || '',
      title: session.session_name || 'New Chat',
      messages: [],
      model: '',
      thinkingTime: [],
      created_at: session.created_at || new Date().toISOString(),
      updated_at: session.updated_at || new Date().toISOString(),
    }));
  }

  async getChat(chatId: string): Promise<BackendChatData> {
    const { agnoApiService } = await import('./agno-api');
    const session = await agnoApiService.getSession(chatId, 'agent');
    
    const messages: BackendMessage[] = [];

    try {
      const runsResponse = await agnoApiService.getSessionRuns(chatId, 'agent');

      const runs = Array.isArray(runsResponse?.runs)
        ? runsResponse.runs
        : Array.isArray(runsResponse)
          ? runsResponse
          : [];

      for (const run of runs) {
        const createdAt = run.created_at || new Date().toISOString();

        // Preferred: reconstruct from run.messages when available
        if (Array.isArray(run.messages) && run.messages.length > 0) {
          // Build a single assistant message per run with inline tool markers, plus any thinking
          let assistantContent = '';
          const toolCalls: BackendMessage['toolCalls'] = [];
          const toolIndex = new Map<string, number>();

          // Inject reasoning as an explicit <think> block, if provided
          if (typeof run.reasoning_content === 'string' && run.reasoning_content.trim() !== '') {
            assistantContent += `<think>${run.reasoning_content}</think>\n\n`;
          }

          for (const m of run.messages) {
            const role = m.role as 'user' | 'assistant' | 'system' | 'tool';
            if (role === 'user') {
              messages.push({
                id: crypto.randomUUID(),
                role: 'user',
                content: m.content || '',
                createdAt,
              });
            } else if (role === 'assistant') {
              // Text content
              if (m.content) assistantContent += m.content;

              // Tool call announcements (OpenAI-like shape: tool_calls)
              const calls = (m.tool_calls || m.tools || []) as any[];
              if (Array.isArray(calls)) {
                for (const call of calls) {
                  const callId = call.id || call.tool_call_id || crypto.randomUUID();
                  const name = call.function?.name || call.tool_name || call.name || 'Unknown';
                  const argsStr = call.function?.arguments || call.tool_args || call.arguments || '{}';
                  let args: Record<string, any> = {};
                  try { args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr; } catch {}
                  if (!toolIndex.has(callId)) {
                    toolIndex.set(callId, toolCalls.length);
                    toolCalls.push({ id: callId, toolName: name, toolArgs: args, isCompleted: false });
                    assistantContent += `\n\n<<TOOL:${callId}>>\n\n`;
                  }
                }
              }
            } else if (role === 'tool') {
              // Tool result can arrive in multiple shapes
              // 1) Direct fields on message
              const directCallId = (m as any).tool_call_id || (m as any).id;
              const directName = (m as any).tool_name;
              const directArgs = (m as any).tool_args;
              const directResult = (m as any).content;

              // 2) Nested tool_calls array (e.g., from some providers)
              const nestedCalls = (m as any).tool_calls as any[] | undefined;
              const haveNested = Array.isArray(nestedCalls) && nestedCalls.length > 0;

              if (haveNested) {
                for (const nc of nestedCalls) {
                  const callId = nc.tool_call_id || nc.id || crypto.randomUUID();
                  const name = nc.tool_name || nc.name || 'Unknown';
                  const args = nc.tool_args || {};
                  const result = nc.content || nc.result || (typeof (m as any).content === 'string' ? (m as any).content : undefined);

                  let idx = toolIndex.get(callId);
                  if (idx === undefined) {
                    idx = toolCalls.length;
                    toolIndex.set(callId, idx);
                    toolCalls.push({ id: callId, toolName: name, toolArgs: args, isCompleted: false });
                    assistantContent += `\n\n<<TOOL:${callId}>>\n\n`;
                  }
                  toolCalls[idx].toolResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                  toolCalls[idx].isCompleted = true;
                }
              } else if (directCallId || directResult) {
                const callId = directCallId || crypto.randomUUID();
                const name = directName || 'Unknown';
                const args = directArgs || {};
                const result = directResult;
                let idx = toolIndex.get(callId);
                if (idx === undefined) {
                  idx = toolCalls.length;
                  toolIndex.set(callId, idx);
                  toolCalls.push({ id: callId, toolName: name, toolArgs: args, isCompleted: false });
                  assistantContent += `\n\n<<TOOL:${callId}>>\n\n`;
                }
                toolCalls[idx].toolResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                toolCalls[idx].isCompleted = true;
              }
            }
          }

          // Merge in top-level tools array as a final pass to fill results
          if (Array.isArray(run.tools)) {
            for (const t of run.tools) {
              const callId = t.tool_call_id || t.id || crypto.randomUUID();
              const name = t.tool_name || t.name || 'Unknown';
              const args = t.tool_args || t.arguments || {};
              const result = t.result || t.content;
              let idx = toolIndex.get(callId);
              if (idx === undefined) {
                idx = toolCalls.length;
                toolIndex.set(callId, idx);
                toolCalls.push({ id: callId, toolName: name, toolArgs: args, isCompleted: false });
                assistantContent += `\n\n<<TOOL:${callId}>>\n\n`;
              }
              if (result !== undefined) {
                toolCalls[idx].toolResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                toolCalls[idx].isCompleted = true;
              }
            }
          }

          // Append any assistant final content provided at the run-level
          if (run.content) assistantContent += run.content;

          if (assistantContent || (toolCalls && toolCalls.length > 0)) {
            messages.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: assistantContent,
              createdAt,
              toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
            });
          }
          continue;
        }

        // Fallback: legacy construction
        if (run.run_input) {
          messages.push({
            id: crypto.randomUUID(),
            role: 'user',
            content: run.run_input,
            createdAt,
          });
        }
        if (run.content || (Array.isArray(run.tools) && run.tools.length > 0) || (typeof run.reasoning_content === 'string' && run.reasoning_content.trim() !== '')) {
          const toolCalls = run.tools && Array.isArray(run.tools) ? run.tools.map((tool: any) => ({
            id: tool.tool_call_id || tool.id || crypto.randomUUID(),
            toolName: tool.tool_name || tool.name || 'Unknown',
            toolArgs: tool.tool_args || tool.arguments || {},
            toolResult: tool.result || tool.content,
            isCompleted: !!(tool.result || tool.content),
          })) : undefined;
          let content = '';
          if (typeof run.reasoning_content === 'string' && run.reasoning_content.trim() !== '') {
            content += `<think>${run.reasoning_content}</think>\n\n`;
          }
          if (run.content) content += run.content;
          if (toolCalls && toolCalls.length > 0) {
            for (const t of toolCalls) {
              content += `\n\n<<TOOL:${t.id}>>\n\n`;
            }
          }
          messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            createdAt,
            toolCalls,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load session runs:', error);
    }
    
    return {
      id: session.session_id,
      user_id: session.user_id || '',
      title: session.session_name || 'New Chat',
      messages,
      model: '',
      thinkingTime: [],
      created_at: session.created_at || new Date().toISOString(),
      updated_at: session.updated_at || new Date().toISOString(),
    };
  }

  async createChat(request: CreateChatRequest): Promise<BackendChatData> {
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id || '';
    const chatId = Math.random().toString(36).substring(7);
    
    return {
      id: chatId,
      user_id: userId,
      title: request.title || 'New Chat',
      messages: [],
      model: request.model,
      thinkingTime: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async updateChat(chatId: string, request: UpdateChatRequest): Promise<BackendChatData> {
    const chat = await this.getChat(chatId);
    return {
      ...chat,
      title: request.title ?? chat.title,
      messages: request.messages ?? chat.messages,
      model: request.model ?? chat.model,
      thinkingTime: request.thinkingTime ?? chat.thinkingTime,
      updated_at: new Date().toISOString(),
    };
  }

  async deleteChat(chatId: string): Promise<void> {
    const { agnoApiService } = await import('./agno-api');
    await agnoApiService.deleteSession(chatId, 'agent');
  }

  // User profile operations (via Supabase)
  async getUserProfile(): Promise<UserProfile> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error(error?.message || 'No authenticated user');
    }
    const user = data.user;
    return {
      id: user.id,
      email: user.email ?? '',
      name: (user.user_metadata?.name as string | undefined) || (user.user_metadata?.full_name as string | undefined) || undefined,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) || undefined,
      created_at: user.created_at ?? new Date().toISOString(),
    };
  }

  async updateUserProfile(request: UpdateProfileRequest): Promise<UserProfile> {
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      data: {
        ...(request.name !== undefined ? { name: request.name } : {}),
        ...(request.avatar_url !== undefined ? { avatar_url: request.avatar_url } : {}),
      },
    });
    if (updateError || !updateData.user) {
      throw new Error(updateError?.message || 'Failed to update profile');
    }
    const user = updateData.user;
    return {
      id: user.id,
      email: user.email ?? '',
      name: (user.user_metadata?.name as string | undefined) || (user.user_metadata?.full_name as string | undefined) || undefined,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) || undefined,
      created_at: user.created_at ?? new Date().toISOString(),
    };
  }

  // Chat streaming and title generation (using Agno)
  async streamChat(messages: BackendMessage[], model?: string, sessionId?: string, modelType?: 'agent' | 'team'): Promise<Response> {
    const { agnoApiService } = await import('./agno-api');
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id;
    
    const lastMessage = messages[messages.length - 1];
    const modelId = model || 'default';
    
    if (modelType === 'team') {
      return agnoApiService.createTeamRun(modelId, {
        message: lastMessage.content,
        stream: true,
        session_id: sessionId,
        user_id: userId,
      });
    } else {
      return agnoApiService.createAgentRun(modelId, {
        message: lastMessage.content,
        stream: true,
        session_id: sessionId,
        user_id: userId,
      });
    }
  }

  async generateTitle(firstMessage: string): Promise<string> {
    const words = firstMessage.split(' ').slice(0, 6).join(' ');
    return words.length < firstMessage.length ? `${words}...` : words;
  }

  // Authentication methods (via Supabase)
  async login(request: LoginRequest): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: request.email,
      password: request.password,
    });
    if (error) {
      throw new Error(error.message || 'Login failed');
    }
    if (data.session?.access_token) {
      this.setAuthToken(data.session.access_token);
      localStorage.setItem('auth_token', data.session.access_token);
    }
    return {
      success: true,
      message: 'Logged in',
      user_id: data.user?.id,
      token: data.session?.access_token,
    };
  }

  async signup(request: SignupRequest): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signUp({
      email: request.email,
      password: request.password,
    });
    if (error) {
      throw new Error(error.message || 'Signup failed');
    }
    if (data.session?.access_token) {
      this.setAuthToken(data.session.access_token);
      localStorage.setItem('auth_token', data.session.access_token);
    }
    return {
      success: true,
      message: 'Signup successful',
      user_id: data.user?.id,
      token: data.session?.access_token,
    };
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut();
    this.clearAuthToken();
    localStorage.removeItem('auth_token');
  }

  // Initialize from stored token (compatibility only)
  initializeFromStorage(): boolean {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        this.setAuthToken(token);
        return true;
      }
    }
    return false;
  }
}

export const backendApiService = BackendApiService.getInstance();
