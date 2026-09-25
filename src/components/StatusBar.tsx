'use client';

import { useIDEStore } from '@/lib/store';
import { GitBranch, Circle } from 'lucide-react';

export default function StatusBar() {
  const { language, isRunning, lastResult } = useIDEStore();

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
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {lastResult?.time && (
          <span className="status-item">
            Exec: {lastResult.time}s
          </span>
        )}
        <span className="status-item">{language.label}</span>
        <span className="status-item">UTF-8</span>
        <span className="status-item">Spaces: 4</span>
      </div>
    </div>
  );
}
