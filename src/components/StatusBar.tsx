'use client';

import { useIDEStore } from '@/lib/store';
import { GitBranch, Circle, CircleX, AlertTriangle, CircleCheck } from 'lucide-react';

export default function StatusBar() {
  const {
    language,
    isRunning,
    lastResult,
    syntaxProblems,
    showOutput,
    toggleOutput,
    setActiveOutputTab,
    vimModeEnabled,
    toggleVimMode,
  } = useIDEStore();

  const errorCount = syntaxProblems.filter((p) => p.severity === 'error').length;
  const warningCount = syntaxProblems.filter((p) => p.severity === 'warning').length;

  const handleProblemsClick = () => {
    setActiveOutputTab('problems');
    if (!showOutput) {
      toggleOutput();
    }
  };

  return (
    <div className="status-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="status-item">
          <Circle
            size={8}
            fill={isRunning ? 'var(--accent-warning)' : 'var(--accent-success)'}
            stroke="none"
            className={isRunning ? 'animate-pulse-dot' : ''}
          />
          {isRunning ? 'Running...' : 'Ready'}
        </span>
        <span className="status-item">
          <GitBranch size={11} />
          main
        </span>
        <button
          onClick={handleProblemsClick}
          className="status-item"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title="Click to view live syntax problems"
        >
          {errorCount > 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-danger-light)', fontWeight: 600 }}>
              <CircleX size={11} />
              {errorCount} {errorCount === 1 ? 'error' : 'errors'}
              {warningCount > 0 && `, ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`}
            </span>
          ) : warningCount > 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-warning)', fontWeight: 600 }}>
              <AlertTriangle size={11} />
              {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-success)' }}>
              <CircleCheck size={11} />
              0 problems
            </span>
          )}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {lastResult?.time && (
          <span className="status-item">
            Exec: {lastResult.time}s
          </span>
        )}
        <button
          type="button"
          onClick={toggleVimMode}
          className="status-item"
          style={{
            background: vimModeEnabled ? 'rgba(212, 148, 58, 0.15)' : 'transparent',
            color: vimModeEnabled ? 'var(--accent)' : 'inherit',
            border: vimModeEnabled ? '1px solid rgba(212, 148, 58, 0.4)' : '1px solid transparent',
            borderRadius: 3,
            padding: '1px 6px',
            cursor: 'pointer',
            fontWeight: vimModeEnabled ? 700 : 500,
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.15s ease',
          }}
          title={vimModeEnabled ? 'Vim Mode: ON (Click to disable)' : 'Vim Mode: OFF (Click to enable)'}
        >
          <span>VIM</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '0 4px',
              borderRadius: 2,
              background: vimModeEnabled ? 'var(--accent)' : 'rgba(255, 255, 255, 0.1)',
              color: vimModeEnabled ? '#080808' : 'var(--text-muted)',
            }}
          >
            {vimModeEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
        <span className="status-item">{language.label}</span>
        <span className="status-item">UTF-8</span>
        <span className="status-item">Spaces: 4</span>
      </div>
    </div>
  );
}
