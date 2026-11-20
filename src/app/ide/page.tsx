'use client';

import { useCallback, useEffect, useState, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useIDEStore, LANGUAGES } from '@/lib/store';
import {
  getLobbyByCode,
  getStudentSession,
  isLobbyOwner,
  LabLobby,
  LobbyStatus,
  subscribeToLobbyUpdates,
  updateLobbyStatus,
} from '@/lib/lobbyService';
import { getTeacherSession } from '@/lib/teacherAuth';
import { getDemoSeat } from '@/lib/demoClass';
import { useStudentSync } from '@/lib/useStudentSync';
import IDEHeader from '@/components/IDEHeader';
import IDESidebar from '@/components/IDESidebar';
import FileExplorer from '@/components/FileExplorer';
import LivePreview from '@/components/LivePreview';
import StatusBar from '@/components/StatusBar';
import OutputPanel from '@/components/OutputPanel';
import AIHintPanel from '@/components/AIHintPanel';
import { Plus, X, Eye, EyeOff, Radio, Lock, Hand, CheckCircle2, CloudOff } from 'lucide-react';
import { soundManager } from '@/lib/sound';

const CodeVisualiser = dynamic(() => import('@/components/visualiser/CodeVisualiser'), { ssr: false });

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

  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCode = searchParams.get('room');
  const wantsTeacher = searchParams.get('role') === 'teacher';
  // A teacher opening one of the demo class's sample students from the dashboard.
  const demoStudentId = wantsTeacher ? null : searchParams.get('student');

  const [visualising, setVisualising] = useState(false);
  const [lobby, setLobby] = useState<LabLobby | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [teacher] = useState(() => getTeacherSession());
  const [demoSeat] = useState(() => (roomCode && demoStudentId ? getDemoSeat(roomCode, demoStudentId) : null));
  const [studentSession] = useState(() =>
    roomCode ? (demoStudentId ? demoSeat : getStudentSession(roomCode)) : null
  );
  const [workspaceReady, setWorkspaceReady] = useState(!roomCode);
  const wasFollowingRef = useRef(false);

  const isTeacher = Boolean(lobby && wantsTeacher && isLobbyOwner(lobby, teacher));
  const lobbyStatus: LobbyStatus = lobby?.status ?? 'active';
  const runLocked = Boolean(roomCode && !isTeacher && lobbyStatus === 'paused');
  const studentSync = useStudentSync(
    isTeacher ? null : studentSession,
    Boolean(lobby) && lobbyStatus !== 'completed'
  );
  const reportRun = studentSync.reportRun;

  // Queue for rapid consecutive stdin inputs
  const pendingStdinRef = useRef<string | null>(null);
  const runCodeRef = useRef<(customStdin?: unknown) => Promise<void>>(() => Promise.resolve());
  const abortRef = useRef<AbortController | null>(null);

  // Apply the lab's state: load its code into the workspace once, then keep the
  // instructor's broadcast, viewing permission and follow mode in sync.
  const applyLobby = useCallback(
    (next: LabLobby) => {
      setLobby(next);
      const store = useIDEStore.getState();
      const isOwner = wantsTeacher && isLobbyOwner(next, teacher);

      if (store.workspaceRoom !== next.room_code) {
        const lang = LANGUAGES.find((l) => l.name === next.language) ?? LANGUAGES[0];
        const initialCode = isOwner
          ? next.broadcast_code || next.starter_code
          : demoSeat?.code ?? next.starter_code;
        store.loadWorkspace(lang, initialCode || null, next.room_code);
      }
      setWorkspaceReady(true);

      if (isOwner) return;
      const viewingAllowed = next.broadcast_enabled !== false;
      const following = Boolean(next.follow_mode) && viewingAllowed;
      store.setReferenceCode(next.broadcast_code ?? '');
      store.setBroadcastEnabled(viewingAllowed);
      store.setSessionMode(following ? 'follow' : 'practice');
      // Open the split view when follow mode starts, but let students close it afterwards.
      if (following && !wasFollowingRef.current) store.setShowReferencePane(true);
      if (!viewingAllowed && wasFollowingRef.current) store.setShowReferencePane(false);
      wasFollowingRef.current = following;
    },
    [teacher, wantsTeacher, demoSeat]
  );

  // The saved workspace is keyed by room and role; reload it for this URL (matters after
  // client-side navigation, when the store was first created on another page).
  useEffect(() => {
    if (roomCode) return;
    useIDEStore.persist.rehydrate();
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;
    let hydrated = false;
    const load = async () => {
      try {
        if (!hydrated) {
          await useIDEStore.persist.rehydrate();
          hydrated = true;
        }
        const next = await getLobbyByCode(roomCode);
        if (cancelled) return;
        if (next) applyLobby(next);
        else setRoomError(`No lab found with code ${roomCode}.`);
      } catch {
        if (!cancelled) setRoomError('Could not reach the lab server. Check your connection and reload.');
      }
    };
    load();
    const unsubscribe = subscribeToLobbyUpdates(roomCode, (change) => {
      if (change.table === 'lab_lobbies') applyLobby(change.lobby);
      else if (change.table === 'unknown') load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [roomCode, applyLobby]);

  // Students need to join (name + PRN) before entering a lab.
  const notOwner = Boolean(lobby && wantsTeacher && !isTeacher);
  const needsJoin = Boolean(roomCode && lobby && !wantsTeacher && !studentSession);
  useEffect(() => {
    if (needsJoin) router.replace(`/join?code=${roomCode}`);
  }, [needsJoin, roomCode, router]);

  const handleStatusChange = async (nextStatus: LobbyStatus) => {
    if (!roomCode) return;
    try {
      setLobby(await updateLobbyStatus(roomCode, nextStatus));
    } catch (err) {
      addOutput({
        type: 'error',
        content: `✗ Could not change the lab status: ${err instanceof Error ? err.message : 'unknown error'}`,
        timestamp: Date.now(),
      });
    }
  };

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
    // Guard against React SyntheticEvent or other objects passed by click handlers
    const stdinStr = typeof customStdin === 'string' ? customStdin : undefined;
    const isInteractiveInput = stdinStr !== undefined;
    const activeStdin = isInteractiveInput ? stdinStr : '';

    if (runLocked) {
      setActiveOutputTab('terminal');
      if (!useIDEStore.getState().showOutput) useIDEStore.getState().toggleOutput();
      addOutput({
        type: 'system',
        content: '⏸ Your instructor has paused the lab. Running code is disabled until they resume it.',
        timestamp: Date.now(),
      });
      return;
    }

    if (isRunning) {
      if (isInteractiveInput) {
        // Queue this stdin so it immediately executes when the currently running process finishes
        pendingStdinRef.current = activeStdin;
      }
      return;
    }

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

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        signal: controller.signal,
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
        Boolean(result.is_missing_input) ||
        result.status?.id === 13 ||
        result.stderr?.includes('EOFError') ||
        result.stderr?.includes('NoSuchElementException') ||
        result.stderr?.includes('ios_base::failure') ||
        result.stderr?.includes('iostream_category') ||
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
        reportRun(isSuccess, result.classification);

        if (!isSuccess && result.classification?.tier !== 'none') {
          setActiveOutputTab('problems');
        }
      }
    } catch (err) {
      // Stopped by the user; stopCode already reported it.
      if (controller.signal.aborted) return;
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
      abortRef.current = null;
      setIsRunning(false);
      if (!controller.signal.aborted && pendingStdinRef.current !== null) {
        const nextInput = pendingStdinRef.current;
        pendingStdinRef.current = null;
        setTimeout(() => {
          runCodeRef.current(nextInput);
        }, 30);
      }
    }
  }, [
    code,
    language,
    isRunning,
    runLocked,
    reportRun,
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

  useEffect(() => {
    runCodeRef.current = runCode;
  }, [runCode]);

  const stopCode = useCallback(() => {
    abortRef.current?.abort();
    pendingStdinRef.current = null;
    setIsRunning(false);
    setIsWaitingForInput(false);
    addOutput({
      type: 'system',
      content: '■ Execution stopped',
      timestamp: Date.now(),
    });
  }, [setIsRunning, setIsWaitingForInput, addOutput]);

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

  if (roomError || notOwner) {
    return (
      <RoomGate
        title={notOwner ? 'This lab belongs to another instructor' : 'Lab unavailable'}
        message={
          notOwner
            ? 'Sign in with the instructor account that created this lab to manage it.'
            : roomError!
        }
        action={notOwner ? { href: '/login', label: 'Instructor sign in' } : { href: '/join', label: 'Join a different lab' }}
      />
    );
  }

  if (!workspaceReady || needsJoin) {
    return <LoadingScreen label={needsJoin ? 'Redirecting to join…' : 'Joining lab…'} />;
  }

  const studentControls =
    roomCode && !isTeacher && studentSession && lobbyStatus !== 'completed' ? (
      <>
        {studentSync.syncError && (
          <span title={studentSync.syncError} className="ih-offline">
            <CloudOff size={14} />
            Offline
          </span>
        )}
        <button
          type="button"
          className={`btn btn-secondary ih-btn ih-hand${studentSync.handRaised ? ' is-on' : ''}`}
          onClick={studentSync.toggleHandRaised}
          aria-pressed={studentSync.handRaised}
          title={studentSync.handRaised ? 'Lower your hand' : 'Let your instructor know you need help'}
        >
          <Hand size={14} />
          {studentSync.handRaised ? 'Help requested' : 'Ask for help'}
        </button>
        <button
          type="button"
          className={`btn btn-secondary ih-btn ih-done${studentSync.done ? ' is-on' : ''}`}
          onClick={studentSync.toggleDone}
          aria-pressed={studentSync.done}
          title={studentSync.done ? 'Mark as still working' : 'Tell your instructor you have finished'}
        >
          <CheckCircle2 size={14} />
          {studentSync.done ? 'Done' : 'I’m done'}
        </button>
      </>
    ) : null;

  return (
    <div className="ide-container">
      {/* Header */}
      <IDEHeader
        onRun={() => runCode()}
        onStop={stopCode}
        onVisualise={() => setVisualising(true)}
        roomCode={roomCode}
        labTitle={lobby?.title}
        studentName={isTeacher ? null : studentSession?.name}
        prn={isTeacher ? null : studentSession?.prn}
        role={isTeacher ? 'teacher' : 'student'}
        lobbyStatus={lobbyStatus}
        onStatusChange={handleStatusChange}
        runLocked={runLocked}
        initialBroadcast={Boolean(lobby?.follow_mode)}
        broadcastReady={isTeacher && workspaceReady}
        extraControls={studentControls}
      />

      {visualising && <CodeVisualiser onClose={() => setVisualising(false)} locked={runLocked}
        referenceAllowed={Boolean(roomCode && !isTeacher && broadcastEnabled && referenceCode)} />}

      <div className="ide-notices">
        {roomCode && lobbyStatus === 'paused' && (
          <div className="ide-notice ide-notice-paused">
            <strong>Lab paused.</strong>
            {isTeacher ? ' Students cannot run code until you resume.' : ' Your instructor is explaining something. You can keep editing; running is off for now.'}
          </div>
        )}
        {roomCode && lobbyStatus === 'completed' && (
          <div className="ide-notice">
            <strong>This lab has ended.</strong>
            {isTeacher ? ' Students can no longer join or send updates.' : ' Your code stays in this browser, but your instructor no longer receives updates.'}
          </div>
        )}
      </div>

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
          {(sessionMode === 'follow' || showReferencePane) && !isTeacher && (
            <div className={`ide-share-bar${sessionMode === 'follow' ? ' is-live' : ''}`}>
              <span className="ide-share-dot" />
              <span className="ide-share-text">
                {sessionMode === 'follow' ? 'Your instructor is sharing their code' : 'Your instructor has stopped sharing'}
              </span>
              <button
                type="button"
                className="btn btn-ghost ih-btn"
                onClick={() => setShowReferencePane(!showReferencePane)}
              >
                {showReferencePane ? <EyeOff size={13} /> : <Eye size={13} />}
                {showReferencePane ? 'Hide' : 'Show'}
              </button>
            </div>
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
                  <div className="panel-header ide-ref-head">
                    <span className="ide-ref-title">
                      <Radio size={13} />
                      Instructor’s code
                    </span>
                    {broadcastEnabled && (
                      <span className="ide-ref-lock" title="Type it yourself: copying is turned off so you practise.">
                        <Lock size={11} />
                        Read-only
                      </span>
                    )}
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    {broadcastEnabled ? (
                      <CodeEditor
                        readOnly={true}
                        disableCopy={true}
                        value={referenceCode || '// Your instructor’s code will appear here when they start sharing.'}
                      />
                    ) : (
                      <div className="ide-ref-empty">
                        <EyeOff size={20} />
                        <p>Your instructor is not sharing their code right now.</p>
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

function LoadingScreen({ label }: { label: string }) {
  return (
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
      {label}
    </div>
  );
}

function RoomGate({ title, message, action }: { title: string; message: string; action: { href: string; label: string } }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: 16,
    }}>
      <div style={{
        maxWidth: 420,
        width: '100%',
        padding: 24,
        borderRadius: 8,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Link href="/" className="btn btn-ghost" style={{ height: 32, fontSize: 12, padding: '0 14px' }}>
            Home
          </Link>
          <Link href={action.href} className="btn btn-primary" style={{ height: 32, fontSize: 12, padding: '0 14px' }}>
            {action.label}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function IDEPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading workspace…" />}>
      <IDEPageContent />
    </Suspense>
  );
}
