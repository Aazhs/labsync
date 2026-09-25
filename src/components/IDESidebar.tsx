'use client';

import { useIDEStore } from '@/lib/store';
import { Code2, BookOpen, LayoutDashboard, FileCode } from 'lucide-react';

export default function IDESidebar() {
  const { showReferencePane, toggleReferencePane } = useIDEStore();

  const items = [
    { icon: <FileCode size={18} />, label: 'Explorer', active: true },
    { icon: <Code2 size={18} />, label: 'Editor', active: false },
    { icon: <BookOpen size={18} />, label: 'Reference', active: showReferencePane, onClick: toggleReferencePane },
    { icon: <LayoutDashboard size={18} />, label: 'Dashboard', active: false },
  ];

  return (
    <aside className="ide-sidebar">
      {items.map((item, i) => (
        <button
          key={i}
          className={`btn-icon tooltip-wrapper ${item.active ? 'active' : ''}`}
          data-tooltip={item.label}
          onClick={item.onClick}
          style={{ width: 36, height: 36 }}
        >
          {item.icon}
        </button>
      ))}
    </aside>
  );
}
