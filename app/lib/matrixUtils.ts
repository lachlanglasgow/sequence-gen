import type { MatrixDimension, MatrixCell, MatrixValue } from '../types/matrix';

/**
 * Compute the cartesian product of all dimension value indices.
 * Returns array of coordinate tuples, e.g. [[0,0],[0,1],[1,0],[1,1]] for 2x2.
 */
export function computeCartesianProduct(dimensions: MatrixDimension[]): number[][] {
  if (dimensions.length === 0) return [];
  if (dimensions.some(d => d.values.length === 0)) return [];

  const result: number[][] = [];

  function recurse(dimIdx: number, current: number[]) {
    if (dimIdx === dimensions.length) {
      result.push([...current]);
      return;
    }
    for (let i = 0; i < dimensions[dimIdx].values.length; i++) {
      current.push(i);
      recurse(dimIdx + 1, current);
      current.pop();
    }
  }

  recurse(0, []);
  return result;
}

/**
 * Resolve a template string by replacing {dimensionName} placeholders.
 * Also replaces {input} with upstream text.
 */
export function resolveTemplate(
  template: string,
  dimensions: MatrixDimension[],
  coordinates: number[],
  inputText: string
): string {
  if (!template) {
    // Fallback: concatenate all dimension values with spaces
    return dimensions
      .map((dim, i) => dim.values[coordinates[i]]?.promptFragment ?? '')
      .filter(Boolean)
      .join(' ');
  }

  let result = template;
  result = result.replace(/\{input\}/g, inputText);

  for (let i = 0; i < dimensions.length; i++) {
    const dim = dimensions[i];
    const value = dim.values[coordinates[i]];
    if (value) {
      // Replace all occurrences of {dimensionName}
      const pattern = new RegExp(`\\{${escapeRegex(dim.name)}\\}`, 'g');
      result = result.replace(pattern, value.promptFragment);
    }
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compute cells from dimensions + template + input text.
 * Preserves completed cells from existingCells by matching on prompt string.
 */
export function computeCells(
  dimensions: MatrixDimension[],
  template: string,
  inputText: string,
  existingCells: MatrixCell[]
): MatrixCell[] {
  const coordinates = computeCartesianProduct(dimensions);

  // Build a map of existing completed/generating cells by prompt for preservation
  const existingByPrompt = new Map<string, MatrixCell>();
  for (const cell of existingCells) {
    if (cell.status === 'completed' && cell.imageUrl) {
      existingByPrompt.set(cell.prompt, cell);
    }
  }

  return coordinates.map(coords => {
    const prompt = resolveTemplate(template, dimensions, coords, inputText);
    const existing = existingByPrompt.get(prompt);
    if (existing) {
      return { ...existing, coordinates: coords };
    }
    return {
      coordinates: coords,
      prompt,
      status: 'pending' as const,
    };
  });
}

/**
 * Group cells into chains for sequential execution.
 * A "chain" is a sequence of cells that share non-sequential dimension coordinates,
 * ordered by the sequential dimension index.
 * If no dimensions are sequential, each cell is its own chain.
 */
export function groupIntoChains(
  cells: MatrixCell[],
  dimensions: MatrixDimension[]
): MatrixCell[][] {
  // Find sequential dimension indices
  const seqDimIndices = dimensions
    .map((d, i) => d.sequential ? i : -1)
    .filter(i => i >= 0);

  if (seqDimIndices.length === 0) {
    // No sequential dimensions — each cell is its own chain
    return cells.map(c => [c]);
  }

  // For v1, support at most one sequential dimension
  const seqDimIdx = seqDimIndices[0];

  // Group by non-sequential coordinates
  const groups = new Map<string, MatrixCell[]>();

  for (const cell of cells) {
    const key = cell.coordinates
      .filter((_, i) => i !== seqDimIdx)
      .join(',');

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(cell);
  }

  // Sort each group by the sequential dimension index
  const chains: MatrixCell[][] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.coordinates[seqDimIdx] - b.coordinates[seqDimIdx]);
    chains.push(group);
  }

  return chains;
}

/**
 * Simple semaphore for concurrency limiting.
 */
export class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;

  constructor(private readonly maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }
    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

/**
 * Count total combinations across dimensions.
 */
export function totalCombinations(dimensions: MatrixDimension[]): number {
  if (dimensions.length === 0) return 0;
  return dimensions.reduce((acc, d) => acc * d.values.length, 1);
}

/**
 * Find unmatched placeholders in a template given the dimension names.
 */
export function findUnmatchedPlaceholders(
  template: string,
  dimensionNames: string[]
): string[] {
  const allPlaceholders = template.match(/\{([^}]+)\}/g) || [];
  const validNames = new Set(['input', ...dimensionNames]);
  return allPlaceholders
    .map(p => p.slice(1, -1))
    .filter(name => !validNames.has(name));
}

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
