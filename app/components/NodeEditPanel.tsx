'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { openImagePreview } from './ImagePreviewModal';
import type { MatrixDimension, MatrixValue, MatrixCell } from '../types/matrix';
import { generateId, totalCombinations, findUnmatchedPlaceholders, resolveTemplate, computeCells, computeCartesianProduct, groupIntoChains } from '../lib/matrixUtils';
import { AVAILABLE_MODELS, getAspectRatiosForModel, IMAGE_SIZES } from './nodes/ImageNode';
import { openMatrixGallery } from './MatrixGalleryPanel';

interface NodeEditPanelProps {
  node: Node;
  onClose: () => void;
  onUpdate: (data: any) => void;
}

interface ImageInput {
  index: number;
  nodeId: string;
}

interface GeneratedImage {
  imageUrl: string;
  prompt: string;
  timestamp: number;
}

// Find image URL for a nodeId by looking at all nodes
function findImageUrl(nodeId: string, allNodes: Node[]): string | undefined {
  const sourceNode = allNodes.find((n) => n.id === nodeId);
  return sourceNode?.data?.generatedImageUrl as string | undefined;
}

export function NodeEditPanel({ node, onClose, onUpdate, allNodes = [] }: NodeEditPanelProps & { allNodes?: Node[] }) {
  const [localData, setLocalData] = useState(node.data);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalData(node.data);
  }, [node.id, node.data]);

  const handleSave = () => {
    onUpdate(localData);
  };

  const getTitle = () => {
    switch (node.type) {
      case 'basePrompt': return 'BASE PROMPT';
      case 'modifyPrompt': return 'MODIFY PROMPT';
      case 'appendPrompt': return 'APPEND PROMPT';
      case 'image': return 'IMAGE GENERATOR';
      case 'multiImage': return 'MULTI IMAGE';
      case 'matrixPrompt': return 'MATRIX';
      default: return 'NODE';
    }
  };

  const swapImages = (index1: number, index2: number) => {
    const currentInputs = [...((localData.imageInputs || []) as ImageInput[])];
    if (index2 < 0 || index2 >= currentInputs.length) return;
    
    // Swap the two items
    const temp = currentInputs[index1];
    currentInputs[index1] = currentInputs[index2];
    currentInputs[index2] = temp;
    
    // Reassign indices
    const newInputs = currentInputs.map((input, idx) => ({ ...input, index: idx }));
    setLocalData({ ...localData, imageInputs: newInputs });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Swap on drag over
    swapImages(draggedIndex, index);
    setDraggedIndex(index);
  }, [draggedIndex, localData.imageInputs]);

  const handleDrop = () => {
    setDraggedIndex(null);
  };

  const inputClass = "w-full bg-[#f0f0f0] border border-[#404040] px-3 py-2 text-[12px] text-[#404040] focus:outline-none focus:border-[#c73e3e]";
  const labelClass = "text-[10px] text-[#606060] mb-1 block";
  const btnSmall = "bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#404040] px-2 py-1 text-[10px] border border-[#404040] flex items-center justify-center";

  const imageInputs = (localData.imageInputs || []) as ImageInput[];

  return (
    <div 
      className="w-[360px] bg-[#e0e0e0] border-l border-[#404040] h-screen overflow-y-auto"
      style={{ fontFamily: 'Courier New, Courier, monospace' }}
    >
      {/* Header */}
      <div className="bg-[#d0d0d0] px-4 py-3 border-b border-[#404040] flex items-center justify-between">
        <h2 className="text-xs font-normal tracking-wider text-[#404040]">{getTitle()}</h2>
        <button onClick={onClose} className="text-[#404040] hover:text-[#c73e3e] text-lg">
          ×
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Base Prompt Editor */}
        {node.type === 'basePrompt' && (
          <div>
            <label className={labelClass}>PROMPT TEXT</label>
            <textarea
              value={String(localData.text || '')}
              onChange={(e) => setLocalData({ ...localData, text: e.target.value })}
              className={`${inputClass} h-40`}
              placeholder="Enter prompt..."
            />
          </div>
        )}

        {/* Modify Prompt Editor */}
        {node.type === 'modifyPrompt' && (
          <div>
            <label className={labelClass}>LLM INSTRUCTION</label>
            <textarea
              value={String(localData.instruction || '')}
              onChange={(e) => setLocalData({ ...localData, instruction: e.target.value })}
              className={`${inputClass} h-32`}
              placeholder="Enter instruction..."
            />
            {(node.data.lastResult as string | undefined) && (
              <div className="mt-4">
                <label className={labelClass}>LAST RESULT</label>
                <div className="bg-[#e8e8e8] p-3 border border-[#404040] text-[11px] text-[#404040] max-h-32 overflow-y-auto">
                  {String(node.data.lastResult)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Append Prompt Editor */}
        {node.type === 'appendPrompt' && (
          <div>
            <label className={labelClass}>TEXT TO APPEND</label>
            <textarea
              value={String(localData.textToAppend || '')}
              onChange={(e) => setLocalData({ ...localData, textToAppend: e.target.value })}
              className={`${inputClass} h-32`}
              placeholder="Enter text to append..."
            />
          </div>
        )}

        {/* Image Node Info */}
        {node.type === 'image' && (
          <div className="space-y-3">
            <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
              <div className="text-[10px] text-[#606060] mb-2">INPUTS</div>
              <ul className="text-[11px] text-[#404040] space-y-1">
                <li>• TEXT: The prompt for generation</li>
                <li>• IMAGES: Reference images (drag to reorder)</li>
              </ul>
            </div>
            
            {/* Image Ordering - Horizontal Scroller with Previews */}
            {imageInputs.length > 0 ? (
              <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#606060]">IMAGE ORDER</span>
                  <span className="text-[10px] bg-[#c73e3e] text-[#f0f0f0] px-2 py-0.5">
                    {imageInputs.length} IMAGE{imageInputs.length !== 1 ? 'S' : ''} WILL BE SENT
                  </span>
                </div>
                
                {/* Horizontal scroller */}
                <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                  {imageInputs.map((input, idx) => {
                    const imageUrl = findImageUrl(input.nodeId, allNodes);
                    return (
                      <div
                        key={input.nodeId}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={handleDrop}
                        className={`flex-shrink-0 w-[80px] bg-[#f0f0f0] border ${draggedIndex === idx ? 'border-[#c73e3e] opacity-50' : 'border-[#404040]'} cursor-move`}
                      >
                        {/* Index label */}
                        <div className="bg-[#d0d0d0] px-1 py-0.5 text-[9px] text-[#404040] border-b border-[#404040] text-center">
                          [{idx + 1}]
                        </div>
                        
                        {/* Image preview */}
                        <div
                          className="h-[60px] flex items-center justify-center bg-[#e8e8e8] overflow-hidden"
                          onClick={() => { if (imageUrl) openImagePreview(imageUrl); }}
                          style={{ cursor: imageUrl ? 'pointer' : undefined }}
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={`Image ${idx + 1}`}
                              className="w-full h-full object-cover hover:brightness-90 transition-[filter]"
                            />
                          ) : (
                            <span className="text-[8px] text-[#909090]">NO IMG</span>
                          )}
                        </div>
                        
                        {/* Swap buttons */}
                        <div className="flex border-t border-[#404040]">
                          <button
                            onClick={() => swapImages(idx, idx - 1)}
                            disabled={idx === 0}
                            className={`flex-1 ${btnSmall} ${idx === 0 ? 'opacity-30' : ''} border-r border-[#404040]`}
                          >
                            ←
                          </button>
                          <button
                            onClick={() => swapImages(idx, idx + 1)}
                            disabled={idx === imageInputs.length - 1}
                            className={`flex-1 ${btnSmall} ${idx === imageInputs.length - 1 ? 'opacity-30' : ''}`}
                          >
                            →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-2 text-[9px] text-[#606060] pt-2 border-t border-[#d0d0d0] space-y-1">
                  <div><strong>[1] PRIMARY</strong> - Base image for editing</div>
                  <div><strong>[2+]</strong> - Additional reference images</div>
                  <div className="text-[#c73e3e]">All {imageInputs.length} images will be sent to Nano Banana</div>
                </div>
              </div>
            ) : (
              <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
                <div className="text-[10px] text-[#909090]">NO IMAGE INPUTS CONNECTED</div>
              </div>
            )}
            
            {/* Current Generated Images */}
            {(localData.generatedImageUrl as string | undefined) && (
              <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
                <div className="text-[10px] text-[#606060] mb-1">GENERATED IMAGE</div>
                <img
                  src={localData.generatedImageUrl as string}
                  alt="Generated"
                  className="w-full border border-[#404040] cursor-pointer hover:brightness-90 transition-[filter]"
                  onClick={() => openImagePreview(localData.generatedImageUrl as string, localData.prompt as string | undefined)}
                />
                {/* Batch thumbnails */}
                {((localData.generatedImages || []) as GeneratedImage[]).length > 1 && (
                  <div className="flex gap-1 mt-2">
                    {((localData.generatedImages || []) as GeneratedImage[]).map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setLocalData({
                            ...localData,
                            generatedImageUrl: img.imageUrl,
                            selectedImageIndex: idx,
                          });
                          openImagePreview(img.imageUrl, img.prompt);
                        }}
                        className={`flex-1 h-[48px] border overflow-hidden cursor-pointer ${
                          idx === ((localData.selectedImageIndex as number) || 0)
                            ? 'border-[#c73e3e]'
                            : 'border-[#808080] opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img.imageUrl} alt={`Variant ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Generation History */}
            {((localData.history || []) as GeneratedImage[]).length > 0 && (
              <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#606060]">
                    HISTORY ({((localData.history || []) as GeneratedImage[]).length})
                  </span>
                  <button
                    onClick={() => setLocalData({ ...localData, history: [] })}
                    className="text-[9px] text-[#909090] hover:text-[#c73e3e]"
                  >
                    CLEAR
                  </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {((localData.history || []) as GeneratedImage[]).map((item, idx) => (
                    <div key={idx} className="bg-[#f0f0f0] border border-[#d0d0d0]">
                      <div
                        className="h-[80px] overflow-hidden cursor-pointer hover:brightness-90 transition-[filter]"
                        onClick={() => openImagePreview(item.imageUrl, item.prompt)}
                      >
                        <img
                          src={item.imageUrl}
                          alt={`History ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-2 py-1 border-t border-[#d0d0d0] flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] text-[#909090]">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </div>
                          {item.prompt && (
                            <div className="text-[9px] text-[#606060] truncate" title={item.prompt}>
                              {item.prompt}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            // Restore this history item as the current image
                            const currentHistory = [...((localData.history || []) as GeneratedImage[])];
                            // Remove the restored item from history
                            currentHistory.splice(idx, 1);
                            // If there's a current image, push it to history
                            if (localData.generatedImageUrl) {
                              const currentImages = (localData.generatedImages || []) as GeneratedImage[];
                              if (currentImages.length > 0) {
                                currentHistory.unshift(...currentImages);
                              } else {
                                currentHistory.unshift({
                                  imageUrl: localData.generatedImageUrl as string,
                                  prompt: String(localData.prompt || ''),
                                  timestamp: Date.now(),
                                });
                              }
                            }
                            setLocalData({
                              ...localData,
                              generatedImageUrl: item.imageUrl,
                              generatedImages: [item],
                              selectedImageIndex: 0,
                              prompt: item.prompt,
                              history: currentHistory,
                            });
                          }}
                          className="text-[9px] text-[#c73e3e] hover:text-[#b53535] ml-2 flex-shrink-0 border border-[#c73e3e] px-1.5 py-0.5"
                        >
                          RESTORE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Multi Image Node Editor */}
        {node.type === 'multiImage' && (
          <MultiImageEditor localData={localData} setLocalData={setLocalData} allNodes={allNodes} />
        )}

        {/* Matrix Node Editor */}
        {node.type === 'matrixPrompt' && (
          <MatrixEditor localData={localData} setLocalData={setLocalData} allNodes={allNodes} />
        )}

        <button
          onClick={handleSave}
          className="w-full bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] py-2 text-[11px] border border-[#404040] transition-colors"
        >
          SAVE CHANGES
        </button>
      </div>
    </div>
  );
}

// ─── Matrix Editor Sub-component ─────────────────────────────────────────────

function MatrixEditor({ localData, setLocalData, allNodes }: { localData: Record<string, unknown>; setLocalData: (d: Record<string, unknown>) => void; allNodes: Node[] }) {
  const inputClass = "w-full bg-[#f0f0f0] border border-[#404040] px-3 py-2 text-[12px] text-[#404040] focus:outline-none focus:border-[#c73e3e]";
  const labelClass = "text-[10px] text-[#606060] mb-1 block";
  const btnSmall = "bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#404040] px-2 py-1 text-[10px] border border-[#404040]";

  const dimensions = (localData.dimensions || []) as MatrixDimension[];
  const template = String(localData.promptTemplate || '');
  const cells = (localData.cells || []) as MatrixCell[];
  const history = (localData.history || []) as { cells: MatrixCell[]; timestamp: number }[];
  const total = totalCombinations(dimensions);
  const model = String(localData.model || 'gemini-3.1-flash-image-preview');
  const aspectRatio = String(localData.aspectRatio || '');
  const imageSize = String(localData.imageSize || '');
  const concurrency = (localData.concurrency as number) || 3;

  const dimNames = dimensions.map(d => d.name).filter(Boolean);
  const unmatched = template ? findUnmatchedPlaceholders(template, dimNames) : [];

  const examplePrompt = dimensions.length > 0 && dimensions.every(d => d.values.length > 0)
    ? resolveTemplate(template, dimensions, dimensions.map(() => 0), '{input}')
    : '';

  const availableRatios = getAspectRatiosForModel(model);

  const updateDimensions = (newDims: MatrixDimension[]) => {
    setLocalData({ ...localData, dimensions: newDims });
  };

  const addDimension = () => {
    updateDimensions([...dimensions, {
      id: generateId(),
      name: '',
      sequential: false,
      values: [],
    }]);
  };

  const removeDimension = (dimId: string) => {
    updateDimensions(dimensions.filter(d => d.id !== dimId));
  };

  const updateDimension = (dimId: string, updates: Partial<MatrixDimension>) => {
    updateDimensions(dimensions.map(d => d.id === dimId ? { ...d, ...updates } : d));
  };

  const addValue = (dimId: string) => {
    updateDimensions(dimensions.map(d => {
      if (d.id !== dimId) return d;
      return { ...d, values: [...d.values, { id: generateId(), label: '', promptFragment: '' }] };
    }));
  };

  const removeValue = (dimId: string, valId: string) => {
    updateDimensions(dimensions.map(d => {
      if (d.id !== dimId) return d;
      return { ...d, values: d.values.filter(v => v.id !== valId) };
    }));
  };

  const updateValue = (dimId: string, valId: string, updates: Partial<MatrixValue>) => {
    updateDimensions(dimensions.map(d => {
      if (d.id !== dimId) return d;
      return { ...d, values: d.values.map(v => v.id === valId ? { ...v, ...updates } : v) };
    }));
  };

  const moveValue = (dimId: string, fromIdx: number, toIdx: number) => {
    updateDimensions(dimensions.map(d => {
      if (d.id !== dimId) return d;
      if (toIdx < 0 || toIdx >= d.values.length) return d;
      const values = [...d.values];
      const [moved] = values.splice(fromIdx, 1);
      values.splice(toIdx, 0, moved);
      return { ...d, values };
    }));
  };

  const [quickFillDimId, setQuickFillDimId] = useState<string | null>(null);
  const [quickFillText, setQuickFillText] = useState('');

  const handleQuickFill = (dimId: string) => {
    const items = quickFillText
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    updateDimensions(dimensions.map(d => {
      if (d.id !== dimId) return d;
      const newValues = items.map(item => ({
        id: generateId(),
        label: item,
        promptFragment: item,
      }));
      return { ...d, values: [...d.values, ...newValues] };
    }));
    setQuickFillText('');
    setQuickFillDimId(null);
  };

  // Load example preset
  const loadExample = () => {
    setLocalData({
      ...localData,
      promptTemplate: 'A {stage} plant in {weather} weather, botanical illustration',
      dimensions: [
        {
          id: generateId(),
          name: 'stage',
          sequential: false,
          values: [
            { id: generateId(), label: 'Seedling', promptFragment: 'tiny seedling' },
            { id: generateId(), label: 'Sapling', promptFragment: 'young sapling with small leaves' },
            { id: generateId(), label: 'Mature', promptFragment: 'fully grown mature' },
          ],
        },
        {
          id: generateId(),
          name: 'weather',
          sequential: false,
          values: [
            { id: generateId(), label: 'Sunny', promptFragment: 'bright sunny' },
            { id: generateId(), label: 'Rainy', promptFragment: 'rainy with puddles' },
          ],
        },
      ],
    });
  };

  const handleRegenerateFailed = () => {
    const newCells = cells.map(c =>
      c.status === 'failed' ? { ...c, status: 'pending' as const, error: undefined } : c
    );
    setLocalData({ ...localData, cells: newCells });
  };

  const handleClearResults = () => {
    const newCells = cells.map(c => ({
      ...c,
      status: 'pending' as const,
      imageUrl: undefined,
      error: undefined,
    }));
    setLocalData({ ...localData, cells: newCells });
  };

  const completedCells = cells.filter(c => c.status === 'completed' && c.imageUrl);
  const dim0 = dimensions[0];
  const dim1 = dimensions[1];

  const [sliceIndices, setSliceIndices] = useState<number[]>([]);
  useEffect(() => {
    if (dimensions.length > 2) {
      setSliceIndices(dimensions.slice(2).map(() => 0));
    } else {
      setSliceIndices([]);
    }
  }, [dimensions.length]);

  const getCellForGrid = (row: number, col: number): MatrixCell | undefined => {
    return cells.find(c => {
      if (dimensions.length === 1) return c.coordinates[0] === row;
      if (dimensions.length === 2) return c.coordinates[0] === row && c.coordinates[1] === col;
      if (c.coordinates[0] !== row || c.coordinates[1] !== col) return false;
      return c.coordinates.slice(2).every((v, i) => v === (sliceIndices[i] ?? 0));
    });
  };

  const isEmpty = dimensions.length === 0;

  return (
    <div className="space-y-4">
      {/* Getting started guide — shown when empty */}
      {isEmpty && (
        <div className="bg-[#e8e8e8] border border-[#404040] p-3">
          <div className="text-[11px] text-[#404040] mb-2">HOW IT WORKS</div>
          <div className="text-[10px] text-[#606060] space-y-2 leading-relaxed">
            <div>
              <span className="text-[#404040]">1.</span> Add dimensions below — each one is a variable
              (e.g. "weather" with values sunny, rainy, snowy)
            </div>
            <div>
              <span className="text-[#404040]">2.</span> Write a prompt template using {'{'}<span className="text-[#c73e3e]">dimension_name</span>{'}'} placeholders
            </div>
            <div>
              <span className="text-[#404040]">3.</span> Hit Generate — every combination gets its own image
            </div>
            <div className="pt-1 text-[9px] text-[#808080]">
              Example: 3 stages × 2 weather types = 6 images auto-generated
            </div>
          </div>
          <button
            onClick={loadExample}
            className="mt-3 w-full bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] py-1.5 text-[10px] border border-[#404040] transition-colors"
          >
            LOAD EXAMPLE (3 stages × 2 weather)
          </button>
        </div>
      )}

      {/* ── STEP 1: Dimensions ───────────────────────────────── */}
      <div>
        <label className={labelClass}>
          {isEmpty ? '1. ADD DIMENSIONS' : 'DIMENSIONS'}
          {total > 0 && (
            <span className="text-[#404040] ml-2">
              = {total} image{total !== 1 ? 's' : ''}
            </span>
          )}
        </label>

        {dimensions.map((dim) => (
          <div key={dim.id} className="bg-[#e8e8e8] border border-[#404040] mb-2 p-2">
            {/* Dimension header */}
            <div className="flex gap-2 items-center mb-1.5">
              <input
                value={dim.name}
                onChange={(e) => updateDimension(dim.id, { name: e.target.value })}
                placeholder="dimension name (e.g. weather)"
                className="flex-1 bg-[#f0f0f0] border border-[#808080] px-2 py-1 text-[11px] text-[#404040] focus:outline-none focus:border-[#c73e3e]"
                style={{ fontFamily: 'Courier New, Courier, monospace' }}
              />
              <button
                onClick={() => removeDimension(dim.id)}
                className="text-[#909090] hover:text-[#c73e3e] text-[14px] px-1"
                title="Delete dimension"
              >
                ×
              </button>
            </div>

            {/* Sequential toggle — with explanation */}
            <label className="flex items-start gap-1.5 text-[9px] text-[#606060] cursor-pointer select-none mb-2 px-0.5">
              <input
                type="checkbox"
                checked={dim.sequential}
                onChange={(e) => updateDimension(dim.id, { sequential: e.target.checked })}
                className="accent-[#c73e3e] mt-[2px]"
              />
              <span>
                <span className="text-[#404040]">Sequential chain</span>
                {' — '}each value&apos;s output image becomes the next value&apos;s input
                {dim.sequential && (
                  <span className="text-[#c73e3e]"> (enabled)</span>
                )}
              </span>
            </label>

            {/* Column headers for values */}
            {dim.values.length > 0 && (
              <div className="flex gap-1 items-center mb-0.5 px-3">
                <span className="w-[80px] text-[8px] text-[#909090]">LABEL</span>
                <span className="flex-1 text-[8px] text-[#909090]">
                  TEXT INSERTED FOR {'{' + (dim.name || '...') + '}'}
                </span>
              </div>
            )}

            {/* Values */}
            {dim.values.map((val, valIdx) => (
              <div key={val.id} className="flex gap-1 items-center mb-1">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveValue(dim.id, valIdx, valIdx - 1)}
                    disabled={valIdx === 0}
                    className={`text-[8px] text-[#606060] ${valIdx === 0 ? 'opacity-30' : 'hover:text-[#404040] cursor-pointer'}`}
                  >▲</button>
                  <button
                    onClick={() => moveValue(dim.id, valIdx, valIdx + 1)}
                    disabled={valIdx === dim.values.length - 1}
                    className={`text-[8px] text-[#606060] ${valIdx === dim.values.length - 1 ? 'opacity-30' : 'hover:text-[#404040] cursor-pointer'}`}
                  >▼</button>
                </div>
                <input
                  value={val.label}
                  onChange={(e) => updateValue(dim.id, val.id, { label: e.target.value, promptFragment: val.promptFragment || e.target.value })}
                  placeholder="label"
                  className="w-[80px] bg-[#f0f0f0] border border-[#808080] px-1.5 py-0.5 text-[10px] text-[#404040] focus:outline-none focus:border-[#c73e3e]"
                  style={{ fontFamily: 'Courier New, Courier, monospace' }}
                />
                <input
                  value={val.promptFragment}
                  onChange={(e) => updateValue(dim.id, val.id, { promptFragment: e.target.value })}
                  placeholder="text that replaces the placeholder"
                  className="flex-1 bg-[#f0f0f0] border border-[#808080] px-1.5 py-0.5 text-[10px] text-[#404040] focus:outline-none focus:border-[#c73e3e]"
                  style={{ fontFamily: 'Courier New, Courier, monospace' }}
                />
                <button
                  onClick={() => removeValue(dim.id, val.id)}
                  className="text-[#909090] hover:text-[#c73e3e] text-[12px] px-0.5"
                >×</button>
              </div>
            ))}

            {dim.values.length === 0 && (
              <div className="text-[9px] text-[#b0b0b0] px-1 mb-1">
                No values yet — add values or use Quick Fill to paste a list
              </div>
            )}

            <div className="flex gap-1 mt-1">
              <button onClick={() => addValue(dim.id)} className={`${btnSmall} flex-1`}>
                + ADD VALUE
              </button>
              <button
                onClick={() => setQuickFillDimId(quickFillDimId === dim.id ? null : dim.id)}
                className={`${btnSmall} flex-1`}
              >
                QUICK FILL
              </button>
            </div>

            {quickFillDimId === dim.id && (
              <div className="mt-1.5 bg-[#f0f0f0] border border-[#808080] p-2">
                <div className="text-[9px] text-[#606060] mb-1">
                  Paste values separated by commas or newlines.
                  Each becomes both a label and prompt text.
                </div>
                <textarea
                  value={quickFillText}
                  onChange={(e) => setQuickFillText(e.target.value)}
                  placeholder={"sunny\nrainy\nsnowy"}
                  className={`${inputClass} h-16 text-[10px]`}
                  autoFocus
                />
                <button
                  onClick={() => handleQuickFill(dim.id)}
                  className={`${btnSmall} w-full mt-1`}
                >
                  ADD ALL
                </button>
              </div>
            )}
          </div>
        ))}

        <button onClick={addDimension} className={`${btnSmall} w-full`}>
          + ADD DIMENSION
        </button>
      </div>

      {/* ── STEP 2: Template ─────────────────────────────────── */}
      {dimensions.length > 0 && (
        <div>
          <label className={labelClass}>
            {dimNames.length === 0 ? '2. NAME YOUR DIMENSIONS FIRST' : '2. PROMPT TEMPLATE'}
          </label>
          {dimNames.length > 0 ? (
            <>
              <div className="text-[9px] text-[#808080] mb-1">
                Available placeholders:{' '}
                {dimNames.map(n => (
                  <span key={n} className="text-[#404040] bg-[#e0e0e0] px-1 mx-0.5 border border-[#d0d0d0]">
                    {'{' + n + '}'}
                  </span>
                ))}
                <span className="text-[#404040] bg-[#e0e0e0] px-1 mx-0.5 border border-[#d0d0d0]">
                  {'{input}'}
                </span>
              </div>
              <textarea
                value={template}
                onChange={(e) => setLocalData({ ...localData, promptTemplate: e.target.value })}
                className={`${inputClass} h-20`}
                placeholder={`e.g. A {${dimNames[0]}} scene${dimNames[1] ? ` in {${dimNames[1]}} style` : ''}`}
              />
              {unmatched.length > 0 && (
                <div className="text-[9px] text-[#c73e3e] mt-1">
                  Unknown: {unmatched.map(p => `{${p}}`).join(', ')} — check spelling
                </div>
              )}
              {examplePrompt && (
                <div className="text-[9px] mt-1.5 bg-[#e8e8e8] border border-[#d0d0d0] p-2">
                  <span className="text-[#909090]">First cell will be: </span>
                  <span className="text-[#404040]">{examplePrompt}</span>
                </div>
              )}
              {!template && dimNames.length > 0 && (
                <div className="text-[9px] text-[#808080] mt-1">
                  No template set — values will be concatenated with spaces
                </div>
              )}
            </>
          ) : (
            <div className="text-[9px] text-[#b0b0b0]">
              Give each dimension a name above, then write a template here using those names as {'{'}<span className="text-[#c73e3e]">placeholders</span>{'}'}.
            </div>
          )}
        </div>
      )}

      {/* ── Prompt Preview Panel ─────────────────────────────── */}
      {total > 0 && dimensions.every(d => d.values.length > 0) && (
        <MatrixPreviewPanel
          dimensions={dimensions}
          template={template}
          imageInputs={(localData.imageInputs || []) as ImageInput[]}
          connectedInputs={(localData.connectedInputs || []) as { index: number; nodeId: string; type: 'text' | 'image' }[]}
          allNodes={allNodes}
        />
      )}

      {/* ── STEP 3: Generation settings ──────────────────────── */}
      {total > 0 && (
        <div>
          <label className={labelClass}>3. GENERATION SETTINGS</label>
          <div className="bg-[#e8e8e8] border border-[#404040] p-2 space-y-2">
            <div>
              <span className="text-[9px] text-[#606060] block mb-0.5">MODEL</span>
              <select
                value={model}
                onChange={(e) => {
                  const newModel = e.target.value;
                  const validRatios = getAspectRatiosForModel(newModel);
                  const updates: Record<string, unknown> = { ...localData, model: newModel };
                  if (aspectRatio && !validRatios.includes(aspectRatio)) {
                    updates.aspectRatio = '';
                  }
                  setLocalData(updates);
                }}
                className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-1 px-2 focus:outline-none focus:border-[#c73e3e]"
                style={{ fontFamily: 'Courier New, Courier, monospace' }}
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <span className="text-[9px] text-[#606060] block mb-0.5">RATIO</span>
                <select
                  value={aspectRatio}
                  onChange={(e) => setLocalData({ ...localData, aspectRatio: e.target.value })}
                  className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-1 px-1.5 focus:outline-none focus:border-[#c73e3e]"
                  style={{ fontFamily: 'Courier New, Courier, monospace' }}
                >
                  <option value="">Auto</option>
                  {availableRatios.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <span className="text-[9px] text-[#606060] block mb-0.5">SIZE</span>
                <select
                  value={imageSize}
                  onChange={(e) => setLocalData({ ...localData, imageSize: e.target.value })}
                  className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-1 px-1.5 focus:outline-none focus:border-[#c73e3e]"
                  style={{ fontFamily: 'Courier New, Courier, monospace' }}
                >
                  <option value="">Auto</option>
                  {IMAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="w-[70px]">
                <span className="text-[9px] text-[#606060] block mb-0.5">PARALLEL</span>
                <select
                  value={concurrency}
                  onChange={(e) => setLocalData({ ...localData, concurrency: parseInt(e.target.value, 10) })}
                  className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-1 px-1 focus:outline-none focus:border-[#c73e3e]"
                  style={{ fontFamily: 'Courier New, Courier, monospace' }}
                >
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="text-[8px] text-[#909090] pt-1">
              Save changes below, then hit GENERATE on the node.
            </div>
          </div>
        </div>
      )}

      {/* ── Image Input Ordering ────────────────────────────── */}
      {(() => {
        const matrixImageInputs = (localData.imageInputs || []) as ImageInput[];
        if (matrixImageInputs.length === 0) return null;

        const swapMatrixImages = (index1: number, index2: number) => {
          const current = [...matrixImageInputs];
          if (index2 < 0 || index2 >= current.length) return;
          const temp = current[index1];
          current[index1] = current[index2];
          current[index2] = temp;
          const newInputs = current.map((input, idx) => ({ ...input, index: idx }));
          setLocalData({ ...localData, imageInputs: newInputs });
        };

        return (
          <div>
            <label className={labelClass}>IMAGE INPUT ORDER</label>
            <div className="bg-[#e8e8e8] border border-[#404040] p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-[#606060]">DRAG OR USE ARROWS TO REORDER</span>
                <span className="text-[10px] bg-[#c73e3e] text-[#f0f0f0] px-2 py-0.5">
                  {matrixImageInputs.length} IMAGE{matrixImageInputs.length !== 1 ? 'S' : ''}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                {matrixImageInputs.map((input, idx) => {
                  const imageUrl = findImageUrl(input.nodeId, allNodes);
                  return (
                    <div
                      key={input.nodeId}
                      className="flex-shrink-0 w-[80px] bg-[#f0f0f0] border border-[#404040]"
                    >
                      <div className="bg-[#d0d0d0] px-1 py-0.5 text-[9px] text-[#404040] border-b border-[#404040] text-center">
                        [{idx + 1}]
                      </div>
                      <div
                        className="h-[60px] flex items-center justify-center bg-[#e8e8e8] overflow-hidden"
                        onClick={() => { if (imageUrl) openImagePreview(imageUrl); }}
                        style={{ cursor: imageUrl ? 'pointer' : undefined }}
                      >
                        {imageUrl ? (
                          <img src={imageUrl} alt={`Image ${idx + 1}`} className="w-full h-full object-cover hover:brightness-90 transition-[filter]" />
                        ) : (
                          <span className="text-[8px] text-[#909090]">NO IMG</span>
                        )}
                      </div>
                      <div className="flex border-t border-[#404040]">
                        <button
                          onClick={() => swapMatrixImages(idx, idx - 1)}
                          disabled={idx === 0}
                          className={`flex-1 ${btnSmall} ${idx === 0 ? 'opacity-30' : ''} border-r border-[#404040]`}
                        >
                          ←
                        </button>
                        <button
                          onClick={() => swapMatrixImages(idx, idx + 1)}
                          disabled={idx === matrixImageInputs.length - 1}
                          className={`flex-1 ${btnSmall} ${idx === matrixImageInputs.length - 1 ? 'opacity-30' : ''}`}
                        >
                          →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[9px] text-[#606060] pt-2 border-t border-[#d0d0d0] space-y-1">
                <div><strong>[1] PRIMARY</strong> - Base image for editing</div>
                <div><strong>[2+]</strong> - Additional reference images</div>
                <div className="text-[#c73e3e]">All {matrixImageInputs.length} images sent to every cell</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bulk actions */}
      {cells.length > 0 && (
        <div>
          <label className={labelClass}>ACTIONS</label>
          <div className="flex gap-1">
            {cells.some(c => c.status === 'failed') && (
              <button onClick={handleRegenerateFailed} className={`${btnSmall} flex-1`}>
                RETRY FAILED
              </button>
            )}
            {cells.some(c => c.status === 'completed') && (
              <button onClick={handleClearResults} className={`${btnSmall} flex-1`}>
                CLEAR ALL
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results grid */}
      {completedCells.length > 0 && dim0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass} style={{ marginBottom: 0 }}>
              RESULTS ({completedCells.length}/{cells.length})
            </label>
            <button
              onClick={() => openMatrixGallery(dimensions, cells)}
              className="bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] px-2 py-0.5 text-[9px] border border-[#404040] transition-colors"
            >
              OPEN GALLERY
            </button>
          </div>

          {dimensions.length > 2 && (
            <div className="mb-2 flex gap-1 flex-wrap">
              {dimensions.slice(2).map((dim, sliceIdx) => (
                <div key={dim.id} className="flex items-center gap-1">
                  <span className="text-[9px] text-[#606060]">{dim.name.toUpperCase()}:</span>
                  <select
                    value={sliceIndices[sliceIdx] ?? 0}
                    onChange={(e) => {
                      const newSlices = [...sliceIndices];
                      newSlices[sliceIdx] = parseInt(e.target.value, 10);
                      setSliceIndices(newSlices);
                    }}
                    className="bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[9px] py-0.5 px-1 focus:outline-none focus:border-[#c73e3e]"
                    style={{ fontFamily: 'Courier New, Courier, monospace' }}
                  >
                    {dim.values.map((v, vi) => (
                      <option key={v.id} value={vi}>{v.label || vi}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-auto max-h-[400px]" style={{ scrollbarWidth: 'thin' }}>
            {dim1 ? (
              <table className="border-collapse w-full">
                <thead>
                  <tr>
                    <th className="text-[8px] text-[#909090] p-1"></th>
                    {dim1.values.map((v, ci) => (
                      <th key={v.id} className="text-[8px] text-[#606060] p-1 text-center font-normal">
                        {v.label || ci}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dim0.values.map((rowVal, ri) => (
                    <tr key={rowVal.id}>
                      <td className="text-[8px] text-[#606060] p-1 font-normal whitespace-nowrap">
                        {rowVal.label || ri}
                      </td>
                      {dim1.values.map((_, ci) => {
                        const cell = getCellForGrid(ri, ci);
                        return (
                          <td key={ci} className="p-0.5">
                            {cell?.imageUrl ? (
                              <img
                                src={cell.imageUrl}
                                alt={cell.prompt}
                                title={cell.prompt}
                                className="w-full h-[50px] object-cover border border-[#d0d0d0] cursor-pointer hover:brightness-90 transition-[filter]"
                                onClick={() => openImagePreview(cell.imageUrl!, cell.prompt)}
                              />
                            ) : (
                              <div
                                className="w-full h-[50px] flex items-center justify-center border border-[#d0d0d0]"
                                style={{
                                  backgroundColor: cell?.status === 'failed' ? '#fde8e8' : cell?.status === 'generating' ? '#fef3cd' : '#f0f0f0',
                                }}
                              >
                                <span className="text-[7px] text-[#909090]">
                                  {cell?.status === 'failed' ? 'FAIL' : cell?.status === 'generating' ? 'GEN' : '—'}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex gap-1 overflow-x-auto">
                {dim0.values.map((val, ri) => {
                  const cell = getCellForGrid(ri, 0);
                  return (
                    <div key={val.id} className="flex-shrink-0 w-[60px]">
                      <div className="text-[8px] text-[#606060] text-center mb-0.5 truncate" title={val.label}>
                        {val.label || ri}
                      </div>
                      {cell?.imageUrl ? (
                        <img
                          src={cell.imageUrl}
                          alt={cell.prompt}
                          title={cell.prompt}
                          className="w-full h-[60px] object-cover border border-[#d0d0d0] cursor-pointer hover:brightness-90 transition-[filter]"
                          onClick={() => openImagePreview(cell.imageUrl!, cell.prompt)}
                        />
                      ) : (
                        <div
                          className="w-full h-[60px] flex items-center justify-center border border-[#d0d0d0]"
                          style={{
                            backgroundColor: cell?.status === 'failed' ? '#fde8e8' : cell?.status === 'generating' ? '#fef3cd' : '#f0f0f0',
                          }}
                        >
                          <span className="text-[7px] text-[#909090]">
                            {cell?.status === 'failed' ? 'FAIL' : cell?.status === 'generating' ? 'GEN' : '—'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass} style={{ marginBottom: 0 }}>
              HISTORY ({history.length})
            </label>
            <button
              onClick={() => setLocalData({ ...localData, history: [] })}
              className="text-[9px] text-[#909090] hover:text-[#c73e3e]"
            >
              CLEAR
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {history.map((entry, idx) => {
              const entryCompleted = (entry.cells || []).filter(c => c.status === 'completed' && c.imageUrl);
              const previewImages = entryCompleted.slice(0, 4);
              return (
                <div key={idx} className="bg-[#e8e8e8] border border-[#d0d0d0]">
                  {/* Thumbnail strip */}
                  {previewImages.length > 0 && (
                    <div className="flex gap-[1px] bg-[#1a1a1a]">
                      {previewImages.map((cell, ci) => (
                        <div key={ci} className="flex-1 min-w-0">
                          <img
                            src={cell.imageUrl}
                            alt=""
                            className="w-full h-[40px] object-cover cursor-pointer hover:brightness-90 transition-[filter]"
                            onClick={() => openImagePreview(cell.imageUrl!, cell.prompt)}
                          />
                        </div>
                      ))}
                      {entryCompleted.length > 4 && (
                        <div className="flex items-center justify-center w-[30px] text-[8px] text-[#606060] bg-[#1a1a1a]">
                          +{entryCompleted.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Info + actions */}
                  <div className="px-2 py-1.5 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-[#909090]">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-[9px] text-[#606060]">
                        {entryCompleted.length}/{entry.cells.length} images
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openMatrixGallery(dimensions, entry.cells)}
                        className="text-[9px] text-[#606060] hover:text-[#404040] border border-[#d0d0d0] px-1.5 py-0.5"
                      >
                        VIEW
                      </button>
                      <button
                        onClick={() => {
                          // Restore: swap current cells into history, put this entry's cells as current
                          const currentCompleted = cells.filter(c => c.status === 'completed' && c.imageUrl);
                          const newHistory = [...history];
                          newHistory.splice(idx, 1);
                          if (currentCompleted.length > 0) {
                            newHistory.unshift({ cells, timestamp: Date.now() });
                          }
                          setLocalData({ ...localData, cells: entry.cells, history: newHistory });
                        }}
                        className="text-[9px] text-[#c73e3e] hover:text-[#b53535] border border-[#c73e3e] px-1.5 py-0.5"
                      >
                        RESTORE
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi Image Editor Sub-component ────────────────────────────────────────

interface MultiImageResult {
  inputImageUrl: string;
  outputImageUrl: string;
  prompt: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
}

interface MultiImageHistoryEntry {
  results: MultiImageResult[];
  prompt: string;
  timestamp: number;
}

function MultiImageEditor({
  localData,
  setLocalData,
  allNodes,
}: {
  localData: Record<string, unknown>;
  setLocalData: (d: Record<string, unknown>) => void;
  allNodes: Node[];
}) {
  const labelClass = "text-[10px] text-[#606060] mb-1 block";

  const uploadedImages = (localData.uploadedImages || []) as { imageUrl: string; filename: string; timestamp: number }[];
  const results = (localData.results || []) as MultiImageResult[];
  const history = (localData.history || []) as MultiImageHistoryEntry[];
  const completedResults = results.filter(r => r.status === 'completed');
  const failedResults = results.filter(r => r.status === 'failed');

  return (
    <div className="space-y-3">
      <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
        <div className="text-[10px] text-[#606060] mb-2">HOW IT WORKS</div>
        <ul className="text-[11px] text-[#404040] space-y-1">
          <li>• Upload images or chain from another multi-image node</li>
          <li>• Each image is processed <strong>individually</strong> with the same prompt</li>
          <li>• Output: one generated image per input (1:1)</li>
          <li>• Chain outputs into another multi-image node for multi-step edits</li>
        </ul>
      </div>

      {/* Uploaded Images Management */}
      <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[#606060]">UPLOADED IMAGES</span>
          <span className="text-[10px] bg-[#c73e3e] text-[#f0f0f0] px-2 py-0.5">
            {uploadedImages.length} IMAGE{uploadedImages.length !== 1 ? 'S' : ''}
          </span>
        </div>

        {uploadedImages.length > 0 ? (
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              {uploadedImages.map((img, idx) => (
                <div key={`${img.filename}-${idx}`} className="relative w-[80px] bg-[#f0f0f0] border border-[#404040]">
                  <div className="bg-[#d0d0d0] px-1 py-0.5 text-[9px] text-[#404040] border-b border-[#404040] text-center truncate" title={img.filename}>
                    [{idx + 1}]
                  </div>
                  <div
                    className="h-[60px] overflow-hidden cursor-pointer hover:brightness-90 transition-[filter]"
                    onClick={() => openImagePreview(img.imageUrl)}
                  >
                    <img src={img.imageUrl} alt={img.filename} className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => {
                      const newImages = uploadedImages.filter((_, i) => i !== idx);
                      setLocalData({ ...localData, uploadedImages: newImages });
                    }}
                    className="w-full text-[9px] text-[#c73e3e] hover:bg-[#c73e3e] hover:text-white border-t border-[#404040] py-0.5 transition-colors"
                  >
                    REMOVE
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocalData({ ...localData, uploadedImages: [] })}
              className="text-[9px] text-[#909090] hover:text-[#c73e3e]"
            >
              CLEAR ALL
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-[#909090]">NO IMAGES UPLOADED (upload via node or chain input)</div>
        )}
      </div>

      {/* Results — Input/Output Side by Side */}
      {completedResults.length > 0 && (
        <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[#606060]">
              RESULTS: {completedResults.length} COMPLETED
              {failedResults.length > 0 && <span className="text-[#c73e3e]"> / {failedResults.length} FAILED</span>}
            </span>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {results.filter(r => r.status === 'completed').map((r, idx) => (
              <div key={idx} className="flex gap-1 bg-[#f0f0f0] border border-[#d0d0d0]">
                <div className="w-1/2 h-[60px] overflow-hidden border-r border-[#d0d0d0]">
                  <img
                    src={r.inputImageUrl}
                    alt={`Input ${idx + 1}`}
                    className="w-full h-full object-cover cursor-pointer hover:brightness-90 transition-[filter]"
                    onClick={() => openImagePreview(r.inputImageUrl)}
                  />
                </div>
                <div className="w-1/2 h-[60px] overflow-hidden">
                  <img
                    src={r.outputImageUrl}
                    alt={`Output ${idx + 1}`}
                    className="w-full h-full object-cover cursor-pointer hover:brightness-90 transition-[filter]"
                    onClick={() => openImagePreview(r.outputImageUrl, r.prompt)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 text-[9px] text-[#909090]">LEFT: INPUT → RIGHT: OUTPUT</div>
        </div>
      )}

      {/* Generation History */}
      {history.length > 0 && (
        <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[#606060]">
              HISTORY ({history.length} BATCH{history.length !== 1 ? 'ES' : ''})
            </span>
            <button
              onClick={() => setLocalData({ ...localData, history: [] })}
              className="text-[9px] text-[#909090] hover:text-[#c73e3e]"
            >
              CLEAR
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {history.map((entry, idx) => {
              const entryCompleted = entry.results.filter(r => r.status === 'completed');
              return (
                <div key={idx} className="bg-[#f0f0f0] border border-[#d0d0d0] p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-[#909090]">
                      {new Date(entry.timestamp).toLocaleTimeString()} — {entryCompleted.length} images
                    </span>
                    <button
                      onClick={() => {
                        // Restore this history entry
                        const currentHistory = [...history];
                        currentHistory.splice(idx, 1);
                        // Push current results to history if they exist
                        if (completedResults.length > 0) {
                          currentHistory.unshift({
                            results,
                            prompt: String(localData.prompt || ''),
                            timestamp: Date.now(),
                          });
                        }
                        const restoredCompleted = entryCompleted;
                        const generatedImages = restoredCompleted.map(r => ({
                          imageUrl: r.outputImageUrl,
                          prompt: r.prompt,
                          timestamp: entry.timestamp,
                        }));
                        setLocalData({
                          ...localData,
                          results: entry.results,
                          generatedImageUrl: generatedImages.length > 0 ? generatedImages[0].imageUrl : undefined,
                          generatedImages,
                          selectedImageIndex: 0,
                          prompt: entry.prompt,
                          history: currentHistory,
                        });
                      }}
                      className="text-[9px] text-[#c73e3e] hover:text-[#b53535] border border-[#c73e3e] px-1.5 py-0.5"
                    >
                      RESTORE
                    </button>
                  </div>
                  {entry.prompt && (
                    <div className="text-[9px] text-[#606060] truncate" title={entry.prompt}>
                      {entry.prompt}
                    </div>
                  )}
                  {/* Thumbnail strip of outputs */}
                  <div className="flex gap-0.5 mt-1 flex-wrap">
                    {entryCompleted.slice(0, 8).map((r, rIdx) => (
                      <div
                        key={rIdx}
                        className="w-[32px] h-[32px] border border-[#d0d0d0] overflow-hidden cursor-pointer hover:brightness-90"
                        onClick={() => openImagePreview(r.outputImageUrl, r.prompt)}
                      >
                        <img src={r.outputImageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {entryCompleted.length > 8 && (
                      <div className="w-[32px] h-[32px] border border-[#d0d0d0] flex items-center justify-center text-[8px] text-[#909090]">
                        +{entryCompleted.length - 8}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Matrix Preview Panel ────────────────────────────────────────────────────

// Walk upstream text nodes synchronously to resolve input text for preview.
// Uses cached node data (lastResult for modify, text for base, textToAppend for append).
// This is a best-effort preview — the real evaluation happens at generation time.
function resolveUpstreamText(nodeId: string, allNodes: Node[], visited: Set<string> = new Set()): string {
  if (visited.has(nodeId)) return '';
  visited.add(nodeId);

  const node = allNodes.find(n => n.id === nodeId);
  if (!node) return '';

  switch (node.type) {
    case 'basePrompt':
      return String(node.data.text || '');
    case 'modifyPrompt':
      // Use cached lastResult if available, otherwise show instruction as hint
      if (node.data.lastResult) return String(node.data.lastResult);
      return String(node.data.instruction || '') ? `[modified: ${String(node.data.instruction).slice(0, 40)}...]` : '';
    case 'appendPrompt':
      return String(node.data.textToAppend || '');
    default:
      return '';
  }
}

function resolveInputTextForPreview(
  connectedInputs: { index: number; nodeId: string; type: 'text' | 'image' }[],
  allNodes: Node[]
): string {
  const textInputs = connectedInputs.filter(i => i.type === 'text');
  if (textInputs.length === 0) return '';

  const texts: string[] = [];
  for (const input of textInputs) {
    const text = resolveUpstreamText(input.nodeId, allNodes);
    if (text) texts.push(text);
  }
  return texts.join(' ');
}

function MatrixPreviewPanel({
  dimensions,
  template,
  imageInputs,
  connectedInputs,
  allNodes,
}: {
  dimensions: MatrixDimension[];
  template: string;
  imageInputs: { index: number; nodeId: string }[];
  connectedInputs: { index: number; nodeId: string; type: 'text' | 'image' }[];
  allNodes: Node[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const total = totalCombinations(dimensions);
  const seqDim = dimensions.find(d => d.sequential);
  const seqDimIdx = dimensions.findIndex(d => d.sequential);

  // Resolve input text from connected text nodes
  const inputText = resolveInputTextForPreview(connectedInputs, allNodes);
  const displayInputText = inputText || '{input}';

  // Compute all cells using resolved input text
  const previewCells = computeCells(dimensions, template, displayInputText, []);
  const chains = groupIntoChains(previewCells, dimensions);

  // Collect image input previews
  const imageUrls: { nodeId: string; url: string | undefined }[] = imageInputs.map(inp => ({
    nodeId: inp.nodeId,
    url: findImageUrl(inp.nodeId, allNodes),
  }));

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between bg-[#d8d8d8] border border-[#404040] px-2 py-1.5 hover:bg-[#d0d0d0] transition-colors"
      >
        <span className="text-[10px] text-[#404040]">
          PREVIEW: {total} PROMPT{total !== 1 ? 'S' : ''}
          {seqDim && ` (${chains.length} chain${chains.length !== 1 ? 's' : ''})`}
        </span>
        <span className="text-[10px] text-[#909090]">{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen && (
        <div className="border border-t-0 border-[#404040] bg-[#f0f0f0]">
          {/* Base image inputs */}
          {imageUrls.length > 0 && (
            <div className="px-2 py-1.5 border-b border-[#d0d0d0]">
              <div className="text-[9px] text-[#606060] mb-1">
                BASE IMAGES — sent to {seqDim ? 'first cell in each chain' : 'every cell'}:
              </div>
              <div className="flex gap-1">
                {imageUrls.map((img, idx) => (
                  <div key={idx} className="w-[36px] h-[36px] border border-[#404040] bg-[#e8e8e8] overflow-hidden flex-shrink-0">
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={`Input ${idx + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:brightness-90 transition-[filter]"
                        onClick={() => { if (img.url) openImagePreview(img.url); }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[7px] text-[#909090]">?</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input text indicator */}
          {inputText && (
            <div className="px-2 py-1.5 border-b border-[#d0d0d0]">
              <div className="text-[9px] text-[#606060] mb-0.5">{'{input}'} RESOLVED TO:</div>
              <div className="text-[10px] text-[#404040] bg-[#e8e8e8] border border-[#d0d0d0] px-1.5 py-1 break-words leading-snug">
                {inputText}
              </div>
            </div>
          )}

          {!inputText && template.includes('{input}') && (
            <div className="px-2 py-1.5 border-b border-[#d0d0d0]">
              <div className="text-[9px] text-[#c73e3e]">
                Template uses {'{input}'} but no text node is connected
              </div>
            </div>
          )}

          {/* Chain view for sequential dimensions */}
          {seqDim ? (
            <div className="max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="px-2 py-1.5 border-b border-[#d0d0d0]">
                <div className="text-[9px] text-[#808080]">
                  Sequential on <strong className="text-[#404040]">{seqDim.name.toUpperCase()}</strong> — each cell&apos;s output image becomes input to the next cell in the chain
                </div>
              </div>
              {chains.map((chain, chainIdx) => {
                // Label the chain by its non-sequential coordinates
                const nonSeqLabels = dimensions
                  .map((dim, i) => {
                    if (i === seqDimIdx) return null;
                    const valIdx = chain[0].coordinates[i];
                    const val = dim.values[valIdx];
                    return val ? `${dim.name}=${val.label}` : null;
                  })
                  .filter(Boolean);

                return (
                  <div key={chainIdx} className={chainIdx > 0 ? 'border-t border-[#c0c0c0]' : ''}>
                    {nonSeqLabels.length > 0 && (
                      <div className="bg-[#e0e0e0] px-2 py-1 border-b border-[#d0d0d0] text-[9px] text-[#404040] font-normal">
                        CHAIN {chainIdx + 1}: {nonSeqLabels.join(', ')}
                      </div>
                    )}
                    {chain.map((cell, cellIdx) => {
                      const seqVal = seqDim.values[cell.coordinates[seqDimIdx]];
                      const isFirst = cellIdx === 0;
                      return (
                        <div key={cellIdx}>
                          {cellIdx > 0 && (
                            <div className="px-2 py-0.5 flex items-center gap-1">
                              <div className="flex-1 h-px bg-[#c73e3e] opacity-30"></div>
                              <span className="text-[8px] text-[#c73e3e]">↓ prev output + prompt</span>
                              <div className="flex-1 h-px bg-[#c73e3e] opacity-30"></div>
                            </div>
                          )}
                          <div className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[9px] bg-[#404040] text-[#f0f0f0] px-1 py-0.5 flex-shrink-0">
                                {seqVal?.label || '?'}
                              </span>
                              {/* Image indicators */}
                              <div className="flex gap-0.5">
                                {isFirst && imageUrls.length > 0 && (
                                  <span className="text-[8px] text-[#c73e3e] border border-[#c73e3e] px-1">
                                    {imageUrls.length} base img
                                  </span>
                                )}
                                {!isFirst && (
                                  <span className="text-[8px] text-[#c73e3e] border border-[#c73e3e] px-1">
                                    prev output{imageUrls.length > 0 ? ` + ${imageUrls.length} base` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] text-[#404040] leading-snug break-words bg-[#e8e8e8] border border-[#d0d0d0] px-1.5 py-1">
                              {cell.prompt}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Non-sequential: flat list of all cells */
            <div className="max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {previewCells.map((cell, idx) => {
                const coordLabel = dimensions.map((dim, i) => {
                  const val = dim.values[cell.coordinates[i]];
                  return val?.label || '?';
                }).join(' × ');

                return (
                  <div
                    key={idx}
                    className={`px-2 py-1.5 ${idx > 0 ? 'border-t border-[#d0d0d0]' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] text-[#909090] flex-shrink-0">
                        [{idx + 1}/{total}]
                      </span>
                      <span className="text-[9px] text-[#606060] truncate" title={coordLabel}>
                        {coordLabel}
                      </span>
                      {imageUrls.length > 0 && (
                        <span className="text-[8px] text-[#c73e3e] border border-[#c73e3e] px-1 flex-shrink-0">
                          {imageUrls.length} img
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#404040] leading-snug break-words bg-[#e8e8e8] border border-[#d0d0d0] px-1.5 py-1">
                      {cell.prompt}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
