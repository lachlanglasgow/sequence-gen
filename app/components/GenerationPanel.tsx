'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Node } from '@xyflow/react';

interface GenerationPanelProps {
  node: Node;
  onClose: () => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

interface Job {
  id: string;
  prompt: string;
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: {
    imageUrl: string;
    size: number;
  };
  error?: string;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-200 border-t-green-600"></div>
    </div>
  );
}

export function GenerationPanel({ node, onClose, setNodes }: GenerationPanelProps) {
  const [prompt, setPrompt] = useState(String(node.data.prompt || ''));
  const [percentage, setPercentage] = useState(Number(node.data.percentage) || 0);
  const [thresholdPercent, setThresholdPercent] = useState('');
  const [thresholdPrompt, setThresholdPrompt] = useState('');
  const [variationName, setVariationName] = useState('');
  const [variationModifier, setVariationModifier] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Load jobs for this step on mount
  useEffect(() => {
    loadJobs();
    // Start polling
    const interval = setInterval(loadJobs, 2000);
    return () => clearInterval(interval);
  }, [node.id]);

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs?stepId=${node.id}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  }, [node.id]);

  const updateNodeData = (updates: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, ...updates } } : n
      )
    );
  };

  const handleSave = () => {
    updateNodeData({ prompt, percentage });
  };

  const addThreshold = () => {
    if (thresholdPercent && thresholdPrompt) {
      updateNodeData({
        threshold: {
          percentage: parseInt(thresholdPercent),
          prompt: thresholdPrompt,
        },
      });
      setThresholdPercent('');
      setThresholdPrompt('');
    }
  };

  const addVariation = () => {
    if (variationName && variationModifier) {
      const currentVariations = (node.data.variations as any[]) || [];
      const variations = [
        ...currentVariations,
        { id: Date.now().toString(), name: variationName, promptModifier: variationModifier },
      ];
      updateNodeData({ variations });
      setVariationName('');
      setVariationModifier('');
    }
  };

  const submitJob = async () => {
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt || `Seedling at ${percentage}% growth`,
          stepId: node.id,
          percentage,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setActiveJobId(result.jobId);
        // Immediately load jobs to show the new pending job
        loadJobs();
      }
    } catch (error) {
      console.error('Failed to submit job:', error);
    }
  };

  const hasRunningJobs = jobs.some((j) => j.status === 'pending' || j.status === 'running');

  return (
    <div className="w-[450px] bg-white border-l border-gray-200 p-4 overflow-y-auto h-screen">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">{String(node.data.label || 'Step')}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Percentage</label>
          <input
            type="number"
            value={String(percentage)}
            onChange={(e) => setPercentage(parseInt(e.target.value) || 0)}
            className="w-full border rounded px-3 py-2"
            min="0"
            max="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Prompt</label>
          <textarea
            value={String(prompt || '')}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full border rounded px-3 py-2 h-24"
            placeholder="Describe this growth stage..."
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-gray-100 hover:bg-gray-200 py-2 rounded font-medium"
        >
          Save Changes
        </button>

        <hr className="my-4" />

        <div>
          <h3 className="font-semibold mb-2">Threshold (Feature Unlock)</h3>
          <div className="flex gap-2 mb-2">
            <input
              type="number"
              placeholder="%"
              value={thresholdPercent}
              onChange={(e) => setThresholdPercent(e.target.value)}
              className="w-20 border rounded px-2 py-1"
            />
            <input
              type="text"
              placeholder="Feature prompt..."
              value={thresholdPrompt}
              onChange={(e) => setThresholdPrompt(e.target.value)}
              className="flex-1 border rounded px-2 py-1"
            />
            <button
              onClick={addThreshold}
              className="bg-yellow-500 text-white px-3 py-1 rounded text-sm"
            >
              Add
            </button>
          </div>
          {(node.data.threshold as { percentage: number; prompt: string } | undefined) && (
            <div className="text-sm bg-yellow-50 p-2 rounded">
              At {(node.data.threshold as { percentage: number }).percentage}%: {(node.data.threshold as { prompt: string }).prompt}
            </div>
          )}
        </div>

        <hr className="my-4" />

        <div>
          <h3 className="font-semibold mb-2">Variations</h3>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Name (e.g., Rainy)"
              value={variationName}
              onChange={(e) => setVariationName(e.target.value)}
              className="flex-1 border rounded px-2 py-1"
            />
          </div>
          <input
            type="text"
            placeholder="Prompt modifier (e.g., rainy weather, dark clouds)"
            value={variationModifier}
            onChange={(e) => setVariationModifier(e.target.value)}
            className="w-full border rounded px-2 py-1 mb-2"
          />
          <button
            onClick={addVariation}
            className="w-full bg-blue-500 text-white py-1 rounded text-sm"
          >
            Add Variation
          </button>
          {((node.data.variations as any[]) || []).length > 0 && (
            <div className="mt-2 space-y-1">
              {(node.data.variations as any[]).map((v: any, i: number) => (
                <div key={i} className="text-sm bg-blue-50 p-2 rounded">
                  <span className="font-medium">{v.name}:</span> {v.promptModifier}
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="my-4" />

        <button
          onClick={submitJob}
          disabled={hasRunningJobs}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
        >
          {hasRunningJobs && <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />}
          {hasRunningJobs ? 'Queueing...' : 'Submit Generation Job'}
        </button>

        {jobs.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Generation Jobs ({jobs.length})</h3>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="border rounded-lg overflow-hidden">
                  {job.status === 'pending' && (
                    <div className="bg-yellow-50 p-4">
                      <div className="flex items-center gap-2">
                        <div className="animate-pulse w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <p className="text-sm text-yellow-800">Pending in queue...</p>
                      </div>
                      <p className="text-xs text-yellow-600 mt-1">{new Date(job.createdAt).toLocaleTimeString()}</p>
                    </div>
                  )}

                  {job.status === 'running' && (
                    <div className="bg-blue-50 p-4">
                      <LoadingSpinner />
                      <p className="text-center text-sm text-blue-600">Generating image...</p>
                      <p className="text-center text-xs text-blue-400 mt-1">Started at {job.startedAt ? new Date(job.startedAt).toLocaleTimeString() : '...'}</p>
                    </div>
                  )}

                  {job.status === 'failed' && (
                    <div className="bg-red-50 p-4">
                      <p className="text-red-600 text-sm font-medium">Generation failed</p>
                      <p className="text-red-500 text-xs mt-1">{job.error}</p>
                      <p className="text-xs text-red-400 mt-1">{new Date(job.createdAt).toLocaleString()}</p>
                    </div>
                  )}

                  {job.status === 'completed' && job.result && (
                    <>
                      <img
                        src={job.result.imageUrl}
                        alt={`Job ${job.id}`}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.png';
                        }}
                      />
                      <div className="p-2 bg-gray-50">
                        <div className="text-xs text-green-600 font-medium">
                          ✓ Completed {job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : ''}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{(job.result.size / 1024).toFixed(1)} KB</div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
