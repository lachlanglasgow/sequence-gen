import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge } from '@xyflow/react';

export type NodeType = 'basePrompt' | 'modifyPrompt' | 'appendPrompt' | 'image';

export interface BasePromptData {
  text: string;
}

export interface ModifyPromptData {
  instruction: string;
  isProcessing?: boolean;
}

export interface AppendPromptData {
  textToAppend: string;
}

export interface GeneratedImage {
  imageUrl: string;
  prompt: string;
  timestamp: number;
}

export interface ImageNodeData {
  isGenerating?: boolean;
  generatedImageUrl?: string;
  error?: string;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  generateCount?: number;
  generatedImages?: GeneratedImage[];
  selectedImageIndex?: number;
  history?: GeneratedImage[];
}

export const PROJECT_VERSION = 2; // Bumped for new features
export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

export const AVAILABLE_IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash', description: 'Fast, high quality generation' },
  { id: 'gemini-2.0-flash-exp-image-generation', name: 'Gemini 2.0 Flash Exp', description: 'Experimental image model' },
] as const;

export interface Project {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  version: number;
  createdAt: number;
  updatedAt: number;
  settings?: {
    defaultImageModel?: string;
  };
}

interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  globalDefaultModel: string;
  addProject: (name: string, nodes: Node[], edges: Edge[]) => Project;
  updateProject: (id: string, nodes: Node[], edges: Edge[]) => void;
  loadProject: (id: string) => Project | null;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setProjectDefaultModel: (id: string, model: string) => void;
  setGlobalDefaultModel: (model: string) => void;
  getDefaultModel: (projectId?: string | null) => string;
  clearCurrentProject: () => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      globalDefaultModel: DEFAULT_IMAGE_MODEL,
      
      addProject: (name, nodes, edges) => {
        const { globalDefaultModel } = get();
        const project: Project = {
          id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: name.trim().slice(0, 100),
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
          version: PROJECT_VERSION,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          settings: {
            defaultImageModel: globalDefaultModel,
          },
        };
        set((state) => ({
          projects: [...state.projects, project],
          currentProjectId: project.id,
        }));
        return project;
      },
      
      updateProject: (id, nodes, edges) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  nodes: JSON.parse(JSON.stringify(nodes)),
                  edges: JSON.parse(JSON.stringify(edges)),
                  updatedAt: Date.now(),
                }
              : p
          ),
        }));
      },
      
      loadProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        if (project) {
          set({ currentProjectId: id });
          return project;
        }
        return null;
      },
      
      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProjectId:
            state.currentProjectId === id ? null : state.currentProjectId,
        }));
      },
      
      renameProject: (id, name) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          ),
        }));
      },

      setProjectDefaultModel: (id, model) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id 
              ? { 
                  ...p, 
                  settings: { ...p.settings, defaultImageModel: model },
                  updatedAt: Date.now() 
                } 
              : p
          ),
        }));
      },

      setGlobalDefaultModel: (model) => {
        set({ globalDefaultModel: model });
      },

      getDefaultModel: (projectId) => {
        const { projects, globalDefaultModel } = get();
        if (!projectId) return globalDefaultModel;
        const project = projects.find((p) => p.id === projectId);
        return project?.settings?.defaultImageModel || globalDefaultModel;
      },

      clearCurrentProject: () => {
        set({ currentProjectId: null });
      },
    }),
    {
      name: 'sequence-generator-projects-v3',
      onRehydrateStorage: () => (state) => {
        // Validate loaded projects on rehydrate
        if (state) {
          state.projects = state.projects.filter((p: Project) => {
            // Filter out corrupted projects
            if (!p.id || !p.name || !Array.isArray(p.nodes) || !Array.isArray(p.edges)) {
              console.warn('Filtered out corrupted project:', p);
              return false;
            }
            return true;
          });
          // Ensure globalDefaultModel exists
          if (!state.globalDefaultModel) {
            state.globalDefaultModel = DEFAULT_IMAGE_MODEL;
          }
        }
      },
    }
  )
);
