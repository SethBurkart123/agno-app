import { useState, useEffect } from 'react';
import { agnoApiService } from '@/lib/services/agno-api';

export interface ModelInfo {
  id: string;
  name: string;
  type: 'agent' | 'team';
}

export function useModels() {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [models, setModels] = useState<string[]>([]);
  const [modelInfoMap, setModelInfoMap] = useState<Map<string, ModelInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const agents = await agnoApiService.getAgents();
        const teams = await agnoApiService.getTeams();
        
        const infoMap = new Map<string, ModelInfo>();
        
        agents.forEach(agent => {
          infoMap.set(agent.id, {
            id: agent.id,
            name: agent.name,
            type: 'agent',
          });
        });
        
        teams.forEach(team => {
          infoMap.set(team.team_id, {
            id: team.team_id,
            name: team.name,
            type: 'team',
          });
        });
        
        const available = Array.from(infoMap.keys());
        
        setModels(available);
        setModelInfoMap(infoMap);

        if (available.length > 0) {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedModel') : null;
          if (saved && available.includes(saved)) {
            setSelectedModel(saved);
          } else {
            setSelectedModel(available[0]);
            if (typeof window !== 'undefined') {
              localStorage.setItem('selectedModel', available[0]);
            }
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load agents/teams:', error);
        setModels([]);
        setModelInfoMap(new Map());
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  const updateSelectedModel = (model: string) => {
    setSelectedModel(model);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedModel', model);
    }
  };

  const getModelInfo = (modelId: string): ModelInfo | undefined => {
    return modelInfoMap.get(modelId);
  };

  return {
    selectedModel,
    setSelectedModel: updateSelectedModel,
    models,
    modelInfoMap,
    getModelInfo,
    isLoading,
  };
}
