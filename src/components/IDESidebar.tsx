'use client';

import { useIDEStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import {
  Files,
  BookOpen,
  CircleAlert,
  Sun,
  Moon,
} from 'lucide-react';

export default function IDESidebar() {
  const { theme, toggle: toggleTheme } = useTheme();
  const {
    showExplorer,
    toggleExplorer,
    showReferencePane,
    toggleReferencePane,
    showOutput,
    toggleOutput,
    setActiveOutputTab,
    syntaxProblems,
  } = useIDEStore();

  const errorCount = syntaxProblems.filter((p) => p.severity === 'error').length;

  const topItems = [
    {
      icon: <Files size={18} />,
      label: 'Files (Ctrl + B)',
      active: showExplorer,
      onClick: toggleExplorer,
    },
    {
      icon: <BookOpen size={18} />,
      label: 'Instructor’s code',
      active: showReferencePane,
      onClick: toggleReferencePane,
    },
    {
      icon: <CircleAlert size={18} />,
      label: `Problems (${syntaxProblems.length})`,
      active: false,
      badge: errorCount > 0 ? errorCount : undefined,
      onClick: () => {
        setActiveOutputTab('problems');
        if (!showOutput) toggleOutput();
      },
    },
  ];

  return (
    <aside
      className="ide-sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
      }}
    >
      {/* Top Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}>
        {topItems.map((item, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <button
              className={`btn-icon tooltip-wrapper ${item.active ? 'active' : ''}`}
              data-tooltip={item.label}
              onClick={item.onClick}
              style={{
                width: 38,
                height: 38,
                borderRadius: 4,
                color: item.active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: item.active ? 'var(--bg-elevated)' : 'transparent',
                borderLeft: item.active ? '2px solid var(--brand)' : '2px solid transparent',
              }}
            >
              {item.icon}
            </button>
            {item.badge !== undefined && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 14,
                  height: 14,
                  borderRadius: 3,
                  background: 'var(--accent-danger)',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  padding: '0 3px',
                }}
              >
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Tools */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%', paddingBottom: 6 }}>
        <button
          className="btn-icon tooltip-wrapper"
          data-tooltip={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          onClick={toggleTheme}
          style={{ width: 38, height: 38, borderRadius: 4 }}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </aside>
  );
}
