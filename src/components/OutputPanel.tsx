'use client';

import { useRef, useEffect } from 'react';
import { useIDEStore } from '@/lib/store';
import { Terminal, CircleCheck, CircleX, Clock, MemoryStick, Trash2 } from 'lucide-react';

export default function OutputPanel() {
  const { output, lastResult, activeOutputTab, setActiveOutputTab, clearOutput } = useIDEStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="panel" style={{ height: '100%' }}>
      {/* Tab Bar */}
      <div className="tab-bar">
        <button
          className={`tab ${activeOutputTab === 'output' ? 'active' : ''}`}
          onClick={() => setActiveOutputTab('output')}
        >
          <Terminal size={13} />
          Output
        </button>
        <button
          className={`tab ${activeOutputTab === 'problems' ? 'active' : ''}`}
          onClick={() => setActiveOutputTab('problems')}
        >
          <CircleX size={13} />
          Problems
          {lastResult?.classification && lastResult.classification.tier !== 'none' && (
            <span className="badge badge-error" style={{ marginLeft: 4 }}>1</span>
          )}
        </button>
        <div style={{ flex: 1 }} />
        {/* Status badges */}
        {lastResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            {lastResult.time && (
              <span className="badge badge-info">
                <Clock size={10} />
                {lastResult.time}s
              </span>
            )}
            {lastResult.memory && (
              <span className="badge badge-info">
                <MemoryStick size={10} />
                {(lastResult.memory / 1024).toFixed(1)}MB
              </span>
            )}
            <span className={`badge ${lastResult.status.id === 3 ? 'badge-success' : 'badge-error'}`}>
              {lastResult.status.id === 3 ? <CircleCheck size={10} /> : <CircleX size={10} />}
              {lastResult.status.description}
            </span>
          </div>
        )}
        <button className="btn-icon" onClick={clearOutput} title="Clear output">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="panel-body" ref={scrollRef} style={{ padding: '8px 0' }}>
        {activeOutputTab === 'output' ? (
          output.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-tertiary)',
              fontSize: 13,
              gap: 8,
            }}>
              <Terminal size={24} />
              <span>Run your code to see output here</span>
              <span style={{ fontSize: 11 }}>Press Ctrl+Enter or click the Run button</span>
            </div>
          ) : (
            output.map((line, i) => (
              <div key={i} className={`output-line output-${line.type}`}>
                {line.content}
              </div>
            ))
          )
        ) : (
          /* Problems Tab */
          lastResult?.classification && lastResult.classification.tier !== 'none' ? (
            <div style={{ padding: '12px 16px' }} className="animate-fade-in">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}>
                <span className={`badge badge-${lastResult.classification.tier === 'syntax' ? 'error' : lastResult.classification.tier === 'logic' ? 'warning' : 'info'}`}>
                  {lastResult.classification.tier.toUpperCase()}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {lastResult.classification.category}
                </span>
              </div>
              <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: 13,
                fontFamily: 'var(--font-mono), monospace',
                color: 'var(--accent-danger)',
                marginBottom: 12,
                lineHeight: 1.5,
              }}>
                {lastResult.classification.message}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}>
                💡 <strong>Hint:</strong> {lastResult.classification.suggestion}
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-tertiary)',
              fontSize: 13,
              gap: 8,
            }}>
              <CircleCheck size={24} />
              <span>No problems detected</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
