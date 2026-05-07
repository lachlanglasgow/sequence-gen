import { create } from 'zustand';
import type { Node } from '@xyflow/react';

export interface Variation {
  id: string;
  name: string;
  promptModifier: string;
}

export interface Threshold {
  percentage: number;
  prompt: string;
}

export interface GenerationHistory {
  id: string;
  timestamp: number;
  prompt: string;
  imageUrl: string;
  variation?: string;
}

export interface StepData {
  label: string;
  percentage: number;
  prompt: string;
  threshold: Threshold | null;
  variations: Variation[];
  history: GenerationHistory[];
}

interface SequenceState {
  steps: string[];
  addStep: (id: string) => void;
  generateSequence: (nodes: Node[]) => Promise<void>;
}

export const useSequenceStore = create<SequenceState>((set) => ({
  steps: [],
  addStep: (id) => set((state) => ({ steps: [...state.steps, id] })),
  generateSequence: async (nodes) => {
    for (const node of nodes) {
      await generateNodeImage(node);
    }
  },
}));

async function generateNodeImage(node: Node) {
  const data = node.data as unknown as StepData;
  const basePrompt = data.prompt || `Seedling at ${data.percentage}% growth`;
  
  // Generate base image
  await generateImage(basePrompt, node.id);
  
  // Generate variations
  for (const variation of data.variations || []) {
    const modifiedPrompt = `${basePrompt}. ${variation.promptModifier}`;
    await generateImage(modifiedPrompt, node.id, variation.name);
  }
}

async function generateImage(prompt: string, stepId: string, variation?: string) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, stepId, variation }),
    });
    
    if (!response.ok) throw new Error('Generation failed');
    
    return await response.json();
  } catch (error) {
    console.error('Generation error:', error);
    throw error;
  }
}
