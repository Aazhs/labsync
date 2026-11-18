/**
 * Error classifier: turns compiler/runtime output into a three-tier diagnosis.
 *
 * - syntax:     the program can't be parsed or compiled (typos, missing ; or :, bad indentation)
 * - logic:      it runs, then crashes or never finishes (bad index, divide by zero, infinite loop)
 * - conceptual: a misunderstanding of how the language works (mixing types, using null/None,
 *               calling methods that don't exist)
 */

export type ErrorTier = 'syntax' | 'logic' | 'conceptual' | 'none';

export type ClassifiedError = {
  tier: ErrorTier;
  category: string;
  message: string;
  suggestion: string;
  line?: number;
};

type Rule = { pattern: RegExp; tier: Exclude<ErrorTier, 'none'>; category: string; suggestion: string };

// Order matters: the first matching rule wins, so specific patterns come before general ones.
const RULES: Rule[] = [
  // ─── Syntax ───
  { pattern: /IndentationError|TabError/, tier: 'syntax', category: 'Indentation', suggestion: 'Python uses indentation to group code. Make sure every line in a block starts at the same column.' },
  { pattern: /SyntaxError:.*(was never closed|unmatched|'\(' was|'\[' was)/i, tier: 'syntax', category: 'Unclosed bracket', suggestion: 'A bracket or parenthesis is opened but never closed. Count them on the reported line.' },
  { pattern: /SyntaxError:.*expected ':'/i, tier: 'syntax', category: 'Missing colon', suggestion: 'Lines starting with if, for, while, def or class must end with a colon.' },
  { pattern: /SyntaxError/, tier: 'syntax', category: 'Invalid syntax', suggestion: 'Python could not read this line. Look for a missing colon, quote or bracket just before the reported spot.' },
  { pattern: /error:\s*expected ';'|error:\s*';' expected/i, tier: 'syntax', category: 'Missing semicolon', suggestion: 'Every statement must end with a semicolon. Check the end of the previous line.' },
  { pattern: /error:\s*expected '\)'|error:\s*'\)' expected/i, tier: 'syntax', category: 'Missing parenthesis', suggestion: 'Check that every opening parenthesis has a matching closing one.' },
  { pattern: /error:\s*expected '\}'|reached end of file while parsing|expected declaration or statement at end of input/i, tier: 'syntax', category: 'Missing brace', suggestion: 'A { is never closed. Match each opening brace with a closing one.' },
  { pattern: /use of undeclared identifier|was not declared in this scope|undeclared \(first use/i, tier: 'syntax', category: 'Undeclared name', suggestion: 'This name is used before it is declared. Check the spelling, or declare the variable first.' },
  { pattern: /error:\s*cannot find symbol/i, tier: 'syntax', category: 'Unknown name', suggestion: 'Java cannot find this variable or method. Check the spelling and that it is declared in scope.' },
  { pattern: /NameError:\s*name '(\w+)' is not defined/, tier: 'syntax', category: 'Undefined name', suggestion: 'This name has not been defined yet. Check for a typo, or assign it before this line.' },
  { pattern: /ReferenceError:\s*\S+ is not defined/, tier: 'syntax', category: 'Undefined name', suggestion: 'This variable has not been declared. Check for a typo, or declare it with let or const.' },
  { pattern: /SyntaxError:\s*Unexpected token|SyntaxError:\s*missing/i, tier: 'syntax', category: 'Unexpected token', suggestion: 'Something is out of place, often a missing bracket, comma or operator just before this point.' },
  { pattern: /class \w+ is public, should be declared in a file named/i, tier: 'syntax', category: 'Class name', suggestion: 'The public class must be named Main to match the file Main.java.' },

  // ─── Conceptual ───
  { pattern: /TypeError:.*(can only concatenate|unsupported operand|must be str|not supported between)/i, tier: 'conceptual', category: 'Mixing types', suggestion: 'You are combining values of different types, like text and a number. Convert one with int(), float() or str() first.' },
  { pattern: /TypeError:.*'NoneType'|AttributeError:\s*'NoneType'/i, tier: 'conceptual', category: 'Using None', suggestion: 'A value you expected is None. Check that the function you called actually returns something.' },
  { pattern: /TypeError:.*(takes \d+ positional|missing \d+ required|got an unexpected keyword)/i, tier: 'conceptual', category: 'Wrong arguments', suggestion: 'The function is called with a different number of arguments than it is defined with.' },
  { pattern: /TypeError:.*not (callable|subscriptable|iterable)/i, tier: 'conceptual', category: 'Wrong kind of value', suggestion: 'You are treating a value as something it is not, for example calling a number or indexing an int.' },
  { pattern: /AttributeError/, tier: 'conceptual', category: 'Missing attribute', suggestion: 'This kind of value has no such method or attribute. Check its type and the method name.' },
  { pattern: /TypeError/, tier: 'conceptual', category: 'Type mismatch', suggestion: 'An operation got a value of the wrong type. Print the type() of the values involved.' },
  { pattern: /ValueError:\s*invalid literal for int/i, tier: 'conceptual', category: 'Bad conversion', suggestion: 'int() received text that is not a whole number. Check the input you typed or strip spaces first.' },
  { pattern: /NullPointerException/, tier: 'conceptual', category: 'Null reference', suggestion: 'An object is used before it is created. Make sure it is initialised with new before you use it.' },
  { pattern: /incompatible types|cannot convert|invalid conversion/i, tier: 'conceptual', category: 'Type mismatch', suggestion: 'The value does not match the declared type. Check the variable and return types.' },
  { pattern: /TypeError:.*(undefined|null)/i, tier: 'conceptual', category: 'Using undefined', suggestion: 'A value is undefined or null where an object was expected. Check where it is assigned.' },

  // ─── Logic ───
  { pattern: /ZeroDivisionError|division by zero|ArithmeticException|Floating point exception/i, tier: 'logic', category: 'Divide by zero', suggestion: 'A divisor became zero. What value does it have on the iteration that fails?' },
  { pattern: /IndexError|ArrayIndexOutOfBounds|StringIndexOutOfBounds|out_of_range/i, tier: 'logic', category: 'Index out of range', suggestion: 'An index goes past the end. If the list has n items, the last index is n - 1. Check the loop bounds.' },
  { pattern: /KeyError/, tier: 'logic', category: 'Missing key', suggestion: 'The dictionary has no such key. Check the key, or use .get() with a default.' },
  { pattern: /RecursionError|StackOverflowError|Maximum call stack/i, tier: 'logic', category: 'Runaway recursion', suggestion: 'The function keeps calling itself. Is the base case reachable for this input?' },
  { pattern: /segmentation fault|SIGSEGV/i, tier: 'logic', category: 'Invalid memory access', suggestion: 'The program read memory it does not own. Check array bounds and pointers that might be uninitialised.' },
  { pattern: /time limit exceeded/i, tier: 'logic', category: 'Never finishes', suggestion: 'The program ran too long. Check that each loop condition eventually becomes false.' },
  { pattern: /ValueError/, tier: 'logic', category: 'Invalid value', suggestion: 'A function received a value it cannot work with. Print the value just before this line.' },
];

/** The line in the student's own file, preferring the deepest traceback frame. */
function findLine(text: string): number | undefined {
  const pyFrames = [...text.matchAll(/File "[^"]*(?:script|main)[^"]*", line (\d+)/g)];
  if (pyFrames.length) return Number(pyFrames[pyFrames.length - 1][1]);
  const compiler = text.match(/\.(?:c|cpp|cc|java|js):(\d+)(?::\d+)?:?\s/);
  if (compiler) return Number(compiler[1]);
  const generic = text.match(/line (\d+)/i);
  return generic ? Number(generic[1]) : undefined;
}

/** The most informative line of the error, e.g. "ZeroDivisionError: division by zero". */
function headline(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const named = [...lines].reverse().find((l) => /(Error|Exception)\b.*:/.test(l) || /error:/i.test(l));
  return named ?? lines[0] ?? '';
}

export function classifyError(stderr: string | null, compileOutput: string | null, statusDescription: string): ClassifiedError {
  const none: ClassifiedError = { tier: 'none', category: 'No error', message: '', suggestion: '' };
  if (statusDescription === 'Accepted' || statusDescription === 'Waiting for Input') return none;

  const errorText = [compileOutput, stderr, statusDescription].filter(Boolean).join('\n');
  if (!errorText.trim()) return none;

  const line = findLine(errorText);
  for (const rule of RULES) {
    if (rule.pattern.test(errorText)) {
      return { tier: rule.tier, category: rule.category, message: headline(errorText), suggestion: rule.suggestion, line };
    }
  }

  if (compileOutput?.trim() || /compil/i.test(statusDescription)) {
    return {
      tier: 'syntax',
      category: 'Does not compile',
      message: headline(errorText),
      suggestion: 'Read the first compiler error. Later errors are often caused by the first one.',
      line,
    };
  }

  return {
    tier: 'logic',
    category: 'Crashed while running',
    message: headline(errorText),
    suggestion: 'The program started but stopped with an error. Read the last line of the message, then check the reported line.',
    line,
  };
}
