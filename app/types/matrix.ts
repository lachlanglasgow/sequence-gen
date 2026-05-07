export interface MatrixDimension {
  id: string;
  name: string;           // e.g. "stage", "weather"
  sequential: boolean;    // if true, each value feeds its output image to the next
  values: MatrixValue[];
}

export interface MatrixValue {
  id: string;
  label: string;          // display label: "Seed"
  promptFragment: string; // injected text: "a seed just planted in soil"
}

export interface MatrixCell {
  coordinates: number[];  // indices into each dimension's values
  prompt: string;         // fully resolved prompt
  status: 'pending' | 'generating' | 'completed' | 'failed';
  imageUrl?: string;
  error?: string;
}

export interface MatrixHistoryEntry {
  cells: MatrixCell[];
  timestamp: number;
}

export interface MatrixNodeData {
  promptTemplate: string; // "A {stage} plant in {weather} weather, {style}"
  dimensions: MatrixDimension[];
  cells: MatrixCell[];
  history: MatrixHistoryEntry[];
  isGenerating: boolean;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  concurrency: number;    // default 3, limits parallel /api/generate calls
}
