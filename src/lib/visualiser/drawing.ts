import { parseFragment, type DefaultTreeAdapterTypes as Html } from 'parse5';

// Only this serialisable drawing vocabulary crosses from generated HTML into React.
export type DrawingNode = {
  tag: string;
  attrs: Record<string, string>;
  children: (DrawingNode | string)[];
  lines?: [number, number];
  variable?: string;
  items?: string;
  item?: boolean;
};
export type Drawing = { caption: string; root: DrawingNode };

const tags = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
]);
const numeric = new Set('x y dx dy x1 x2 y1 y2 cx cy r rx ry width height opacity'.split(' '));
const typography: Record<string, string> = {
  'stroke-width': 'strokeWidth',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'text-anchor': 'textAnchor',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
};
const variable = /^[\p{L}_$][\p{L}\p{N}_$]{0,79}$/u;

function child(element: Html.ParentNode, name: string) {
  return element.childNodes.find((node): node is Html.Element => 'tagName' in node && node.tagName === name);
}

function validAttribute(name: string, value: string): string | undefined {
  if (numeric.has(name) || ['stroke-width', 'font-size', 'font-weight'].includes(name)) {
    return /^-?\d+(\.\d+)?%?$/.test(value) ? (typography[name] ?? name) : undefined;
  }
  if (name === 'fill' || name === 'stroke') return /^(#[\da-f]{3,8}|[a-z]+)$/i.test(value) ? name : undefined;
  if (name === 'd' || name === 'points' || name === 'viewBox')
    return /^[MmZzLlHhVvCcSsQqTtAaEe\d.,+\s-]+$/.test(value) ? name : undefined;
  if (name === 'transform')
    return /^(?:(?:translate|rotate|scale|matrix)\([\d.,+\s-]+\)\s*)+$/.test(value) ? name : undefined;
  if (Object.hasOwn(typography, name) && /^[a-z]+$/.test(value)) return typography[name];
}

export function compileDrawing(markup: string, lineCount: number): Drawing {
  if (markup.length > 40000) throw new Error('Drawing too large');
  const document = parseFragment(markup);
  const figure = child(document, 'figure');
  const svg = child(figure ?? document, 'svg');
  const caption = figure && child(figure, 'figcaption');
  if (!svg) throw new Error('Missing drawing');
  let count = 0,
    shapes = 0;

  function visit(el: Html.Element, depth: number, insideItems: boolean): DrawingNode {
    if (++count > 200 || depth > 12) throw new Error('Drawing too complex');
    const node: DrawingNode = { tag: el.tagName, attrs: {}, children: [] };
    if (!['svg', 'g', 'text', 'tspan'].includes(el.tagName)) shapes++;
    for (const { name, value, namespace } of el.attrs) {
      if (namespace || value.length > 4096) continue;
      const attr = validAttribute(name, value);
      if (attr) node.attrs[attr] = value;
      if (name === 'data-lines') {
        const match = /^(\d+)(?:-(\d+))?$/.exec(value.trim());
        if (match) {
          const start = Number(match[1]),
            end = Number(match[2] ?? match[1]);
          if (start > 0 && end >= start && end <= lineCount) node.lines = [start, end];
        }
      }
      if (name === 'data-var' && el.tagName === 'text' && variable.test(value)) node.variable = value;
      if (name === 'data-items' && el.tagName === 'g' && !insideItems && variable.test(value))
        node.items = value;
      if (name === 'data-item' && el.tagName === 'text' && insideItems) node.item = true;
    }
    for (const part of el.childNodes) {
      if ('tagName' in part && tags.has(part.tagName) && part.tagName !== 'svg')
        node.children.push(visit(part, depth + 1, insideItems || !!node.items));
      else if ('value' in part && ['text', 'tspan'].includes(el.tagName))
        node.children.push(part.value.slice(0, 160));
    }
    return node;
  }

  const root = visit(svg, 0, false);
  if (!shapes) throw new Error('No diagram shapes');
  const box = root.attrs.viewBox
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (!box || box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0)
    root.attrs.viewBox = '0 0 600 260';
  return {
    caption:
      caption?.childNodes
        .map((n) => ('value' in n ? n.value : ''))
        .join('')
        .trim()
        .slice(0, 220) || 'AI-generated code sketch',
    root,
  };
}
