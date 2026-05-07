'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface ModifyPromptNodeProps {
  data: {
    instruction?: string;
    isProcessing?: boolean;
    lastResult?: string;
  };
  selected?: boolean;
}

export const ModifyPromptNode = memo(({ data, selected }: ModifyPromptNodeProps) => {
  return (
    <div 
      className={`bg-[#e0e0e0] border ${selected ? 'border-[#c73e3e]' : 'border-[#404040]'} w-[260px]`}
      style={{ 
        fontFamily: 'Courier New, Courier, monospace',
        boxShadow: selected ? '0 0 0 1px #c73e3e' : 'none'
      }}
    >
      {/* Header */}
      <div className="bg-[#d0d0d0] px-3 py-1.5 border-b border-[#404040] flex items-center justify-between">
        <span className="text-[#404040] text-xs font-normal tracking-wider">
          MODIFY PROMPT
        </span>
        {data.isProcessing && (
          <span className="text-[#c73e3e] text-xs animate-pulse">▮</span>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-1 border-b border-[#404040] bg-[#e8e8e8]">
        <span className="text-[10px] text-[#606060] font-normal">INPUT</span>
        <Handle
          type="target"
          position={Position.Left}
          id="text"
          className="!w-2 !h-2 !bg-[#808080] !border !border-[#404040] !rounded-none"
          style={{ position: 'absolute', left: '4px', top: '38px' }}
        />
      </div>
      
      {/* Instruction */}
      <div className="p-3 bg-[#f0f0f0] border-b border-[#404040]">
        <div className="text-[10px] text-[#606060] mb-1">INSTRUCTION:</div>
        <div className="text-[11px] text-[#404040] min-h-[40px]">
          {data.instruction || <span className="text-[#909090]">Enter instruction...</span>}
        </div>
      </div>
      
      {/* Last Result */}
      {data.lastResult && (
        <div className="p-3 bg-[#e8e8e8] border-b border-[#404040]">
          <div className="text-[10px] text-[#606060] mb-1">RESULT:</div>
          <div className="text-[11px] text-[#404040] line-clamp-3">
            {data.lastResult}
          </div>
        </div>
      )}
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        className="!w-2 !h-2 !bg-[#808080] !border !border-[#404040] !rounded-none"
        style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
});

ModifyPromptNode.displayName = 'ModifyPromptNode';
