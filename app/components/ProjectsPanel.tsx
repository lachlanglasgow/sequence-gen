'use client';

import { useState } from 'react';
import { useProjectStore, type Project } from '../store/projectStore';
import type { Node, Edge } from '@xyflow/react';

interface ProjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentNodes: Node[];
  currentEdges: Edge[];
  onLoadProject: (project: Project) => void;
  onNewProject: () => void;
  hasUnsavedChanges?: boolean;
}

export function ProjectsPanel({
  isOpen,
  onClose,
  currentNodes,
  currentEdges,
  onLoadProject,
  onNewProject,
  hasUnsavedChanges = false,
}: ProjectsPanelProps) {
  const { projects, currentProjectId, addProject, deleteProject, renameProject } =
    useProjectStore();
  const [newProjectName, setNewProjectName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [pendingLoadProject, setPendingLoadProject] = useState<Project | null>(null);
  const [pendingNewProject, setPendingNewProject] = useState(false);

  const validateProjectName = (name: string, excludeId?: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return 'Project name is required';
    if (trimmed.length > 100) return 'Project name must be 100 characters or less';
    if (projects.some((p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.id !== excludeId)) {
      return 'A project with this name already exists';
    }
    return null;
  };

  const handleSaveNew = () => {
    const error = validateProjectName(newProjectName);
    if (error) {
      alert(error);
      return;
    }
    addProject(newProjectName.trim(), currentNodes, currentEdges);
    setNewProjectName('');
  };

  const handleLoad = (project: Project) => {
    if (hasUnsavedChanges) {
      setPendingLoadProject(project);
      return;
    }
    onLoadProject(project);
    onClose();
  };

  const confirmLoadWithUnsavedChanges = () => {
    if (pendingLoadProject) {
      onLoadProject(pendingLoadProject);
      setPendingLoadProject(null);
      onClose();
    }
  };

  const handleRename = (id: string) => {
    const error = validateProjectName(editName, id);
    if (error) {
      alert(error);
      return;
    }
    renameProject(id, editName.trim());
    setEditingId(null);
    setEditName('');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const btnClass = "bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] px-2 py-1 text-[10px] border border-[#404040] transition-colors";

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-[#404040]/30 z-40" onClick={onClose} />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-[320px] bg-[#e0e0e0] border-l border-[#404040] z-50 transform transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ fontFamily: 'Courier New, Courier, monospace' }}
      >
        {/* Header */}
        <div className="bg-[#d0d0d0] px-4 py-3 border-b border-[#404040] flex items-center justify-between">
          <h2 className="text-xs font-normal tracking-wider text-[#404040]">PROJECTS</h2>
          <button onClick={onClose} className="text-[#404040] hover:text-[#c73e3e] text-xl">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100vh-60px)]">
          {/* New Project */}
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                setPendingNewProject(true);
              } else {
                onNewProject();
                onClose();
              }
            }}
            className="w-full bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] py-2 text-[11px] font-normal border border-[#404040] transition-colors"
          >
            NEW PROJECT
          </button>

          {/* Save Current */}
          <div className="bg-[#e8e8e8] p-3 border border-[#404040]">
            <div className="text-[10px] text-[#606060] mb-2">SAVE CURRENT</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1 bg-[#f0f0f0] border border-[#404040] px-2 py-1 text-[11px] text-[#404040] focus:outline-none focus:border-[#c73e3e]"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveNew()}
              />
              <button
                onClick={handleSaveNew}
                disabled={!newProjectName.trim()}
                className={`${btnClass} ${!newProjectName.trim() ? 'opacity-50' : ''}`}
              >
                SAVE
              </button>
            </div>
          </div>

          {/* Project List */}
          <div>
            <div className="text-[10px] text-[#606060] mb-2">
              SAVED PROJECTS ({projects.length})
            </div>

            {projects.length === 0 && (
              <div className="text-[11px] text-[#909090] text-center py-8 border border-[#404040] border-dashed">
                NO SAVED PROJECTS
              </div>
            )}

            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`border ${project.id === currentProjectId ? 'border-[#c73e3e] bg-[#e8e8e8]' : 'border-[#404040] bg-[#f0f0f0]'} p-3 cursor-pointer`}
                  onClick={() => handleLoad(project)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {editingId === project.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 bg-[#f0f0f0] border border-[#404040] px-1 py-0.5 text-[11px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(project.id);
                              if (e.key === 'Escape') {
                                setEditingId(null);
                                setEditName('');
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename(project.id);
                            }}
                            className="text-[#c73e3e] text-xs"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <div className="text-[12px] text-[#404040] truncate">{project.name}</div>
                      )}
                      <div className="text-[10px] text-[#606060] mt-1">
                        {project.nodes.length} NODES • {formatDate(project.updatedAt)}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(project.id);
                          setEditName(project.name);
                        }}
                        className="text-[#606060] hover:text-[#404040] px-1"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('DELETE THIS PROJECT?')) {
                            deleteProject(project.id);
                          }
                        }}
                        className="text-[#c73e3e] hover:text-[#a03030] px-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Unsaved Changes Warning — New Project */}
        {pendingNewProject && (
          <div className="absolute inset-0 bg-[#404040]/50 flex items-center justify-center z-50">
            <div className="bg-[#e0e0e0] border border-[#404040] w-[280px]">
              <div className="bg-[#c73e3e] px-3 py-2">
                <span className="text-[#f0f0f0] text-[11px] font-normal">UNSAVED CHANGES</span>
              </div>
              <div className="p-3">
                <p className="text-[11px] text-[#404040] mb-3">
                  You have unsaved changes. Starting a new project will discard them.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingNewProject(false)}
                    className="flex-1 bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] py-1.5 text-[10px] border border-[#404040]"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={() => {
                      setPendingNewProject(false);
                      onNewProject();
                      onClose();
                    }}
                    className="flex-1 bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] py-1.5 text-[10px] border border-[#404040]"
                  >
                    DISCARD & NEW
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unsaved Changes Warning — Load Project */}
        {pendingLoadProject && (
          <div className="absolute inset-0 bg-[#404040]/50 flex items-center justify-center z-50">
            <div className="bg-[#e0e0e0] border border-[#404040] w-[280px]">
              <div className="bg-[#c73e3e] px-3 py-2">
                <span className="text-[#f0f0f0] text-[11px] font-normal">UNSAVED CHANGES</span>
              </div>
              <div className="p-3">
                <p className="text-[11px] text-[#404040] mb-3">
                  You have unsaved changes. Loading a project will discard them.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingLoadProject(null)}
                    className="flex-1 bg-[#d4d4d4] hover:bg-[#c8c8c8] text-[#303030] py-1.5 text-[10px] border border-[#404040]"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={confirmLoadWithUnsavedChanges}
                    className="flex-1 bg-[#c73e3e] hover:bg-[#b53535] text-[#f0f0f0] py-1.5 text-[10px] border border-[#404040]"
                  >
                    DISCARD & LOAD
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
