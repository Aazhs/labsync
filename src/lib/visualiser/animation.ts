import type { Frame, Recording } from './trace';

export type Layout = 'grid' | 'sequence' | 'graph' | 'stack' | 'memory';
export type Tile = { id: string; value: string; slot: number; label?: string };
export type Stage = {
  layout: Layout;
  columns: number;
  slots: number;
  tiles: Tile[];
  links: number[][];
  focus: number[];
  changed: number[];
  label: string;
};
export type Beat = { line: number; title: string; detail: string; stage: Stage };
export type Story = { title: string; example: string; beats: Beat[] };

function object(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw Error('Expected a scene object');
  return x as Record<string, unknown>;
}
function list(x: unknown, max: number): unknown[] {
  if (!Array.isArray(x) || x.length > max) throw Error('Invalid scene list');
  return x;
}
function integer(x: unknown, min: number, max: number): number {
  if (typeof x !== 'number' || !Number.isInteger(x) || x < min || x > max)
    throw Error('Invalid scene position');
  return x;
}
function label(x: unknown, max: number, empty = false): string {
  if (typeof x !== 'string' || x.length > max || (!empty && !x.trim())) throw Error('Invalid scene label');
  return x.trim();
}

// Expand the model's edits once. Scrubbing backwards and replaying use identical snapshots.
export function compileStory(input: unknown, lineCount: number): Story {
  const s = object(input);
  const layout = s.layout as Layout;
  if (!['grid', 'sequence', 'graph', 'stack', 'memory'].includes(layout)) throw Error('Unknown layout');
  let tiles = list(s.cells, 100).map((v, i) => ({ id: 'tile-' + i, slot: i, value: label(v, 36, true) }));
  const slots = tiles.length;
  const columns = integer(s.columns, 1, Math.min(12, slots));
  const slot = (x: unknown) => integer(x, 0, slots - 1);
  let links = list(s.links ?? [], 120).map((edge) => {
    const [a, b] = list(edge, 2);
    return [slot(a), slot(b)];
  });
  const name = label(s.subject, 64);
  let lastFocus: number[] = [],
    movement = 0;
  const beats = list(s.steps, 18).map((raw, n) => {
    const step = object(raw),
      changed = new Set<number>();
    tiles = tiles.map((t) => ({ ...t }));
    for (const rawSwap of list(step.swaps ?? [], 16)) {
      const [a, b] = list(rawSwap, 2).map(slot);
      if (b === undefined || a === b) throw Error('Invalid swap');
      [tiles[a], tiles[b]] = [tiles[b], tiles[a]];
      tiles[a].slot = a;
      tiles[b].slot = b;
      changed.add(a);
      changed.add(b);
    }
    for (const rawEdit of list(step.writes ?? [], 100)) {
      const edit = object(rawEdit),
        i = slot(edit.at),
        value = label(edit.value, 36, true);
      if (tiles[i].value !== value) changed.add(i);
      tiles[i].value = value;
    }
    // A rewire replaces every outgoing arrow of one slot, so pointer updates and edge edits animate too.
    const rewires = list(step.rewires ?? [], 16).map((raw) => {
      const edit = object(raw);
      return [slot(edit.from), integer(edit.to, -1, slots - 1)];
    });
    if (rewires.length) {
      const before = JSON.stringify(links);
      const sources = new Set(rewires.map(([from]) => from));
      links = [
        ...links.filter(([from]) => !sources.has(from)),
        ...rewires.filter(([, to]) => to >= 0).map(([from, to]) => [from, to]),
      ];
      if (JSON.stringify(links) !== before) for (const [from] of rewires) changed.add(from);
    }
    const focus = list(step.focus, 12).map(slot);
    if (n && (changed.size || JSON.stringify(lastFocus) !== JSON.stringify(focus))) movement++;
    lastFocus = focus;
    return {
      line: integer(step.line, 1, lineCount),
      title: label(step.title, 90),
      detail: label(step.detail, 300),
      stage: { layout, columns, slots, tiles, links, focus, changed: [...changed], label: name },
    };
  });
  if (beats.length < 3 || movement < 2) throw Error('The example needs distinct visual actions');
  return { title: label(s.title, 90), example: label(s.example, 220), beats };
}

function collections(frame: Frame) {
  const grids = Object.entries(frame.grids ?? {}).map(([label, rows]) => {
    const columns = Math.max(0, ...rows.map((row) => row.length));
    return {
      layout: 'grid' as const,
      label,
      columns,
      values: rows.flatMap((row) => Array.from({ length: columns }, (_, i) => row[i] ?? '')),
    };
  });
  return [
    ...grids,
    ...Object.entries(frame.values).flatMap(([label, v]) =>
      Array.isArray(v)
        ? [{ layout: 'sequence' as const, label, columns: Math.min(8, v.length), values: v }]
        : [],
    ),
  ].filter((data) => data.values.length);
}

// Resolve direct subscripts against the recorded locals without evaluating student expressions.
function indexedSlots(line: string, frame: Frame, data: ReturnType<typeof collections>[number]) {
  const slots = new Set<number>();
  for (const m of line.matchAll(/([\w$]+)\s*\[\s*([\w$]+)\s*\](?:\s*\[\s*([\w$]+)\s*\])?/g)) {
    if (m[1] !== data.label) continue;
    const index = (name: string) => {
      const v = /^\d+$/.test(name) ? name : frame.values[name];
      return typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : -1;
    };
    const first = index(m[2]);
    if (first < 0) continue;
    let slot = first;
    if (data.layout === 'grid') {
      if (!m[3]) continue;
      const col = index(m[3]);
      if (col < 0 || col >= data.columns) continue;
      slot = first * data.columns + col;
    }
    if (slot < data.values.length) slots.add(slot);
  }
  return [...slots];
}

// Persistent identities make swaps move across the canvas. Duplicate items are matched in order.
export function executionStage(recording: Recording, index: number, line = ''): Stage | null {
  const frame = recording.frames[index];
  if (!frame) return null;
  const previous = recording.frames[index - 1];
  const candidates = collections(frame);
  const prior = previous ? collections(previous) : [];
  const mentioned = new Set(line.match(/[\w$]+/g));
  const data =
    candidates.find((d) => mentioned.has(d.label)) ??
    candidates.find((d) => {
      const last = prior.find((p) => p.label === d.label);
      return (
        last && (last.values.length !== d.values.length || d.values.some((v, i) => last.values[i] !== v))
      );
    }) ??
    candidates[0];
  if (data) {
    const before = prior.find((p) => p.label === data.label)?.values ?? [];
    const changed: number[] = [];
    const seen = new Map<string, number>();
    const tiles = data.values.map((v, i) => {
      const occurrence = seen.get(v) ?? 0;
      seen.set(v, occurrence + 1);
      if (before.length && before[i] !== v) changed.push(i);
      return {
        id: data.layout === 'grid' ? data.label + '/' + i : data.label + '/' + v + '/' + occurrence,
        value: v,
        slot: i,
      };
    });
    const focus = indexedSlots(line, frame, data);
    return {
      layout: data.layout,
      label: data.label,
      columns: data.columns,
      slots: tiles.length,
      tiles,
      links: [],
      focus: focus.length ? focus : changed.slice(0, 1),
      changed,
    };
  }
  const values = Object.entries(frame.values).filter((v): v is [string, string] => typeof v[1] === 'string');
  if (!values.length) return null;
  const tiles = values.map(([name, value], i) => ({ id: name, label: name, value, slot: i }));
  const changed = tiles.filter((t) => previous && previous.values[t.id] !== t.value).map((t) => t.slot);
  return {
    layout: 'memory',
    columns: Math.min(4, tiles.length),
    slots: tiles.length,
    label: 'Local variables',
    tiles,
    links: [],
    focus: changed.slice(0, 1),
    changed,
  };
}
