'use client';

import { memo, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { openImagePreview } from '../ImagePreviewModal';
import { AVAILABLE_MODELS, DEFAULT_MODEL, getAspectRatiosForModel, IMAGE_SIZES } from './ImageNode';

interface UploadedImage {
  imageUrl: string;
  filename: string;
  timestamp: number;
}

interface GeneratedResult {
  inputImageUrl: string;
  outputImageUrl: string;
  prompt: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
}

interface MultiImageNodeProps {
  id: string;
  data: {
    prompt?: string;
    uploadedImages?: UploadedImage[];
    isGenerating?: boolean;
    isUploading?: boolean;
    // Per-image results (1:1 with input images)
    results?: GeneratedResult[];
    completedCount?: number;
    totalCount?: number;
    // For output handle compatibility — set to first completed result
    generatedImageUrl?: string;
    // All output image URLs for downstream chaining
    generatedImages?: { imageUrl: string; prompt: string; timestamp: number }[];
    selectedImageIndex?: number;
    history?: { results: GeneratedResult[]; prompt: string; timestamp: number }[];
    error?: string;
    model?: string;
    aspectRatio?: string;
    imageSize?: string;
    concurrency?: number;
    // Upstream multi-image node connections
    upstreamMultiImageInputs?: { nodeId: string }[];
  };
  selected?: boolean;
}

export const MultiImageNode = memo(({ id, data, selected }: MultiImageNodeProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadedImages = (data.uploadedImages || []) as UploadedImage[];
  const results = (data.results || []) as GeneratedResult[];
  const currentModel = data.model || DEFAULT_MODEL;
  const modelInfo = AVAILABLE_MODELS.find(m => m.id === currentModel);
  const availableRatios = getAspectRatiosForModel(currentModel);
  const currentAspectRatio = data.aspectRatio || '';
  const currentImageSize = data.imageSize || '';
  const concurrency = data.concurrency || 3;
  const generatedImages = data.generatedImages || [];
  const selectedImageIndex = data.selectedImageIndex || 0;
  const historyCount = (data.history || []).length;
  const completedCount = data.completedCount || 0;
  const totalCount = data.totalCount || 0;
  const hasUpstream = ((data.upstreamMultiImageInputs || []) as { nodeId: string }[]).length > 0;
  const inputCount = uploadedImages.length + (hasUpstream ? '(+chained)' : '');

  const handleGenerate = () => {
    window.dispatchEvent(new CustomEvent('generateMultiImage', { detail: { nodeId: id } }));
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { isUploading: true } }
    }));

    const newImages: UploadedImage[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          newImages.push({
            imageUrl: result.imageUrl,
            filename: result.filename || file.name,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error('Upload error:', error);
      }
    }

    if (newImages.length > 0) {
      window.dispatchEvent(new CustomEvent('updateNodeData', {
        detail: {
          nodeId: id,
          data: {
            uploadedImages: [...uploadedImages, ...newImages],
            isUploading: false,
          }
        }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('updateNodeData', {
        detail: { nodeId: id, data: { isUploading: false } }
      }));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [id, uploadedImages]);

  const handleRemoveImage = useCallback((index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { uploadedImages: newImages } }
    }));
  }, [id, uploadedImages]);

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
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
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { aspectRatio: e.target.value || undefined } }
    }));
  }, [id]);

  const handleImageSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { imageSize: e.target.value || undefined } }
    }));
  }, [id]);

  const handleConcurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { concurrency: parseInt(e.target.value, 10) } }
    }));
  }, [id]);

  const handleSelectImage = useCallback((index: number) => {
    window.dispatchEvent(new CustomEvent('updateNodeData', {
      detail: { nodeId: id, data: { selectedImageIndex: index, generatedImageUrl: data.generatedImages?.[index]?.imageUrl } }
    }));
  }, [id, data.generatedImages]);

  const completedResults = results.filter(r => r.status === 'completed');
  const failedResults = results.filter(r => r.status === 'failed');

  return (
    <div
      className={`bg-[#e0e0e0] border ${selected ? 'border-[#c73e3e]' : 'border-[#404040]'} w-[300px]`}
      style={{
        fontFamily: 'Courier New, Courier, monospace',
        boxShadow: selected ? '0 0 0 1px #c73e3e' : 'none'
      }}
    >
      {/* Text input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        className="!w-2 !h-2 !bg-[#808080] !border !border-[#404040] !rounded-none"
        style={{ position: 'absolute', left: '4px', top: '14px' }}
      />

      {/* Image input handle (for chaining from another multi-image node) */}
      <Handle
        type="target"
        position={Position.Left}
        id="image-input"
        className="!w-2 !h-2 !bg-[#c73e3e] !border !border-[#404040] !rounded-none"
        style={{ position: 'absolute', left: '4px', top: '30px' }}
      />

      {/* Header */}
      <div className="bg-[#d0d0d0] px-3 py-1.5 border-b border-[#404040] flex items-center justify-between">
        <span className="text-[#404040] text-xs font-normal tracking-wider">
          MULTI IMAGE
        </span>
        <div className="flex items-center gap-2">
          {data.isUploading && (
            <span className="text-[#606060] text-[9px] animate-pulse">UPLOADING...</span>
          )}
          {data.isGenerating && (
            <span className="text-[#c73e3e] text-[9px] animate-pulse">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
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

      {/* Aspect Ratio, Image Size & Concurrency */}
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
          <span className="text-[10px] text-[#606060] font-normal block mb-0.5">PARA</span>
          <select
            value={concurrency}
            onChange={handleConcurrencyChange}
            disabled={data.isGenerating}
            className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-1 px-1 font-normal focus:outline-none focus:border-[#c73e3e] disabled:bg-[#d0d0d0] disabled:text-[#909090]"
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chained Input Indicator */}
      {hasUpstream && (
        <div className="border-b border-[#404040] bg-[#c73e3e] px-3 py-1.5">
          <span className="text-[10px] text-[#f0f0f0] font-normal">
            CHAINED — USING OUTPUT FROM UPSTREAM NODE
          </span>
        </div>
      )}

      {/* Uploaded Images Grid */}
      <div className="border-b border-[#404040] bg-[#e8e8e8] px-2 py-1.5">
        <div className="flex items-center justify-between px-1 mb-1.5">
          <span className="text-[10px] text-[#606060] font-normal">
            {hasUpstream ? 'ADDITIONAL UPLOADS' : 'IMAGES'}: {uploadedImages.length > 0 ? uploadedImages.length : 'NONE'}
          </span>
          <button
            onClick={handleUploadClick}
            disabled={data.isUploading || data.isGenerating}
            className="text-[9px] text-[#c73e3e] hover:text-[#b53535] disabled:text-[#909090]"
          >
            + ADD
          </button>
        </div>

        {uploadedImages.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {uploadedImages.map((img, idx) => (
              <div key={`${img.filename}-${idx}`} className="relative w-[56px] h-[56px] border border-[#404040] bg-[#f0f0f0] overflow-hidden group">
                <img
                  src={img.imageUrl}
                  alt={img.filename}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => openImagePreview(img.imageUrl)}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                  className="absolute top-0 right-0 w-3.5 h-3.5 bg-[#c73e3e] text-white text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : !hasUpstream ? (
          <div
            onClick={handleUploadClick}
            className="border border-dashed border-[#808080] py-4 text-center cursor-pointer hover:border-[#c73e3e] hover:bg-[#f0f0f0] transition-colors"
          >
            <div className="text-[10px] text-[#909090]">CLICK TO UPLOAD OR CHAIN INPUT</div>
            <div className="text-[9px] text-[#b0b0b0] mt-0.5">EACH IMAGE PROCESSED INDIVIDUALLY</div>
          </div>
        ) : null}
      </div>

      {/* Prompt Preview */}
      {data.prompt && (
        <div className="px-3 py-2 bg-[#e8e8e8] border-b border-[#404040]">
          <div className="text-[10px] text-[#606060] mb-1">PROMPT:</div>
          <div className="text-[11px] text-[#404040] line-clamp-2 font-normal">
            {data.prompt}
          </div>
        </div>
      )}

      {/* Results Grid — show completed outputs as a thumbnail grid */}
      {completedResults.length > 0 && (
        <div className="border-b border-[#404040] bg-[#f0f0f0] px-2 py-1.5">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[10px] text-[#606060]">
              OUTPUT: {completedResults.length}
              {failedResults.length > 0 && <span className="text-[#c73e3e]"> ({failedResults.length} FAILED)</span>}
            </span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {completedResults.map((r, idx) => (
              <div
                key={idx}
                className={`relative w-[56px] h-[56px] border overflow-hidden cursor-pointer hover:brightness-90 transition-[filter] ${
                  idx === selectedImageIndex ? 'border-[#c73e3e] ring-1 ring-[#c73e3e]' : 'border-[#404040]'
                }`}
                onClick={() => {
                  handleSelectImage(idx);
                  openImagePreview(r.outputImageUrl, data.prompt);
                }}
              >
                <img src={r.outputImageUrl} alt={`Output ${idx + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status when generating */}
      {data.isGenerating && (
        <div className="bg-[#f0f0f0] border-b border-[#404040] px-3 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[#c73e3e] text-[10px] animate-pulse">PROCESSING...</span>
            <span className="text-[10px] text-[#606060]">{completedCount}/{totalCount}</span>
          </div>
          <div className="w-full bg-[#d0d0d0] h-1.5">
            <div
              className="bg-[#c73e3e] h-full transition-all"
              style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {!data.isGenerating && data.error && completedResults.length === 0 && (
        <div className="bg-[#f0f0f0] border-b border-[#404040] px-3 py-3">
          <div className="text-[#c73e3e] text-xs text-center">
            ERROR: {data.error}
          </div>
        </div>
      )}

      {/* No output placeholder */}
      {!data.isGenerating && completedResults.length === 0 && !data.error && (
        <div className="bg-[#f0f0f0] border-b border-[#404040] px-3 py-4">
          <div className="text-[#909090] text-xs text-center">NO OUTPUT</div>
        </div>
      )}

      {/* Generation Info */}
      {historyCount > 0 && (
        <div className="px-3 py-1 bg-[#d0d0d0] border-b border-[#404040]">
          <span className="text-[9px] text-[#909090]">
            {historyCount} BATCH{historyCount !== 1 ? 'ES' : ''} IN HISTORY
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-2 space-y-1">
        <button
          onClick={handleGenerate}
          disabled={data.isGenerating || (uploadedImages.length === 0 && !hasUpstream)}
          className="w-full bg-[#d4d4d4] hover:bg-[#c8c8c8] disabled:bg-[#b0b0b0] text-[#303030] py-1.5 text-[11px] font-normal border border-[#404040] transition-colors"
          style={{ fontFamily: 'Courier New, Courier, monospace' }}
        >
          {data.isGenerating
            ? `PROCESSING ${completedCount}/${totalCount}...`
            : hasUpstream && uploadedImages.length === 0
              ? 'GENERATE CHAINED IMAGES'
              : `GENERATE (${uploadedImages.length}${hasUpstream ? ' + chained' : ''} IMG)`}
        </button>

        {completedResults.length > 0 && (
          <>
            <button
              onClick={() => openImagePreview(completedResults[selectedImageIndex]?.outputImageUrl || completedResults[0].outputImageUrl, data.prompt)}
              className="w-full bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] py-1.5 text-[11px] font-normal border border-[#404040] transition-colors"
              style={{ fontFamily: 'Courier New, Courier, monospace' }}
            >
              VIEW SELECTED
            </button>
            <button
              onClick={() => {
                completedResults.forEach((r, idx) => {
                  const link = document.createElement('a');
                  link.href = r.outputImageUrl;
                  link.download = `multi-img-${id}-${idx + 1}-${Date.now()}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                });
              }}
              className="w-full bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] py-1.5 text-[11px] font-normal border border-[#404040] transition-colors"
              style={{ fontFamily: 'Courier New, Courier, monospace' }}
            >
              DOWNLOAD ALL ({completedResults.length})
            </button>
          </>
        )}
      </div>

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
      />

      {/* Output Handle — outputs all generated images for chaining */}
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

MultiImageNode.displayName = 'MultiImageNode';
