'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface BasePromptNodeProps {
  data: {
    text?: string;
  };
  selected?: boolean;
}

export const BasePromptNode = memo(({ data, selected }: BasePromptNodeProps) => {
  return (
    <div 
      className={`bg-[#e0e0e0] border ${selected ? 'border-[#c73e3e]' : 'border-[#404040]'} w-[240px]`}
      style={{ 
        fontFamily: 'Courier New, Courier, monospace',
        boxShadow: selected ? '0 0 0 1px #c73e3e' : 'none'
      }}
    >
      {/* Header */}
      <div className="bg-[#d0d0d0] px-3 py-1.5 border-b border-[#404040]">
        <span className="text-[#404040] text-xs font-normal tracking-wider">
          BASE PROMPT
        </span>
      </div>
      
      {/* Content */}
      <div className="p-3 bg-[#e8e8e8] min-h-[80px]">
        <div className="text-[11px] text-[#404040] whitespace-pre-wrap font-normal">
          {data.text || <span className="text-[#909090]">Enter prompt...</span>}
        </div>
      </div>
      
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

BasePromptNode.displayName = 'BasePromptNode';
