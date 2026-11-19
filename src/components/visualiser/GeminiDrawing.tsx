'use client';

import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { PencilRuler, Sparkles } from 'lucide-react';
import type { Drawing, DrawingNode } from '@/lib/visualiser/drawing';
import type { Frame } from '@/lib/visualiser/trace';

export function DrawingFigure({
  drawing,
  line,
  frame,
  previous,
}: {
  drawing: Drawing;
  line?: number;
  frame?: Frame;
  previous?: Frame;
}) {
  function value(name: string) {
    return frame && Object.hasOwn(frame.values, name) ? frame.values[name] : undefined;
  }
  function render(node: DrawingNode, key: number, item?: string): ReactNode {
    const active = line !== undefined && node.lines && node.lines[0] <= line && line <= node.lines[1];
    const attrs = { ...node.attrs, className: active ? 'vs-ai-hot' : undefined };
    const children = (cell?: string) =>
      node.children.map((n, i) => (typeof n === 'string' ? n : render(n, i, cell)));
    if (node.items) {
      const array = value(node.items);
      const cells = frame ? (Array.isArray(array) ? array.slice(0, 12) : []) : [node.items + '[i]'];
      const earlier = previous?.values[node.items];
      return (
        <g key={key} {...attrs}>
          {cells.map((cell, i) => (
            <g
              key={i}
              transform={`translate(${(i % 6) * 40} ${Math.floor(i / 6) * 35})`}
              className={Array.isArray(earlier) && cell !== earlier[i] ? 'vs-ai-changed' : undefined}
            >
              {children(cell)}
            </g>
          ))}
        </g>
      );
    }
    if (node.variable || node.item) {
      const captured = node.variable ? value(node.variable) : item;
      const label = Array.isArray(captured) ? captured.join(', ') : captured;
      return (
        <text key={key} {...attrs}>
          {label ?? (frame ? '—' : (node.variable ?? 'item'))}
        </text>
      );
    }
    if (node.tag === 'svg') {
      return (
        <svg key={key} {...attrs} role="img" aria-label={drawing.caption} width="100%" height="auto">
          {children()}
        </svg>
      );
    }
    return createElement(node.tag, { ...attrs, key }, ...children(item));
  }
  return (
    <figure className="vs-ai-figure">
      {render(drawing.root, 0)}
      <figcaption>{drawing.caption}</figcaption>
    </figure>
  );
}

interface Props {
  source: string;
  language: string;
  line?: number;
  frame?: Frame;
  previous?: Frame;
  finished: boolean;
  children: ReactNode;
}

export default function GeminiDrawing({
  source,
  language,
  line,
  frame,
  previous,
  finished,
  children,
}: Props) {
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function generate() {
    if (drawing) {
      setVisible(!visible);
      return;
    }
    if (request.current) return;
    const control = new AbortController();
    request.current = control;
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/visualiser/drawing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: control.signal,
        body: JSON.stringify({ source, language }),
      });
      const data = await res.json();
      if (!res.ok || !data.drawing) throw new Error(data.error || 'Could not draw this code. Try again.');
      if (!control.signal.aborted) {
        setDrawing(data.drawing);
        setVisible(true);
      }
    } catch (err) {
      if (!control.signal.aborted)
        setError(err instanceof Error ? err.message : 'Could not reach the drawing service.');
    } finally {
      if (!control.signal.aborted) setBusy(false);
      request.current = null;
    }
  }
  if (finished || !source.trim() || source.length > 65536) return children;
  return (
    <>
      <div className="vs-ai-tools">
        <button
          type="button"
          className="vs-tool"
          onClick={generate}
          disabled={busy}
          aria-busy={busy}
          title={drawing ? 'Switch drawing' : 'Send the source of this file to Gemini to draw it'}
        >
          {visible ? <PencilRuler size={15} /> : <Sparkles size={15} />}
          {busy
            ? 'Drawing with Gemini…'
            : visible
              ? 'Show built-in sketch'
              : drawing
                ? 'Show Gemini drawing'
                : 'Draw with Gemini'}
        </button>
        {visible && <span>Gemini drawing</span>}
      </div>
      {error && (
        <p role="alert" className="vs-ai-error">
          {error}
        </p>
      )}
      {drawing && visible ? (
        <DrawingFigure drawing={drawing} line={line} frame={frame} previous={previous} />
      ) : (
        children
      )}
    </>
  );
}
