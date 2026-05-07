'use client';

import { useState } from 'react';
import { AVAILABLE_IMAGE_MODELS, DEFAULT_IMAGE_MODEL } from '../store/projectStore';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModel: string;
  onDefaultModelChange: (model: string) => void;
}

export function SettingsPanel({ isOpen, onClose, defaultModel, onDefaultModelChange }: SettingsPanelProps) {
  const [selectedModel, setSelectedModel] = useState(defaultModel);

  if (!isOpen) return null;

  const handleSave = () => {
    onDefaultModelChange(selectedModel);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        className="bg-[#e0e0e0] border border-[#404040] w-[400px] max-w-[90vw]"
        style={{ fontFamily: 'Courier New, Courier, monospace' }}
      >
        {/* Header */}
        <div className="bg-[#d0d0d0] px-4 py-2 border-b border-[#404040] flex items-center justify-between">
          <span className="text-[#404040] text-xs font-normal tracking-wider">SETTINGS</span>
          <button onClick={onClose} className="text-[#606060] hover:text-[#c73e3e] text-xs">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Default Model Section */}
          <div className="space-y-2">
            <label className="text-[10px] text-[#606060] font-normal block">
              DEFAULT IMAGE MODEL
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-[#f0f0f0] border border-[#808080] text-[#404040] text-xs py-2 px-3 font-normal focus:outline-none focus:border-[#c73e3e]"
              style={{ fontFamily: 'Courier New, Courier, monospace' }}
            >
              {AVAILABLE_IMAGE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-[9px] text-[#909090]">
              New image nodes will use this model by default. You can change individual nodes after creation.
            </p>
          </div>

          {/* Model Info */}
          <div className="bg-[#d8d8d8] p-3 border border-[#808080]">
            <div className="text-[10px] text-[#606060] mb-1">AVAILABLE MODELS</div>
            <div className="space-y-1">
              {AVAILABLE_IMAGE_MODELS.map((model) => (
                <div key={model.id} className="flex justify-between text-[10px]">
                  <span className="text-[#404040]">{model.name}</span>
                  <span className="text-[#909090]">{model.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#d0d0d0] px-4 py-3 border-t border-[#404040] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] px-4 py-2 text-[11px] font-normal border border-[#404040] transition-colors"
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            className="bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] px-4 py-2 text-[11px] font-normal border border-[#404040] transition-colors"
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
