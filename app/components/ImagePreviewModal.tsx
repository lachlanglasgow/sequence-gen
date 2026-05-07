'use client';

import { useEffect, useCallback } from 'react';

interface ImagePreviewModalProps {
  imageUrl: string;
  prompt?: string;
  onClose: () => void;
  onDownload: () => void;
  onPopToNode: () => void;
}

export function ImagePreviewModal({ imageUrl, prompt, onClose, onDownload, onPopToNode }: ImagePreviewModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]"
      onClick={onClose}
      style={{ fontFamily: 'Courier New, Courier, monospace' }}
    >
      <div
        className="bg-[#e0e0e0] border border-[#404040] max-w-[90vw] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#d0d0d0] px-4 py-2 border-b border-[#404040] flex items-center justify-between flex-shrink-0">
          <span className="text-[#404040] text-xs font-normal tracking-wider">IMAGE PREVIEW</span>
          <button onClick={onClose} className="text-[#606060] hover:text-[#c73e3e] text-xs">
            ESC
          </button>
        </div>

        {/* Image */}
        <div className="overflow-auto flex-1 flex items-center justify-center bg-[#1a1a1a] p-2">
          <img
            src={imageUrl}
            alt="Preview"
            className="max-w-full max-h-[70vh] object-contain"
          />
        </div>

        {/* Prompt */}
        {prompt && (
          <div className="px-4 py-2 border-t border-[#404040] bg-[#e8e8e8] flex-shrink-0">
            <div className="text-[9px] text-[#909090] mb-0.5">PROMPT</div>
            <div className="text-[11px] text-[#404040] line-clamp-2">{prompt}</div>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 border-t border-[#404040] bg-[#d0d0d0] flex gap-2 flex-shrink-0">
          <button
            onClick={() => { onDownload(); onClose(); }}
            className="flex-1 bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] py-2 text-[11px] font-normal border border-[#404040] transition-colors"
          >
            DOWNLOAD
          </button>
          <button
            onClick={() => { onPopToNode(); onClose(); }}
            className="flex-1 bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] py-2 text-[11px] font-normal border border-[#404040] transition-colors"
          >
            POP INTO NEW NODE
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dispatch from anywhere to open the image preview modal */
export function openImagePreview(imageUrl: string, prompt?: string) {
  window.dispatchEvent(new CustomEvent('openImagePreview', {
    detail: { imageUrl, prompt },
  }));
}
