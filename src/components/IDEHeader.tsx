'use client';

import { useState } from 'react';
import { useIDEStore, LANGUAGES } from '@/lib/store';
import {
  Play,
  Square,
  Sparkles,
  Monitor,
  Settings,
  ChevronDown,
  Zap,
  X,
  Minus,
  Plus,
  Keyboard,
} from 'lucide-react';

interface IDEHeaderProps {
  onRun: () => void;
  onStop: () => void;
}

export default function IDEHeader({ onRun, onStop }: IDEHeaderProps) {
  const {
    language,
    setLanguage,
    isRunning,
    showHintPanel,
    toggleHintPanel,
    sessionMode,
    fontSize,
    setFontSize,
  } = useIDEStore();

  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="ide-header">
        {/* Left: Logo + Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(212, 148, 58, 0.2)',
            }}>
              <Zap size={16} color="#080808" strokeWidth={2.5} />
            </div>
            <span style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
            }}>
              SignalClass
            </span>
          </div>

          <div style={{ width: 1, height: 22, background: 'var(--border)', marginLeft: 2 }} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            background: sessionMode === 'follow'
              ? 'rgba(91, 141, 184, 0.08)'
              : 'rgba(61, 140, 111, 0.08)',
            color: sessionMode === 'follow'
              ? 'var(--accent-info)'
              : 'var(--accent-success)',
            border: `1px solid ${sessionMode === 'follow'
              ? 'rgba(91, 141, 184, 0.12)'
              : 'rgba(61, 140, 111, 0.12)'}`,
          }}>
            <Monitor size={10} />
            {sessionMode === 'follow' ? 'Follow' : 'Practice'}
          </div>
        </div>

        {/* Center: Language + Run */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="select-wrapper">
            <select
              className="select"
              value={language.id}
              onChange={(e) => {
                const lang = LANGUAGES.find((l) => l.id === Number(e.target.value));
                if (lang) setLanguage(lang);
              }}
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
            <button className="btn btn-danger" onClick={onStop}>
              <Square size={13} />
              Stop
            </button>
          ) : (
            <button className="btn btn-success" onClick={onRun}>
              <Play size={13} fill="white" />
              Run Code
            </button>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 10,
            color: 'var(--text-faint)',
            marginLeft: 4,
          }}>
            <Keyboard size={11} />
            <span>⌘↵</span>
          </div>
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
            className={`btn-icon ${showHintPanel ? 'active' : ''}`}
            onClick={toggleHintPanel}
            title="AI Lab Assistant"
          >
            <Sparkles size={15} />
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
                { key: '⌘ + S', action: 'Save File' },
                { key: '⌘ + /', action: 'Toggle Comment' },
                { key: '⌘ + Z', action: 'Undo' },
                { key: '⌘ + Shift + Z', action: 'Redo' },
              ].map((shortcut, i) => (
                <div key={i} className="settings-row">
                  <div className="settings-label">{shortcut.action}</div>
                  <kbd style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-xs)',
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
    </>
  );
}
