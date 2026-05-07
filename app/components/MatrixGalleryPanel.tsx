'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MatrixDimension, MatrixCell } from '../types/matrix';

interface MatrixGalleryPanelProps {
  dimensions: MatrixDimension[];
  cells: MatrixCell[];
  onClose: () => void;
}

export function MatrixGalleryPanel({ dimensions, cells, onClose }: MatrixGalleryPanelProps) {
  const [selectedCellIdx, setSelectedCellIdx] = useState<number | null>(null);
  const [sliceIndices, setSliceIndices] = useState<number[]>(() =>
    dimensions.length > 2 ? dimensions.slice(2).map(() => 0) : []
  );

  const dim0 = dimensions[0];
  const dim1 = dimensions[1];

  // Get the cell for a given row/col in the current slice
  const getCellForGrid = useCallback((row: number, col: number): MatrixCell | undefined => {
    return cells.find(c => {
      if (dimensions.length === 1) return c.coordinates[0] === row;
      if (dimensions.length === 2) return c.coordinates[0] === row && c.coordinates[1] === col;
      if (c.coordinates[0] !== row || c.coordinates[1] !== col) return false;
      return c.coordinates.slice(2).every((v, i) => v === (sliceIndices[i] ?? 0));
    });
  }, [cells, dimensions, sliceIndices]);

  // Flat list of visible cells for arrow-key navigation
  const visibleCells: MatrixCell[] = [];
  if (dim0) {
    for (let r = 0; r < dim0.values.length; r++) {
      const cols = dim1 ? dim1.values.length : 1;
      for (let c = 0; c < cols; c++) {
        const cell = getCellForGrid(r, c);
        if (cell) visibleCells.push(cell);
      }
    }
  }

  const selectedCell = selectedCellIdx !== null ? visibleCells[selectedCellIdx] : null;

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedCellIdx !== null) {
        setSelectedCellIdx(null);
      } else {
        onClose();
      }
      return;
    }
    if (selectedCellIdx === null) return;
    const cols = dim1 ? dim1.values.length : 1;
    let next = selectedCellIdx;
    if (e.key === 'ArrowRight') next = Math.min(selectedCellIdx + 1, visibleCells.length - 1);
    else if (e.key === 'ArrowLeft') next = Math.max(selectedCellIdx - 1, 0);
    else if (e.key === 'ArrowDown') next = Math.min(selectedCellIdx + cols, visibleCells.length - 1);
    else if (e.key === 'ArrowUp') next = Math.max(selectedCellIdx - cols, 0);
    else return;
    e.preventDefault();
    setSelectedCellIdx(next);
  }, [selectedCellIdx, visibleCells.length, dim1, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const completedCount = cells.filter(c => c.status === 'completed').length;
  const totalCount = cells.length;

  const handleDownload = useCallback((imageUrl: string, prompt: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `matrix-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Get dimension labels for a cell
  const getCellLabels = (cell: MatrixCell): string => {
    return cell.coordinates
      .map((coordIdx, dimIdx) => {
        const dim = dimensions[dimIdx];
        const val = dim?.values[coordIdx];
        return val ? `${dim.name}: ${val.label}` : '';
      })
      .filter(Boolean)
      .join(' / ');
  };

  if (!dim0) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex flex-col z-[100]"
      style={{ fontFamily: 'Courier New, Courier, monospace' }}
    >
      {/* Header bar */}
      <div className="bg-[#d0d0d0] px-4 py-2.5 border-b border-[#404040] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[#404040] text-xs tracking-wider">MATRIX GALLERY</span>
          <span className="text-[10px] text-[#606060]">
            {completedCount}/{totalCount} images
          </span>
          {/* Dimension summary */}
          <span className="text-[9px] text-[#808080]">
            {dimensions.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ' × '}
                {d.name.toUpperCase()}:{d.values.length}
              </span>
            ))}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {selectedCellIdx !== null && (
            <span className="text-[9px] text-[#808080]">← → ↑ ↓ to navigate</span>
          )}
          <button onClick={onClose} className="text-[#606060] hover:text-[#c73e3e] text-xs">
            ESC TO CLOSE
          </button>
        </div>
      </div>

      {/* Higher-dimension slice selector */}
      {dimensions.length > 2 && (
        <div className="bg-[#e0e0e0] px-4 py-2 border-b border-[#404040] flex gap-3 items-center flex-shrink-0">
          <span className="text-[9px] text-[#606060]">SLICE:</span>
          {dimensions.slice(2).map((dim, sliceIdx) => (
            <div key={dim.id} className="flex items-center gap-1">
              <span className="text-[10px] text-[#404040]">{dim.name.toUpperCase()}</span>
              <select
                value={sliceIndices[sliceIdx] ?? 0}
                onChange={(e) => {
                  const newSlices = [...sliceIndices];
                  newSlices[sliceIdx] = parseInt(e.target.value, 10);
                  setSliceIndices(newSlices);
                  setSelectedCellIdx(null);
                }}
                className="bg-[#f0f0f0] border border-[#808080] text-[#404040] text-[10px] py-0.5 px-2 focus:outline-none focus:border-[#c73e3e]"
                style={{ fontFamily: 'Courier New, Courier, monospace' }}
              >
                {dim.values.map((v, vi) => (
                  <option key={v.id} value={vi}>{v.label || `#${vi}`}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Main content area: grid + detail panel side by side */}
      <div className="flex-1 flex min-h-0">
        {/* Grid */}
        <div className="flex-1 overflow-auto p-4" style={{ scrollbarWidth: 'thin' }}>
          {dim1 ? (
            /* 2D grid: rows = dim0, cols = dim1 */
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-black/80 z-10 p-2 text-[10px] text-[#808080] font-normal text-left">
                    {dim0.name} ↓ / {dim1.name} →
                  </th>
                  {dim1.values.map((v) => (
                    <th key={v.id} className="sticky top-0 bg-black/80 z-10 p-2 text-[10px] text-[#d0d0d0] font-normal text-center min-w-[120px]">
                      {v.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dim0.values.map((rowVal, ri) => (
                  <tr key={rowVal.id}>
                    <td className="p-2 text-[10px] text-[#d0d0d0] font-normal whitespace-nowrap align-top sticky left-0 bg-black/80 z-[5]">
                      {rowVal.label}
                      {dim0.sequential && ri > 0 && (
                        <span className="text-[#c73e3e] ml-1">→</span>
                      )}
                    </td>
                    {dim1.values.map((_, ci) => {
                      const cell = getCellForGrid(ri, ci);
                      const flatIdx = visibleCells.indexOf(cell!);
                      const isSelected = flatIdx === selectedCellIdx;
                      return (
                        <td key={ci} className="p-1">
                          <div
                            className={`border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#c73e3e] shadow-[0_0_12px_rgba(199,62,62,0.5)]'
                                : 'border-transparent hover:border-[#808080]'
                            }`}
                            onClick={() => setSelectedCellIdx(flatIdx >= 0 ? flatIdx : null)}
                          >
                            {cell?.imageUrl ? (
                              <img
                                src={cell.imageUrl}
                                alt={cell.prompt}
                                className="w-full h-[120px] object-cover"
                              />
                            ) : (
                              <div
                                className="w-full h-[120px] flex items-center justify-center"
                                style={{
                                  backgroundColor: cell?.status === 'generating' ? '#3a3520' :
                                    cell?.status === 'failed' ? '#3a2020' : '#1a1a1a',
                                }}
                              >
                                <span className="text-[10px] text-[#606060]">
                                  {cell?.status === 'generating' ? 'GENERATING...' :
                                    cell?.status === 'failed' ? 'FAILED' : 'PENDING'}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* 1D: horizontal strip with larger images */
            <div className="flex gap-3 flex-wrap">
              {dim0.values.map((val, ri) => {
                const cell = getCellForGrid(ri, 0);
                const flatIdx = visibleCells.indexOf(cell!);
                const isSelected = flatIdx === selectedCellIdx;
                return (
                  <div
                    key={val.id}
                    className={`border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#c73e3e] shadow-[0_0_12px_rgba(199,62,62,0.5)]'
                        : 'border-transparent hover:border-[#808080]'
                    }`}
                    onClick={() => setSelectedCellIdx(flatIdx >= 0 ? flatIdx : null)}
                    style={{ width: 180 }}
                  >
                    <div className="text-[10px] text-[#d0d0d0] text-center py-1 bg-black/50">
                      {val.label}
                      {dim0.sequential && ri > 0 && (
                        <span className="text-[#c73e3e] ml-1">→</span>
                      )}
                    </div>
                    {cell?.imageUrl ? (
                      <img
                        src={cell.imageUrl}
                        alt={cell.prompt}
                        className="w-full h-[160px] object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-[160px] flex items-center justify-center"
                        style={{ backgroundColor: cell?.status === 'failed' ? '#3a2020' : '#1a1a1a' }}
                      >
                        <span className="text-[10px] text-[#606060]">
                          {cell?.status === 'generating' ? 'GENERATING...' :
                            cell?.status === 'failed' ? 'FAILED' : 'PENDING'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel — shown when an image is selected */}
        {selectedCell && (
          <div className="w-[400px] bg-[#1a1a1a] border-l border-[#404040] flex flex-col flex-shrink-0">
            {/* Large image */}
            <div className="flex-1 flex items-center justify-center p-3 min-h-0 overflow-hidden">
              {selectedCell.imageUrl ? (
                <img
                  src={selectedCell.imageUrl}
                  alt={selectedCell.prompt}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-[#606060] text-xs">
                  {selectedCell.status === 'failed' ? `FAILED: ${selectedCell.error}` : selectedCell.status.toUpperCase()}
                </div>
              )}
            </div>

            {/* Cell info */}
            <div className="border-t border-[#404040] bg-[#222222] p-3 flex-shrink-0 space-y-2">
              {/* Dimension labels */}
              <div className="text-[10px] text-[#c0c0c0]">
                {getCellLabels(selectedCell)}
              </div>

              {/* Prompt */}
              <div>
                <div className="text-[8px] text-[#808080] mb-0.5">PROMPT</div>
                <div className="text-[10px] text-[#d0d0d0] leading-relaxed max-h-[80px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {selectedCell.prompt}
                </div>
              </div>

              {/* Error */}
              {selectedCell.error && (
                <div className="text-[10px] text-[#c73e3e]">{selectedCell.error}</div>
              )}

              {/* Actions */}
              {selectedCell.imageUrl && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleDownload(selectedCell.imageUrl!, selectedCell.prompt)}
                    className="flex-1 bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] py-1.5 text-[10px] border border-[#404040] transition-colors"
                  >
                    DOWNLOAD
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('popImageToNode', {
                        detail: {
                          imageUrl: selectedCell.imageUrl,
                          prompt: selectedCell.prompt,
                        },
                      }));
                    }}
                    className="flex-1 bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] py-1.5 text-[10px] border border-[#404040] transition-colors"
                  >
                    POP TO NODE
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Dispatch from anywhere to open the matrix gallery */
export function openMatrixGallery(dimensions: MatrixDimension[], cells: MatrixCell[]) {
  window.dispatchEvent(new CustomEvent('openMatrixGallery', {
    detail: { dimensions, cells },
  }));
}
