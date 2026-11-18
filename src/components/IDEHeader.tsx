'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, Lock, Minus, Pause, Play, Plus, Settings, Sparkles, Square, X } from 'lucide-react';
import { useIDEStore, LANGUAGES } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { updateLobbyBroadcast } from '@/lib/lobbyService';

interface IDEHeaderProps {
  onRun: () => void;
  onStop: () => void;
  roomCode?: string | null;
  labTitle?: string | null;
  studentName?: string | null;
  prn?: string | null;
  role?: string | null;
  lobbyStatus?: 'active' | 'paused' | 'completed';
  onStatusChange?: (status: 'active' | 'paused' | 'completed') => void;
  /** Students can't run code while the instructor has paused the lab. */
  runLocked?: boolean;
  /** Teacher only: whether the lab was sharing when the IDE opened. */
  initialBroadcast?: boolean;
  /** Teacher only: false until the editor holds this lab's code, so nothing stale is shared. */
  broadcastReady?: boolean;
  /** Extra controls rendered before Run (e.g. student raise-hand). */
  extraControls?: React.ReactNode;
}

const SHORTCUTS = [
  { key: 'Ctrl / ⌘ + Enter', action: 'Run code' },
  { key: 'Ctrl / ⌘ + B', action: 'Show or hide files' },
  { key: 'Ctrl / ⌘ + J', action: 'Show or hide the terminal' },
  { key: 'Ctrl / ⌘ + /', action: 'Comment a line' },
  { key: '↑ / ↓', action: 'Previous input in the terminal' },
];

export default function IDEHeader({
  onRun,
  onStop,
  roomCode,
  labTitle,
  studentName,
  role,
  lobbyStatus = 'active',
  onStatusChange,
  runLocked = false,
  initialBroadcast = false,
  broadcastReady = false,
  extraControls,
}: IDEHeaderProps) {
  const {
    code,
    language,
    setLanguage,
    isRunning,
    showHintPanel,
    toggleHintPanel,
    showLivePreview,
    toggleLivePreview,
    files,
    fontSize,
    setFontSize,
    soundEnabled,
    toggleSound,
    vimModeEnabled,
    toggleVimMode,
  } = useIDEStore();
  const { theme, setTheme } = useTheme();

  const isTeacher = role === 'teacher' && Boolean(roomCode);
  const [showSettings, setShowSettings] = useState(false);
  // null until the teacher picks; until then follow the lab's current setting.
  const [shareChoice, setShareChoice] = useState<boolean | null>(null);
  const sharing = shareChoice ?? initialBroadcast;
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While sharing, push the teacher's code to students shortly after each edit.
  useEffect(() => {
    if (!isTeacher || !roomCode || !broadcastReady || !sharing) return;
    timerRef.current = setTimeout(async () => {
      setSyncState('syncing');
      try {
        await updateLobbyBroadcast(roomCode, { broadcast_code: code, follow_mode: true, broadcast_enabled: true });
        setSyncState('idle');
      } catch {
        setSyncState('error');
      }
    }, 250);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code, sharing, broadcastReady, roomCode, isTeacher]);

  const toggleSharing = async () => {
    const next = !sharing;
    setShareChoice(next);
    if (!roomCode || !broadcastReady) return;
    setSyncState('syncing');
    try {
      await updateLobbyBroadcast(
        roomCode,
        next
          ? { broadcast_code: code, follow_mode: true, broadcast_enabled: true }
          : { follow_mode: false, broadcast_enabled: false }
      );
      setSyncState('idle');
    } catch {
      setSyncState('error');
    }
  };

  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowSettings(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSettings]);

  const isWeb = language.name === 'web' || files.some((f) => f.name.endsWith('.html'));

  return (
    <>
      <header className="ide-header">
        <div className="ih-left">
          <Link href={isTeacher ? '/dashboard' : '/'} className="ih-brand" aria-label={isTeacher ? 'Back to dashboard' : 'LabSync home'}>
            <Image src="/logo.png" alt="" width={26} height={26} />
          </Link>

          {roomCode ? (
            <div className="ih-lab">
              <span className="ih-lab-title">{labTitle || 'Lab'}</span>
              <span className="ih-lab-meta">
                <span className="ih-mono">{roomCode}</span>
                {studentName && <span>{studentName}</span>}
                {isTeacher && <span>You are teaching</span>}
              </span>
            </div>
          ) : (
            <span className="ih-lab-title">Practice editor</span>
          )}

          {isTeacher && (
            <Link href="/dashboard" className="btn btn-ghost ih-btn">
              Dashboard
            </Link>
          )}
        </div>

        <div className="ih-right">
          {isTeacher && (
            <>
              <button
                type="button"
                role="switch"
                aria-checked={sharing}
                className={`ih-share${sharing ? ' is-on' : ''}`}
                onClick={toggleSharing}
                title={sharing ? 'Students see your code beside theirs. Click to stop.' : 'Show your code beside every student’s editor'}
              >
                <span className="ih-share-track"><span className="ih-share-thumb" /></span>
                <span>
                  {syncState === 'error' ? 'Sharing failed, retrying on next edit' : sharing ? 'Sharing with class' : 'Share my code'}
                </span>
              </button>

              {lobbyStatus === 'paused' ? (
                <button type="button" className="btn btn-secondary ih-btn" onClick={() => onStatusChange?.('active')}>
                  <Play size={13} />
                  Resume lab
                </button>
              ) : lobbyStatus === 'active' ? (
                <button
                  type="button"
                  className="btn btn-secondary ih-btn"
                  onClick={() => onStatusChange?.('paused')}
                  title="Stop students from running code while you explain"
                >
                  <Pause size={13} />
                  Pause lab
                </button>
              ) : null}
              <span className="ih-divider" />
            </>
          )}

          {!roomCode && (
            <select
              className="ih-select"
              aria-label="Language"
              value={language.id}
              onChange={(e) => {
                const lang = LANGUAGES.find((l) => l.id === Number(e.target.value));
                if (!lang) return;
                if (!window.confirm(`Switch to ${lang.label}? Your current files will be replaced with a new template.`)) return;
                setLanguage(lang);
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          )}
          {roomCode && <span className="ih-lang">{language.label}</span>}

          {extraControls}

          {isWeb && (
            <button
              type="button"
              className={`btn btn-secondary ih-btn${showLivePreview ? ' is-on' : ''}`}
              onClick={toggleLivePreview}
              aria-pressed={showLivePreview}
            >
              <Eye size={14} />
              Preview
            </button>
          )}

          {isRunning ? (
            <button className="btn btn-danger ih-run" onClick={onStop}>
              <Square size={13} />
              Stop
            </button>
          ) : (
            <button
              className="btn btn-success ih-run"
              onClick={() => onRun()}
              disabled={runLocked}
              title={runLocked ? 'Your instructor has paused the lab' : 'Run (Ctrl + Enter)'}
            >
              {runLocked ? <Lock size={13} /> : <Play size={13} fill="currentColor" />}
              {runLocked ? 'Paused' : language.name === 'web' ? 'Refresh' : 'Run'}
            </button>
          )}

          <button
            className={`btn-icon${showHintPanel ? ' active' : ''}`}
            onClick={toggleHintPanel}
            aria-pressed={showHintPanel}
            title="Ask for a hint"
            aria-label="Ask for a hint"
          >
            <Sparkles size={16} />
          </button>
          <button className="btn-icon" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="form-modal-head">
              <h2 id="settings-title">Editor settings</h2>
              <button className="btn-icon" onClick={() => setShowSettings(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '6px 0 4px' }}>
              <div className="settings-row">
                <div className="settings-label">Text size</div>
                <div className="ih-stepper">
                  <button className="btn-icon" onClick={() => setFontSize(Math.max(10, fontSize - 1))} aria-label="Smaller text">
                    <Minus size={13} />
                  </button>
                  <span className="ih-mono">{fontSize}</span>
                  <button className="btn-icon" onClick={() => setFontSize(Math.min(28, fontSize + 1))} aria-label="Larger text">
                    <Plus size={13} />
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <div className="settings-label">Theme</div>
                <div className="ih-segment">
                  <button className={theme === 'light' ? 'is-on' : ''} onClick={() => setTheme('light')}>Light</button>
                  <button className={theme === 'dark' ? 'is-on' : ''} onClick={() => setTheme('dark')}>Dark</button>
                </div>
              </div>
              <SettingToggle label="Sounds on run" on={soundEnabled} onToggle={toggleSound} />
              <SettingToggle label="Vim keys" on={vimModeEnabled} onToggle={toggleVimMode} />
            </div>

            <div className="ih-shortcuts">
              <h3>Keyboard shortcuts</h3>
              {SHORTCUTS.map((s) => (
                <div key={s.action} className="ih-shortcut">
                  <span>{s.action}</span>
                  <kbd>{s.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SettingToggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="settings-row">
      <div className="settings-label">{label}</div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={`ih-share ih-share-plain${on ? ' is-on' : ''}`} onClick={onToggle}>
        <span className="ih-share-track"><span className="ih-share-thumb" /></span>
      </button>
    </div>
  );
}
