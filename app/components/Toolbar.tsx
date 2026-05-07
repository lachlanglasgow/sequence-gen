'use client';

interface ToolbarProps {
  onAddNode: (type: string) => void;
  onGenerateAll: () => void;
  onOpenProjects: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onUploadImage: () => void;
  onOpenSettings?: () => void;
  hasNodes: boolean;
  hasCurrentProject: boolean;
  isGenerating: boolean;
  isUploading?: boolean;
  hasUnsavedChanges?: boolean;
}

export function Toolbar({
  onAddNode,
  onGenerateAll,
  onOpenProjects,
  onSave,
  onSaveAsNew,
  onUploadImage,
  onOpenSettings,
  hasNodes,
  hasCurrentProject,
  isGenerating,
  isUploading,
  hasUnsavedChanges = false,
}: ToolbarProps) {
  const btnClass = "bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] px-3 py-2 text-[11px] font-normal border border-[#404040] transition-colors";
  const accentBtnClass = "bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] px-3 py-2 text-[11px] font-normal border border-[#404040] transition-colors";

  return (
    <div className="flex gap-1 z-10 flex-wrap p-4 shrink-0" style={{ fontFamily: 'Courier New, Courier, monospace' }}>
      <button onClick={() => onAddNode('basePrompt')} className={btnClass}>
        BASE
      </button>
      <button onClick={() => onAddNode('modifyPrompt')} className={btnClass}>
        MODIFY
      </button>
      <button onClick={() => onAddNode('appendPrompt')} className={btnClass}>
        APPEND
      </button>
      <button onClick={() => onAddNode('image')} className={btnClass}>
        IMAGE
      </button>
      <button onClick={() => onAddNode('multiImage')} className={btnClass}>
        MULTI IMG
      </button>
      <button onClick={() => onAddNode('matrixPrompt')} className={btnClass}>
        MATRIX
      </button>
      <button 
        onClick={onUploadImage} 
        disabled={isUploading}
        className={`${isUploading ? 'bg-[#b0b0b0]' : accentBtnClass} px-3 py-2 text-[11px] font-normal border border-[#404040] transition-colors`}
        type="button"
      >
        {isUploading ? 'UPLOADING...' : 'UPLOAD'}
      </button>
      <button 
        onClick={onGenerateAll}
        disabled={isGenerating || !hasNodes}
        className={`${isGenerating || !hasNodes ? 'bg-[#b0b0b0]' : 'bg-[#d4d4d4] hover:bg-[#c8c8c8]'} text-[#303030] px-4 py-2 text-[11px] font-normal border border-[#404040] transition-colors`}
      >
        {isGenerating ? 'PROCESSING...' : 'GENERATE ALL'}
      </button>
      <button onClick={onOpenProjects} className={btnClass}>
        PROJECTS
      </button>
      {hasNodes && hasCurrentProject && (
        <button onClick={onSave} className={`${btnClass} ${hasUnsavedChanges ? 'border-[#c73e3e]' : ''}`}>
          SAVE{hasUnsavedChanges ? ' *' : ''}
        </button>
      )}
      {hasNodes && (
        <button onClick={onSaveAsNew} className={btnClass}>
          SAVE AS NEW
        </button>
      )}
      {onOpenSettings && (
        <button onClick={onOpenSettings} className={btnClass} title="Settings">
          ⚙
        </button>
      )}
    </div>
  );
}
