'use client';

import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';

interface SequenceNodeProps {
  data: {
    label: string;
    percentage: number;
    prompt: string;
    threshold: { percentage: number; prompt: string } | null;
    variations: { name: string }[];
    history: { id: string; timestamp: number; imageUrl: string }[];
  };
}

export const SequenceNode = memo(({ data }: SequenceNodeProps) => {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-3 min-w-[180px] shadow-md">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm">{data.label}</span>
        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
          {data.percentage}%
        </span>
      </div>
      
      {data.prompt && (
        <div className="text-xs text-gray-600 mb-2 line-clamp-2">
          {data.prompt}
        </div>
      )}
      
      {data.threshold && (
        <div className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-2">
          <span className="font-medium">Threshold:</span> {data.threshold.percentage}%
        </div>
      )}
      
      {data.variations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.variations.map((v, i) => (
            <span key={i} className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
              {v.name}
            </span>
          ))}
        </div>
      )}
      
      {data.history.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          {data.history.length} generation(s)
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
});

SequenceNode.displayName = 'SequenceNode';
