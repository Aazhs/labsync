'use client';

import { useState, useRef, useEffect } from 'react';
import { useIDEStore, ProjectFile } from '@/lib/store';
import {
  FileCode,
  FileText,
  FileJson,
  File,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  PanelLeftClose,
  FolderOpen,
  RotateCcw,
} from 'lucide-react';

export default function FileExplorer() {
  const {
    files,
    activeFileId,
    language,
    toggleExplorer,
    setActiveFile,
    createFile,
    deleteFile,
    renameFile,
  } = useIDEStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    if (editingFileId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingFileId]);

  const handleStartCreate = () => {
    const ext =
      language.name === 'python'
        ? '.py'
        : language.name === 'javascript'
        ? '.js'
        : language.name === 'java'
        ? '.java'
        : language.name === 'cpp'
        ? '.cpp'
        : '.c';
    setNewFileName(`file${files.length + 1}${ext}`);
    setIsCreating(true);
  };

  const handleConfirmCreate = () => {
    const name = newFileName.trim();
    if (name) {
      createFile(name);
    }
    setIsCreating(false);
    setNewFileName('');
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewFileName('');
  };

  const handleStartRename = (file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFileId(file.id);
    setEditingName(file.name);
  };

  const handleConfirmRename = () => {
    if (editingFileId && editingName.trim()) {
      renameFile(editingFileId, editingName.trim());
    }
    setEditingFileId(null);
    setEditingName('');
  };

  const handleCancelRename = () => {
    setEditingFileId(null);
    setEditingName('');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (files.length <= 1) return;
    deleteFile(id);
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.py')) {
      return <FileCode size={14} style={{ color: '#5b8db8' }} />;
    }
    if (filename.endsWith('.js') || filename.endsWith('.ts')) {
      return <FileCode size={14} style={{ color: '#e8a838' }} />;
    }
    if (filename.endsWith('.cpp') || filename.endsWith('.c') || filename.endsWith('.h')) {
      return <FileCode size={14} style={{ color: '#3d8c6f' }} />;
    }
    if (filename.endsWith('.java')) {
      return <FileCode size={14} style={{ color: '#c0392b' }} />;
    }
    if (filename.endsWith('.json')) {
      return <FileJson size={14} style={{ color: '#d4943a' }} />;
    }
    if (filename.endsWith('.md') || filename.endsWith('.txt')) {
      return <FileText size={14} style={{ color: '#8a847a' }} />;
    }
    return <File size={14} style={{ color: 'var(--text-muted)' }} />;
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px 0 14px',
          height: 38,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <FolderOpen size={14} style={{ color: 'var(--brand-light)' }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            Explorer
          </span>
          <span
            className="badge badge-info"
            style={{ fontSize: 10, padding: '1px 5px', height: 16 }}
          >
            {files.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="btn-icon"
            onClick={() => {
              if (window.confirm('Reset all files in this workspace to original starter template?')) {
                useIDEStore.getState().resetToTemplate();
              }
            }}
            title="Reset to starter template"
            style={{ width: 26, height: 26 }}
          >
            <RotateCcw size={13} />
          </button>
          <button
            className="btn-icon"
            onClick={handleStartCreate}
            title="New File"
            style={{ width: 26, height: 26 }}
          >
            <Plus size={14} />
          </button>
          <button
            className="btn-icon"
            onClick={toggleExplorer}
            title="Hide Explorer (⌘B)"
            style={{ width: 26, height: 26 }}
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
      </div>

      {/* Workspace label */}
      <div
        style={{
          padding: '8px 14px 4px',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-faint)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Lab Workspace</span>
      </div>

      {/* File Tree List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          const isEditing = file.id === editingFileId;

          return (
            <div
              key={file.id}
              onClick={() => setActiveFile(file.id)}
              className="explorer-file-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                transition: 'background var(--transition-fast)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  overflow: 'hidden',
                  flex: 1,
                }}
              >
                {getFileIcon(file.name)}
                {isEditing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleConfirmRename();
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      onBlur={handleConfirmRename}
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-active)',
                        borderRadius: 'var(--radius-xs)',
                        padding: '1px 5px',
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        outline: 'none',
                        width: '100%',
                      }}
                    />
                  </form>
                ) : (
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                    }}
                  >
                    {file.name}
                  </span>
                )}
                {file.isEntrypoint && !isEditing && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 4px',
                      borderRadius: 'var(--radius-xs)',
                      background: 'rgba(212, 148, 58, 0.12)',
                      color: 'var(--brand-light)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    MAIN
                  </span>
                )}
              </div>

              {/* Hover actions */}
              {!isEditing && (
                <div
                  className="file-actions"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    opacity: isActive ? 1 : 0,
                    transition: 'opacity var(--transition-fast)',
                  }}
                >
                  <button
                    className="btn-icon"
                    onClick={(e) => handleStartRename(file, e)}
                    title="Rename"
                    style={{ width: 22, height: 22 }}
                  >
                    <Pencil size={11} />
                  </button>
                  {files.length > 1 && (
                    <button
                      className="btn-icon"
                      onClick={(e) => handleDelete(file.id, e)}
                      title="Delete"
                      style={{ width: 22, height: 22 }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* New file input row */}
        {isCreating && (
          <div
            style={{
              padding: '4px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-elevated)',
            }}
          >
            <FileCode size={14} style={{ color: 'var(--brand-light)' }} />
            <input
              ref={inputRef}
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreate();
                if (e.key === 'Escape') handleCancelCreate();
              }}
              placeholder="filename.py"
              style={{
                flex: 1,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-active)',
                borderRadius: 'var(--radius-xs)',
                padding: '3px 6px',
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
            <button
              className="btn-icon"
              onClick={handleConfirmCreate}
              title="Confirm"
              style={{ width: 22, height: 22, color: 'var(--accent-success)' }}
            >
              <Check size={12} />
            </button>
            <button
              className="btn-icon"
              onClick={handleCancelCreate}
              title="Cancel"
              style={{ width: 22, height: 22 }}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
