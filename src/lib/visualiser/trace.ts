import type { SyntaxNode } from '@lezer/common';
import { children, parse } from './source';

// Long enough for a small search or backtracking run to reach its interesting writes.
export const FRAME_LIMIT = 1500;
export interface Frame {
  line: number;
  at?: number;
  leaving?: boolean;
  grids?: Record<string, string[][]>;
  values: Partial<Record<string, string | string[]>>;
  output: string;
}
export interface Recording {
  frames: Frame[];
  truncated: boolean;
  output: string;
}

type Binding = { name: string; type: string; array?: boolean; container?: 'vector' | 'matrix' };
type Edit = { pos: number; text: string };
const blocks = new Set(['Script', 'Block', 'CompoundStatement']);
const bodies = new Set([
  'IfStatement',
  'WhileStatement',
  'ForStatement',
  'DoStatement',
  'EnhancedForStatement',
  'ForInStatement',
]);
const variables = new Set(['VariableDeclaration', 'Declaration', 'LocalVariableDeclaration']);

function bindings(node: SyntaxNode, source: string, language: string): Binding[] {
  const raw = (n: SyntaxNode) => source.slice(n.from, n.to);
  const parts = children(node);
  if (language === 'javascript') {
    return parts.filter((p) => p.name === 'VariableDefinition').map((p) => ({ name: raw(p), type: 'js' }));
  }
  if (parts.some((p) => raw(p) === 'volatile')) return [];
  if (language === 'cpp') {
    const template = node.getChild('TemplateType');
    // Match only std::vector of numeric primitives, with at most two dimensions.
    const vector =
      template &&
      /^(?:std::)?vector<((?:(?:std::)?vector<)?(?:int|long|short|float|double|unsigned|bool)>?)>$/.exec(
        raw(template).replace(/\s+/g, ''),
      );
    if (vector) {
      const container = vector[1].includes('<') ? ('matrix' as const) : ('vector' as const);
      const declarators = parts.flatMap((p) => (p.name === 'InitDeclarator' ? [p.firstChild] : [p]));
      return declarators.flatMap((p) => {
        const id = p?.name === 'ReferenceDeclarator' ? p.getChild('Identifier') : p;
        return id?.name === 'Identifier' ? [{ name: raw(id), type: 'vector', container }] : [];
      });
    }
  }
  const arrayType = node.getChild('ArrayType');
  const primitive =
    parts.find((p) => p.name === 'PrimitiveType' || p.name === 'SizedTypeSpecifier') ??
    arrayType?.getChild('PrimitiveType') ??
    arrayType?.getChild('ArrayType')?.getChild('PrimitiveType');
  if (!primitive) return [];
  const type = raw(primitive);
  if (
    !/^(int|short|long|unsigned|signed|char|bool|boolean|byte|float|double)(\s+(int|long|char|short))*$/.test(
      type,
    )
  )
    return [];
  const list: Binding[] = [];
  for (const decl of parts) {
    if (decl.name !== 'InitDeclarator' && decl.name !== 'VariableDeclarator') continue;
    const name = decl.firstChild;
    if (!name || !decl.firstChild?.nextSibling) continue;
    if (name.name === 'Identifier' || name.name === 'Definition') {
      list.push({ name: raw(name), type, array: !!arrayType || !!decl.getChild('Dimension') });
    }
    if (
      name.name === 'ArrayDeclarator' &&
      name.firstChild?.name === 'Identifier' &&
      decl.getChild('InitializerList')
    ) {
      list.push({ name: raw(name.firstChild), type, array: true });
    }
    if (name.name === 'ArrayDeclarator' && decl.getChild('InitializerList')) {
      const inner = name.firstChild;
      if (inner?.name === 'ArrayDeclarator' && inner.firstChild?.name === 'Identifier')
        list.push({ name: raw(inner.firstChild), type, container: 'matrix' });
    }
  }
  if (
    /Parameter(Declaration)?$/.test(node.name) ||
    (node.name === 'ForSpec' && parts.some((p) => p.name === ':'))
  ) {
    const name = parts.find((p) => ['Definition', 'Identifier'].includes(p.name));
    if (name) list.push({ name: raw(name), type, array: !!arrayType });
  }
  return list;
}

function pythonTrace(source: string, mark: string, executable: string) {
  return `import sys as _sys, json as _json, itertools as _it
_source = ${JSON.stringify(executable)}
_count = 0
def _value(v, depth=0):
    if type(v) in (int, float, bool, str, type(None)):
        return str(v)[:80] if type(v) != int or v.bit_length() < 256 else "<large integer>"
    if type(v) in (list, tuple):
        return [_value(x, depth+1) if type(x) in (int, float, bool, str, type(None)) or (depth == 0 and type(x) in (list, tuple)) else type(x).__name__ for x in v[:12]] + (["…"] if len(v) > 12 else [])
    return "<" + type(v).__name__ + ">"
def _watch(f, event, arg):
    global _count
    if f.f_code.co_filename != "<lab>": return None
    if event in ("line", "return") and 0 < f.f_lineno <= ${source.split('\n').length}:
        if _count == ${FRAME_LIMIT}:
            print("${mark}END\\x1f", end="", flush=True)
            _sys.settrace(None)
            return None
        _count += 1
        vals = {k: _value(v) for k,v in _it.islice(((k,v) for k,v in f.f_locals.items() if not k.startswith("__") and type(v) in (int,float,bool,str,list,tuple,type(None))), 8)}
        print("${mark}" + str(-f.f_lineno - 1 if event == "return" else f.f_lineno) + "\\t" + _json.dumps(vals) + "\\x1f", end="", flush=True)
    return _watch
_program = compile(_source, "<lab>", "exec")
_sys.settrace(_watch)
try:
    exec(_program, {"__name__": "__main__", "__file__": "main.py"})
finally:
    _sys.settrace(None)
`;
}

function cValue(b: Binding, expression: string) {
  if (b.type === 'char') return `printf("\\\"\\\\u%04x\\\"", (unsigned)(unsigned char)(${expression}));`;
  if (/float|double/.test(b.type)) return `printf("\\\"%.8g\\\"", (double)(${expression}));`;
  if (b.type.includes('unsigned')) return `printf("\\\"%llu\\\"", (unsigned long long)(${expression}));`;
  return `printf("\\\"%lld\\\"", (long long)(${expression}));`;
}

export function instrument(source: string, language: string, mark: string, executable = source) {
  if (language === 'python') return pythonTrace(source, mark, executable);
  const tree = parse(source, language);
  if (!tree) throw new Error('This file supports a source walkthrough.');
  const js = language === 'javascript',
    java = language === 'java';
  const helper = 'LSv' + mark.replace(/\W/g, '');
  const edits: Edit[] = [];
  let instrumentedChars = source.length;
  const event = (at: number, vars: Binding[]) => {
    if (js) return `;${helper}(${at},()=>({${vars.map((v) => v.name).join(',')}}));`;
    if (java) {
      const fields = vars.map((b) => `+"\\\"${b.name}\\\":"+ ${helper}.value(${b.name})`);
      return `if(${helper}.step(${at}))System.out.print("{"${fields.join(' + "," ')}+"}\\037");`;
    }
    const fields = vars.map((b, i) => {
      const prefix = `fputs("${i ? ',' : ''}\\\"${b.name}\\\":",stdout);`;
      if (language === 'c' && b.container === 'matrix') {
        const row = helper + 'r',
          col = helper + 'c',
          grid = b.name;
        return (
          prefix +
          `putchar('[');for(size_t ${row}=0;${row}<12&&${row}<sizeof(${grid})/sizeof(${grid}[0]);++${row}){
          if(${row})putchar(',');putchar('[');
          for(size_t ${col}=0;${col}<12&&${col}<sizeof(${grid}[0])/sizeof(${grid}[0][0]);++${col}){
            if(${col})putchar(',');${cValue(b, grid + '[' + row + '][' + col + ']')}
          }putchar(']');}putchar(']');`
        );
      }
      if (b.container) return prefix + `${helper}${b.container}(${b.name});`;
      if (!b.array) return prefix + cValue(b, b.name);
      return (
        prefix +
        `putchar('[');for(unsigned ${helper}i=0;${helper}i<sizeof(${b.name})/sizeof(${b.name}[0])&&${helper}i<12;++${helper}i){if(${helper}i)putchar(',');${cValue(b, b.name + '[' + helper + 'i]')}}if(sizeof(${b.name})/sizeof(${b.name}[0])>12)fputs(",\\\"…\\\"",stdout);putchar(']');`
      );
    });
    return `if(${helper}(${at})){putchar('{');${fields.join('')}fputs("}\\037",stdout);fflush(stdout);}`;
  };

  // Only insert between statements, or surround a single control-flow body with braces.
  // Loop headers, directives, labels, and explicit constructor invocations keep their positions.
  function walk(node: SyntaxNode, inherited: Binding[]) {
    const parts = children(node);
    const functionBody =
      blocks.has(node.name) &&
      (node.name === 'Script' || /Function|Method|Constructor/.test(node.parent?.name ?? ''));
    const last = functionBody
      ? parts.filter((p) => p.name !== '}' && !p.name.endsWith('Comment')).at(-1)
      : null;
    const scope = new Map(inherited.map((b) => [b.name, b]));
    for (const child of parts) {
      const directive = js && child.name === 'ExpressionStatement' && child.firstChild?.name === 'String';
      const statement =
        (child.name.endsWith('Statement') || variables.has(child.name)) &&
        ![
          'CompoundStatement',
          'EmptyStatement',
          'LabeledStatement',
          'ImportStatement',
          'ExportStatement',
        ].includes(child.name);
      const inBlock = blocks.has(node.name);
      const singleBody = bodies.has(node.name) && child.name.endsWith('Statement');
      if (statement && !directive && (inBlock || singleBody)) {
        const hook = event(child.from, [...scope.values()].slice(-8));
        instrumentedChars += hook.length;
        if (instrumentedChars > 512 * 1024)
          throw new Error('Recording exceeds the instrumented source limit.');
        edits.push({ pos: child.from, text: singleBody ? '{' + hook : hook });
        if (singleBody) edits.push({ pos: child.to, text: '}' });
      }
      // Function calls get their own parameters, including recursive calls.
      if (
        /Function(Definition|Declaration|Expression)|MethodDeclaration|ArrowFunction|ConstructorDeclaration/.test(
          child.name,
        )
      ) {
        const params =
          child.getChild('FunctionDeclarator')?.getChild('ParameterList') ??
          child.getChild('FormalParameters') ??
          child.getChild('ParamList');
        const args = params
          ? js
            ? bindings(params, source, language)
            : children(params).flatMap((p) => bindings(p, source, language))
          : [];
        walk(child, args);
      } else if (bodies.has(child.name)) {
        const spec = child.getChild('ForSpec') ?? child.getChild('ForOfSpec') ?? child;
        const declaration = children(spec).find((p) => variables.has(p.name));
        const loopVars = bindings(declaration ?? spec, source, language);
        walk(child, [...scope.values(), ...loopVars]);
      } else {
        walk(child, [...scope.values()]);
      }
      if (inBlock && variables.has(child.name)) {
        // Remove shadowed names even when their new type cannot be displayed.
        for (const part of children(child)) {
          const declarator = ['InitDeclarator', 'VariableDeclarator'].includes(part.name)
            ? part.firstChild
            : part;
          if (declarator) scope.delete(source.slice(declarator.from, declarator.to));
        }
        for (const b of bindings(child, source, language)) scope.set(b.name, b);
      }
      if (
        last === child &&
        !directive &&
        (variables.has(child.name) || child.name === 'ExpressionStatement')
      ) {
        // A function that falls through may have no next statement at which to see its last write.
        edits.push({ pos: child.to, text: event(-child.from - 1, [...scope.values()].slice(-8)) });
      }
    }
  }
  walk(tree.topNode, []);
  const prelude = js
    ? `
function ${helper}(at, read) {
  const count = ${helper}.count || 0;
  if (count > ${FRAME_LIMIT}) return;
  ${helper}.count = count + 1;
  if (count === ${FRAME_LIMIT}) { process.stdout.write("${mark}END\\x1f"); return; }
  const primitive = v => v === null || ['number','string','boolean','bigint','undefined'].includes(typeof v) ? String(v).slice(0,80) : '<object>';
  const sampleArray = (v,depth=0) => {
    const cells=[];
    for (let i=0; i<Math.min(v.length,12); i++) {
      const cell=Object.getOwnPropertyDescriptor(v,String(i));
      if (!cell || !('value' in cell)) cells.push(cell ? '<accessor>' : '<empty>');
      else cells.push(!depth && Array.isArray(cell.value) ? sampleArray(cell.value,1) : primitive(cell.value));
    }
    if (v.length>12) cells.push('…');
    return cells;
  };
  const values = Object.create(null);
  try {
    for (const [k,v] of Object.entries(read())) {
      if (!Array.isArray(v)) { values[k] = primitive(v); continue; }
      values[k] = sampleArray(v);
    }
  } catch {}
  process.stdout.write("${mark}"+at+"\\t"+JSON.stringify(values)+"\\x1f");
}
`
    : java
      ? String.raw`
class ${helper} {
  static int count;
  static String value(Object v) {
    if (v == null) return "\"null\"";
    if (v instanceof Character) return String.format("\"\\u%04x\"", (int)(char)v);
    if (!v.getClass().isArray()) return "\"" + v + "\"";
    if (!v.getClass().getComponentType().isPrimitive() && !(v.getClass().getComponentType().isArray() && v.getClass().getComponentType().getComponentType().isPrimitive())) return "\"<array>\"";
    StringBuilder result = new StringBuilder("[");
    int size = java.lang.reflect.Array.getLength(v);
    for (int i=0; i<Math.min(size,12); i++) {
      if (i>0) result.append(',');
      result.append(value(java.lang.reflect.Array.get(v,i)));
    }
    if (size>12) result.append(",\"…\"");
    return result.append(']').toString();
  }
  static boolean step(int at) {
    if(count > ${FRAME_LIMIT}) return false;
    if(count++ == ${FRAME_LIMIT}) {System.out.print("${mark}END\037"); return false;}
    System.out.print("${mark}"+at+"\t"); return true;
  }
}
`
      : `#include <stdio.h>
${
  language === 'cpp'
    ? `#include <iostream>
#include <vector>
template<class T> static size_t ${helper}size(const std::vector<T>& v){return v.size();}
template<class T,size_t N> static size_t ${helper}size(const T(&)[N]){return N;}
template<class T> static void ${helper}vector(const T& v){
  putchar('[');for(size_t i=0;i<${helper}size(v)&&i<12;i++){if(i)putchar(',');printf("\\"%.12Lg\\"",(long double)v[i]);}putchar(']');
}
template<class R> static void ${helper}matrix(const R& m){
  putchar('[');for(size_t i=0;i<${helper}size(m)&&i<12;i++){if(i)putchar(',');${helper}vector(m[i]);}putchar(']');
}
`
    : ''
}
static int ${helper}(int at){static unsigned count;if(count>${FRAME_LIMIT})return 0;${language === 'cpp' ? 'std::cout.flush();' : ''}if(count++==${FRAME_LIMIT}){fputs("${mark}END\\037",stdout);return 0;}printf("${mark}%d\\t",at);return 1;}
`;
  // Work forwards. A closing brace at a shared boundary precedes the next probe.
  edits.sort((a, b) => a.pos - b.pos);
  let pos = 0,
    result = '';
  for (const edit of edits) {
    result += source.slice(pos, edit.pos) + edit.text;
    pos = edit.pos;
  }
  result += source.slice(pos);
  return js || java ? result + '\n' + prelude : prelude + result;
}

export function readRecording(stdout: string, source: string, language: string, mark: string): Recording {
  const frames: Frame[] = [];
  let truncated = false,
    output = '';
  const lines = source.split('\n');
  const chunks = stdout.split(mark);
  output = chunks.shift() || '';
  for (const chunk of chunks) {
    const end = chunk.indexOf('\x1f');
    if (end < 0) continue;
    const payload = chunk.slice(0, end);
    if (payload === 'END') truncated = true;
    else if (frames.length < FRAME_LIMIT) {
      const tab = payload.indexOf('\t');
      const position = Number(payload.slice(0, tab));
      const leaving = position < 0;
      const loc = leaving ? -position - 1 : position;
      const line = language === 'python' ? loc : source.slice(0, loc).split('\n').length;
      if (tab > 0 && Number.isInteger(loc) && loc >= 0 && line >= 1 && line <= lines.length) {
        try {
          const decoded = JSON.parse(payload.slice(tab + 1));
          const values: Frame['values'] = Object.create(null);
          const grids: NonNullable<Frame['grids']> = Object.create(null);
          for (const [name, v] of Object.entries(decoded).slice(0, 8)) {
            if (
              Array.isArray(v) &&
              v.some(Array.isArray) &&
              v.every((row) => Array.isArray(row) || row === '…')
            ) {
              grids[name] = v
                .filter(Array.isArray)
                .slice(0, 12)
                .map((row) => row.slice(0, 12).map((cell) => String(cell).slice(0, 80)));
              continue;
            }
            if (Array.isArray(v)) values[name] = v.slice(0, 13).map((x) => String(x).slice(0, 80));
            else values[name] = String(v).slice(0, 80);
          }
          frames.push({
            line,
            ...(leaving ? { leaving: true } : {}),
            at: language === 'python' ? undefined : loc,
            values,
            ...(Object.keys(grids).length ? { grids } : {}),
            output: output.slice(-1600),
          });
        } catch {
          /* A terminated program may leave a partial marker. */
        }
      }
    }
    output += chunk.slice(end + 1);
  }
  return { frames, truncated, output };
}
