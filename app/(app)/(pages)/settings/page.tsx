"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { getProviderSettings, saveProviderSettings } from '@/python/apiClient';
import { Check, Loader2 } from 'lucide-react';
import { usePageTitle } from '@/contexts/page-title-context';

interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}

const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    description: 'GPT-4, GPT-4o, and other OpenAI models',
    fields: ['api_key', 'base_url'],
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Haiku, and Opus',
    fields: ['api_key'],
  },
  groq: {
    name: 'Groq',
    description: 'Fast Llama and Mixtral models',
    fields: ['api_key'],
  },
  ollama: {
    name: 'Ollama',
    description: 'Local models running on your machine',
    fields: ['base_url'],
  },
};

export default function SettingsPage() {
  const { setTitle } = usePageTitle();
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [savedProvider, setSavedProvider] = useState<string | null>(null);

  useEffect(() => {
    setTitle('Settings');
    loadSettings();
  }, [setTitle]);

  const loadSettings = async () => {
    try {
      const response = await getProviderSettings(undefined);
      const providerMap: Record<string, ProviderConfig> = {};
      
      response.providers.forEach((p) => {
        providerMap[p.provider] = {
          provider: p.provider,
          apiKey: p.apiKey || '',
          baseUrl: p.baseUrl || '',
          enabled: Boolean(p.enabled ?? true),
        };
      });
      
      // Initialize missing providers
      Object.keys(PROVIDER_INFO).forEach((providerKey) => {
        if (!providerMap[providerKey]) {
          providerMap[providerKey] = {
            provider: providerKey,
            apiKey: '',
            baseUrl: providerKey === 'ollama' ? 'http://localhost:11434' : '',
            enabled: true,
          };
        }
      });
      
      setProviders(providerMap);
    } catch (error) {
      console.error('Failed to load provider settings:', error);
      // Initialize with defaults
      const defaultProviders: Record<string, ProviderConfig> = {};
      Object.keys(PROVIDER_INFO).forEach((providerKey) => {
        defaultProviders[providerKey] = {
          provider: providerKey,
          apiKey: '',
          baseUrl: providerKey === 'ollama' ? 'http://localhost:11434' : '',
          enabled: true,
        };
      });
      setProviders(defaultProviders);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (providerKey: string) => {
    setIsSaving(providerKey);
    setSavedProvider(null);
    
    try {
      const config = providers[providerKey];
      await saveProviderSettings(
        {
          provider: providerKey,
          apiKey: config.apiKey || undefined,
          baseUrl: config.baseUrl || undefined,
          enabled: config.enabled,
        },
        undefined
      );
      
      setSavedProvider(providerKey);
      setTimeout(() => setSavedProvider(null), 2000);
    } catch (error) {
      console.error(`Failed to save ${providerKey} settings:`, error);
    } finally {
      setIsSaving(null);
    }
  };

  const updateProvider = (providerKey: string, field: string, value: string | boolean) => {
    setProviders((prev) => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 px-4">
      <div className="space-y-6">
        {Object.entries(PROVIDER_INFO).map(([providerKey, info]) => {
          const config = providers[providerKey] || {
            provider: providerKey,
            apiKey: '',
            baseUrl: '',
            enabled: true,
          };

          return (
            <Card key={providerKey} className="p-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">{info.name}</h2>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </div>

                <div className="space-y-4">
                  {info.fields.includes('api_key') && (
                    <div className="space-y-2">
                      <Label htmlFor={`${providerKey}-api-key`}>API Key</Label>
                      <Input
                        id={`${providerKey}-api-key`}
                        type="password"
                        placeholder="sk-..."
                        value={config.apiKey || ''}
                        onChange={(e) =>
                          updateProvider(providerKey, 'apiKey', e.target.value)
                        }
                      />
                    </div>
                  )}

                  {info.fields.includes('base_url') && (
                    <div className="space-y-2">
                      <Label htmlFor={`${providerKey}-base-url`}>
                        {providerKey === 'ollama' ? 'Host URL' : 'Base URL (optional)'}
                      </Label>
                      <Input
                        id={`${providerKey}-base-url`}
                        type="text"
                        placeholder={
                          providerKey === 'ollama'
                            ? 'http://localhost:11434'
                            : 'https://api.example.com'
                        }
                        value={config.baseUrl || ''}
                        onChange={(e) =>
                          updateProvider(providerKey, 'baseUrl', e.target.value)
                        }
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      {savedProvider === providerKey && (
                        <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-500">
                          <Check className="h-4 w-4" />
                          Saved successfully
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={() => handleSave(providerKey)}
                      disabled={isSaving === providerKey}
                    >
                      {isSaving === providerKey ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
