import OpenAIIcon from './icons/OpenAI';
import ClaudeIcon from './icons/Claude';
import GroqIcon from './icons/Groq';
import OllamaIcon from './icons/Ollama';

export interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}

export type FieldId = 'apiKey' | 'baseUrl';

export interface ProviderFieldDef {
  id: FieldId;
  label: string;
  type: 'password' | 'text';
  placeholder?: string;
  required?: boolean; // default true
}

export interface ProviderDefinition {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  fields: ProviderFieldDef[];
  defaults?: Partial<ProviderConfig>;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    key: 'openai',
    name: 'OpenAI',
    description: 'GPT‑4, GPT‑4o, and other OpenAI models',
    icon: OpenAIIcon,
    fields: [
      { id: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
      { id: 'baseUrl', label: 'Base URL (optional)', type: 'text', placeholder: 'https://api.openai.com', required: false },
    ],
    defaults: { enabled: true },
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Haiku, and Opus',
    icon: ClaudeIcon,
    fields: [
      { id: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-...' },
    ],
    defaults: { enabled: true },
  },
  {
    key: 'groq',
    name: 'Groq',
    description: 'Fast Llama and Mixtral models',
    icon: GroqIcon,
    fields: [
      { id: 'apiKey', label: 'API Key', type: 'password', placeholder: 'gsk_...' },
    ],
    defaults: { enabled: true },
  },
  {
    key: 'ollama',
    name: 'Ollama',
    description: 'Local models running on your machine',
    icon: OllamaIcon,
    fields: [
      { id: 'baseUrl', label: 'Host URL', type: 'text', placeholder: 'http://localhost:11434' },
    ],
    defaults: { enabled: true, baseUrl: 'http://localhost:11434' },
  },
];

export const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map((p) => [p.key, p]));

