'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useIDEStore, LANGUAGES } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import {
  Play,
  Square,
  Sparkles,
  Monitor,
  Settings,
  ChevronDown,
  X,
  Minus,
  Plus,
  Keyboard,
  Sun,
  Moon,
  Eye,
  Volume2,
  VolumeX,
  Users,
  Radio,
  LayoutDashboard,
  Check,
  Pause,
  Lock,
} from 'lucide-react';
import { updateLobbyBroadcast } from '@/lib/lobbyService';

interface IDEHeaderProps {
  onRun: () => void;
  onStop: () => void;
  roomCode?: string | null;
  studentName?: string | null;
  prn?: string | null;
  role?: string | null;
  lobbyStatus?: 'active' | 'paused' | 'completed';
  onStatusChange?: (status: 'active' | 'paused' | 'completed') => void;
}

export default function IDEHeader({
  onRun,
  onStop,
  roomCode,
  studentName,
  prn,
  role,
  lobbyStatus = 'active',
  onStatusChange,
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
    sessionMode,
    fontSize,
    setFontSize,
    soundEnabled,
    toggleSound,
    vimModeEnabled,
    toggleVimMode,
  } = useIDEStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState(true); // Default to Broadcast Mode as requested
  const [isSyncing, setIsSyncing] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  // Auto-broadcast teacher code continuously when in Broadcast Mode
  useEffect(() => {
    if (role !== 'teacher' || !roomCode) return;

    if (!broadcastMode) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setIsSyncing(false);
      return;
    }

    setIsSyncing(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await updateLobbyBroadcast(roomCode, {
          broadcast_code: code,
          follow_mode: true,
          broadcast_enabled: true,
        });
      } catch (err) {
        console.error('Auto-broadcast error:', err);
      } finally {
        setIsSyncing(false);
      }
    }, 450);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [code, broadcastMode, roomCode, role]);

  const handleToggleBroadcastMode = async (enableBroadcast: boolean) => {
    setBroadcastMode(enableBroadcast);
    if (!roomCode) return;

    if (enableBroadcast) {
      setIsSyncing(true);
      await updateLobbyBroadcast(roomCode, {
        broadcast_code: code,
        follow_mode: true,
        broadcast_enabled: true,
      });
      setIsSyncing(false);
    } else {
      await updateLobbyBroadcast(roomCode, {
        follow_mode: false,
        broadcast_enabled: false,
      });
    }
  };

  return (
    <>
      <header className="ide-header">
        {/* Left: Logo + Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Image
              src="/logo.png"
              alt="LabSync"
              width={28}
              height={28}
              style={{ borderRadius: 'var(--radius-sm)' }}
            />
            <span style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
            }}>
              LabSync
            </span>
          </div>

          <div style={{ width: 1, height: 22, background: 'var(--border)', marginLeft: 2 }} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            background: sessionMode === 'follow'
              ? 'rgba(91, 141, 184, 0.1)'
              : 'rgba(61, 140, 111, 0.1)',
            color: sessionMode === 'follow'
              ? 'var(--accent-info)'
              : 'var(--accent-success)',
            border: `1px solid ${sessionMode === 'follow'
              ? 'rgba(91, 141, 184, 0.2)'
              : 'rgba(61, 140, 111, 0.2)'}`,
          }}>
            <Monitor size={10} />
            {sessionMode === 'follow' ? 'Follow' : 'Practice'}
          </div>

          {roomCode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: 'rgba(212, 148, 58, 0.12)',
                color: 'var(--brand-light)',
                border: '1px solid rgba(212, 148, 58, 0.35)',
                cursor: 'pointer',
              }}
              onClick={() => {
                navigator.clipboard.writeText(roomCode);
                alert(`Room code #${roomCode} copied to clipboard!`);
              }}
              title="Click to copy 6-digit room code"
            >
              <Users size={11} />
              <span>ROOM #{roomCode}</span>
              {studentName && (
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'none' }}>
                  ({studentName}{prn ? ` • PRN: ${prn}` : ''})
                </span>
              )}
              {role === 'teacher' && (
                <span style={{ color: 'var(--accent-info)', fontWeight: 700 }}>
                  [Host]
                </span>
              )}
            </div>
          )}

          {roomCode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background:
                  lobbyStatus === 'paused'
                    ? 'rgba(217, 119, 6, 0.15)'
                    : lobbyStatus === 'completed'
                    ? 'rgba(113, 113, 122, 0.15)'
                    : 'rgba(34, 197, 94, 0.15)',
                color:
                  lobbyStatus === 'paused'
                    ? 'var(--accent-warning)'
                    : lobbyStatus === 'completed'
                    ? 'var(--text-muted)'
                    : 'var(--accent-success)',
                border: `1px solid ${
                  lobbyStatus === 'paused'
                    ? 'rgba(217, 119, 6, 0.3)'
                    : lobbyStatus === 'completed'
                    ? 'rgba(113, 113, 122, 0.3)'
                    : 'rgba(34, 197, 94, 0.3)'
                }`,
              }}
              title={`Lab Session Status: ${lobbyStatus}`}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'currentColor',
                }}
              />
              {lobbyStatus}
            </div>
          )}

          {role === 'teacher' && roomCode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {lobbyStatus === 'paused' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onStatusChange?.('active')}
                  style={{ height: 24, fontSize: 10, padding: '0 8px', borderRadius: 4, gap: 4 }}
                  title="Resume lab: allow students to execute code"
                >
                  <Play size={10} fill="currentColor" />
                  Resume Lab
                </button>
              ) : lobbyStatus === 'completed' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onStatusChange?.('active')}
                  style={{ height: 24, fontSize: 10, padding: '0 8px', borderRadius: 4, gap: 4 }}
                  title="Restart lab session for students"
                >
                  <Play size={10} fill="currentColor" />
                  Start Lab
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onStatusChange?.('paused')}
                  style={{ height: 24, fontSize: 10, padding: '0 8px', borderRadius: 4, gap: 4 }}
                  title="Pause lab: prevents student code execution while you lecture"
                >
                  <Pause size={10} fill="currentColor" />
                  Pause Lab
                </button>
              )}

              <a
                href="/dashboard"
                className="btn btn-ghost"
                style={{
                  height: 24,
                  fontSize: 10,
                  padding: '0 8px',
                  borderRadius: 4,
                  gap: 4,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Return to Instructor Dashboard"
              >
                <LayoutDashboard size={11} />
                Dashboard
              </a>
            </div>
          )}
        </div>

        {/* Center: Instructor Broadcast Slider + Language + Run */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {role === 'teacher' && roomCode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '3px 4px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 8,
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.4)',
              }}
              title="Instructor Broadcast Controller: Continuously streams your code to all students"
            >
              {/* Segmented slider pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: 6,
                  padding: 2,
                  gap: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggleBroadcastMode(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 26,
                    padding: '0 11px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 4,
                    border: broadcastMode ? '1px solid rgba(212, 148, 58, 0.6)' : '1px solid transparent',
                    background: broadcastMode
                      ? 'linear-gradient(135deg, rgba(212, 148, 58, 0.25) 0%, rgba(224, 74, 59, 0.25) 100%)'
                      : 'transparent',
                    color: broadcastMode ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    boxShadow: broadcastMode ? '0 1px 8px rgba(212, 148, 58, 0.35)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  title="Broadcast Mode (Default): Automatically broadcasts your code live to all students in the room"
                >
                  <Radio size={12} style={{ color: broadcastMode ? 'var(--brand-light)' : 'inherit' }} />
                  <span>Broadcast Mode</span>
                  {broadcastMode && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isSyncing ? 'var(--accent-info)' : 'var(--accent-success)',
                        boxShadow: isSyncing
                          ? '0 0 6px var(--accent-info)'
                          : '0 0 6px var(--accent-success)',
                        animation: 'pulse-live-dot 1.5s infinite',
                      }}
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleBroadcastMode(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 26,
                    padding: '0 11px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 4,
                    border: !broadcastMode ? '1px solid var(--border-medium)' : '1px solid transparent',
                    background: !broadcastMode ? 'var(--bg-surface)' : 'transparent',
                    color: !broadcastMode ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    boxShadow: !broadcastMode ? '0 1px 4px rgba(0, 0, 0, 0.25)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  title="Normal Mode: Private editor. Code is kept private and not broadcast to students."
                >
                  <Lock size={11} />
                  <span>Normal Mode</span>
                </button>
              </div>

              {/* Status text */}
              <div style={{ display: 'flex', alignItems: 'center', paddingRight: 6 }}>
                {broadcastMode ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: isSyncing ? 'var(--accent-info)' : 'var(--accent-success-light)',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isSyncing ? '⚡ Syncing...' : '● Live Stream'}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    🔒 Private
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="select-wrapper">
            <select
              className="select"
              value={language.id}
              onChange={(e) => {
                const lang = LANGUAGES.find((l) => l.id === Number(e.target.value));
                if (lang) setLanguage(lang);
              }}
              style={{ borderRadius: 4, height: 32, fontSize: 12 }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
            <ChevronDown
              size={11}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--text-muted)',
              }}
            />
          </div>

          {isRunning ? (
            <button
              className="btn btn-danger"
              onClick={onStop}
              style={{ borderRadius: 4, height: 32, fontSize: 12, fontWeight: 600 }}
            >
              <Square size={13} />
              Stop
            </button>
          ) : (
            <button
              className="btn btn-success"
              onClick={() => onRun()}
              style={{ borderRadius: 4, height: 32, fontSize: 12, fontWeight: 600 }}
            >
              <Play size={13} fill="white" />
              {language.name === 'web' ? 'Refresh Preview' : 'Run Code'}
            </button>
          )}

          {(language.name === 'web' || files.some((f) => f.name.endsWith('.html'))) && (
            <button
              className="btn btn-secondary"
              onClick={toggleLivePreview}
              title="Toggle Live Web Preview (right side)"
              style={{
                borderRadius: 4,
                height: 32,
                fontSize: 12,
                fontWeight: 600,
                gap: 6,
                background: showLivePreview ? 'rgba(212, 148, 58, 0.12)' : 'var(--bg-elevated)',
                borderColor: showLivePreview ? 'var(--brand)' : 'var(--border)',
                color: showLivePreview ? 'var(--brand-light)' : 'var(--text-secondary)',
              }}
            >
              <Eye size={13} />
              <span>{showLivePreview ? 'Close Preview' : 'Live Preview'}</span>
            </button>
          )}

          <button
            onClick={() => setShowShortcuts(true)}
            className="btn-ghost"
            title="Keyboard Shortcuts (⌘/)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              cursor: 'pointer',
              marginLeft: 4,
              height: 26,
            }}
          >
            <Keyboard size={12} />
            <span>⌘↵</span>
          </button>
        </div>

        {/* Right: Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Font size */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            marginRight: 6,
          }}>
            <button
              onClick={() => setFontSize(Math.max(10, fontSize - 1))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px 7px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Minus size={11} />
            </button>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              minWidth: 22,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
            }}>
              {fontSize}
            </span>
            <button
              onClick={() => setFontSize(Math.min(24, fontSize + 1))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px 7px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Plus size={11} />
            </button>
          </div>

          <button
            className={`btn-icon ${soundEnabled ? 'active' : ''}`}
            title={soundEnabled ? 'Audio feedback: ON (Click to mute)' : 'Audio feedback: MUTED (Click to unmute)'}
            onClick={toggleSound}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <button
            className={`btn-icon ${showHintPanel ? 'active' : ''}`}
            onClick={toggleHintPanel}
            title="AI Lab Assistant"
          >
            <Sparkles size={15} />
          </button>

          <button
            className="btn-icon"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            className="btn-icon"
            title="Settings"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} style={{ color: 'var(--brand-light)' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Settings</span>
              </div>
              <button
                className="btn-icon"
                onClick={() => setShowSettings(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Editor Settings */}
            <div style={{ padding: '8px 0' }}>
              <div style={{
                padding: '6px 20px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Editor
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Font Size</div>
                  <div className="settings-desc">Adjust the editor font size</div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <button
                    className="btn-icon"
                    onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                    style={{ width: 28, height: 28 }}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    fontSize: 14,
                    minWidth: 28,
                    textAlign: 'center',
                  }}>
                    {fontSize}
                  </span>
                  <button
                    className="btn-icon"
                    onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                    style={{ width: 28, height: 28 }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Language</div>
                  <div className="settings-desc">Default programming language</div>
                </div>
                <select
                  className="select"
                  value={language.id}
                  onChange={(e) => {
                    const lang = LANGUAGES.find((l) => l.id === Number(e.target.value));
                    if (lang) setLanguage(lang);
                  }}
                  style={{ width: 120 }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Audio Feedback</div>
                  <div className="settings-desc">Play acoustic chimes on run success & failure</div>
                </div>
                <button
                  type="button"
                  className={`btn ${soundEnabled ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={toggleSound}
                  style={{ height: 28, fontSize: 11, padding: '0 12px' }}
                >
                  {soundEnabled ? 'Enabled' : 'Muted'}
                </button>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Vim Mode</div>
                  <div className="settings-desc">Modal editing with standard Vim motions & commands</div>
                </div>
                <button
                  type="button"
                  className={`btn ${vimModeEnabled ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={toggleVimMode}
                  style={{ height: 28, fontSize: 11, padding: '0 12px' }}
                >
                  {vimModeEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div style={{
                padding: '6px 20px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginTop: 8,
              }}>
                Keyboard Shortcuts
              </div>

              {[
                { key: '⌘ + Enter', action: 'Run Code' },
                { key: '⌘ + B', action: 'Toggle File Explorer' },
                { key: '⌘ + J', action: 'Toggle Terminal Panel' },
                { key: '⌘ + M', action: 'Toggle Audio Feedback' },
                { key: '⌘ + S', action: 'Save File' },
                { key: '⌘ + /', action: 'Toggle Comment (Editor)' },
              ].map((shortcut, i) => (
                <div key={i} className="settings-row">
                  <div className="settings-label">{shortcut.action}</div>
                  <kbd style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                  }}>
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="settings-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="settings-modal animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Keyboard size={16} style={{ color: 'var(--brand-light)' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Keyboard Shortcuts</span>
              </div>
              <button
                className="btn-icon"
                onClick={() => setShowShortcuts(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Shortcuts List */}
            <div style={{ padding: '10px 0' }}>
              {[
                { key: '⌘ + ↵', winKey: 'Ctrl + Enter', action: 'Execute / Run Code' },
                { key: '⌘ + B', winKey: 'Ctrl + B', action: 'Toggle File Explorer' },
                { key: '⌘ + J', winKey: 'Ctrl + J', action: 'Toggle Terminal Panel' },
                { key: '⌘ + M', winKey: 'Ctrl + M', action: 'Toggle Audio Feedback (Mute/Unmute)' },
                { key: '⌘ + S', winKey: 'Ctrl + S', action: 'Save File / Check Syntax' },
                { key: '⌘ + /', winKey: 'Ctrl + /', action: 'Toggle Line Comment (Editor)' },
                { key: 'VIM', winKey: 'VIM', action: 'Toggle Vim Mode (Status Bar or Settings)' },
                { key: '↑ / ↓', winKey: '↑ / ↓', action: 'Cycle Terminal Input History' },
                { key: 'Esc', winKey: 'Esc', action: 'Close Modals / Overlays' },
              ].map((shortcut, i) => (
                <div key={i} className="settings-row" style={{ padding: '9px 20px' }}>
                  <div className="settings-label" style={{ fontSize: 12.5 }}>{shortcut.action}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <kbd style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--brand-light)',
                    }}>
                      {shortcut.key}
                    </kbd>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
