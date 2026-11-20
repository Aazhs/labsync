import { classifyError } from './classifier';

export type HintMessage = { role: 'user' | 'assistant'; content: string };

export type DebugContext = {
  code: string;
  language: string;
  filename: string;
  error: string;
  compileOutput: string;
  status: string;
  output: string;
  message: string;
};

export function getDebugDiagnostic({ error, compileOutput, status }: DebugContext) {
  const diagnostic = classifyError(error || null, compileOutput?.replace(/[‘’]/g, "'") || null, status);
  if (diagnostic.tier === 'none') return diagnostic;
  // A linker summary usually follows the diagnostic that identifies the missing symbol.
  const diagnosticLine = `${compileOutput}\n${error}`.split(/\r?\n/).find((line) =>
    /undefined reference|undefined symbol|unresolved external symbol/i.test(line),
  );
  if (diagnosticLine) {
    return { ...diagnostic, category: 'Unresolved symbol', message: diagnosticLine.trim() };
  }
  return diagnostic;
}

export function hasUsedHint(hint: string, history: HintMessage[]) {
  const normalize = (content: string) => content.toLowerCase().replace(/[`\s]+/g, ' ').trim();
  const normalizedHint = normalize(hint);
  return history.some(({ role, content }) => role === 'assistant' && normalize(content) === normalizedHint);
}

export function getLocalHint(context: DebugContext, history: HintMessage[]) {
  const diagnostic = getDebugDiagnostic(context);
  const lines = context.code.split(/\r?\n/);
  const sourceLine = diagnostic.line && diagnostic.line <= lines.length ? diagnostic.line : undefined;
  const location = sourceLine ? `line ${sourceLine}` : 'the statement that triggers the error';
  const before = sourceLine && sourceLine > 1 ? `lines ${sourceLine - 1}–${sourceLine}` : location;
  const name = diagnostic.message.match(/[‘'`]([a-zA-Z_]\w*(?:::\w+)*)[’'`]|\b(?:variable|method)\s+([a-zA-Z_]\w*)/)?.slice(1).find(Boolean);
  const identifier = name ? `\`${name}\`` : 'the reported name';

  let steps: string[];
  switch (diagnostic.category) {
    case 'Missing semicolon':
      steps = [
        `Compare ${before}. Where does the compiler expect the previous ${context.language} statement to end?`,
        `On ${before}, separate the statement from any loop or function header. What punctuation marks the end of the statement?`,
      ];
      break;
    case 'Undeclared name':
    case 'Undefined name':
    case 'Unknown name':
      steps = [
        `Where is ${identifier} declared before ${location}, and does the spelling and capitalization match its use?`,
        `Trace the smallest block containing ${identifier} on ${location}. Is its declaration inside a different function or block?`,
      ];
      break;
    case 'Unresolved symbol':
      steps = [
        `The linker reports ${identifier}. Where is that symbol defined, and is the file with its definition included in this build?`,
        `Compare the declaration and definition of ${identifier}. Do the scope, name and parameter types match?`,
      ];
      break;
    case 'Missing parenthesis':
    case 'Missing brace':
    case 'Unclosed bracket':
    case 'Unexpected token':
    case 'Invalid syntax':
      steps = [
        `Starting at ${location}, match each opening delimiter to its closing delimiter. Which expression or block is still open when the next token appears?`,
        `Can you narrow ${before} to one expression or block and check its delimiters from the inside out?`,
      ];
      break;
    case 'Indentation':
    case 'Missing colon':
      steps = [
        `Compare the block header and its first body line near ${location}. Where should the header end, and which lines belong to its body?`,
        `Which nearby working block has the same structure? Compare its header punctuation and the starting columns of its body.`,
      ];
      break;
    case 'Index out of range':
    case 'Invalid memory access':
      steps = [
        `With your smallest failing input, what index or pointer do you use on ${location}? How does it compare with the valid range or initialized storage?`,
        'What value does the index or pointer have immediately before the failure, and which statement last changed it?',
      ];
      break;
    case 'Never finishes':
    case 'Runaway recursion':
      steps = [
        'What condition should stop the loop or recursive call? Trace the first two iterations or calls and check what changes toward that condition.',
        'Try the smallest input that should stop immediately. Which condition or base case actually runs for that input?',
      ];
      break;
    case 'Divide by zero':
      steps = [
        `What is the divisor on ${location} immediately before the failure? Which input or earlier calculation controls that value?`,
        'Trace the smallest failing input up to the division. Where does the divisor first become zero?',
      ];
      break;
    case 'Mixing types':
    case 'Type mismatch':
    case 'Wrong kind of value':
    case 'Wrong arguments':
      steps = [
        `What types or arguments does the operation on ${location} expect, and what does your code supply?`,
        'Trace those values back to their declarations or the functions that returned them. Where do the actual types first differ from the expected types?',
      ];
      break;
    default: {
      if (diagnostic.tier !== 'none') {
        const problem = diagnostic.message.slice(0, 160);
        steps = [
          `The diagnostic is “${problem}”. On ${location}, which expression or value could trigger it?`,
          `Can you isolate ${location} in a small example and check which expression or input still triggers the error?`,
        ];
        break;
      }
      const outputLine = lines.findIndex((line) => /\b(?:print(?:ln|f)?\s*\(|cout\s*<<|console\.log\s*\()/.test(line));
      const mentionedLine = Number(context.message.match(/\bline\s+(\d+)\b/i)?.[1]);
      const outputLocation = mentionedLine >= 1 && mentionedLine <= lines.length
        ? `the expression on line ${mentionedLine}`
        : outputLine >= 0 ? `the output expression on line ${outputLine + 1}` : 'the expression that produces the result';
      const actual = context.output.trim().split(/\r?\n/, 1)[0].slice(0, 80);
      steps = /\b(?:expect(?:ed|ing)?|should)\b.+\b(?:got|actual(?:ly)?|instead)\b/i.test(context.message) ? [] : [
        actual
          ? `Your last run started its output with “${actual}”. For the same input, what did you expect ${outputLocation} to produce?`
          : `What is one small input or action, and what should it produce? Trace that case up to ${outputLocation}.`,
      ];
      steps.push(
        `Trace the same case by hand. Which value first differs from what you expected before reaching ${outputLocation}?`,
        `What happens with a boundary case, such as zero or one item? Compare the values right before ${outputLocation}.`,
      );
    }
  }

  return steps.find((hint) => !hasUsedHint(hint, history))
    ?? 'What happened after the last check? Share the first unexpected value or the new diagnostic, and the line that produced it.';
}
