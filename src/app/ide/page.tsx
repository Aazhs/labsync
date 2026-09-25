'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useIDEStore } from '@/lib/store';
import IDEHeader from '@/components/IDEHeader';
import IDESidebar from '@/components/IDESidebar';
import StatusBar from '@/components/StatusBar';
import OutputPanel from '@/components/OutputPanel';
import AIHintPanel from '@/components/AIHintPanel';
import { GripVertical } from 'lucide-react';

// Dynamic import for Monaco (no SSR)
const CodeEditor = dynamic(() => import('@/components/CodeEditor'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-secondary)',
      color: 'var(--text-tertiary)',
      fontSize: 13,
    }}>
      <div className="loading-spinner" style={{ marginRight: 8 }} />
      Loading editor...
    </div>
  ),
});

export default function IDEPage() {
  const {
    code,
    language,
    isRunning,
    showOutput,
    showHintPanel,
    showReferencePane,
    sessionMode,
    referenceCode,
    setIsRunning,
    addOutput,
    clearOutput,
    setLastResult,
    setActiveOutputTab,
  } = useIDEStore();

  // Resizable panel sizes
  const [editorHeight, setEditorHeight] = useState(65); // percentage
  const [hintWidth, setHintWidth] = useState(320); // pixels
  const [isResizingV, setIsResizingV] = useState(false);
  const [isResizingH, setIsResizingH] = useState(false);

  const runCode = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    clearOutput();
    setLastResult(null);
    setActiveOutputTab('output');

    // Show output panel if hidden
    if (!useIDEStore.getState().showOutput) {
      useIDEStore.getState().toggleOutput();
    }

    addOutput({
      type: 'system',
      content: `▶ Running ${language.label}...`,
      timestamp: Date.now(),
    });

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          languageId: language.id,
          stdin: '',
        }),
      });

      const result = await res.json();

      if (result.error && !result.status) {
        addOutput({
          type: 'error',
          content: `✗ Error: ${result.error}`,
          timestamp: Date.now(),
        });
        return;
      }

      // Show compile output if any
      if (result.compile_output) {
        addOutput({
          type: 'stderr',
          content: result.compile_output,
          timestamp: Date.now(),
        });
      }

      // Show stdout
      if (result.stdout) {
        addOutput({
          type: 'stdout',
          content: result.stdout,
          timestamp: Date.now(),
        });
      }

      // Show stderr
      if (result.stderr) {
        addOutput({
          type: 'stderr',
          content: result.stderr,
          timestamp: Date.now(),
        });
      }

      // Show status
      const isSuccess = result.status?.id === 3;
      addOutput({
        type: isSuccess ? 'success' : 'error',
        content: isSuccess
          ? `✓ Process exited with code 0${result.time ? ` (${result.time}s)` : ''}`
          : `✗ ${result.status?.description || 'Execution failed'}`,
        timestamp: Date.now(),
      });

      setLastResult(result);

      // Auto-switch to problems tab on error
      if (!isSuccess && result.classification?.tier !== 'none') {
        setActiveOutputTab('problems');
      }
    } catch (err) {
      addOutput({
        type: 'error',
        content: `✗ Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, language, isRunning, setIsRunning, clearOutput, addOutput, setLastResult, setActiveOutputTab]);

  const stopCode = useCallback(() => {
    setIsRunning(false);
    addOutput({
      type: 'system',
      content: '■ Execution stopped',
      timestamp: Date.now(),
    });
  }, [setIsRunning, addOutput]);

  // Keyboard shortcut: Ctrl+Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [runCode]);

  // Vertical resize (editor/output split)
  useEffect(() => {
    if (!isResizingV) return;

    const handleMove = (e: MouseEvent) => {
      const main = document.getElementById('ide-main');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setEditorHeight(Math.max(20, Math.min(85, pct)));
    };

    const handleUp = () => setIsResizingV(false);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingV]);

  // Horizontal resize (hint panel)
  useEffect(() => {
    if (!isResizingH) return;

    const handleMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setHintWidth(Math.max(240, Math.min(500, newWidth)));
    };

    const handleUp = () => setIsResizingH(false);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingH]);

  return (
    <div className="ide-container">
      {/* Header */}
      <IDEHeader onRun={runCode} onStop={stopCode} />

      {/* Sidebar */}
      <IDESidebar />

      {/* Main Content */}
      <div
        id="ide-main"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Follow Mode Banner */}
        {sessionMode === 'follow' && (
          <div className="mode-banner mode-follow">
            📡 Follow Mode — watching professor&apos;s live code
          </div>
        )}

        {/* Main Editor Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Editor + Output Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Editor Row (may have reference pane) */}
            <div style={{
              flex: showOutput ? `0 0 ${editorHeight}%` : 1,
              display: 'flex',
              overflow: 'hidden',
            }}>
              {/* Reference Pane (Follow Mode) */}
              {showReferencePane && (
                <>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div className="panel" style={{ height: '100%' }}>
                      <div className="panel-header">
                        <span>📖 Professor&apos;s Code (Read-Only)</span>
                      </div>
                      <div className="panel-body">
                        <CodeEditor
                          readOnly={true}
                          value={referenceCode || '// Professor\'s code will appear here\n// during Follow Mode sessions'}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    className="resize-handle-h"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GripVertical size={10} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </>
              )}

              {/* Main Editor */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="panel" style={{ height: '100%', borderRadius: 0 }}>
                  <div className="tab-bar">
                    <div className="tab active">
                      <span style={{ fontSize: 11 }}>●</span>
                      main.{language.name === 'python' ? 'py' : language.name === 'javascript' ? 'js' : language.name === 'java' ? 'java' : language.name === 'cpp' ? 'cpp' : 'c'}
                    </div>
                  </div>
                  <div className="panel-body">
                    <CodeEditor />
                  </div>
                </div>
              </div>
            </div>

            {/* Resize Handle (vertical) */}
            {showOutput && (
              <div
                className="resize-handle-v"
                onMouseDown={() => setIsResizingV(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            )}

            {/* Output Panel */}
            {showOutput && (
              <div style={{ flex: `0 0 ${100 - editorHeight}%`, overflow: 'hidden' }}>
                <OutputPanel />
              </div>
            )}
          </div>

          {/* AI Hint Panel (right side) */}
          {showHintPanel && (
            <>
              <div
                className="resize-handle-h"
                onMouseDown={() => setIsResizingH(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <GripVertical size={10} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div
                style={{ width: hintWidth, flexShrink: 0, overflow: 'hidden' }}
                className="animate-slide-in"
              >
                <AIHintPanel />
              </div>
            </>
          )}
        </div>

        {/* Status Bar */}
        <StatusBar />
      </div>
    </div>
  );
}
