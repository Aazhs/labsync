import assert from 'node:assert/strict';
import test from 'node:test';
import { compileStory, executionStage } from '../src/lib/visualiser/animation';

const step = (
  line: number,
  focus: number[],
  writes: { at: number; value: string }[] = [],
  swaps: number[][] = [],
) => ({ line, focus, writes, swaps, title: 'Step ' + line, detail: 'Follow the highlighted value.' });
const plan = {
  title: 'Rotate values',
  example: 'Start with C, A, B.',
  subject: 'Queue',
  layout: 'sequence',
  columns: 3,
  cells: ['C', 'A', 'B'],
  links: [],
  steps: [step(1, [0]), step(3, [1], [], [[0, 1]]), step(3, [2], [], [[1, 2]])],
};
test('moves keep tile identity across snapshots, including repeated source lines', () => {
  const { beats } = compileStory(plan, 3);
  assert.deepEqual(
    beats.map((b) => b.stage.tiles.map((t) => t.value).join('')),
    ['CAB', 'ACB', 'ABC'],
  );
  assert.equal(beats[0].stage.tiles[0].id, beats[2].stage.tiles[2].id);
  assert.deepEqual(
    beats.map((b) => b.stage.changed),
    [[], [0, 1], [1, 2]],
  );
});
test('one player models graph visits and reversible writes to a stack', () => {
  const graph = compileStory(
    {
      ...plan,
      layout: 'graph',
      links: [
        [0, 2],
        [2, 1],
      ],
      steps: [step(1, [0]), step(2, [0, 2]), step(2, [2, 1])],
    },
    3,
  );
  assert.deepEqual(graph.beats.at(-1)?.stage.links, [
    [0, 2],
    [2, 1],
  ]);
  const stack = compileStory(
    {
      ...plan,
      layout: 'stack',
      columns: 1,
      cells: ['root', '', ''],
      steps: [step(1, [0]), step(2, [1], [{ at: 1, value: 'child' }]), step(3, [0], [{ at: 1, value: '' }])],
    },
    3,
  );
  assert.deepEqual(
    stack.beats.map((b) => b.stage.tiles[1].value),
    ['', 'child', ''],
  );
});
test('unplayable diagrams, invalid source lines and bad edits are rejected', () => {
  for (const changes of [
    { steps: [step(1, [0]), step(1, [0]), step(1, [0])] },
    { steps: [...plan.steps, step(4, [0])] },
    { links: [[0, 3]] },
    { steps: [...plan.steps, step(3, [0], [], [[1]])] },
  ])
    assert.throws(() => compileStory({ ...plan, ...changes }, 3));
});
test('recorded focus follows user-defined index names and the accessed collection', () => {
  const frames = [
    { line: 1, values: { left: ['9'], right: ['a', 'b'], cursor: '1' }, output: '' },
    { line: 2, values: { left: ['9'], right: ['b', 'a'], cursor: '0' }, output: '' },
  ];
  const r = { frames, output: '', truncated: false };
  const a = executionStage(r, 0, 'consume(right[cursor])')!,
    b = executionStage(r, 1, 'inspect(right[cursor])')!;
  assert.equal(a.label, 'right');
  assert.deepEqual(a.focus, [1]);
  assert.deepEqual(b.focus, [0]);
  assert.equal(a.tiles[0].id, b.tiles[1].id);
});

test('rewires replace a node pointer so reversals animate as arrow changes', () => {
  const rewire = (line: number, focus: number[], rewires: { from: number; to: number }[]) => ({
    ...step(line, focus),
    rewires,
  });
  const { beats } = compileStory(
    {
      ...plan,
      layout: 'graph',
      cells: ['1', '2', '3'],
      links: [
        [0, 1],
        [1, 2],
      ],
      steps: [
        rewire(1, [0], [{ from: 0, to: -1 }]),
        rewire(2, [1], [{ from: 1, to: 0 }]),
        rewire(3, [2], [{ from: 2, to: 1 }]),
      ],
    },
    3,
  );
  assert.deepEqual(beats.at(-1)?.stage.links, [
    [1, 0],
    [2, 1],
  ]);
  assert.deepEqual(beats[0].stage.links, [[1, 2]]);
  assert.deepEqual(beats[1].stage.changed, [1]);
  assert.throws(() => compileStory({ ...plan, steps: [rewire(1, [0], [{ from: 0, to: 9 }])] }, 3));
});
