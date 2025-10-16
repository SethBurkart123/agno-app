export interface AgnoConfig {
  baseUrl: string;
}

export interface AgnoModel {
  id: string;
  provider: string;
}

export interface AgnoAgent {
  id: string;
  name: string;
  description?: string;
  db_id?: string;
  model?: {
    name: string;
    model: string;
    provider: string;
  };
}

export interface AgnoTeam {
  team_id: string;
  name: string;
  description?: string;
  mode?: string;
  model?: {
    name: string;
    model: string;
    provider: string;
  };
}

export interface AgnoSession {
  session_id: string;
  session_name?: string;
  user_id?: string;
  component_id?: string;
  type: 'agent' | 'team' | 'workflow';
  created_at?: string;
  updated_at?: string;
}

export interface AgnoMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgnoSessionDetail extends AgnoSession {
  messages?: AgnoMessage[];
}

export interface AgnoRunRequest {
  message: string;
  stream?: boolean;
  session_id?: string;
  user_id?: string;
  files?: File[];
}

export interface AgnoRunResponse {
  content?: string;
  run_id?: string;
  session_id?: string;
}

export interface AgnoSessionsResponse {
  data: AgnoSession[];
  meta: {
    page: number;
    limit: number;
    total_pages: number;
    total_count: number;
  };
}

class AgnoApiService {
  private static instance: AgnoApiService;
  private config: AgnoConfig | null = null;

  private constructor() {}

  static getInstance(): AgnoApiService {
    if (!AgnoApiService.instance) {
      AgnoApiService.instance = new AgnoApiService();
    }
    return AgnoApiService.instance;
  }

  configure(config: AgnoConfig) {
    this.config = config;
  }

  private getBaseUrl(): string {
    if (!this.config?.baseUrl) {
      throw new Error('Agno API not configured. Please set NEXT_PUBLIC_AGNO_BASE_URL');
    }
    return this.config.baseUrl;
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Agno API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async getAgents(): Promise<AgnoAgent[]> {
    return this.fetch<AgnoAgent[]>('/agents');
  }

  async getAgent(agentId: string): Promise<AgnoAgent> {
    return this.fetch<AgnoAgent>(`/agents/${agentId}`);
  }

  async getTeams(): Promise<AgnoTeam[]> {
    return this.fetch<AgnoTeam[]>('/teams');
  }

  async getTeam(teamId: string): Promise<AgnoTeam> {
    return this.fetch<AgnoTeam>(`/teams/${teamId}`);
  }

  async getModels(): Promise<AgnoModel[]> {
    return this.fetch<AgnoModel[]>('/models');
  }

  async getSessions(params?: {
    type?: 'agent' | 'team' | 'workflow';
    component_id?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<AgnoSessionsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.component_id) queryParams.append('component_id', params.component_id);
    if (params?.user_id) queryParams.append('user_id', params.user_id);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.fetch<AgnoSessionsResponse>(`/sessions${query ? `?${query}` : ''}`);
  }

  async getSession(sessionId: string, type: 'agent' | 'team' | 'workflow' = 'agent'): Promise<AgnoSessionDetail> {
    return this.fetch<AgnoSessionDetail>(`/sessions/${sessionId}?type=${type}`);
  }

  async getSessionRuns(sessionId: string, type: 'agent' | 'team' | 'workflow' = 'agent'): Promise<any> {
    return this.fetch<any>(`/sessions/${sessionId}/runs?type=${type}`);
  }

  async deleteSession(sessionId: string, type: 'agent' | 'team' | 'workflow' = 'agent'): Promise<void> {
    await this.fetch(`/sessions/${sessionId}?type=${type}`, {
      method: 'DELETE',
    });
  }

  async renameSession(sessionId: string, sessionName: string, type: 'agent' | 'team' | 'workflow' = 'agent'): Promise<void> {
    await this.fetch(`/sessions/${sessionId}/rename?type=${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_name: sessionName }),
    });
  }

  async createAgentRun(agentId: string, request: AgnoRunRequest): Promise<Response> {
    const formData = new FormData();
    formData.append('message', request.message);
    formData.append('stream', String(request.stream ?? true));
    if (request.session_id) formData.append('session_id', request.session_id);
    if (request.user_id) formData.append('user_id', request.user_id);
    if (request.files) {
      request.files.forEach(file => formData.append('files', file));
    }

    const url = `${this.getBaseUrl()}/agents/${agentId}/runs`;
    return fetch(url, {
      method: 'POST',
      body: formData,
    });
  }

  async createTeamRun(teamId: string, request: AgnoRunRequest): Promise<Response> {
    const formData = new FormData();
    formData.append('message', request.message);
    formData.append('stream', String(request.stream ?? true));
    if (request.session_id) formData.append('session_id', request.session_id);
    if (request.user_id) formData.append('user_id', request.user_id);
    if (request.files) {
      request.files.forEach(file => formData.append('files', file));
    }

    const url = `${this.getBaseUrl()}/teams/${teamId}/runs`;
    return fetch(url, {
      method: 'POST',
      body: formData,
    });
  }
}

export const agnoApiService = AgnoApiService.getInstance();

if (typeof window !== 'undefined') {
  const baseUrl = process.env.NEXT_PUBLIC_AGNO_BASE_URL;
  if (baseUrl) {
    agnoApiService.configure({ baseUrl });
  }
}


