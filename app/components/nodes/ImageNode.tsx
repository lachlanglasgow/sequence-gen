'use client';

import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { openImagePreview } from '../ImagePreviewModal';

// Available Gemini image generation models
export const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash (Default)', description: 'Fast, high quality' },
  { id: 'gemini-2.0-flash-exp-image-generation', name: 'Gemini 2.0 Flash Exp', description: 'Experimental' },
];

export const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';

// Aspect ratios available for all Gemini image models
const BASE_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
// Additional aspect ratios only for Gemini 3.1 Flash
const FLASH_31_EXTRA_RATIOS = ['1:4', '4:1', '1:8', '8:1'];

export function getAspectRatiosForModel(modelId: string): string[] {
  if (modelId === 'gemini-3.1-flash-image-preview') {
    return [...BASE_ASPECT_RATIOS, ...FLASH_31_EXTRA_RATIOS];
  }
  return BASE_ASPECT_RATIOS;
}

export const IMAGE_SIZES = ['1K', '2K', '4K'];

interface ConnectedInput {
  index: number;
  nodeId: string;
  type: 'text' | 'image';
}

interface ImageNodeProps {
  id: string;
  data: {
    isGenerating?: boolean;
    generatedImageUrl?: string;
    error?: string;
    prompt?: string;
    connectedInputs?: ConnectedInput[];
    imageInputs?: { index: number; nodeId: string }[]; // legacy, kept for compat
    inputImageCount?: number;
    model?: string;
    aspectRatio?: string;
    imageSize?: string;
    generateCount?: number;
    generatedImages?: { imageUrl: string; prompt: string; timestamp: number }[];
    selectedImageIndex?: number;
    history?: { imageUrl: string; prompt: string; timestamp: number }[];
  };
  selected?: boolean;
}

export const ImageNode = memo(({ id, data, selected }: ImageNodeProps) => {
  const handleDownload = () => {
    if (data.generatedImageUrl) {
      const link = document.createElement('a');
      link.href = data.generatedImageUrl;
      link.download = `generated-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleGenerate = () => {
    window.dispatchEvent(new CustomEvent('generateImage', { detail: { nodeId: id } }));
  };

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    // If current aspect ratio is not valid for new model, reset it
    const validRatios = getAspectRatiosForModel(newModel);
    const updates: Record<string, string | undefined> = { model: newModel };
    if (data.aspectRatio && !validRatios.includes(data.aspectRatio)) {
      updates.aspectRatio = undefined;
    }
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: updates }
    }));
  }, [id, data.aspectRatio]);

  const handleAspectRatioChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { aspectRatio: value || undefined } }
    }));
  }, [id]);

  const handleImageSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { imageSize: value || undefined } }
    }));
  }, [id]);

  const handleCountChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { generateCount: value } }
    }));
  }, [id]);

  const handleSelectImage = useCallback((index: number) => {
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { selectedImageIndex: index, generatedImageUrl: data.generatedImages?.[index]?.imageUrl } }
    }));
  }, [id, data.generatedImages]);

  const connectedInputs = data.connectedInputs || [];
  const maxInputs = 6;
  const currentModel = data.model || DEFAULT_MODEL;
  const textCount = connectedInputs.filter(i => i.type === 'text').length;
  const imageCount = connectedInputs.filter(i => i.type === 'image').length;
  const modelInfo = AVAILABLE_MODELS.find(m => m.id === currentModel);
  const availableRatios = getAspectRatiosForModel(currentModel);
  const currentAspectRatio = data.aspectRatio || '';
  const currentImageSize = data.imageSize || '';
  const generateCount = data.generateCount || 1;
  const generatedImages = data.generatedImages || [];
  const selectedImageIndex = data.selectedImageIndex || 0;
  const historyCount = (data.history || []).length;

  return (
    <div 
      className={`bg-[#e0e0e0] border ${selected ? 'border-[#c73e3e]' : 'border-[#404040]'} w-[300px]`}
      style={{ 
        fontFamily: 'Courier New, Courier, monospace',
        boxShadow: selected ? '0 0 0 1px #c73e3e' : 'none'
      }}
    >
      {/* Header */}
      <div className="bg-[#d0d0d0] px-3 py-1.5 border-b border-[#404040] flex items-center justify-between">
        <span className="text-[#404040] text-xs font-normal tracking-wider">
          IMAGE GENERATOR
        </span>
        {data.isGenerating && (
          <span className="text-[#c73e3e] text-xs animate-pulse">▮</span>
        )}
      </div>

      {/* Model Selector */}
      <div className="px-3 py-1.5 border-b border-[#404040] bg-[#e0e0e0]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[#606060] font-normal">MODEL</span>
          <span className="text-[9px] text-[#909090]" title={modelInfo?.description}>
            {modelInfo?.name.split('(')[0].trim()}
          </span>
        </div>
        <select
          value={currentModel}
          onChange={handleModelChange}
          disabled={data.isGenerating}
          className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-1 px-2 font-normal focus:outline-none focus:border-[#c73e3e] disabled:bg-[#d0d0d0] disabled:text-[#909090]"
          style={{ fontFamily: 'Courier New, Courier, monospace' }}
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {/* Aspect Ratio, Image Size & Count */}
      <div className="px-3 py-1.5 border-b border-[#404040] bg-[#e0e0e0] flex gap-2">
        <div className="flex-1">
          <span className="text-[10px] text-[#606060] font-normal block mb-0.5">RATIO</span>
          <select
            value={currentAspectRatio}
            onChange={handleAspectRatioChange}
            disabled={data.isGenerating}
            className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-1 px-1.5 font-normal focus:outline-none focus:border-[#c73e3e] disabled:bg-[#d0d0d0] disabled:text-[#909090]"
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
          >
            <option value="">Auto</option>
            {availableRatios.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <span className="text-[10px] text-[#606060] font-normal block mb-0.5">SIZE</span>
          <select
            value={currentImageSize}
            onChange={handleImageSizeChange}
            disabled={data.isGenerating}
            className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-1 px-1.5 font-normal focus:outline-none focus:border-[#c73e3e] disabled:bg-[#d0d0d0] disabled:text-[#909090]"
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
          >
            <option value="">Auto</option>
            {IMAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="w-[52px] flex-shrink-0">
          <span className="text-[10px] text-[#606060] font-normal block mb-0.5">QTY</span>
          <select
            value={generateCount}
            onChange={handleCountChange}
            disabled={data.isGenerating}
            className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-1 px-1 font-normal focus:outline-none focus:border-[#c73e3e] disabled:bg-[#d0d0d0] disabled:text-[#909090]"
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Inputs */}
      <div className="border-b border-[#404040] bg-[#e8e8e8] px-3 py-1 flex items-center justify-between">
        <span className="text-[10px] text-[#606060] font-normal">
          INPUTS: {connectedInputs.length > 0
            ? `${textCount > 0 ? `${textCount}T` : ''}${textCount > 0 && imageCount > 0 ? ' ' : ''}${imageCount > 0 ? `${imageCount}I` : ''}`
            : 'NONE'}
        </span>
        <span className="text-[9px] text-[#909090]">MAX {maxInputs}</span>

        {/* Universal input handles - color based on connected source type */}
        {Array.from({ length: maxInputs }).map((_, idx) => {
          const input = connectedInputs.find(i => i.index === idx);
          const isConnected = !!input;
          // gray (#808080) for text, red (#c73e3e) for image, dim for unconnected
          const bgColor = input?.type === 'text' ? '#808080' : input?.type === 'image' ? '#c73e3e' : '#808080';
          return (
            <Handle
              key={`input-${idx}`}
              type="target"
              position={Position.Left}
              id={`input-${idx}`}
              className="!w-2 !h-2 !border !border-[#404040] !rounded-none"
              style={{
                position: 'absolute',
                left: '4px',
                top: `${72 + (idx * 14)}px`,
                opacity: isConnected ? 1 : 0.3,
                backgroundColor: bgColor,
              }}
            />
          );
        })}
      </div>
      
      {/* Image Display */}
      <div className="bg-[#f0f0f0] min-h-[120px] flex items-center justify-center border-b border-[#404040]">
        {data.isGenerating ? (
          <div className="flex flex-col items-center py-8">
            <div className="text-[#c73e3e] text-xs animate-pulse mb-2">
              PROCESSING{generateCount > 1 ? ` ${generateCount} IMAGES` : ''}...
            </div>
            <div className="w-24 h-px bg-[#c73e3e] animate-pulse"></div>
          </div>
        ) : data.generatedImageUrl ? (
          <img
            src={data.generatedImageUrl}
            alt="Generated"
            className="w-full h-auto object-cover cursor-pointer hover:brightness-90 transition-[filter]"
            style={{ maxHeight: '160px' }}
            onClick={() => openImagePreview(data.generatedImageUrl!, data.prompt)}
          />
        ) : data.error ? (
          <div className="text-[#c73e3e] text-xs text-center p-4">
            ERROR: {data.error}
          </div>
        ) : (
          <div className="text-[#909090] text-xs text-center">
            NO DATA
          </div>
        )}
      </div>

      {/* Batch Image Strip - shown when multiple images generated */}
      {generatedImages.length > 1 && (
        <div className="px-2 py-1.5 border-b border-[#404040] bg-[#e8e8e8]">
          <div className="flex gap-1">
            {generatedImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => {
                  handleSelectImage(idx);
                  openImagePreview(img.imageUrl, img.prompt);
                }}
                className={`flex-1 h-[40px] border overflow-hidden ${
                  idx === selectedImageIndex
                    ? 'border-[#c73e3e] ring-1 ring-[#c73e3e]'
                    : 'border-[#808080] opacity-60 hover:opacity-100'
                } cursor-pointer`}
              >
                <img
                  src={img.imageUrl}
                  alt={`Variant ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Preview */}
      {data.prompt && (
        <div className="px-3 py-2 bg-[#e8e8e8] border-b border-[#404040]">
          <div className="text-[10px] text-[#606060] mb-1">PROMPT:</div>
          <div className="text-[11px] text-[#404040] line-clamp-2 font-normal">
            {data.prompt}
          </div>
        </div>
      )}
      
      {/* Generation Info */}
      {(data.inputImageCount !== undefined || historyCount > 0) && (
        <div className="px-3 py-1 bg-[#d0d0d0] border-b border-[#404040] flex items-center justify-between">
          {data.inputImageCount !== undefined && (
            <span className="text-[9px] text-[#606060]">
              USED {data.inputImageCount} IMAGE{data.inputImageCount !== 1 ? 'S' : ''}
            </span>
          )}
          {historyCount > 0 && (
            <span className="text-[9px] text-[#909090]">
              {historyCount} IN HISTORY
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-2 space-y-1">
        <button
          onClick={handleGenerate}
          disabled={data.isGenerating}
          className="w-full bg-[#d4d4d4] hover:bg-[#c8c8c8] disabled:bg-[#b0b0b0] text-[#303030] py-1.5 text-[11px] font-normal border border-[#404040] transition-colors"
          style={{ fontFamily: 'Courier New, Courier, monospace' }}
          title={connectedInputs.length > 0 ? `${textCount} text, ${imageCount} image input(s)` : 'No inputs connected'}
        >
          {data.isGenerating
            ? `PROCESSING${generateCount > 1 ? ` x${generateCount}` : ''}...`
            : `GENERATE${generateCount > 1 ? ` x${generateCount}` : ''}${connectedInputs.length > 0 ? ` (${connectedInputs.length})` : ''}`}
        </button>

        {data.generatedImageUrl && (
          <button
            onClick={() => openImagePreview(data.generatedImageUrl!, data.prompt)}
            className="w-full bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] py-1.5 text-[11px] font-normal border border-[#404040] transition-colors"
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
          >
            VIEW / DOWNLOAD
          </button>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        className="!w-2 !h-2 !bg-[#c73e3e] !border !border-[#404040] !rounded-none"
        style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
});

ImageNode.displayName = 'ImageNode';
