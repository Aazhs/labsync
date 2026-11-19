import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildOutline } from '../src/lib/visualiser/source';
import { FRAME_LIMIT, instrument, readRecording, type Recording } from '../src/lib/visualiser/trace';
import lessons from '../src/lib/visualiser/lessons.json';
import recordings from '../src/lib/visualiser/recordings.json';

const fixtures: Record<string, Recording> = recordings;
const runtimes: Record<string, { command: string; filename: string }> = {
  python: { command: 'python3', filename: 'main.py' },
  cpp: { command: 'g++', filename: 'main.cpp' },
  c: { command: 'gcc', filename: 'main.c' },
  java: { command: 'javac', filename: 'Main.java' },
  javascript: { command: process.execPath, filename: 'main.js' },
};

function record(language: string, source: string, stdin = '') {
  const { command, filename } = runtimes[language];
  const cwd = mkdtempSync(join(tmpdir(), 'labsync-trace-test-'));
  const marker = '__LS_TEST__';
  try {
    const run = (code: string) => {
      writeFileSync(join(cwd, filename), code);
      const opts = { cwd, encoding: 'utf8' as const, timeout: 15000, input: stdin };
      if (language === 'java') {
        execFileSync(command, [filename], opts);
        return execFileSync('java', ['Main'], opts);
      }
      if (language === 'c' || language === 'cpp') {
        execFileSync(command, [filename, '-o', 'main'], opts);
        return execFileSync(join(cwd, 'main'), [], opts);
      }
      return execFileSync(command, [filename], opts);
    };
    const trace = readRecording(run(instrument(source, language, marker)), source, language, marker);
    assert.equal(trace.output, run(source));
    assert.ok(trace.frames.length > 0);
    return trace;
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

for (const lesson of lessons) {
  test(lesson.title + ' matches its bundled replay', (t) => {
    if (spawnSync(runtimes[lesson.language].command, ['--version']).status !== 0)
      return t.skip('Compiler unavailable');
    const trace = record(lesson.language, lesson.code, lesson.stdin);
    assert.deepEqual(JSON.parse(JSON.stringify(trace)), fixtures[lesson.id]);
  });
}

test('Java captures primitive arrays across an unbraced enhanced for loop', (t) => {
  if (spawnSync('javac', ['-version']).status !== 0) return t.skip('JDK unavailable');
  const trace = record(
    'java',
    'class Main { public static void main(String[] args) { char[] a = {65, 66}; for (char c : a) if (c == 65) System.out.print(c); else System.out.print("!"); } }',
  );
  assert.equal(trace.output, 'A!');
  assert.ok(trace.frames.some((f) => f.values.c === 'B' && f.values.a?.[0] === 'A'));
});

test('C retains control flow and captures array swaps', (t) => {
  if (spawnSync('gcc', ['--version']).status !== 0) return t.skip('C compiler unavailable');
  const trace = record(
    'c',
    '#include <stdio.h>\nint main(){int a[]={3,2}; for(int i=0;i<2;i++) if(a[i]>2) a[i]=1; else a[i]=4; printf("%d%d",a[0],a[1]);}',
  );
  assert.ok(trace.frames.some((f) => Array.isArray(f.values.a) && f.values.a.join('') === '14'));
});

test('recording stops capturing values at the limit while the program finishes', () => {
  const trace = record('javascript', '"use strict"; let i=0; while(i<200) i++; console.log(i);');
  assert.equal(trace.frames.length, FRAME_LIMIT);
  assert.equal(trace.truncated, true);
  assert.equal(trace.output.trim(), '200');
});

test('source maps keep original line numbers and recognise web documents', () => {
  const py = buildOutline('# for fake in comment:\nitems = [1,2]\nfor n in items:\n    print(n)', 'python');
  assert.deepEqual(
    py.scenes.map((s) => [s.line, s.kind]),
    [
      [2, 'store'],
      [3, 'loop'],
      [4, 'output'],
    ],
  );
  const html = buildOutline('<main>\n  <button>OK</button>\n</main>', 'html');
  assert.deepEqual(html.scenes[1].pieces, ['main', 'button']);
  const css = buildOutline('button {\n color: green;\n}', 'css');
  assert.deepEqual(css.scenes[1].pieces, ['green', 'color']);
});

test('the last assignment is visible when a program finishes without printing', () => {
  const trace = record('javascript', 'let total = 2; total *= 3;');
  assert.equal(trace.frames.at(-1)?.values.total, '6');
  assert.equal(trace.frames.at(-1)?.leaving, true);
});
