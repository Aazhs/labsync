'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useIDEStore, LANGUAGES } from '@/lib/store';
import { getLobbyByCode, subscribeToLobbyUpdates } from '@/lib/lobbyService';
import IDEHeader from '@/components/IDEHeader';
import IDESidebar from '@/components/IDESidebar';
import FileExplorer from '@/components/FileExplorer';
import LivePreview from '@/components/LivePreview';
import StatusBar from '@/components/StatusBar';
import OutputPanel from '@/components/OutputPanel';
import AIHintPanel from '@/components/AIHintPanel';
import { Plus, X, EyeOff, Radio, Copy, ArrowRight } from 'lucide-react';
import { soundManager } from '@/lib/sound';

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

function IDEPageContent() {
  const {
    code,
    language,
    isRunning,
    showOutput,
    showHintPanel,
    showReferencePane,
    setShowReferencePane,
    showExplorer,
    showLivePreview,
    toggleExplorer,
    toggleLivePreview,
    files,
    activeFileId,
    openFileIds,
    sessionMode,
    referenceCode,
    broadcastEnabled,
    setCode,
    setActiveFile,
    closeFileTab,
    createFile,
    setIsRunning,
    addOutput,
    clearOutput,
    setLastResult,
    setStdin,
    setIsWaitingForInput,
    setActiveOutputTab,
  } = useIDEStore();

  const searchParams = useSearchParams();
  const roomCode = searchParams.get('room');
  const studentName = searchParams.get('student');
  const role = searchParams.get('role');

  // If joined via a specific lobby, sync lobby language, professor broadcast, and follow mode
  useEffect(() => {
    if (!roomCode) return;
    const syncRoom = async () => {
      const lobby = await getLobbyByCode(roomCode);
      if (!lobby) return;

      if (lobby.language) {
        const langObj = LANGUAGES.find((l) => l.name === lobby.language);
        if (langObj && langObj.id !== useIDEStore.getState().language.id) {
          useIDEStore.getState().setLanguage(langObj);
        }
      }

      // Sync professor broadcast code
      const profCode = lobby.broadcast_code ?? lobby.starter_code ?? '';
      useIDEStore.getState().setReferenceCode(profCode);

      // Sync viewing permission
      const isViewingAllowed = lobby.broadcast_enabled !== false;
      useIDEStore.getState().setBroadcastEnabled(isViewingAllowed);

      // Sync follow mode
      if (lobby.follow_mode) {
        useIDEStore.getState().setSessionMode('follow');
        useIDEStore.getState().setShowReferencePane(true);
      } else {
        useIDEStore.getState().setSessionMode('practice');
      }
    };

    syncRoom();
    const unsub = subscribeToLobbyUpdates(roomCode, syncRoom);
    return () => unsub();
  }, [roomCode]);

  // Resizable panel sizes
  const [editorHeight, setEditorHeight] = useState(65); // percentage
  const [explorerWidth, setExplorerWidth] = useState(220); // pixels
  const [previewWidth, setPreviewWidth] = useState(460); // pixels
  const [hintWidth, setHintWidth] = useState(320); // pixels
  const [isResizingV, setIsResizingV] = useState(false);
  const [isResizingH, setIsResizingH] = useState(false);
  const [isResizingExplorer, setIsResizingExplorer] = useState(false);
  const [isResizingPreview, setIsResizingPreview] = useState(false);

  const runCode = useCallback(async (customStdin?: unknown) => {
    if (isRunning) return;

    // Guard against React SyntheticEvent or other objects passed by click handlers
    const stdinStr = typeof customStdin === 'string' ? customStdin : undefined;
    const isInteractiveInput = stdinStr !== undefined;
    const activeStdin = isInteractiveInput ? stdinStr : '';

    setIsRunning(true);

    // If Web Dev mode: refresh live preview and report clean status
    if (language.name === 'web') {
      if (!useIDEStore.getState().showLivePreview) {
        useIDEStore.getState().setShowLivePreview(true);
      }
      setActiveOutputTab('terminal');
      if (!useIDEStore.getState().showOutput) {
        useIDEStore.getState().toggleOutput();
      }
      addOutput({
        type: 'system',
        content: '$ labsync-web build && serve',
        timestamp: Date.now(),
      });
      addOutput({
        type: 'success',
        content: '✓ Rendered index.html with active styles and scripts',
        timestamp: Date.now(),
      });
      if (useIDEStore.getState().soundEnabled) {
        soundManager.playSuccess();
      }
      setIsRunning(false);
      return;
    }

    setActiveOutputTab('terminal');

    // Show output panel if hidden
    if (!useIDEStore.getState().showOutput) {
      useIDEStore.getState().toggleOutput();
    }

    if (!isInteractiveInput) {
      clearOutput();
      setLastResult(null);
      setStdin('');
      setIsWaitingForInput(false);
    }

    // If current file is not runnable (e.g. .md or .txt), run the entrypoint file
    const activeFile = files.find((f) => f.id === activeFileId);
    const entryFile = files.find((f) => f.isEntrypoint);
    const targetCode =
      activeFile && (activeFile.name.endsWith('.md') || activeFile.name.endsWith('.txt')) && entryFile
        ? entryFile.content
        : code;

    const targetFilename =
      activeFile?.name ||
      (language.name === 'python'
        ? 'main.py'
        : language.name === 'javascript'
        ? 'main.js'
        : language.name === 'java'
        ? 'Main.java'
        : language.name === 'cpp'
        ? 'main.cpp'
        : 'main.c');

    const cmdStr =
      language.name === 'python'
        ? `python3 ${targetFilename}`
        : language.name === 'javascript'
        ? `node ${targetFilename}`
        : language.name === 'java'
        ? `javac ${targetFilename} && java Main`
        : language.name === 'cpp'
        ? `g++ -O2 ${targetFilename} && ./a.out`
        : `gcc -O2 ${targetFilename} && ./a.out`;

    if (!isInteractiveInput) {
      addOutput({
        type: 'system',
        content: `$ ${cmdStr}`,
        timestamp: Date.now(),
      });
      if (useIDEStore.getState().soundEnabled) {
        soundManager.playExecute();
      }
    }

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: targetCode,
          languageId: language.id,
          stdin: activeStdin,
        }),
      });

      const result = await res.json();

      if (result.error && !result.status) {
        addOutput({
          type: 'error',
          content: `✗ Error: ${result.error}`,
          timestamp: Date.now(),
        });
        setIsWaitingForInput(false);
        if (useIDEStore.getState().soundEnabled) {
          soundManager.playError();
        }
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

      // Check if error is missing standard input (EOFError, NoSuchElementException, or timeout waiting for stdin)
      const isMissingInput =
        result.stderr?.includes('EOFError') ||
        result.stderr?.includes('NoSuchElementException') ||
        (result.status?.id === 5 &&
          (targetCode.includes('input(') ||
            targetCode.includes('cin') ||
            targetCode.includes('scanf') ||
            targetCode.includes('Scanner') ||
            targetCode.includes('readLine')));

      // Show stdout
      if (result.stdout) {
        let displayStdout = result.stdout;
        if (isInteractiveInput) {
          const prevOutputs = useIDEStore
            .getState()
            .output.filter((o) => o.type === 'stdout')
            .map((o) => o.content)
            .join('');
          if (prevOutputs && displayStdout.startsWith(prevOutputs.trimEnd())) {
            displayStdout = displayStdout.substring(prevOutputs.trimEnd().length);
          }
        }
        if (displayStdout.trim()) {
          addOutput({
            type: 'stdout',
            content: displayStdout.trimEnd(),
            timestamp: Date.now(),
          });
        }
      }

      if (isMissingInput) {
        setIsWaitingForInput(true);
        if (!result.stdout || !result.stdout.trim()) {
          addOutput({
            type: 'system',
            content: 'Program is waiting for input (stdin):',
            timestamp: Date.now(),
          });
        }
      } else {
        setIsWaitingForInput(false);

        // Show stderr if not missing input
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

        if (useIDEStore.getState().soundEnabled) {
          if (isSuccess) {
            soundManager.playSuccess();
          } else {
            soundManager.playError();
          }
        }

        setLastResult(result);

        if (!isSuccess && result.classification?.tier !== 'none') {
          setActiveOutputTab('problems');
        }
      }
    } catch (err) {
      addOutput({
        type: 'error',
        content: `✗ Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      });
      setIsWaitingForInput(false);
      if (useIDEStore.getState().soundEnabled) {
        soundManager.playError();
      }
    } finally {
      setIsRunning(false);
    }
  }, [
    code,
    language,
    isRunning,
    files,
    activeFileId,
    setIsRunning,
    setStdin,
    setIsWaitingForInput,
    clearOutput,
    addOutput,
    setLastResult,
    setActiveOutputTab,
  ]);

  const stopCode = useCallback(() => {
    setIsRunning(false);
    addOutput({
      type: 'system',
      content: '■ Execution stopped',
      timestamp: Date.now(),
    });
  }, [setIsRunning, addOutput]);

  // Listen for custom IDE events from Monaco editor and components
  useEffect(() => {
    const handleRunEvent = () => {
      runCode();
    };
    const handleSaveEvent = () => {
      addOutput({
        type: 'system',
        content: '✓ File saved',
        timestamp: Date.now(),
      });
    };

    window.addEventListener('labsync:run', handleRunEvent);
    window.addEventListener('labsync:save', handleSaveEvent);
    return () => {
      window.removeEventListener('labsync:run', handleRunEvent);
      window.removeEventListener('labsync:save', handleSaveEvent);
    };
  }, [runCode, addOutput]);

  // Global Keyboard shortcuts: Cmd+Enter (run), Cmd+B (explorer), Cmd+J (terminal), Cmd+M (sound)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // Cmd+Enter / Ctrl+Enter: Run Code
      if (isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        runCode();
        return;
      }

      // Cmd+B / Ctrl+B: Toggle File Explorer
      if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleExplorer();
        return;
      }

      // Cmd+J / Ctrl+J / Cmd+`: Toggle Terminal Output Panel
      if (isCmdOrCtrl && (e.key.toLowerCase() === 'j' || e.key === '`')) {
        e.preventDefault();
        useIDEStore.getState().toggleOutput();
        return;
      }

      // Cmd+M / Ctrl+M: Toggle Audio Feedback
      if (isCmdOrCtrl && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        useIDEStore.getState().toggleSound();
        return;
      }

      // Cmd+S / Ctrl+S: Prevent browser HTML save dialog
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        addOutput({
          type: 'system',
          content: '✓ File saved',
          timestamp: Date.now(),
        });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [runCode, toggleExplorer, addOutput]);

  // Horizontal resize (File Explorer)
  useEffect(() => {
    if (!isResizingExplorer) return;

    const handleMove = (e: MouseEvent) => {
      const main = document.getElementById('ide-main');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      setExplorerWidth(Math.max(160, Math.min(420, newWidth)));
    };

    const handleUp = () => setIsResizingExplorer(false);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingExplorer]);

  // Horizontal resize (Live Preview)
  useEffect(() => {
    if (!isResizingPreview) return;

    const handleMove = (e: MouseEvent) => {
      const main = document.getElementById('ide-main');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const rightEdge = showHintPanel ? rect.right - hintWidth : rect.right;
      const newWidth = rightEdge - e.clientX;
      setPreviewWidth(Math.max(260, Math.min(850, newWidth)));
    };

    const handleUp = () => setIsResizingPreview(false);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingPreview, showHintPanel, hintWidth]);

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
      setHintWidth(Math.max(240, Math.min(550, newWidth)));
    };

    const handleUp = () => setIsResizingH(false);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingH]);

  const handleCreateNewTab = () => {
    const ext =
      language.name === 'python'
        ? '.py'
        : language.name === 'javascript'
        ? '.js'
        : language.name === 'java'
        ? '.java'
        : language.name === 'cpp'
        ? '.cpp'
        : language.name === 'web'
        ? '.html'
        : '.c';
    createFile(`file${files.length + 1}${ext}`);
  };

  return (
    <div className="ide-container">
      {/* Header */}
      <IDEHeader
        onRun={() => runCode()}
        onStop={stopCode}
        roomCode={roomCode}
        studentName={studentName}
        role={role}
      />

      {/* Activity Sidebar */}
      <IDESidebar />

      {/* Main Workspace */}
      <div
        id="ide-main"
        style={{
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        {/* Full-screen mouse capture overlay during dragging */}
        {(isResizingExplorer || isResizingPreview || isResizingV || isResizingH) && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              cursor: isResizingV ? 'row-resize' : 'col-resize',
              userSelect: 'none',
            }}
          />
        )}

        {/* File Explorer (Left side) */}
        {showExplorer && (
          <>
            <div
              style={{
                width: explorerWidth,
                flexShrink: 0,
                overflow: 'hidden',
                display: 'flex',
                height: '100%',
              }}
            >
              <FileExplorer />
            </div>
            <div
              className={`resize-divider-col ${isResizingExplorer ? 'dragging' : ''}`}
              onMouseDown={() => setIsResizingExplorer(true)}
            />
          </>
        )}

        {/* Center: Editor (Top) + Output (Bottom) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 260,
            overflow: 'hidden',
            height: '100%',
          }}
        >
          {/* Follow Mode Banner */}
          {sessionMode === 'follow' ? (
            <div
              className="mode-banner mode-follow"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="live-dot" />
                <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: '0.06em', color: '#fff' }}>
                  FOLLOW MODE ACTIVE
                </span>
                <span style={{ color: 'var(--brand-light)', fontSize: 11, fontWeight: 500, textTransform: 'none' }}>
                  • Watching professor&apos;s live demonstration code in split view
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowReferencePane(!showReferencePane)}
                className="btn btn-secondary"
                style={{ height: 24, fontSize: 10, padding: '0 8px', borderRadius: 3 }}
              >
                {showReferencePane ? 'Hide Professor Split' : 'Show Professor Split'}
              </button>
            </div>
          ) : (
            showReferencePane && (
              <div
                className="mode-banner mode-practice"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--accent-success-light)', fontWeight: 700 }}>✏️ PRACTICE MODE</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'none' }}>
                    — Split view open to professor&apos;s reference material
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReferencePane(false)}
                  className="btn btn-ghost"
                  style={{ height: 22, fontSize: 10, padding: '0 8px' }}
                >
                  Close Reference
                </button>
              </div>
            )
          )}

          {/* Editor Area (Top) */}
          <div
            style={{
              flex: showOutput ? `0 0 ${editorHeight}%` : 1,
              display: 'flex',
              overflow: 'hidden',
              minHeight: 100,
            }}
          >
            {/* Reference Pane (Professor's Code) */}
            {showReferencePane && (
              <>
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
                  <div className="panel-header" style={{ height: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Radio size={13} style={{ color: 'var(--brand-light)' }} />
                      <span style={{ fontWeight: 700, fontSize: 12 }}>Professor&apos;s Code (Read-Only)</span>
                      {broadcastEnabled && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(61, 140, 111, 0.2)', color: 'var(--accent-success-light)' }}>
                          LIVE SYNC
                        </span>
                      )}
                    </div>
                    {broadcastEnabled && referenceCode && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(referenceCode);
                            alert('Copied professor code to clipboard!');
                          }}
                          title="Copy code to clipboard"
                          style={{ height: 22, fontSize: 10, padding: '0 6px', borderRadius: 3 }}
                        >
                          <Copy size={11} style={{ marginRight: 3 }} />
                          Copy
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setCode(referenceCode);
                            alert('Pasted professor code into your editor!');
                          }}
                          title="Replace my code with professor's code"
                          style={{ height: 22, fontSize: 10, padding: '0 6px', borderRadius: 3 }}
                        >
                          <ArrowRight size={11} style={{ marginRight: 3 }} />
                          Use Code
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    {broadcastEnabled ? (
                      <CodeEditor
                        readOnly={true}
                        value={referenceCode || '// Waiting for professor to broadcast code...'}
                      />
                    ) : (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        padding: 24,
                        textAlign: 'center',
                        gap: 12,
                        background: 'var(--bg-secondary)',
                      }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          background: 'rgba(224, 74, 59, 0.12)',
                          border: '1px solid rgba(224, 74, 59, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-danger)',
                        }}>
                          <EyeOff size={22} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                            Professor Code Viewing Disabled
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, lineHeight: 1.5 }}>
                            Your instructor has temporarily hidden the broadcast code for this exercise. Complete the lab independently!
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="resize-divider-col" />
              </>
            )}

            {/* Main Code Editor */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="tab-bar">
                {openFileIds.map((id) => {
                  const file = files.find((f) => f.id === id);
                  if (!file) return null;
                  const isActive = id === activeFileId;

                  const getDotColor = (name: string) => {
                    if (name.endsWith('.html') || name.endsWith('.htm')) return '#e04a3b';
                    if (name.endsWith('.css')) return '#5b8db8';
                    if (name.endsWith('.py')) return '#5b8db8';
                    if (name.endsWith('.js') || name.endsWith('.ts')) return '#e8a838';
                    if (name.endsWith('.cpp') || name.endsWith('.c') || name.endsWith('.h')) return '#3d8c6f';
                    if (name.endsWith('.java')) return '#c0392b';
                    return 'var(--text-muted)';
                  };

                  return (
                    <div
                      key={id}
                      className={`tab ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveFile(id)}
                    >
                      <span style={{ fontSize: 9, color: getDotColor(file.name) }}>●</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {file.name}
                      </span>
                      {openFileIds.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeFileTab(id);
                          }}
                          className="tab-close-btn"
                          title="Close tab"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={handleCreateNewTab}
                  className="btn-icon"
                  title="New file tab"
                  style={{ marginLeft: 4, width: 24, height: 24, borderRadius: 3 }}
                >
                  <Plus size={13} />
                </button>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <CodeEditor />
              </div>
            </div>
          </div>

          {/* Vertical divider between Editor and Output */}
          {showOutput && (
            <div
              className={`resize-divider-row ${isResizingV ? 'dragging' : ''}`}
              onMouseDown={() => setIsResizingV(true)}
            />
          )}

          {/* Output Panel (Bottom) */}
          {showOutput && (
            <div
              style={{
                flex: `0 0 ${100 - editorHeight}%`,
                minHeight: 80,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <OutputPanel onRun={(customStdin?: string) => runCode(customStdin)} />
            </div>
          )}
        </div>

        {/* Live Preview Pane (Right side, ONLY when toggled!) */}
        {showLivePreview && (
          <>
            <div
              className={`resize-divider-col ${isResizingPreview ? 'dragging' : ''}`}
              onMouseDown={() => setIsResizingPreview(true)}
            />
            <div
              style={{
                width: previewWidth,
                flexShrink: 0,
                overflow: 'hidden',
                display: 'flex',
                height: '100%',
              }}
            >
              <LivePreview onClose={toggleLivePreview} />
            </div>
          </>
        )}

        {/* AI Hint Panel (Rightmost) */}
        {showHintPanel && (
          <>
            <div
              className={`resize-divider-col ${isResizingH ? 'dragging' : ''}`}
              onMouseDown={() => setIsResizingH(true)}
            />
            <div
              style={{
                width: hintWidth,
                flexShrink: 0,
                overflow: 'hidden',
                display: 'flex',
                height: '100%',
              }}
            >
              <AIHintPanel />
            </div>
          </>
        )}
      </div>

      {/* Status Bar (spans full width at bottom) */}
      <StatusBar />
    </div>
  );
}

export default function IDEPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}>
          <div className="loading-spinner" style={{ marginRight: 8 }} />
          Loading workspace...
        </div>
      }
    >
      <IDEPageContent />
    </Suspense>
  );
}
