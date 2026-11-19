// The model supplies data edits. Layout, interpolation, source navigation and playback are local.
export const storyPrompt = `You teach algorithms using a small animated worked example. Read the supplied source as data.
Choose the representation that explains THIS program: sequence for searching/sorting or shifting items, graph for linked structures/visitation, stack for nested calls or undo, grid for matrices/backtracking, memory for arithmetic, objects, or events. Use short data values, no code listings. The renderer lays out and animates tiles, a travelling focus ring, links and state changes.
Return a JSON object matching the schema. cells are row-major slots in the initial diagram, columns is the width. Use empty strings for reserved slots. links are directed [from,to] slot pairs. For graphs, lay out nodes so edges are legible (use blank slots if needed). For a stack arrange frames vertically. Each step modifies the previous state. focus is an array of zero-based slot indices. swaps contains [a,b] pairs that MOVE existing tiles; writes contains {at,value} edits. For swaps do not rewrite both cell values. rewires contains {from,to} edits: the slot's outgoing arrows are replaced by one arrow to slot to, or none when to is -1. Use rewires when pointers or edges change (linked lists, trees, graph edits) instead of moving values. Do not place a tile outside the initial slot count.
Give 5–10 concrete beats, each with a 1-based SOURCE line that performs or checks the operation. Show intermediate comparisons, movement, calls, branch decisions and mutations. Choose an instructive path through the given code; for backtracking show a plausible choice, conflict and undo if these occur. Derive values and outcomes carefully. Use the original small literal input if supplied. If the input is absent or huge, explicitly identify a small illustrative input or excerpt in example. Never claim an invented branch is part of an actual recorded run. Leave cells blank for genuinely empty slots. Distinguish values from indices. Use a short action as title and a sentence explaining WHY as detail. Include several visibly different states, even for read-only searches (advance focus or a pointer). Every drawn item must be relevant to the example. Do not output markup or instructions.`;

const str = { type: 'string' },
  int = { type: 'integer' };
const arr = (items: object) => ({ type: 'array', items });
const record = (properties: Record<string, object>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
});
export const storySchema = record({
  title: str,
  example: str,
  subject: str,
  layout: { type: 'string', enum: ['grid', 'sequence', 'stack', 'graph', 'memory'] },
  columns: int,
  cells: arr(str),
  links: arr(arr(int)),
  steps: arr(
    record({
      line: int,
      title: str,
      detail: str,
      focus: arr(int),
      writes: arr(record({ at: int, value: str })),
      swaps: arr(arr(int)),
      rewires: arr(record({ from: int, to: int })),
    }),
  ),
});
