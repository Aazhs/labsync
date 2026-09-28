'use client';

import { useRef, useEffect, useState } from 'react';
import { useIDEStore } from '@/lib/store';
import {
  Terminal as TerminalIcon,
  CircleCheck,
  CircleX,
  AlertTriangle,
  Clock,
  MemoryStick,
  Trash2,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';

interface OutputPanelProps {
  onRun?: (customStdin?: string) => void;
}

export default function OutputPanel({ onRun }: OutputPanelProps) {
  const {
    output,
    lastResult,
    activeOutputTab,
    syntaxProblems,
    language,
    stdin,
    isRunning,
    isWaitingForInput,
    terminalHistory,
    setStdin,
    setIsWaitingForInput,
    pushTerminalHistory,
    setActiveOutputTab,
    addOutput,
    clearOutput,
    setTargetPosition,
  } = useIDEStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [cliInput, setCliInput] = useState('');
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Auto-scroll terminal output on new lines
  useEffect(() => {
    if (scrollRef.current && (activeOutputTab === 'output' || activeOutputTab === 'terminal')) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output, activeOutputTab]);

  // When program is waiting for input, automatically focus the terminal cursor
  useEffect(() => {
    if (isWaitingForInput && (activeOutputTab === 'output' || activeOutputTab === 'terminal')) {
      inputRef.current?.focus();
    }
  }, [isWaitingForInput, activeOutputTab]);

  const errorCount = syntaxProblems.filter((p) => p.severity === 'error').length;
  const warningCount = syntaxProblems.filter((p) => p.severity === 'warning').length;
  const totalProblems = syntaxProblems.length;

  const fileExt =
    language.name === 'python'
      ? 'py'
      : language.name === 'javascript'
      ? 'js'
      : language.name === 'java'
      ? 'java'
      : language.name === 'cpp'
      ? 'cpp'
      : 'c';

  // Keyboard navigation & submission in terminal
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = cliInput;
      if (!val && !isWaitingForInput) return;

      // Handle standard terminal commands
      if (val.trim() === 'clear') {
        clearOutput();
        setCliInput('');
        setHistoryIdx(-1);
        return;
      }
      if (val.trim() === 'run') {
        setCliInput('');
        setHistoryIdx(-1);
        if (onRun) onRun();
        return;
      }
      if (val.trim() === 'help') {
        addOutput({
          type: 'system',
          content: 'Terminal commands:\n  run   - Execute active code\n  clear - Clear terminal',
          timestamp: Date.now(),
        });
        setCliInput('');
        setHistoryIdx(-1);
        return;
      }

      // Add to command history
      if (val.trim()) {
        pushTerminalHistory(val);
      }
      setHistoryIdx(-1);

      // Echo input into the terminal stream
      addOutput({
        type: 'stdin',
        content: val,
        timestamp: Date.now(),
      });

      // Append to accumulated stdin using fresh store state
      const currentStdin = useIDEStore.getState().stdin;
      const nextStdin = currentStdin ? `${currentStdin.trimEnd()}\n${val}\n` : `${val}\n`;
      setStdin(nextStdin);
      setCliInput('');
      setIsWaitingForInput(false);

      // Re-trigger execution with the updated standard input
      if (onRun) {
        onRun(nextStdin);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalHistory.length === 0) return;
      const nextIdx = historyIdx === -1 ? terminalHistory.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setCliInput(terminalHistory[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      if (historyIdx >= terminalHistory.length - 1) {
        setHistoryIdx(-1);
        setCliInput('');
      } else {
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        setCliInput(terminalHistory[nextIdx]);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.includes('\n')) {
      e.preventDefault();
      const lines = text.split('\n').filter((l) => l.trim() !== '');
      if (lines.length === 0) return;

      lines.forEach((line) => {
        addOutput({
          type: 'stdin',
          content: line,
          timestamp: Date.now(),
        });
      });

      const currentStdin = useIDEStore.getState().stdin;
      const nextStdin = currentStdin
        ? `${currentStdin.trimEnd()}\n${lines.join('\n')}\n`
        : `${lines.join('\n')}\n`;

      setStdin(nextStdin);
      setCliInput('');
      setIsWaitingForInput(false);
      if (onRun) {
        onRun(nextStdin);
      }
    }
  };

  const isTerminalActive = activeOutputTab === 'terminal' || activeOutputTab === 'output';

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header Tab Bar */}
      <div className="tab-bar">
        <button
          className={`tab ${isTerminalActive ? 'active' : ''}`}
          onClick={() => setActiveOutputTab('terminal')}
        >
          <TerminalIcon size={13} />
          Terminal
        </button>

        <button
          className={`tab ${activeOutputTab === 'problems' ? 'active' : ''}`}
          onClick={() => setActiveOutputTab('problems')}
        >
          <CircleX size={13} />
          Problems
          {totalProblems > 0 && (
            <span
              className={`badge ${errorCount > 0 ? 'badge-error' : 'badge-warning'}`}
              style={{ marginLeft: 6 }}
            >
              {totalProblems}
            </span>
          )}
        </button>

        <div style={{ flex: 1 }} />

        {/* Execution status badges */}
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
            <span
              className={`badge ${
                lastResult.status.id === 3 ? 'badge-success' : 'badge-error'
              }`}
            >
              {lastResult.status.id === 3 ? <CircleCheck size={10} /> : <CircleX size={10} />}
              {lastResult.status.description}
            </span>
          </div>
        )}

        <button className="btn-icon" onClick={clearOutput} title="Clear terminal">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {isTerminalActive ? (
          /* Unified Terminal */
          <div
            className="terminal-container"
            onClick={() => inputRef.current?.focus()}
          >
            <div className="terminal-scroll-area" ref={scrollRef}>
              {output.length === 0 ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 6 }}>
                  LabSync Terminal — Press &quot;Run Code&quot; (⌘↵) to execute. Output and stdin appear here.
                </div>
              ) : (
                output.map((line, i) => {
                  if (line.type === 'stdin') {
                    return (
                      <div key={i} className="terminal-line terminal-stdin-line">
                        <span className="terminal-prompt-symbol">❯</span>
                        <span>{line.content}</span>
                      </div>
                    );
                  }
                  if (line.type === 'system') {
                    return (
                      <div key={i} className="terminal-line terminal-system">
                        {line.content}
                      </div>
                    );
                  }
                  if (line.type === 'error' || line.type === 'stderr') {
                    return (
                      <div key={i} className="terminal-line terminal-stderr">
                        {line.content}
                      </div>
                    );
                  }
                  if (line.type === 'success') {
                    return (
                      <div key={i} className="terminal-line terminal-success">
                        {line.content}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="terminal-line terminal-stdout">
                      {line.content}
                    </div>
                  );
                })
              )}

              {/* Active inline terminal input prompt */}
              <div className="terminal-prompt-row">
                <span className="terminal-prompt-symbol">❯</span>
                <input
                  ref={inputRef}
                  type="text"
                  className="terminal-prompt-input"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={
                    isWaitingForInput
                      ? 'Type input for program and press Enter ↵'
                      : isRunning
                      ? 'Running...'
                      : ''
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Problems Tab */
          <div style={{ padding: '8px 16px', overflowY: 'auto', height: '100%' }}>
            {syntaxProblems.length > 0 ? (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 6,
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Live Diagnostics ({errorCount} {errorCount === 1 ? 'error' : 'errors'}
                    {warningCount > 0 ? `, ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}` : ''})
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    Click an item to jump to code
                  </span>
                </div>

                {syntaxProblems.map((prob) => {
                  const isError = prob.severity === 'error';
                  return (
                    <div
                      key={prob.id}
                      className={`problem-card ${isError ? 'problem-card-error' : 'problem-card-warning'}`}
                      onClick={() => setTargetPosition({ line: prob.line, column: prob.column })}
                      title="Click to jump to line"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isError ? (
                            <CircleX size={13} style={{ color: 'var(--accent-danger)' }} />
                          ) : (
                            <AlertTriangle size={13} style={{ color: 'var(--accent-warning)' }} />
                          )}
                          <span
                            className={`badge ${isError ? 'badge-error' : 'badge-warning'}`}
                            style={{ fontSize: 10, padding: '1px 6px' }}
                          >
                            {prob.category}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            main.{fileExt}:{prob.line}:{prob.column}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--brand-light)' }}>
                          <span>Jump</span>
                          <ArrowRight size={11} />
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: 'var(--font-mono)',
                          color: isError ? 'var(--accent-danger-light)' : 'var(--accent-warning)',
                          lineHeight: 1.4,
                        }}
                      >
                        {prob.message}
                      </div>

                      {prob.suggestion && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 5,
                            marginTop: 2,
                          }}
                        >
                          <Lightbulb size={12} style={{ color: 'var(--brand-light)', flexShrink: 0, marginTop: 1 }} />
                          <span>{prob.suggestion}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : lastResult?.classification && lastResult.classification.tier !== 'none' ? (
              <div style={{ padding: '8px 0' }} className="animate-fade-in">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span
                    className={`badge badge-${
                      lastResult.classification.tier === 'syntax'
                        ? 'error'
                        : lastResult.classification.tier === 'logic'
                        ? 'warning'
                        : 'info'
                    }`}
                  >
                    {lastResult.classification.tier.toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {lastResult.classification.category}
                  </span>
                </div>
                <div
                  style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono), monospace',
                    color: 'var(--accent-danger)',
                    marginBottom: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {lastResult.classification.message}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  💡 <strong>Hint:</strong> {lastResult.classification.suggestion}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-tertiary)',
                  fontSize: 13,
                  gap: 8,
                }}
              >
                <CircleCheck size={28} style={{ color: 'var(--accent-success)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No syntax problems detected</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Code editor has zero syntax warnings or errors. Ready to execute!
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
