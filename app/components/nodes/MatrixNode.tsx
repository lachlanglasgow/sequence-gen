'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { MatrixDimension, MatrixCell } from '../../types/matrix';
import { totalCombinations } from '../../lib/matrixUtils';
import { openMatrixGallery } from '../MatrixGalleryPanel';
import { openImagePreview } from '../ImagePreviewModal';

interface ConnectedInput {
  index: number;
  nodeId: string;
  type: 'text' | 'image';
}

interface MatrixNodeProps {
  id: string;
  data: {
    promptTemplate?: string;
    dimensions?: MatrixDimension[];
    cells?: MatrixCell[];
    isGenerating?: boolean;
    model?: string;
    aspectRatio?: string;
    imageSize?: string;
    concurrency?: number;
    connectedInputs?: ConnectedInput[];
    imageInputs?: { index: number; nodeId: string }[];
    history?: { cells: MatrixCell[]; timestamp: number }[];
  };
  selected?: boolean;
}

export const MatrixNode = memo(({ id, data, selected }: MatrixNodeProps) => {
  const dimensions = data.dimensions || [];
  const cells = data.cells || [];
  const total = totalCombinations(dimensions);
  const hasEmptyDimension = dimensions.some(d => d.values.length === 0);

  const completedCount = cells.filter(c => c.status === 'completed').length;
  const generatingCount = cells.filter(c => c.status === 'generating').length;
  const failedCount = cells.filter(c => c.status === 'failed').length;
  const pendingCount = cells.filter(c => c.status === 'pending').length;

  const completedCells = cells.filter(c => c.status === 'completed' && c.imageUrl);

  const connectedInputs = data.connectedInputs || [];
  const maxInputs = 6;
  const textCount = connectedInputs.filter(i => i.type === 'text').length;
  const imageCount = connectedInputs.filter(i => i.type === 'image').length;

  const handleGenerate = () => {
    window.dispatchEvent(new CustomEvent('generateMatrix', { detail: { nodeId: id } }));
  };

  const handleOpenGallery = () => {
    openMatrixGallery(dimensions, cells);
  };

  const isEmpty = dimensions.length === 0;

  // For thumbnail grid on the node: show up to 3x3 = 9 images as a preview
  const dim0 = dimensions[0];
  const dim1 = dimensions[1];
  const previewRows = dim0 ? Math.min(dim0.values.length, 3) : 0;
  const previewCols = dim1 ? Math.min(dim1.values.length, 4) : Math.min(completedCells.length, 4);

  const getCellForCoords = (row: number, col: number): MatrixCell | undefined => {
    return cells.find(c => {
      if (dimensions.length === 1) return c.coordinates[0] === row;
      return c.coordinates[0] === row && c.coordinates[1] === col;
    });
  };

  return (
    <div
      className={`bg-[#e0e0e0] border ${selected ? 'border-[#c73e3e]' : 'border-[#404040]'} w-[280px]`}
      style={{
        fontFamily: 'Courier New, Courier, monospace',
        boxShadow: selected ? '0 0 0 1px #c73e3e' : 'none',
      }}
    >
      {/* Universal input handles — color based on connected source type */}
      {Array.from({ length: maxInputs }).map((_, idx) => {
        const input = connectedInputs.find(i => i.index === idx);
        const isConnected = !!input;
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
              top: `${44 + (idx * 14)}px`,
              opacity: isConnected ? 1 : 0.3,
              backgroundColor: bgColor,
            }}
          />
        );
      })}

      {/* Header */}
      <div className="bg-[#d0d0d0] px-3 py-1.5 border-b border-[#404040] flex items-center justify-between">
        <span className="text-[#404040] text-xs font-normal tracking-wider">
          MATRIX
        </span>
        <span className="text-[10px] text-[#606060]">
          {completedCount > 0
            ? `${completedCount}/${total}`
            : total > 0
              ? `${total} CELL${total !== 1 ? 'S' : ''}`
              : ''}
        </span>
        {data.isGenerating && (
          <span className="text-[#c73e3e] text-xs animate-pulse">▮</span>
        )}
      </div>

      {/* Inputs indicator */}
      <div className="border-b border-[#404040] bg-[#e8e8e8] px-3 py-1 flex items-center justify-between">
        <span className="text-[10px] text-[#606060] font-normal">
          INPUTS: {connectedInputs.length > 0
            ? `${textCount > 0 ? `${textCount}T` : ''}${textCount > 0 && imageCount > 0 ? ' ' : ''}${imageCount > 0 ? `${imageCount}I` : ''}`
            : 'NONE'}
        </span>
        <span className="text-[9px] text-[#909090]">MAX {maxInputs}</span>
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="px-3 py-3 border-b border-[#404040] bg-[#e8e8e8]">
          <div className="text-[10px] text-[#404040] mb-1.5">Batch image generator</div>
          <div className="text-[9px] text-[#808080] leading-relaxed space-y-1">
            <div>Define dimensions of variation (e.g. &quot;weather&quot;, &quot;style&quot;) and this node generates every combination.</div>
            <div className="text-[#c73e3e] mt-2">Click this node to set up →</div>
          </div>
        </div>
      ) : (
        <>
          {/* Dimensions summary */}
          <div className="px-3 py-1.5 border-b border-[#404040] bg-[#e8e8e8]">
            <div className="text-[9px] text-[#606060] leading-relaxed">
              {dimensions.map((dim, i) => (
                <span key={dim.id}>
                  {i > 0 && <span className="text-[#909090]"> × </span>}
                  <span className="text-[#404040]">{dim.name.toUpperCase() || '?'}</span>
                  <span className="text-[#909090]">:{dim.values.length}</span>
                  {dim.sequential && <span className="text-[#c73e3e]"> →chain</span>}
                </span>
              ))}
              {total > 0 && <span className="text-[#404040]"> = {total}</span>}
            </div>
          </div>

          {/* Template preview */}
          {data.promptTemplate && (
            <div className="px-3 py-1.5 border-b border-[#404040] bg-[#e8e8e8]">
              <div className="text-[10px] text-[#404040] line-clamp-2">{data.promptTemplate}</div>
            </div>
          )}
        </>
      )}

      {/* Image thumbnail grid — shows actual generated images */}
      {completedCells.length > 0 && dim0 ? (
        <div className="border-b border-[#404040] bg-[#1a1a1a] p-1.5">
          {dim1 ? (
            /* 2D grid */
            <div className="space-y-[2px]">
              {Array.from({ length: previewRows }, (_, ri) => (
                <div key={ri} className="flex gap-[2px]">
                  {Array.from({ length: previewCols }, (_, ci) => {
                    const cell = getCellForCoords(ri, ci);
                    return (
                      <div key={ci} className="flex-1 min-w-0">
                        {cell?.imageUrl ? (
                          <img
                            src={cell.imageUrl}
                            alt=""
                            className="w-full h-[52px] object-cover cursor-pointer hover:brightness-110 transition-[filter]"
                            onClick={(e) => {
                              e.stopPropagation();
                              openImagePreview(cell.imageUrl!, cell.prompt);
                            }}
                          />
                        ) : (
                          <div
                            className="w-full h-[52px] flex items-center justify-center"
                            style={{
                              backgroundColor: cell?.status === 'generating' ? '#3a3520' :
                                cell?.status === 'failed' ? '#3a2020' : '#2a2a2a',
                            }}
                          >
                            <span className="text-[7px] text-[#505050]">
                              {cell?.status === 'generating' ? '...' : cell?.status === 'failed' ? '!' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Overflow indicator */}
              {(dim0.values.length > previewRows || dim1.values.length > previewCols) && (
                <div className="text-[8px] text-[#606060] text-center pt-0.5">
                  showing {previewRows}×{previewCols} of {dim0.values.length}×{dim1.values.length}
                </div>
              )}
            </div>
          ) : (
            /* 1D strip */
            <div className="flex gap-[2px]">
              {completedCells.slice(0, 4).map((cell, i) => (
                <div key={i} className="flex-1 min-w-0">
                  <img
                    src={cell.imageUrl}
                    alt=""
                    className="w-full h-[52px] object-cover cursor-pointer hover:brightness-110 transition-[filter]"
                    onClick={(e) => {
                      e.stopPropagation();
                      openImagePreview(cell.imageUrl!, cell.prompt);
                    }}
                  />
                </div>
              ))}
              {completedCells.length > 4 && (
                <div className="flex items-center justify-center w-[30px] text-[8px] text-[#606060]">
                  +{completedCells.length - 4}
                </div>
              )}
            </div>
          )}
        </div>
      ) : cells.length > 0 ? (
        /* Status-only grid (no images yet) */
        <div className="px-3 py-2 border-b border-[#404040] bg-[#f0f0f0]">
          <div className="flex flex-wrap gap-[2px]">
            {cells.slice(0, 100).map((cell, i) => {
              let bgColor = '#c0c0c0';
              if (cell.status === 'generating') bgColor = '#e8a020';
              if (cell.status === 'completed') bgColor = '#4caf50';
              if (cell.status === 'failed') bgColor = '#c73e3e';
              const sz = total > 60 ? 6 : total > 30 ? 8 : 10;
              return (
                <div
                  key={i}
                  style={{
                    width: sz,
                    height: sz,
                    backgroundColor: bgColor,
                    animation: cell.status === 'generating' ? 'pulse 1.5s ease-in-out infinite' : undefined,
                  }}
                />
              );
            })}
          </div>
          <div className="flex gap-2 mt-1.5 text-[9px]">
            {generatingCount > 0 && <span className="text-[#e8a020]">{generatingCount} gen</span>}
            {failedCount > 0 && <span className="text-[#c73e3e]">{failedCount} fail</span>}
            {pendingCount > 0 && <span className="text-[#909090]">{pendingCount} pending</span>}
          </div>
        </div>
      ) : null}

      {/* History indicator */}
      {(data.history || []).length > 0 && (
        <div className="px-3 py-1 bg-[#d0d0d0] border-b border-[#404040]">
          <span className="text-[9px] text-[#909090]">
            {(data.history || []).length} IN HISTORY
          </span>
        </div>
      )}

      {/* Buttons */}
      <div className="p-2 space-y-1">
        <button
          onClick={handleGenerate}
          disabled={data.isGenerating || total === 0 || hasEmptyDimension}
          className="w-full bg-[#d4d4d4] hover:bg-[#c8c8c8] disabled:bg-[#b0b0b0] text-[#303030] py-1.5 text-[11px] font-normal border border-[#404040] transition-colors"
          style={{ fontFamily: 'Courier New, Courier, monospace' }}
        >
          {data.isGenerating
            ? `GENERATING ${generatingCount}/${total}...`
            : total > 0
              ? `GENERATE ${total} IMAGE${total !== 1 ? 'S' : ''}`
              : 'SET UP DIMENSIONS FIRST'}
        </button>

        {completedCells.length > 0 && (
          <button
            onClick={handleOpenGallery}
            className="w-full bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] py-1.5 text-[11px] font-normal border border-[#404040] transition-colors"
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
          >
            VIEW GALLERY ({completedCells.length})
          </button>
        )}
      </div>
    </div>
  );
});

MatrixNode.displayName = 'MatrixNode';
