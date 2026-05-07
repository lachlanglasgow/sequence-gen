'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BasePromptNode } from './components/nodes/BasePromptNode';
import { ModifyPromptNode } from './components/nodes/ModifyPromptNode';
import { AppendPromptNode } from './components/nodes/AppendPromptNode';
import { ImageNode } from './components/nodes/ImageNode';
import { MatrixNode } from './components/nodes/MatrixNode';
import { MultiImageNode } from './components/nodes/MultiImageNode';
import { NodeEditPanel } from './components/NodeEditPanel';
import { ProjectsPanel } from './components/ProjectsPanel';
import { SaveDialog } from './components/SaveDialog';
import { Toolbar } from './components/Toolbar';
import { SettingsPanel } from './components/SettingsPanel';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { MatrixGalleryPanel } from './components/MatrixGalleryPanel';
import { useProjectStore, type Project, DEFAULT_IMAGE_MODEL } from './store/projectStore';
import { computeCells, groupIntoChains, Semaphore } from './lib/matrixUtils';
import type { MatrixDimension, MatrixCell } from './types/matrix';

const nodeTypes = {
  basePrompt: BasePromptNode,
  modifyPrompt: ModifyPromptNode,
  appendPrompt: AppendPromptNode,
  image: ImageNode,
  matrixPrompt: MatrixNode,
  multiImage: MultiImageNode,
};

// Evaluate the text value for a node based on its inputs
async function evaluateNodeText(
  node: Node,
  nodes: Node[],
  edges: Edge[],
  evaluated: Map<string, string>
): Promise<string> {
  // Return cached result
  if (evaluated.has(node.id)) {
    return evaluated.get(node.id)!;
  }

  const type = node.type as string;

  // Base prompt - just returns its text
  if (type === 'basePrompt') {
    const result = String(node.data.text || '');
    evaluated.set(node.id, result);
    return result;
  }

  // Get input text from connected nodes (text sources connected to any universal handle)
  const inputEdges = edges.filter((e) => e.target === node.id && e.sourceHandle === 'text');
  const inputTexts: string[] = [];

  for (const edge of inputEdges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (sourceNode) {
      const text = await evaluateNodeText(sourceNode, nodes, edges, evaluated);
      inputTexts.push(text);
    }
  }

  const inputText = inputTexts.join(' ');

  // Modify prompt - uses LLM
  if (type === 'modifyPrompt') {
    const instruction = String(node.data.instruction || '');
    if (!inputText || !instruction) {
      evaluated.set(node.id, inputText);
      return inputText;
    }

    // Check if we have a cached result for this input+instruction combo
    const cacheKey = `${node.id}:${inputText}:${instruction}`;
    if (node.data.lastInput === cacheKey && node.data.lastResult) {
      evaluated.set(node.id, String(node.data.lastResult));
      return String(node.data.lastResult);
    }

    // Call API to modify
    try {
      const response = await fetch('/api/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText, instruction }),
      });

      if (response.ok) {
        const data = await response.json();
        evaluated.set(node.id, data.modifiedText);
        return data.modifiedText;
      }
    } catch (error) {
      console.error('Modify failed:', error);
    }

    evaluated.set(node.id, inputText);
    return inputText;
  }

  // Append prompt - concatenates
  if (type === 'appendPrompt') {
    const appendText = String(node.data.textToAppend || '');
    const result = inputText ? `${inputText} ${appendText}` : appendText;
    evaluated.set(node.id, result);
    return result;
  }

  // Image node - returns prompt text for display
  if (type === 'image') {
    evaluated.set(node.id, inputText);
    return inputText;
  }

  // Matrix node - returns input text (used for {input} placeholder)
  if (type === 'matrixPrompt') {
    evaluated.set(node.id, inputText);
    return inputText;
  }

  // Multi-image node - returns input text (used as prompt combined with uploaded images)
  if (type === 'multiImage') {
    evaluated.set(node.id, inputText);
    return inputText;
  }

  evaluated.set(node.id, inputText);
  return inputText;
}

export default function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ imageUrl: string; prompt?: string } | null>(null);
  const [matrixGallery, setMatrixGallery] = useState<{ dimensions: MatrixDimension[]; cells: MatrixCell[] } | null>(null);
  const { currentProjectId, updateProject, addProject, loadProject, projects, globalDefaultModel, setGlobalDefaultModel, setProjectDefaultModel, getDefaultModel, clearCurrentProject } = useProjectStore();
  const evaluatedCache = useRef<Map<string, string>>(new Map());

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastSavedState = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const hasLoadedProject = useRef(false);

  // Auto-load current project on mount (zustand rehydrates currentProjectId but canvas is empty)
  useEffect(() => {
    if (currentProjectId && !hasLoadedProject.current) {
      hasLoadedProject.current = true;
      const project = projects.find((p) => p.id === currentProjectId);
      if (project) {
        setNodes(JSON.parse(JSON.stringify(project.nodes)));
        setEdges(JSON.parse(JSON.stringify(project.edges)));
        lastSavedState.current = { nodes: JSON.parse(JSON.stringify(project.nodes)), edges: JSON.parse(JSON.stringify(project.edges)) };
      }
    }
  }, [currentProjectId, projects, setNodes, setEdges]);

  // Initialize lastSavedState on mount
  useEffect(() => {
    lastSavedState.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
  }, []);

  // Recover from orphaned generating states (e.g. page refreshed mid-generation)
  const hasRecovered = useRef(false);
  useEffect(() => {
    if (hasRecovered.current || nodes.length === 0) return;
    hasRecovered.current = true;

    setNodes((currentNodes) => {
      let changed = false;
      const fixed = currentNodes.map((node) => {
        if (node.type === 'image' || node.type === 'multiImage') {
          if (node.data.isGenerating) {
            changed = true;
            return { ...node, data: { ...node.data, isGenerating: false, error: 'Interrupted — page was refreshed during generation' } };
          }
        }
        if (node.type === 'matrixPrompt') {
          if (node.data.isGenerating) {
            changed = true;
            const cells = ((node.data.cells || []) as { coordinates: number[]; prompt: string; status: string; imageUrl?: string; error?: string }[]).map((cell) => {
              if (cell.status === 'generating' || cell.status === 'pending') {
                return { ...cell, status: 'failed' as const, error: 'Interrupted — page was refreshed' };
              }
              return cell;
            });
            return { ...node, data: { ...node.data, isGenerating: false, cells } };
          }
        }
        if (node.type === 'multiImage') {
          const results = (node.data.results || []) as { status: string }[];
          const hasOrphaned = results.some(r => r.status === 'generating' || r.status === 'pending');
          if (hasOrphaned && !node.data.isGenerating) {
            changed = true;
            const fixedResults = results.map(r => {
              if (r.status === 'generating' || r.status === 'pending') {
                return { ...r, status: 'failed' as const, error: 'Interrupted — page was refreshed' };
              }
              return r;
            });
            return { ...node, data: { ...node.data, results: fixedResults } };
          }
        }
        return node;
      });
      return changed ? fixed : currentNodes;
    });
  }, [nodes.length]);

  // Auto-save (skip when canvas is empty to prevent overwriting saved data on fresh load)
  useEffect(() => {
    if (currentProjectId && (nodes.length > 0 || edges.length > 0)) {
      const timeout = setTimeout(() => {
        updateProject(currentProjectId, nodes, edges);
        lastSavedState.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
        setHasUnsavedChanges(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [nodes, edges, currentProjectId, updateProject]);

  // Track unsaved changes
  useEffect(() => {
    if (!currentProjectId || !lastSavedState.current) {
      setHasUnsavedChanges(nodes.length > 0 || edges.length > 0);
      return;
    }
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(lastSavedState.current.nodes);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(lastSavedState.current.edges);
    setHasUnsavedChanges(nodesChanged || edgesChanged);
  }, [nodes, edges, currentProjectId]);

  // Update image nodes and matrix nodes with their connected inputs whenever edges change
  // Use a ref to prevent infinite loops
  const isUpdatingImageInputs = useRef(false);
  useEffect(() => {
    if (isUpdatingImageInputs.current) return;

    isUpdatingImageInputs.current = true;

    setNodes((currentNodes) => {
      let updated = false;
      const newNodes = currentNodes.map((node) => {
        if (node.type === 'image') {
          // Find all input edges for this node (universal handles)
          const inputEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle?.startsWith('input-')
          );

          // Determine type of each connection from the source node/handle
          const newInputs = inputEdges
            .map((edge) => {
              const sourceNode = currentNodes.find((n) => n.id === edge.source);
              if (!sourceNode) return null;
              const type: 'text' | 'image' = edge.sourceHandle === 'image' ? 'image' : 'text';
              const handleIdx = parseInt(edge.targetHandle!.replace('input-', ''), 10);
              return { index: handleIdx, nodeId: sourceNode.id, type };
            })
            .filter(Boolean) as { index: number; nodeId: string; type: 'text' | 'image' }[];

          newInputs.sort((a, b) => a.index - b.index);

          const currentInputs = (node.data.connectedInputs || []) as { index: number; nodeId: string; type: string }[];

          const changed =
            newInputs.length !== currentInputs.length ||
            newInputs.some(
              (inp, i) =>
                !currentInputs[i] ||
                inp.nodeId !== currentInputs[i].nodeId ||
                inp.type !== currentInputs[i].type ||
                inp.index !== currentInputs[i].index
            );

          if (changed) {
            updated = true;
            const imageInputs = newInputs
              .filter((i) => i.type === 'image')
              .map((i, idx) => ({ index: idx, nodeId: i.nodeId }));
            return { ...node, data: { ...node.data, connectedInputs: newInputs, imageInputs } };
          }
          return node;
        }

        if (node.type === 'multiImage') {
          // Track image inputs connected to the multi-image node
          // An image source connected to ANY handle on this node counts as an upstream image input
          const imageEdges = edges.filter(
            (e) => e.target === node.id && (e.targetHandle === 'image-input' || e.sourceHandle === 'image')
          );
          // Deduplicate by source node ID (a single source might match both conditions)
          const seen = new Set<string>();
          const newImageInputs: { nodeId: string }[] = [];
          for (const edge of imageEdges) {
            const sourceNode = currentNodes.find((n) => n.id === edge.source);
            if (sourceNode && !seen.has(sourceNode.id)) {
              seen.add(sourceNode.id);
              newImageInputs.push({ nodeId: sourceNode.id });
            }
          }

          const currentImageInputs = (node.data.upstreamMultiImageInputs || []) as { nodeId: string }[];
          const changed =
            newImageInputs.length !== currentImageInputs.length ||
            newImageInputs.some((inp, i) => !currentImageInputs[i] || inp.nodeId !== currentImageInputs[i].nodeId);

          if (changed) {
            updated = true;
            return { ...node, data: { ...node.data, upstreamMultiImageInputs: newImageInputs } };
          }
          return node;
        }

        if (node.type === 'matrixPrompt') {
          // Find all input edges for this node (universal handles, same as image node)
          const inputEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle?.startsWith('input-')
          );

          const newInputs = inputEdges
            .map((edge) => {
              const sourceNode = currentNodes.find((n) => n.id === edge.source);
              if (!sourceNode) return null;
              const type: 'text' | 'image' = edge.sourceHandle === 'image' ? 'image' : 'text';
              const handleIdx = parseInt(edge.targetHandle!.replace('input-', ''), 10);
              return { index: handleIdx, nodeId: sourceNode.id, type };
            })
            .filter(Boolean) as { index: number; nodeId: string; type: 'text' | 'image' }[];

          newInputs.sort((a, b) => a.index - b.index);

          const currentInputs = (node.data.connectedInputs || []) as { index: number; nodeId: string; type: string }[];

          const changed =
            newInputs.length !== currentInputs.length ||
            newInputs.some(
              (inp, i) =>
                !currentInputs[i] ||
                inp.nodeId !== currentInputs[i].nodeId ||
                inp.type !== currentInputs[i].type ||
                inp.index !== currentInputs[i].index
            );

          if (changed) {
            updated = true;
            const imageInputs = newInputs
              .filter((i) => i.type === 'image')
              .map((i, idx) => ({ index: idx, nodeId: i.nodeId }));
            return { ...node, data: { ...node.data, connectedInputs: newInputs, imageInputs } };
          }
          return node;
        }

        return node;
      });

      return updated ? newNodes : currentNodes;
    });

    // Reset the flag after a tick
    setTimeout(() => {
      isUpdatingImageInputs.current = false;
    }, 0);
  }, [edges]); // Only depend on edges, not nodes

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    setEdges((eds) => eds.filter((e) => !deletedEdges.find((d) => d.id === e.id)));
  }, [setEdges]);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    setEdges((eds) => eds.map((e) => (e.id === oldEdge.id ? { ...e, ...newConnection } as Edge : e)));
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
    );
  }, [setNodes]);

  const generateSingleNode = useCallback(async (nodeId: string) => {
    const imageNode = nodes.find((n) => n.id === nodeId);
    if (!imageNode || imageNode.type !== 'image') return;

    evaluatedCache.current.clear();

    // Push current generation to history before starting new one
    const existingImages = (imageNode.data.generatedImages || []) as { imageUrl: string; prompt: string; timestamp: number }[];
    const existingHistory = (imageNode.data.history || []) as { imageUrl: string; prompt: string; timestamp: number }[];
    let newHistory = [...existingHistory];
    if (existingImages.length > 0) {
      newHistory = [...existingImages, ...newHistory];
    } else if (imageNode.data.generatedImageUrl) {
      newHistory = [
        { imageUrl: imageNode.data.generatedImageUrl as string, prompt: String(imageNode.data.prompt || ''), timestamp: Date.now() },
        ...newHistory,
      ];
    }

    // Set generating state
    updateNodeData(imageNode.id, { isGenerating: true, error: undefined, history: newHistory });

    try {
      // Evaluate prompt
      const prompt = await evaluateNodeText(imageNode, nodes, edges, evaluatedCache.current);

      // Use stored image inputs (respecting user reordering)
      const storedImageInputs = (imageNode.data.imageInputs || []) as { index: number; nodeId: string }[];

      // Build URLs from stored order - ALL images, not just first
      const inputImageUrls: string[] = [];

      for (const input of storedImageInputs) {
        const sourceNode = nodes.find((n) => n.id === input.nodeId);
        if ((sourceNode?.type === 'image' || sourceNode?.type === 'multiImage') && sourceNode.data.generatedImageUrl) {
          inputImageUrls.push(sourceNode.data.generatedImageUrl as string);
        }
      }

      // Get settings from node data
      const model = imageNode.data.model || 'gemini-3.1-flash-image-preview';
      const aspectRatio = imageNode.data.aspectRatio as string | undefined;
      const imageSize = imageNode.data.imageSize as string | undefined;
      const generateCount = (imageNode.data.generateCount as number) || 1;

      console.log(`[Generate] Node ${imageNode.id}: Generating ${generateCount} image(s), model: ${model}, aspectRatio: ${aspectRatio || 'auto'}, imageSize: ${imageSize || 'auto'}`);

      // Fire N parallel requests
      const requests = Array.from({ length: generateCount }, (_, i) =>
        fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            stepId: imageNode.id,
            inputImages: inputImageUrls,
            model,
            aspectRatio,
            imageSize,
            batchIndex: generateCount > 1 ? i : undefined,
          }),
        }).then(async (res) => {
          if (!res.ok) throw new Error('Generation failed');
          return res.json();
        })
      );

      const results = await Promise.all(requests);

      const generatedImages = results.map((r) => ({
        imageUrl: r.imageUrl as string,
        prompt,
        timestamp: Date.now(),
      }));

      console.log(`[Generate] Node ${imageNode.id}: ${results.length} image(s) generated`);

      updateNodeData(imageNode.id, {
        isGenerating: false,
        generatedImageUrl: generatedImages[0].imageUrl,
        generatedImages,
        selectedImageIndex: 0,
        prompt,
        inputImageCount: results[0].inputImageCount,
      });
    } catch (error) {
      updateNodeData(imageNode.id, {
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      });
    }
  }, [nodes, edges, updateNodeData]);

  const generateMatrixNode = useCallback(async (nodeId: string) => {
    const matrixNode = nodes.find((n) => n.id === nodeId);
    if (!matrixNode || matrixNode.type !== 'matrixPrompt') return;

    const dimensions = (matrixNode.data.dimensions || []) as MatrixDimension[];
    const template = String(matrixNode.data.promptTemplate || '');
    const concurrency = (matrixNode.data.concurrency as number) || 3;
    const model = matrixNode.data.model || 'gemini-3.1-flash-image-preview';
    const aspectRatio = matrixNode.data.aspectRatio as string | undefined;
    const imageSize = matrixNode.data.imageSize as string | undefined;

    if (dimensions.length === 0 || dimensions.some(d => d.values.length === 0)) return;

    evaluatedCache.current.clear();

    // Evaluate upstream text for {input}
    const inputText = await evaluateNodeText(matrixNode, nodes, edges, evaluatedCache.current);

    // Push current completed cells to history before regenerating
    const existingCells = (matrixNode.data.cells || []) as MatrixCell[];
    const existingHistory = (matrixNode.data.history || []) as { cells: MatrixCell[]; timestamp: number }[];
    const completedExisting = existingCells.filter(c => c.status === 'completed' && c.imageUrl);
    let newHistory = [...existingHistory];
    if (completedExisting.length > 0) {
      newHistory = [{ cells: existingCells, timestamp: Date.now() }, ...newHistory];
    }

    // Reset all cells to pending for a fresh generation
    const allCells = computeCells(dimensions, template, inputText, []);

    // All cells are pending since we passed empty existingCells
    const pendingCells = allCells;
    if (pendingCells.length === 0) return;

    // Warn for large generation
    if (pendingCells.length > 100) {
      if (!window.confirm(`This will generate ${pendingCells.length} images. Continue?`)) return;
    }

    // Collect input image URLs from connected image nodes (respecting user reordering)
    const storedImageInputs = (matrixNode.data.imageInputs || []) as { index: number; nodeId: string }[];
    const baseInputImageUrls: string[] = [];
    for (const input of storedImageInputs) {
      const sourceNode = nodes.find((n) => n.id === input.nodeId);
      if ((sourceNode?.type === 'image' || sourceNode?.type === 'multiImage') && sourceNode.data.generatedImageUrl) {
        baseInputImageUrls.push(sourceNode.data.generatedImageUrl as string);
      }
    }

    // Set all cells + generating state
    updateNodeData(nodeId, { cells: allCells, history: newHistory, isGenerating: true });

    const chains = groupIntoChains(pendingCells, dimensions);
    const semaphore = new Semaphore(concurrency);

    // Helper to find a cell's index in allCells by coordinates
    const cellIndex = (coords: number[]): number =>
      allCells.findIndex(c => c.coordinates.every((v, i) => v === coords[i]));

    // Helper to update a single cell in allCells
    const updateCell = (coords: number[], updates: Partial<MatrixCell>) => {
      const idx = cellIndex(coords);
      if (idx >= 0) {
        allCells[idx] = { ...allCells[idx], ...updates };
        // Update node with new cells array (shallow copy to trigger re-render)
        updateNodeData(nodeId, { cells: [...allCells] });
      }
    };

    // Run all chains in parallel (semaphore limits actual concurrency)
    const chainPromises = chains.map(async (chain) => {
      let previousImageUrl: string | undefined;

      for (let i = 0; i < chain.length; i++) {
        const cell = chain[i];

        await semaphore.acquire();

        // Mark generating
        updateCell(cell.coordinates, { status: 'generating' });

        try {
          // Start with connected input images, then add sequential chain image
          const inputImages: string[] = [...baseInputImageUrls];
          // If this dimension is sequential and we have a previous image, add it
          if (previousImageUrl) {
            inputImages.push(previousImageUrl);
          }

          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: cell.prompt,
              stepId: `${nodeId}-${cell.coordinates.join('-')}`,
              inputImages,
              model,
              aspectRatio,
              imageSize,
            }),
          });

          if (!response.ok) throw new Error('Generation failed');

          const result = await response.json();
          updateCell(cell.coordinates, {
            status: 'completed',
            imageUrl: result.imageUrl,
            error: undefined,
          });
          previousImageUrl = result.imageUrl;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Generation failed';
          updateCell(cell.coordinates, { status: 'failed', error: errorMsg });

          // If sequential chain, mark remaining cells as failed
          const seqDimIdx = dimensions.findIndex(d => d.sequential);
          if (seqDimIdx >= 0) {
            for (let j = i + 1; j < chain.length; j++) {
              updateCell(chain[j].coordinates, {
                status: 'failed',
                error: 'Previous cell in chain failed',
              });
            }
            break;
          }
          previousImageUrl = undefined;
        } finally {
          semaphore.release();
        }
      }
    });

    await Promise.all(chainPromises);
    updateNodeData(nodeId, { isGenerating: false });
  }, [nodes, edges, updateNodeData]);

  const generateMultiImageNode = useCallback(async (nodeId: string) => {
    const multiNode = nodes.find((n) => n.id === nodeId);
    if (!multiNode || multiNode.type !== 'multiImage') return;

    console.log(`[MultiImage] Starting generation for node ${nodeId}`);

    // Collect input images: uploads + upstream node outputs
    const uploadedImages = (multiNode.data.uploadedImages || []) as { imageUrl: string; filename: string; timestamp: number }[];
    const upstreamInputs = (multiNode.data.upstreamMultiImageInputs || []) as { nodeId: string }[];

    console.log(`[MultiImage] ${uploadedImages.length} uploads, ${upstreamInputs.length} upstream connections`);

    const allInputImageUrls: string[] = uploadedImages.map((img) => img.imageUrl);

    // Collect outputs from upstream nodes
    for (const input of upstreamInputs) {
      const sourceNode = nodes.find((n) => n.id === input.nodeId);
      if (!sourceNode) {
        console.log(`[MultiImage] Upstream node ${input.nodeId} not found`);
        continue;
      }

      console.log(`[MultiImage] Upstream node ${input.nodeId} type=${sourceNode.type}`);

      if (sourceNode.type === 'multiImage') {
        // Prefer generated outputs; fall back to uploaded images (pass-through)
        const sourceResults = (sourceNode.data.results || []) as { outputImageUrl: string; status: string }[];
        const completedOutputs = sourceResults.filter(r => r.status === 'completed' && r.outputImageUrl);
        const sourceGenerated = (sourceNode.data.generatedImages || []) as { imageUrl: string }[];
        const sourceUploads = (sourceNode.data.uploadedImages || []) as { imageUrl: string }[];

        if (completedOutputs.length > 0) {
          console.log(`[MultiImage] Using ${completedOutputs.length} completed results from upstream`);
          for (const r of completedOutputs) {
            allInputImageUrls.push(r.outputImageUrl);
          }
        } else if (sourceGenerated.length > 0) {
          console.log(`[MultiImage] Using ${sourceGenerated.length} generatedImages from upstream`);
          for (const img of sourceGenerated) {
            allInputImageUrls.push(img.imageUrl);
          }
        } else if (sourceUploads.length > 0) {
          console.log(`[MultiImage] Pass-through: using ${sourceUploads.length} uploads from upstream`);
          for (const img of sourceUploads) {
            allInputImageUrls.push(img.imageUrl);
          }
        }
      } else if ((sourceNode.type === 'image') && sourceNode.data.generatedImageUrl) {
        console.log(`[MultiImage] Using generatedImageUrl from image node`);
        allInputImageUrls.push(sourceNode.data.generatedImageUrl as string);
      }
    }

    console.log(`[MultiImage] Total input images: ${allInputImageUrls.length}`);

    if (allInputImageUrls.length === 0) {
      console.log(`[MultiImage] No input images, aborting`);
      return;
    }

    evaluatedCache.current.clear();

    // Push current results to history
    const existingResults = (multiNode.data.results || []) as { inputImageUrl: string; outputImageUrl: string; prompt: string; status: string }[];
    const existingHistory = (multiNode.data.history || []) as { results: unknown[]; prompt: string; timestamp: number }[];
    let newHistory = [...existingHistory];
    const completedExisting = existingResults.filter(r => r.status === 'completed');
    if (completedExisting.length > 0) {
      newHistory = [{ results: existingResults, prompt: String(multiNode.data.prompt || ''), timestamp: Date.now() }, ...newHistory];
    }

    const model = multiNode.data.model || 'gemini-3.1-flash-image-preview';
    const aspectRatio = multiNode.data.aspectRatio as string | undefined;
    const imageSize = multiNode.data.imageSize as string | undefined;
    const concurrency = (multiNode.data.concurrency as number) || 3;

    // Initialize results array — one entry per input image
    const initialResults: {
      inputImageUrl: string;
      outputImageUrl: string;
      prompt: string;
      status: 'pending' | 'generating' | 'completed' | 'failed';
      error?: string;
    }[] = allInputImageUrls.map((url) => ({
      inputImageUrl: url,
      outputImageUrl: '',
      prompt: '',
      status: 'pending',
    }));

    updateNodeData(nodeId, {
      isGenerating: true,
      error: undefined,
      history: newHistory,
      results: initialResults,
      completedCount: 0,
      totalCount: allInputImageUrls.length,
    });

    try {
      const prompt = await evaluateNodeText(multiNode, nodes, edges, evaluatedCache.current);

      console.log(`[Generate] MultiImage ${nodeId}: ${allInputImageUrls.length} images 1:1, concurrency: ${concurrency}, model: ${model}`);

      const semaphore = new Semaphore(concurrency);
      let completed = 0;

      // Process each image individually, in parallel up to concurrency limit
      const promises = allInputImageUrls.map(async (inputUrl, idx) => {
        await semaphore.acquire();

        // Mark generating
        initialResults[idx] = { ...initialResults[idx], status: 'generating', prompt };
        updateNodeData(nodeId, { results: [...initialResults] });

        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              stepId: `${nodeId}-${idx}`,
              inputImages: [inputUrl],
              model,
              aspectRatio,
              imageSize,
            }),
          });

          if (!response.ok) throw new Error('Generation failed');

          const result = await response.json();
          initialResults[idx] = {
            inputImageUrl: inputUrl,
            outputImageUrl: result.imageUrl,
            prompt,
            status: 'completed',
          };
        } catch (error) {
          initialResults[idx] = {
            inputImageUrl: inputUrl,
            outputImageUrl: '',
            prompt,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Failed',
          } as any;
        } finally {
          completed++;
          updateNodeData(nodeId, {
            results: [...initialResults],
            completedCount: completed,
          });
          semaphore.release();
        }
      });

      await Promise.all(promises);

      // Build generatedImages array from completed results (for downstream chaining)
      const completedResults = initialResults.filter(r => r.status === 'completed');
      const generatedImages = completedResults.map(r => ({
        imageUrl: r.outputImageUrl,
        prompt,
        timestamp: Date.now(),
      }));

      updateNodeData(nodeId, {
        isGenerating: false,
        results: [...initialResults],
        generatedImageUrl: generatedImages.length > 0 ? generatedImages[0].imageUrl : undefined,
        generatedImages,
        selectedImageIndex: 0,
        prompt,
        completedCount: completed,
      });
    } catch (error) {
      updateNodeData(nodeId, {
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      });
    }
  }, [nodes, edges, updateNodeData]);

  // Listen for generate events from ImageNodes
  useEffect(() => {
    const handleGenerateEvent = (e: CustomEvent<{ nodeId: string }>) => {
      generateSingleNode(e.detail.nodeId);
    };
    window.addEventListener('generateImage', handleGenerateEvent as EventListener);
    return () => window.removeEventListener('generateImage', handleGenerateEvent as EventListener);
  }, [generateSingleNode]);

  // Listen for generate events from MatrixNodes
  useEffect(() => {
    const handleMatrixGenerateEvent = (e: CustomEvent<{ nodeId: string }>) => {
      generateMatrixNode(e.detail.nodeId);
    };
    window.addEventListener('generateMatrix', handleMatrixGenerateEvent as EventListener);
    return () => window.removeEventListener('generateMatrix', handleMatrixGenerateEvent as EventListener);
  }, [generateMatrixNode]);

  // Listen for generate events from MultiImageNodes
  useEffect(() => {
    const handleMultiImageGenerateEvent = (e: CustomEvent<{ nodeId: string }>) => {
      console.log(`[MultiImage] Event received for node ${e.detail.nodeId}`);
      generateMultiImageNode(e.detail.nodeId);
    };
    window.addEventListener('generateMultiImage', handleMultiImageGenerateEvent as EventListener);
    return () => window.removeEventListener('generateMultiImage', handleMultiImageGenerateEvent as EventListener);
  }, [generateMultiImageNode]);

  // Listen for updateNodeData events from nodes
  useEffect(() => {
    const handleUpdateNodeDataEvent = (e: CustomEvent<{ nodeId: string; data: any }>) => {
      updateNodeData(e.detail.nodeId, e.detail.data);
    };
    window.addEventListener('updateNodeData', handleUpdateNodeDataEvent as EventListener);
    return () => window.removeEventListener('updateNodeData', handleUpdateNodeDataEvent as EventListener);
  }, [updateNodeData]);

  // Listen for openImagePreview events
  useEffect(() => {
    const handleOpenPreview = (e: CustomEvent<{ imageUrl: string; prompt?: string }>) => {
      setPreviewImage(e.detail);
    };
    window.addEventListener('openImagePreview', handleOpenPreview as EventListener);
    return () => window.removeEventListener('openImagePreview', handleOpenPreview as EventListener);
  }, []);

  // Listen for openMatrixGallery events
  useEffect(() => {
    const handleOpenGallery = (e: CustomEvent<{ dimensions: MatrixDimension[]; cells: MatrixCell[] }>) => {
      setMatrixGallery(e.detail);
    };
    window.addEventListener('openMatrixGallery', handleOpenGallery as EventListener);
    return () => window.removeEventListener('openMatrixGallery', handleOpenGallery as EventListener);
  }, []);

  // Listen for popImageToNode events (from gallery)
  useEffect(() => {
    const handlePop = (e: CustomEvent<{ imageUrl: string; prompt: string }>) => {
      const { imageUrl, prompt } = e.detail;
      const id = `image-popped-${Date.now()}`;
      const newNode: Node = {
        id,
        type: 'image',
        position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
        data: {
          generatedImageUrl: imageUrl,
          prompt,
          generatedImages: [{ imageUrl, prompt, timestamp: Date.now() }],
          selectedImageIndex: 0,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    };
    window.addEventListener('popImageToNode', handlePop as EventListener);
    return () => window.removeEventListener('popImageToNode', handlePop as EventListener);
  }, [setNodes]);

  const addNode = useCallback((type: string) => {
    const id = `${type}-${Date.now()}`;
    const position = { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 };

    let newNode: Node;

    switch (type) {
      case 'basePrompt':
        newNode = {
          id,
          type: 'basePrompt',
          position,
          data: { text: '' },
        };
        break;
      case 'modifyPrompt':
        newNode = {
          id,
          type: 'modifyPrompt',
          position,
          data: { instruction: '' },
        };
        break;
      case 'appendPrompt':
        newNode = {
          id,
          type: 'appendPrompt',
          position,
          data: { textToAppend: '' },
        };
        break;
      case 'image':
        const defaultModel = useProjectStore.getState().getDefaultModel(currentProjectId);
        newNode = {
          id,
          type: 'image',
          position,
          data: { model: defaultModel },
        };
        break;
      case 'matrixPrompt':
        const defaultMatrixModel = useProjectStore.getState().getDefaultModel(currentProjectId);
        newNode = {
          id,
          type: 'matrixPrompt',
          position,
          data: {
            promptTemplate: '',
            dimensions: [],
            cells: [],
            history: [],
            isGenerating: false,
            model: defaultMatrixModel,
            concurrency: 3,
          },
        };
        break;
      case 'multiImage':
        const defaultMultiImageModel = useProjectStore.getState().getDefaultModel(currentProjectId);
        newNode = {
          id,
          type: 'multiImage',
          position,
          data: {
            uploadedImages: [],
            model: defaultMultiImageModel,
          },
        };
        break;
      default:
        return;
    }

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleGenerate = useCallback(async () => {
    const imageNodes = nodes.filter((n) => n.type === 'image');
    const matrixNodes = nodes.filter((n) => n.type === 'matrixPrompt');
    const multiImageNodes = nodes.filter((n) => n.type === 'multiImage');
    if (imageNodes.length === 0 && matrixNodes.length === 0 && multiImageNodes.length === 0) return;

    setIsGenerating(true);

    // Trigger matrix nodes in parallel
    const matrixPromises = matrixNodes.map(mn => generateMatrixNode(mn.id));
    evaluatedCache.current.clear();

    for (const imageNode of imageNodes) {
      // Push current generation to history before starting new one
      const existingImages = (imageNode.data.generatedImages || []) as { imageUrl: string; prompt: string; timestamp: number }[];
      const existingHistory = (imageNode.data.history || []) as { imageUrl: string; prompt: string; timestamp: number }[];
      let newHistory = [...existingHistory];
      if (existingImages.length > 0) {
        newHistory = [...existingImages, ...newHistory];
      } else if (imageNode.data.generatedImageUrl) {
        newHistory = [
          { imageUrl: imageNode.data.generatedImageUrl as string, prompt: String(imageNode.data.prompt || ''), timestamp: Date.now() },
          ...newHistory,
        ];
      }

      // Set generating state
      updateNodeData(imageNode.id, { isGenerating: true, error: undefined, history: newHistory });

      try {
        // Evaluate prompt
        const prompt = await evaluateNodeText(imageNode, nodes, edges, evaluatedCache.current);

        // Get all input images respecting the stored order
        const storedImageInputs = (imageNode.data.imageInputs || []) as { index: number; nodeId: string }[];
        const inputImageUrls: string[] = [];

        for (const input of storedImageInputs) {
          const sourceNode = nodes.find((n) => n.id === input.nodeId);
          if ((sourceNode?.type === 'image' || sourceNode?.type === 'multiImage') && sourceNode.data.generatedImageUrl) {
            inputImageUrls.push(sourceNode.data.generatedImageUrl as string);
          }
        }

        // Get settings from node data
        const model = imageNode.data.model || 'gemini-3.1-flash-image-preview';
        const aspectRatio = imageNode.data.aspectRatio as string | undefined;
        const imageSize = imageNode.data.imageSize as string | undefined;
        const generateCount = (imageNode.data.generateCount as number) || 1;

        console.log(`[Generate] Node ${imageNode.id}: Generating ${generateCount} image(s), model: ${model}`);

        // Fire N parallel requests
        const requests = Array.from({ length: generateCount }, (_, i) =>
          fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              stepId: imageNode.id,
              inputImages: inputImageUrls,
              model,
              aspectRatio,
              imageSize,
              batchIndex: generateCount > 1 ? i : undefined,
            }),
          }).then(async (res) => {
            if (!res.ok) throw new Error('Generation failed');
            return res.json();
          })
        );

        const results = await Promise.all(requests);

        const generatedImages = results.map((r) => ({
          imageUrl: r.imageUrl as string,
          prompt,
          timestamp: Date.now(),
        }));

        updateNodeData(imageNode.id, {
          isGenerating: false,
          generatedImageUrl: generatedImages[0].imageUrl,
          generatedImages,
          selectedImageIndex: 0,
          prompt,
          inputImageCount: results[0].inputImageCount,
        });
      } catch (error) {
        updateNodeData(imageNode.id, {
          isGenerating: false,
          error: error instanceof Error ? error.message : 'Generation failed',
        });
      }
    }

    // Trigger multi-image nodes in parallel
    const multiImagePromises = multiImageNodes.map(mn => generateMultiImageNode(mn.id));

    // Wait for matrix and multi-image nodes to finish
    await Promise.all([...matrixPromises, ...multiImagePromises]);

    setIsGenerating(false);
  }, [nodes, edges, updateNodeData, generateMatrixNode, generateMultiImageNode]);

  const handleLoadProject = useCallback((project: Project) => {
    hasLoadedProject.current = true;
    setNodes(JSON.parse(JSON.stringify(project.nodes)));
    setEdges(JSON.parse(JSON.stringify(project.edges)));
    lastSavedState.current = { nodes: JSON.parse(JSON.stringify(project.nodes)), edges: JSON.parse(JSON.stringify(project.edges)) };
    setHasUnsavedChanges(false);
    evaluatedCache.current.clear();
  }, [setNodes, setEdges]);

  const handleNewProject = useCallback(() => {
    clearCurrentProject();
    setNodes([]);
    setEdges([]);
    lastSavedState.current = { nodes: [], edges: [] };
    setHasUnsavedChanges(false);
    setSelectedNode(null);
    evaluatedCache.current.clear();
  }, [setNodes, setEdges, clearCurrentProject]);

  const handleSave = useCallback(() => {
    if (currentProjectId) {
      // Overwrite existing project
      updateProject(currentProjectId, nodes, edges);
      lastSavedState.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
      setHasUnsavedChanges(false);
    } else {
      // No current project - show save dialog
      setShowSaveDialog(true);
    }
  }, [currentProjectId, nodes, edges, updateProject]);

  const handleSaveAsNew = useCallback(() => {
    setShowSaveDialog(true);
  }, []);

  const handleSaveDialogConfirm = useCallback((name: string) => {
    if (name.trim()) {
      addProject(name.trim(), nodes, edges);
      lastSavedState.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
      setHasUnsavedChanges(false);
    }
    setShowSaveDialog(false);
  }, [nodes, edges, addProject]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset to allow re-selecting same file
      fileInputRef.current.click();
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setIsUploading(true);

    // Create FormData
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Upload the file
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      // Create image node with uploaded image
      const id = `image-uploaded-${Date.now()}`;
      const newNode: Node = {
        id,
        type: 'image',
        position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
        data: {
          generatedImageUrl: result.imageUrl,
          prompt: `Uploaded: ${file.name}`,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setNodes]);

  const handlePreviewDownload = useCallback(() => {
    if (!previewImage) return;
    const link = document.createElement('a');
    link.href = previewImage.imageUrl;
    link.download = `generated-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [previewImage]);

  const handlePopToNode = useCallback(() => {
    if (!previewImage) return;
    const id = `image-popped-${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'image',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: {
        generatedImageUrl: previewImage.imageUrl,
        prompt: previewImage.prompt || '',
        generatedImages: [{ imageUrl: previewImage.imageUrl, prompt: previewImage.prompt || '', timestamp: Date.now() }],
        selectedImageIndex: 0,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [previewImage, setNodes]);

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col min-h-0">
        <Toolbar
          onAddNode={addNode}
          onGenerateAll={handleGenerate}
          onOpenProjects={() => setProjectsOpen(true)}
          onSave={handleSave}
          onSaveAsNew={handleSaveAsNew}
          onUploadImage={handleUploadClick}
          onOpenSettings={() => setShowSettings(true)}
          hasNodes={nodes.length > 0}
          hasCurrentProject={!!currentProjectId}
          isGenerating={isGenerating}
          isUploading={isUploading}
          hasUnsavedChanges={hasUnsavedChanges}
        />
        <div className="flex-1 relative min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onReconnect={onReconnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
        />
        </div>
      </div>

      {selectedNode && (
        <NodeEditPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          allNodes={nodes}
        />
      )}

      <ProjectsPanel
        isOpen={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        currentNodes={nodes}
        currentEdges={edges}
        onLoadProject={handleLoadProject}
        onNewProject={handleNewProject}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onConfirm={handleSaveDialogConfirm}
        existingNames={projects.map((p) => p.name)}
      />

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        defaultModel={currentProjectId ? getDefaultModel(currentProjectId) : globalDefaultModel}
        onDefaultModelChange={(model) => {
          if (currentProjectId) {
            setProjectDefaultModel(currentProjectId, model);
          } else {
            setGlobalDefaultModel(model);
          }
        }}
      />

      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.imageUrl}
          prompt={previewImage.prompt}
          onClose={() => setPreviewImage(null)}
          onDownload={handlePreviewDownload}
          onPopToNode={handlePopToNode}
        />
      )}

      {matrixGallery && (
        <MatrixGalleryPanel
          dimensions={matrixGallery.dimensions}
          cells={matrixGallery.cells}
          onClose={() => setMatrixGallery(null)}
        />
      )}
    </div>
  );
}
