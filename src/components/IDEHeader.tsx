'use client';

import { useState } from 'react';
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
} from 'lucide-react';

interface IDEHeaderProps {
  onRun: () => void;
  onStop: () => void;
  roomCode?: string | null;
  studentName?: string | null;
  role?: string | null;
}

export default function IDEHeader({
  onRun,
  onStop,
  roomCode,
  studentName,
  role,
}: IDEHeaderProps) {
  const {
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
  const { theme, toggle: toggleTheme } = useTheme();

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
                  ({studentName})
                </span>
              )}
              {role === 'teacher' && (
                <span style={{ color: 'var(--accent-info)', fontWeight: 700 }}>
                  [Host]
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center: Language + Run */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
