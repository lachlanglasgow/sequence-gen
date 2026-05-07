'use client';

import { useState, useEffect, useRef } from 'react';

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  existingNames: string[];
}

export function SaveDialog({ isOpen, onClose, onConfirm, existingNames }: SaveDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
      // Focus input after dialog opens
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const validate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'Project name is required';
    if (trimmed.length > 100) return 'Project name must be 100 characters or less';
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      return 'A project with this name already exists';
    }
    return null;
  };

  const handleSubmit = () => {
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    onConfirm(name.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#404040]/50 flex items-center justify-center z-50" style={{ fontFamily: 'Courier New, Courier, monospace' }}>
      <div className="bg-[#e0e0e0] border border-[#404040] w-[320px]">
        <div className="bg-[#d0d0d0] px-3 py-2 border-b border-[#404040]">
          <span className="text-[#404040] text-[11px] font-normal tracking-wider">SAVE PROJECT</span>
        </div>
        <div className="p-3">
          <label className="text-[10px] text-[#606060] mb-1 block">PROJECT NAME</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-[#f0f0f0] border border-[#404040] px-2 py-1.5 text-[12px] text-[#404040] focus:outline-none focus:border-[#c73e3e]"
            placeholder="Enter project name..."
          />
          {error && (
            <div className="mt-2 text-[10px] text-[#c73e3e]">{error}</div>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={onClose}
              className="flex-1 bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] py-1.5 text-[11px] border border-[#404040] transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="flex-1 bg-[#c73e3e] hover:bg-[#b53535] disabled:bg-[#b0b0b0] text-[#f0f0f0] py-1.5 text-[11px] border border-[#404040] transition-colors"
            >
              SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
