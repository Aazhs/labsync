'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Boxes,
  Braces,
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Eye,
  GitBranch,
  Layers,
  ListRestart,
  MousePointer2,
  PanelTop,
  Pause,
  PencilRuler,
  Play,
  Radio,
  Repeat2,
  RotateCcw,
  SlidersHorizontal,
  SquareTerminal,
  X,
} from 'lucide-react';
import { useIDEStore } from '@/lib/store';
import { buildOutline, labels, runtimeLanguages, type Kind, type Scene } from '@/lib/visualiser/source';
import type { Recording } from '@/lib/visualiser/trace';
import lessons from '@/lib/visualiser/lessons.json';
import examples from '@/lib/visualiser/recordings.json';
import GeminiDrawing from './GeminiDrawing';
import { ArraySketch, HanoiSketch } from './DataSketch';
import './visualiser.css';

const recorded: Record<string, Recording> = examples;
const glyphs = {
  store: Boxes,
  loop: Repeat2,
  branch: GitBranch,
  call: Braces,
  output: SquareTerminal,
  return: CornerUpLeft,
  input: ArrowDownToLine,
  element: PanelTop,
  style: PencilRuler,
  action: MousePointer2,
};
const categories: Record<Kind, string> = {
  store: 'Memory',
  loop: 'Iteration',
  branch: 'Decision',
  call: 'Function',
  output: 'Output',
  return: 'Return',
  input: 'Input',
  element: 'Page structure',
  style: 'Appearance',
  action: 'Expression',
};
type Lesson = (typeof lessons)[number];
interface Props {
  onClose: () => void;
  locked: boolean;
  referenceAllowed: boolean;
}

export default function CodeVisualiser({ onClose, locked, referenceAllowed }: Props) {
  const { code, language, files, activeFileId, referenceCode, createFile, setShowLivePreview } =
    useIDEStore();
  const [selection, setSelection] = useState('editor');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const file = files.find((f) => f.id === activeFileId);
  const lesson = lessons.find((item) => item.id === selection);
  const isReference = selection === 'reference' && referenceAllowed;
  const lang =
    lesson?.language ??
    (isReference ? (language.name === 'web' ? 'html' : language.name) : (file?.language ?? language.name));
  const source = lesson?.code ?? (isReference ? referenceCode : code);
  const name = lesson?.filename ?? (isReference ? 'Instructor’s code' : (file?.name ?? 'Active file'));
  function openCopy() {
    if (!lesson || language.name !== lesson.language) return;
    const ext = lesson.filename.lastIndexOf('.');
    let filename = lesson.filename;
    let i = 2;
    while (files.some((f) => f.name === filename))
      filename = lesson.filename.slice(0, ext) + '-' + i++ + lesson.filename.slice(ext);
    createFile(filename, lesson.code);
    onClose();
  }
  return (
    <dialog
      ref={dialog}
      className="vs-dialog"
      aria-labelledby="vs-title"
      onCancel={onClose}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div
        className="vs-shell"
        onCopy={isReference ? (e) => e.preventDefault() : undefined}
        style={isReference ? { userSelect: 'none' } : undefined}
      >
        <header className="vs-header">
          <span className="vs-emblem" aria-hidden="true">
            <PencilRuler size={23} />
          </span>
          <h2 id="vs-title">Code visualiser</h2>
          <label className="vs-picker">
            <BookOpen size={16} />
            <select
              aria-label="Choose code or lesson"
              value={isReference ? 'reference' : (lesson?.id ?? 'editor')}
              onChange={(e) => setSelection(e.target.value)}
            >
              <option value="editor">Editor · {file?.name ?? 'Active file'}</option>
              {referenceAllowed && <option value="reference">Instructor’s code</option>}
              {['PL', 'PS', 'Python'].map((group) => (
                <optgroup key={group} label={group + ' lessons'}>
                  {lessons
                    .filter((item) => item.collection === group)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="vs-icon" onClick={onClose} aria-label="Close visualiser" autoFocus>
            <X size={19} />
          </button>
        </header>
        <Player
          key={JSON.stringify([selection, name, source, lang])}
          source={source}
          name={name}
          lang={lang}
          lesson={lesson}
          locked={locked}
          web={language.name === 'web' && !lesson}
          openWeb={() => {
            setShowLivePreview(true);
            onClose();
          }}
          openCopy={lesson && language.name === lang ? openCopy : undefined}
        />
      </div>
    </dialog>
  );
}

interface PlayerProps {
  source: string;
  name: string;
  lang: string;
  locked: boolean;
  web: boolean;
  lesson?: Lesson;
  openCopy?: () => void;
  openWeb: () => void;
}

function Player({ source, name, lang, locked, web, lesson, openCopy, openWeb }: PlayerProps) {
  const tooBig = source.length > 65536;
  const outline = useMemo(() => buildOutline(tooBig ? '' : source, lang), [source, lang, tooBig]);
  const lines = useMemo(() => (tooBig ? [] : source.split(/\r?\n/)), [source, tooBig]);
  const sample = lesson ?? lessons.find((l) => l.code === source && l.language === lang);
  const [recording, setRecording] = useState<Recording | null>(() => (sample ? recorded[sample.id] : null));
  const [mode, setMode] = useState<'source' | 'run'>(recording ? 'run' : 'source');
  const [stdin, setStdin] = useState(sample?.stdin ?? '');
  const [inputOpen, setInputOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState('Program finished');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const request = useRef<AbortController | null>(null);
  const activeLine = useRef<HTMLButtonElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  const canRun = !!runtimeLanguages[lang] && !web && !tooBig && !!source.trim();
  const trace = mode === 'run' ? recording : null;
  const total = trace ? trace.frames.length + 1 : outline.scenes.length;
  const frame = trace?.frames[index];
  const finished = !!trace && index === trace.frames.length;
  const scene = trace
    ? frame &&
      (outline.scenes.find((s) => s.at === frame.at) ?? outline.scenes.find((s) => s.line === frame.line))
    : outline.scenes[index];
  const line = frame?.line ?? scene?.line;
  const previous = trace?.frames[index - 1];
  const output = finished ? trace?.output : frame?.output;
  const sourceMap = useMemo(() => {
    const map = new Map<number, number>();
    const steps = trace ? trace.frames : outline.scenes;
    steps.forEach((s, i) => {
      if (!map.has(s.line)) map.set(s.line, i);
    });
    return map;
  }, [trace, outline]);

  useEffect(() => {
    activeLine.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [line]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, total - 1));
      if (index + 1 >= total - 1) setPlaying(false);
    }, 1400 / speed);
    return () => clearTimeout(timer);
  }, [index, playing, speed, total]);
  const jump = (i: number) => {
    setPlaying(false);
    setIndex(i);
  };
  const switchMode = (m: 'source' | 'run') => {
    jump(0);
    setMode(m);
  };

  async function record() {
    if (!canRun || locked || busy) return;
    const control = new AbortController();
    request.current = control;
    setBusy(true);
    setMessage('');
    setPlaying(false);
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        signal: control.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: source, languageId: runtimeLanguages[lang], stdin, trace: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The runner could not record this file.');
      const next: Recording = data.recording;
      const success = data.status.id === 3;
      if (!success)
        setMessage(
          data.status.id === 13
            ? 'The program needs more input. Add the remaining values and record again.'
            : data.diagnostic || data.status.description,
        );
      if (next.frames.length || success) {
        setRecording(next);
        setOutcome(success ? 'Program finished' : data.status.description);
        switchMode('run');
        setInputOpen(false);
      }
    } catch (err) {
      if (!control.signal.aborted)
        setMessage(err instanceof Error ? err.message : 'The runner is unavailable.');
    } finally {
      if (!control.signal.aborted) setBusy(false);
    }
  }

  function changeInput(value: string) {
    setStdin(value);
    setMessage('');
    setRecording(null);
    switchMode('source');
  }
  return (
    <>
      <div className="vs-toolbar">
        <div className="vs-modes">
          <button aria-pressed={mode === 'source'} onClick={() => switchMode('source')}>
            <Layers size={15} /> Source map
          </button>
          {recording && (
            <button aria-pressed={mode === 'run'} onClick={() => switchMode('run')}>
              <ListRestart size={15} /> Recorded run
            </button>
          )}
        </div>
        <span className="vs-spacer" />
        {openCopy && (
          <button className="vs-tool" onClick={openCopy}>
            <ArrowDownToLine size={14} /> Open a copy in IDE
          </button>
        )}
        {web && (
          <button className="vs-tool" onClick={openWeb}>
            <Eye size={15} /> Live preview
          </button>
        )}
        {canRun && (
          <>
            <button
              className="vs-tool"
              aria-expanded={inputOpen}
              disabled={busy}
              onClick={() => setInputOpen(!inputOpen)}
            >
              <SlidersHorizontal size={14} /> Input
            </button>
            <button className="vs-record" disabled={busy || locked} onClick={record}>
              <Radio size={15} />
              {locked ? 'Lab paused' : busy ? 'Recording…' : 'Record run'}
            </button>
          </>
        )}
      </div>
      {inputOpen && (
        <label className="vs-input">
          Standard input
          <textarea
            value={stdin}
            onChange={(e) => changeInput(e.target.value)}
            disabled={busy}
            rows={2}
            placeholder="Enter values in the order the program reads them"
          />
        </label>
      )}
      {message && (
        <pre className="vs-message" role="alert">
          {message}
        </pre>
      )}
      <div className="vs-workspace">
        <aside className="vs-source">
          <div className="vs-file">
            <span>{name}</span>
            <small>{labels[lang] ?? lang}</small>
          </div>
          <div className="vs-lines" aria-label="Source lines">
            {lines.map((content, i) => {
              const step = sourceMap.get(i + 1);
              return (
                <button
                  key={i}
                  ref={line === i + 1 ? activeLine : undefined}
                  className={line === i + 1 ? 'is-current' : ''}
                  aria-current={line === i + 1 ? 'step' : undefined}
                  disabled={step === undefined}
                  title={step === undefined ? undefined : 'Go to this line'}
                  onClick={() => {
                    if (step !== undefined) jump(step);
                  }}
                >
                  <span>{i + 1}</span>
                  <code>{content || ' '}</code>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="vs-paper" aria-label="Sketch playback">
          <div className="vs-heading">
            <div className="vs-context">
              {lesson ? lesson.collection + ' lesson' : trace ? 'Execution sketch' : 'Source walkthrough'}
            </div>
            <h3>{lesson?.title ?? (trace ? 'Follow the run' : 'Inside ' + name)}</h3>
            {lesson && <p>{lesson.goal}</p>}
          </div>
          {total > 0 && (
            <>
              <div className="vs-caption">
                <span>{finished ? 'Result' : 'Line ' + line}</span>
                <span>
                  {frame
                    ? frame.leaving
                      ? 'Leaving this scope'
                      : 'Before this statement'
                    : scene
                      ? categories[scene.kind]
                      : ''}
                </span>
              </div>
              <h4>{finished ? outcome : (scene?.title ?? 'Visit this line')}</h4>
            </>
          )}
          <GeminiDrawing
            source={source}
            language={lang}
            line={line}
            frame={frame}
            previous={previous}
            finished={finished}
          >
            {total > 0 && !finished && (
              <Sketch key={mode + index} scene={scene} fallback={lines[(line ?? 1) - 1]} />
            )}
            {trace && sample?.id === 'tower-of-hanoi' && (
              <HanoiSketch count={Number(stdin.trim().split(/\s+/)[0])} output={output ?? ''} />
            )}
            {frame && <ArraySketch frame={frame} />}
          </GeminiDrawing>
          {total > 0 ? (
            <>
              {finished ? (
                <div className="vs-finish">
                  <SquareTerminal size={31} />
                  <div>
                    <strong>Program output</strong>
                    <pre>{output || 'No output'}</pre>
                  </div>
                </div>
              ) : (
                <p className="vs-detail">
                  {scene?.detail ?? 'The runner reached this line of the active file.'}
                </p>
              )}
              {frame && (
                <div className="vs-memory">
                  <h5>Values in scope</h5>
                  {Object.keys(frame.values).length ? (
                    Object.entries(frame.values).map(([key, value]) => {
                      const previousValue = previous?.values[key];
                      return (
                        <div className="vs-binding" key={key}>
                          <code>{key}</code>
                          <span className="vs-cells">
                            {(Array.isArray(value) ? (value.length ? value : ['[ ]']) : [value]).map(
                              (v, i) => {
                                const before = Array.isArray(previousValue)
                                  ? previousValue[i]
                                  : previousValue;
                                return (
                                  <span key={i} className={'vs-cell' + (v !== before ? ' vs-changed' : '')}>
                                    {Array.isArray(value) && value.length > 0 && <small>{i}</small>}
                                    {v || '""'}
                                  </span>
                                );
                              },
                            )}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p>No captured values at this step.</p>
                  )}
                </div>
              )}
              {frame?.output && (
                <div className="vs-sofar">
                  <h5>Output so far</h5>
                  <pre>{frame.output}</pre>
                </div>
              )}
            </>
          ) : (
            <p className="vs-empty">
              {tooBig
                ? 'This file exceeds the 64 KB visualiser limit.'
                : !source.trim()
                  ? 'Write some code or choose a lesson to start a sketch.'
                  : !outline.supported
                    ? 'Choose a programming, HTML, or CSS file to explore its structure.'
                    : 'No statements to sketch yet. Add a statement or choose a lesson.'}
            </p>
          )}
          {trace?.truncated && (
            <p className="vs-note">
              Showing the first {trace.frames.length} recorded steps. The result includes the remaining
              output.
            </p>
          )}
          {mode === 'source' && outline.partial && (
            <p className="vs-note">
              Some syntax could not be mapped. The sketch covers the recognised parts.
            </p>
          )}
          {mode === 'source' && outline.capped && (
            <p className="vs-note">Showing the first 500 source steps.</p>
          )}
        </section>
      </div>
      <footer className="vs-footer">
        <button
          className="vs-icon"
          disabled={index === 0}
          onClick={() => jump(0)}
          aria-label="Restart playback"
        >
          <RotateCcw size={17} />
        </button>
        <button
          className="vs-icon"
          disabled={index === 0}
          onClick={() => jump(index - 1)}
          aria-label="Previous step"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          className="vs-play"
          disabled={total < 2}
          onClick={() => {
            if (index === total - 1) setIndex(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause' : 'Play'}
        </button>
        <button
          className="vs-icon"
          disabled={index >= total - 1}
          onClick={() => jump(index + 1)}
          aria-label="Next step"
        >
          <ChevronRight size={20} />
        </button>
        <span className="vs-counter">
          {total ? index + 1 : 0} / {total}
        </span>
        <input
          type="range"
          aria-label="Playback step"
          min={0}
          max={Math.max(0, total - 1)}
          value={index}
          disabled={total < 2}
          onChange={(e) => jump(Number(e.target.value))}
        />
        <select aria-label="Playback speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {[0.5, 1, 1.5, 2].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </footer>
    </>
  );
}

function Sketch({ scene, fallback }: { scene?: Scene; fallback: string }) {
  const kind = scene?.kind ?? 'action';
  const Icon = glyphs[kind];
  const pieces = scene?.pieces.length ? scene.pieces : [fallback];
  return (
    <div className={'vs-sketch vs-' + kind}>
      <div className="vs-doodle" aria-hidden="true">
        <Icon size={30} strokeWidth={1.7} />
        <i />
        <b />
      </div>
      <div className="vs-flow">
        {pieces.map((piece, i) => (
          <div className="vs-fragment" key={i}>
            {i > 0 && <ArrowRight size={19} aria-hidden="true" />}
            <code>{piece}</code>
          </div>
        ))}
      </div>
      {kind === 'loop' && <Repeat2 className="vs-loopmark" size={20} aria-hidden="true" />}
    </div>
  );
}
