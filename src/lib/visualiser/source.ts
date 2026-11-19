import { parser as cpp } from '@lezer/cpp';
import { parser as java } from '@lezer/java';
import { parser as javascript } from '@lezer/javascript';
import { parser as python } from '@lezer/python';
import { parser as html } from '@lezer/html';
import { parser as css } from '@lezer/css';
import type { Parser, SyntaxNode } from '@lezer/common';

const parsers: Record<string, Parser> = {
  c: cpp,
  cpp,
  java,
  javascript,
  typescript: javascript.configure({ dialect: 'ts' }),
  python,
  html,
  css,
};
export const runtimeLanguages: Record<string, number> = {
  python: 71,
  javascript: 63,
  java: 62,
  c: 50,
  cpp: 54,
};
export const labels: Record<string, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  html: 'HTML',
  css: 'CSS',
};

export type Kind =
  'store' | 'loop' | 'branch' | 'call' | 'output' | 'return' | 'input' | 'element' | 'style' | 'action';
export interface Scene {
  at: number;
  line: number;
  kind: Kind;
  title: string;
  detail: string;
  pieces: string[];
}

export function children(node: SyntaxNode) {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}

export function parse(source: string, language: string) {
  return Object.hasOwn(parsers, language) ? parsers[language].parse(source) : null;
}

function short(value: string, limit = 80) {
  const flat = value.trim().replace(/\s+/g, ' ');
  return flat.length > limit ? flat.slice(0, limit - 1) + '…' : flat;
}

const blocks = new Set(['Block', 'CompoundStatement', 'Body', 'ClassBody']);
const declarations = new Set([
  'Declaration',
  'LocalVariableDeclaration',
  'VariableDeclaration',
  'AssignStatement',
  'UpdateStatement',
  'FieldDeclaration',
]);
const functions = new Set([
  'FunctionDefinition',
  'FunctionDeclaration',
  'MethodDeclaration',
  'ConstructorDeclaration',
]);
const quiet = new Set(['BlockComment', 'LineComment', 'Comment', 'String', 'Text']);

function describe(
  node: SyntaxNode,
  source: string,
  language: string,
): Omit<Scene, 'line' | 'at'> | undefined {
  const type = node.name;
  if (
    !(
      declarations.has(type) ||
      functions.has(type) ||
      /Statement$|^OpenTag$|^SelfClosingTag$|^RuleSet$|^Class(Definition|Declaration)$/.test(type)
    ) ||
    blocks.has(type)
  )
    return;
  const parts = children(node);
  const body =
    parts.find(
      (p) => blocks.has(p.name) || (p.name.endsWith('Statement') && p.name !== 'ExpressionStatement'),
    ) ?? (/^(If|For|While|Do)/.test(type) ? parts.find((p) => p.name === 'ExpressionStatement') : undefined);
  const raw = source.slice(node.from, body?.from ?? node.to).trim();
  const snippet = short(raw.replace(/[;:{]\s*$/, ''));
  function scene(kind: Kind, title: string, detail: string, ...pieces: string[]) {
    return { kind, title, detail, pieces: pieces.filter(Boolean).map((p) => short(p, 55)) };
  }
  if (type === 'OpenTag' || type === 'SelfClosingTag') {
    const tag = raw.match(/^<([\w:-]+)/)?.[1] || 'element';
    const parent = node.parent?.parent?.firstChild?.getChild('TagName');
    return scene(
      'element',
      `Place a <${tag}> element`,
      `The opening tag starts this element${parent ? ' inside its parent' : ' in the document'}.`,
      parent ? source.slice(parent.from, parent.to) : 'document',
      tag,
    );
  }
  if (type === 'RuleSet')
    return scene(
      'style',
      'Match a group of elements',
      `The browser applies this rule to elements matching ${snippet}.`,
      snippet,
      'matching elements',
    );
  if (language === 'css' && type === 'Declaration') {
    const [property, ...value] = raw.split(':');
    return scene(
      'style',
      `Set ${short(property)}`,
      'This declaration supplies a value for the selected elements.',
      value.join(':'),
      property,
    );
  }
  if (functions.has(type) || type.startsWith('Class')) {
    const nameNode =
      node.getChild('FunctionDeclarator')?.firstChild ??
      parts.find((p) =>
        ['Definition', 'VariableDefinition', 'VariableName', 'TypeIdentifier'].includes(p.name),
      );
    const name = nameNode ? source.slice(nameNode.from, nameNode.to) : snippet;
    const isClass = type.startsWith('Class');
    return scene(
      'call',
      `${isClass ? 'Define the class' : 'Meet the function'} ${short(name, 35)}`,
      isClass
        ? 'This block groups data and behaviour under one name.'
        : 'A call to this function transfers control to its body.',
      name,
      isClass ? 'members' : 'function body',
    );
  }
  if (type === 'ForStatement' || type === 'EnhancedForStatement') {
    const each = raw.match(/^for\s*\(?\s*(?:(?:const|let|var)\s+)?(\w+)\s+(?:in|of)\s+(.+?)\s*[):]?$/);
    if (each)
      return scene(
        'loop',
        `Visit each ${each[1]}`,
        `Take the next item from ${short(each[2])} and bind it to ${each[1]} for this pass through the body.`,
        each[2],
        each[1],
        'loop body',
      );
    const header = raw.match(/\(([^;]*);([^;]*);([^)]*)\)/);
    if (header)
      return scene(
        'loop',
        'Advance through the loop',
        `Start with ${short(header[1]) || 'the current state'}. Repeat while ${short(header[2]) || 'true'}, then apply ${short(header[3]) || 'the next update'} after each pass.`,
        header[1],
        header[2],
        header[3],
      );
    return scene(
      'loop',
      'Visit each item',
      'Each pass makes the next item available inside the loop.',
      snippet,
      'loop body',
    );
  }
  if (type === 'WhileStatement') {
    const condition = snippet.replace(/^while\s*/, '').replace(/^\((.*)\)$/, '$1');
    return scene(
      'loop',
      'Test before repeating',
      `Run the body while ${condition} is true. Check again after each pass.`,
      condition,
      'loop body',
      'check again',
    );
  }
  if (type === 'DoStatement')
    return scene(
      'loop',
      'Run the body once',
      'The first pass happens before the condition is checked.',
      'loop body',
      'test condition',
    );
  if (type === 'IfStatement') {
    const condition = snippet.replace(/^if\s*/, '').replace(/^\((.*)\)$/, '$1');
    return scene(
      'branch',
      'Check the condition',
      `If ${condition} is true, enter this branch. Otherwise continue to the next alternative or statement.`,
      condition,
      'true / false',
    );
  }
  if (/^(Switch|Match|Try)/.test(type))
    return scene(
      'branch',
      'Choose a path',
      'Control passes to the matching branch for this decision.',
      snippet,
      'matching branch',
    );
  if (type === 'ReturnStatement')
    return scene(
      'return',
      'Return to the caller',
      'This ends the current call and passes control back to the calling code.',
      snippet.replace(/^return\s*/, '') || 'control',
      'caller',
    );
  if (/^(Break|Continue)/.test(type))
    return scene(
      'action',
      type === 'BreakStatement' ? 'Leave this block' : 'Start the next iteration',
      'This statement changes where execution continues.',
      snippet,
    );
  if (declarations.has(type) || type === 'ExpressionStatement') {
    if (
      /^(?:std::)?c(?:out|err)\s*<<|^(?:printf|puts|print|console\.(?:log|warn|error)|System\.out\.print\w*)\s*\(/.test(
        raw,
      )
    ) {
      const value = snippet.replace(/^(?:std::)?c(?:out|err)\s*<<\s*|^[\w.]+\s*\(/, '').replace(/\)$/, '');
      return scene(
        'output',
        'Write a value',
        'Evaluate the expression and send its value to the output stream.',
        value,
        'output',
      );
    }
    if (/\b(?:cin\s*>>|(?:scanf|input|nextInt|readLine)\s*\()/.test(raw))
      return scene(
        'input',
        'Read program input',
        'The next value comes from the input supplied to the program.',
        'input',
        snippet,
      );
    const increment = snippet.match(/^(\w+)(\+\+|--)$/);
    if (increment)
      return scene(
        'store',
        `Update ${increment[1]}`,
        `Change ${increment[1]} by one.`,
        increment[1],
        increment[2] === '++' ? 'add 1' : 'subtract 1',
        increment[1],
      );
    const declared = parts.filter(
      (part) => part.name === 'InitDeclarator' || part.name === 'VariableDeclarator',
    );
    if (declared.length > 1) {
      return scene(
        'store',
        'Initialise local variables',
        'Each declaration gives its variable an initial value.',
        ...declared.map((d) => source.slice(d.from, d.to)),
      );
    }
    const assignment = raw.match(/^(.+?)\s*(\+=|-=|\*=|\/=|=(?!=|>))\s*([\s\S]+?);?$/);
    if (assignment && (declarations.has(type) || node.firstChild?.name === 'AssignmentExpression')) {
      const target = assignment[1].replace(
        /^(?:(?:const|let|var|final|int|float|double|long|char|bool|String|auto)\s+)+/,
        '',
      );
      return scene(
        'store',
        `Update ${short(target, 32)}`,
        assignment[2] === '='
          ? 'Evaluate the right-hand expression and store the result in the destination.'
          : 'Combine the current value with the expression and store the result.',
        assignment[3],
        assignment[2],
        target,
      );
    }
    if (declarations.has(type))
      return scene('store', 'Declare storage', 'The declaration introduces a name in this scope.', snippet);
    const call = snippet.match(/^([\w.:]+)\s*\((.*)\)$/);
    if (call)
      return scene(
        'call',
        `Call ${short(call[1], 32)}`,
        'Pass the arguments to this operation and continue when it returns.',
        call[2] || 'no arguments',
        call[1],
      );
    return scene(
      'action',
      'Evaluate an expression',
      'Follow the operands and the operation shown on this line.',
      snippet,
    );
  }
}

export function buildOutline(source: string, language: string) {
  const scenes: Scene[] = [];
  const tree = parse(source, language);
  let partial = false;
  let line = 1,
    scanned = 0;
  const lineAt = (pos: number) => {
    while (scanned < pos) if (source[scanned++] === '\n') line++;
    return line;
  };
  tree?.iterate({
    enter(ref) {
      if (scenes.length >= 500 || quiet.has(ref.name)) return false;
      if (ref.type.isError) partial = true;
      const description = describe(ref.node, source, language);
      if (description) scenes.push({ ...description, at: ref.from, line: lineAt(ref.from) });
    },
  });
  return { scenes, partial, supported: !!tree, capped: scenes.length === 500 };
}
