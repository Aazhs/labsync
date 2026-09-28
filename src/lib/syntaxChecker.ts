/**
 * Live Syntax Error Displayer Engine
 * Real-time client-side syntax analysis for Python, C, C++, Java, and JavaScript.
 * Provides line and column-accurate errors, warnings, suggestions, and compiler error parsing.
 */

export type SyntaxSeverity = 'error' | 'warning' | 'info';

export interface SyntaxProblem {
  id: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: SyntaxSeverity;
  category: string;
  message: string;
  suggestion?: string;
  source: 'live' | 'compiler';
}

interface DelimiterToken {
  char: '(' | '[' | '{';
  line: number;
  col: number;
}

const MATCHING_DELIMITERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
};

const OPENING_DELIMITERS: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
};

/**
 * Perform real-time syntax checking on user code as they type.
 */
export function checkSyntax(code: string, languageName: string): SyntaxProblem[] {
  if (!code || !code.trim()) {
    return [];
  }

  const problems: SyntaxProblem[] = [];
  const lines = code.split('\n');
  const lang = languageName.toLowerCase();

  // 1. Universal Delimiter & String Checking
  checkDelimitersAndStrings(lines, lang, problems);

  // 2. Language-specific syntax rules
  if (lang === 'python') {
    checkPythonSyntax(lines, problems);
  } else if (lang === 'cpp' || lang === 'c') {
    checkCAndCppSyntax(lines, problems, lang);
  } else if (lang === 'java') {
    checkJavaSyntax(lines, problems);
  } else if (lang === 'javascript') {
    checkJavaScriptSyntax(lines, problems);
  }

  // Sort problems by line and column ascending
  return problems.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });
}

/**
 * Universal delimiter bracket tracker & unterminated string checker.
 * Handles strings, escapes, single-line and multi-line comments.
 */
function checkDelimitersAndStrings(
  lines: string[],
  lang: string,
  problems: SyntaxProblem[]
) {
  const stack: DelimiterToken[] = [];
  let inMultiLineComment = false;
  let multiLineCommentStart = { line: 0, col: 0 };
  let inTripleQuote: string | null = null;
  let tripleQuoteStart = { line: 0, col: 0 };

  const isPython = lang === 'python';

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const line = lines[lineIdx];
    let i = 0;

    let inString: string | null = null;
    let stringStartCol = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = i + 1 < line.length ? line[i + 1] : '';
      const colNum = i + 1;

      // Handle multi-line comment /* ... */ in C/C++/Java/JS
      if (inMultiLineComment) {
        if (char === '*' && nextChar === '/') {
          inMultiLineComment = false;
          i += 2;
          continue;
        }
        i++;
        continue;
      }

      // Handle Python triple quotes """ or '''
      if (isPython && inTripleQuote) {
        if (line.slice(i, i + 3) === inTripleQuote) {
          inTripleQuote = null;
          i += 3;
          continue;
        }
        i++;
        continue;
      }

      // Handle single-line strings '...' or "..." or `...`
      if (inString) {
        if (char === '\\') {
          // Escaped character
          i += 2;
          continue;
        }
        if (char === inString) {
          inString = null;
          i++;
          continue;
        }
        i++;
        continue;
      }

      // Check start of multi-line comment /*
      if (!isPython && char === '/' && nextChar === '*') {
        inMultiLineComment = true;
        multiLineCommentStart = { line: lineNum, col: colNum };
        i += 2;
        continue;
      }

      // Check start of single line comment
      if (!isPython && char === '/' && nextChar === '/') {
        // Rest of the line is a comment
        break;
      }
      if (isPython && char === '#') {
        // Rest of the line is a comment
        break;
      }

      // Check start of Python triple quotes
      if (isPython && (line.slice(i, i + 3) === '"""' || line.slice(i, i + 3) === "'''")) {
        inTripleQuote = line.slice(i, i + 3);
        tripleQuoteStart = { line: lineNum, col: colNum };
        i += 3;
        continue;
      }

      // Check start of string literals
      if (char === '"' || char === "'" || (!isPython && char === '`')) {
        inString = char;
        stringStartCol = colNum;
        i++;
        continue;
      }

      // Opening brackets
      if (char === '(' || char === '[' || char === '{') {
        stack.push({ char, line: lineNum, col: colNum });
        i++;
        continue;
      }

      // Closing brackets
      if (char === ')' || char === ']' || char === '}') {
        const expectedOpener = OPENING_DELIMITERS[char];
        if (stack.length === 0) {
          problems.push({
            id: `delimiter-unexpected-${lineNum}-${colNum}`,
            line: lineNum,
            column: colNum,
            endLine: lineNum,
            endColumn: colNum + 1,
            severity: 'error',
            category: 'Unmatched Bracket',
            message: `SyntaxError: Unexpected closing '${char}' with no matching opening bracket`,
            suggestion: `Remove the extra '${char}' or add the matching '${expectedOpener}'.`,
            source: 'live',
          });
        } else {
          const top = stack.pop()!;
          if (top.char !== expectedOpener) {
            problems.push({
              id: `delimiter-mismatch-${lineNum}-${colNum}`,
              line: lineNum,
              column: colNum,
              endLine: lineNum,
              endColumn: colNum + 1,
              severity: 'error',
              category: 'Mismatched Delimiter',
              message: `SyntaxError: Mismatched bracket: expected '${MATCHING_DELIMITERS[top.char]}' to close '${top.char}' from line ${top.line}, but found '${char}'`,
              suggestion: `Replace '${char}' with '${MATCHING_DELIMITERS[top.char]}'.`,
              source: 'live',
            });
          }
        }
        i++;
        continue;
      }

      i++;
    }

    // If single line string was not closed and line doesn't end with a backslash escape
    if (inString && !line.trimEnd().endsWith('\\')) {
      problems.push({
        id: `unterminated-string-${lineNum}-${stringStartCol}`,
        line: lineNum,
        column: stringStartCol,
        endLine: lineNum,
        endColumn: line.length + 1,
        severity: 'error',
        category: 'Unterminated String',
        message: `SyntaxError: Unterminated string literal (missing closing ${inString})`,
        suggestion: `Add closing quote ${inString} at the end of the string.`,
        source: 'live',
      });
    }
  }

  // End of file checks
  if (inMultiLineComment) {
    problems.push({
      id: `unterminated-comment-${multiLineCommentStart.line}`,
      line: multiLineCommentStart.line,
      column: multiLineCommentStart.col,
      endLine: multiLineCommentStart.line,
      endColumn: multiLineCommentStart.col + 2,
      severity: 'error',
      category: 'Unterminated Comment',
      message: "SyntaxError: Unterminated block comment '/*'",
      suggestion: "Close the comment with '*/'.",
      source: 'live',
    });
  }

  if (inTripleQuote) {
    problems.push({
      id: `unterminated-triple-quote-${tripleQuoteStart.line}`,
      line: tripleQuoteStart.line,
      column: tripleQuoteStart.col,
      endLine: tripleQuoteStart.line,
      endColumn: tripleQuoteStart.col + 3,
      severity: 'error',
      category: 'Unterminated String',
      message: `SyntaxError: Unterminated triple-quoted string (${inTripleQuote})`,
      suggestion: `Close the string with ${inTripleQuote}.`,
      source: 'live',
    });
  }

  // Unclosed brackets remaining on stack
  for (const unclosed of stack) {
    const expected = MATCHING_DELIMITERS[unclosed.char];
    problems.push({
      id: `unclosed-bracket-${unclosed.line}-${unclosed.col}`,
      line: unclosed.line,
      column: unclosed.col,
      endLine: unclosed.line,
      endColumn: unclosed.col + 1,
      severity: 'error',
      category: 'Unclosed Delimiter',
      message: `SyntaxError: Unclosed '${unclosed.char}' — missing closing '${expected}'`,
      suggestion: `Add matching '${expected}' before the end of this block.`,
      source: 'live',
    });
  }
}

/**
 * Python-specific syntax validation.
 */
function checkPythonSyntax(lines: string[], problems: SyntaxProblem[]) {
  const HEADER_PATTERN = /^\s*(def\s+\w+|class\s+\w+|if\b|elif\b|else\b|for\b|while\b|try\b|except\b|finally\b|with\b|async\s+def\b|async\s+for\b|async\s+with\b)/;

  let openParenDepth = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    // Skip empty lines and full-line comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Strip inline comments for syntax analysis
    const commentIdx = rawLine.indexOf('#');
    const codePart = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
    const trimmedCode = codePart.trim();

    // Track parentheses depth across lines for multi-line function defs
    for (let c = 0; c < codePart.length; c++) {
      if (codePart[c] === '(') openParenDepth++;
      else if (codePart[c] === ')') openParenDepth = Math.max(0, openParenDepth - 1);
    }

    // 1. Check for missing colon after compound statements (when parens are closed)
    if (HEADER_PATTERN.test(codePart) && openParenDepth === 0) {
      if (!trimmedCode.endsWith(':') && !trimmedCode.endsWith('\\')) {
        const match = codePart.match(HEADER_PATTERN);
        const keyword = match ? match[1].split(' ')[0] : 'statement';
        problems.push({
          id: `py-missing-colon-${lineNum}`,
          line: lineNum,
          column: codePart.trimEnd().length + 1,
          endLine: lineNum,
          endColumn: codePart.trimEnd().length + 2,
          severity: 'error',
          category: 'Missing Colon',
          message: `SyntaxError: expected ':' at the end of '${keyword}' statement`,
          suggestion: "Add a colon ':' at the end of the line.",
          source: 'live',
        });
      }
    }

    // 2. Assignment '=' inside conditional 'if' or 'elif' or 'while'
    const condMatch = codePart.match(/^\s*(if|elif|while)\s+(.*)/);
    if (condMatch) {
      let condText = condMatch[2];
      if (condText.endsWith(':')) condText = condText.slice(0, -1);
      
      // Look for single '=' not part of ==, !=, <=, >=, :=
      const singleEqMatch = condText.match(/(?<![=!<:>])=(?![=])/);
      if (singleEqMatch && singleEqMatch.index !== undefined) {
        const eqCol = codePart.indexOf('=') + 1;
        problems.push({
          id: `py-invalid-assign-cond-${lineNum}`,
          line: lineNum,
          column: eqCol,
          endLine: lineNum,
          endColumn: eqCol + 1,
          severity: 'error',
          category: 'Invalid Syntax',
          message: "SyntaxError: Cannot use assignment '=' in conditional expression",
          suggestion: "Did you mean '==' for comparison? Or use ':=' for assignment expression.",
          source: 'live',
        });
      }
    }

    // 3. Keyword Typos: 'else if' or 'elseif'
    const elseIfMatch = codePart.match(/^\s*(else\s+if|elseif)\b/);
    if (elseIfMatch) {
      const typoCol = codePart.indexOf(elseIfMatch[1]) + 1;
      problems.push({
        id: `py-else-if-${lineNum}`,
        line: lineNum,
        column: typoCol,
        endLine: lineNum,
        endColumn: typoCol + elseIfMatch[1].length,
        severity: 'error',
        category: 'Invalid Keyword',
        message: "SyntaxError: Python uses 'elif', not 'else if'",
        suggestion: "Replace with 'elif'.",
        source: 'live',
      });
    }

    // 4. 'print' statement without parentheses (Python 2 syntax)
    const printMatch = codePart.match(/^\s*print\s+(["'][^"']*["']|[a-zA-Z0-9_]+)/);
    if (printMatch && !codePart.includes('(')) {
      const printCol = codePart.indexOf('print') + 1;
      problems.push({
        id: `py-print-call-${lineNum}`,
        line: lineNum,
        column: printCol,
        endLine: lineNum,
        endColumn: printCol + 5,
        severity: 'error',
        category: 'Missing Parentheses',
        message: "SyntaxError: Missing parentheses in call to 'print'",
        suggestion: "Use print(...) as a function in Python 3.",
        source: 'live',
      });
    }

    // 5. 'function' keyword instead of 'def'
    const funcMatch = codePart.match(/^\s*(function)\s+\w+/);
    if (funcMatch) {
      const funcCol = codePart.indexOf('function') + 1;
      problems.push({
        id: `py-func-keyword-${lineNum}`,
        line: lineNum,
        column: funcCol,
        endLine: lineNum,
        endColumn: funcCol + 8,
        severity: 'error',
        category: 'Invalid Keyword',
        message: "SyntaxError: Python uses 'def' to define functions, not 'function'",
        suggestion: "Replace 'function' with 'def'.",
        source: 'live',
      });
    }

    // 6. Inconsistent indentation: mixing tabs and spaces
    const leadingSpaces = rawLine.match(/^([ \t]+)/);
    if (leadingSpaces) {
      const whitespace = leadingSpaces[1];
      if (whitespace.includes('\t') && whitespace.includes(' ')) {
        problems.push({
          id: `py-mixed-indent-${lineNum}`,
          line: lineNum,
          column: 1,
          endLine: lineNum,
          endColumn: whitespace.length + 1,
          severity: 'warning',
          category: 'Indentation Warning',
          message: 'IndentationWarning: Inconsistent use of tabs and spaces in indentation',
          suggestion: 'Standardize on 4 spaces for indentation.',
          source: 'live',
        });
      }
    }

    // 7. Empty block after compound statement header
    if (trimmedCode.endsWith(':') && lineIdx + 1 < lines.length) {
      const currentIndent = rawLine.search(/\S/);
      // Find the next non-empty, non-comment line
      let nextLineIdx = lineIdx + 1;
      while (nextLineIdx < lines.length) {
        const nextTrim = lines[nextLineIdx].trim();
        if (nextTrim && !nextTrim.startsWith('#')) break;
        nextLineIdx++;
      }

      if (nextLineIdx < lines.length) {
        const nextRaw = lines[nextLineIdx];
        const nextIndent = nextRaw.search(/\S/);
        if (nextIndent <= currentIndent) {
          problems.push({
            id: `py-expected-indent-${lineNum + 1}`,
            line: lineIdx + 2,
            column: 1,
            endLine: lineIdx + 2,
            endColumn: 4,
            severity: 'error',
            category: 'Indentation Error',
            message: `IndentationError: expected an indented block after statement on line ${lineNum}`,
            suggestion: "Indent the code inside this block, or add 'pass' if intentional.",
            source: 'live',
          });
        }
      }
    }
  }
}

/**
 * C and C++ syntax checking.
 */
function checkCAndCppSyntax(lines: string[], problems: SyntaxProblem[], lang: string) {
  let insideBlockDepth = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      continue;
    }

    // Strip inline single-line comments
    const commentIdx = rawLine.indexOf('//');
    const codePart = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
    const trimmedCode = codePart.trim();

    // Track block depth
    for (const ch of codePart) {
      if (ch === '{') insideBlockDepth++;
      else if (ch === '}') insideBlockDepth = Math.max(0, insideBlockDepth - 1);
    }

    // 1. #include directive validation
    if (trimmedCode.startsWith('#include')) {
      if (!/#include\s+[<"][^>"]+[>"]/.test(trimmedCode)) {
        problems.push({
          id: `cpp-include-${lineNum}`,
          line: lineNum,
          column: 1,
          endLine: lineNum,
          endColumn: trimmedCode.length + 1,
          severity: 'error',
          category: 'Preprocessor Error',
          message: "SyntaxError: Expected '<header>' or '\"header\"' after #include",
          suggestion: 'Example: #include <iostream> or #include <stdio.h>',
          source: 'live',
        });
      }
      continue;
    }

    // 2. Stream operator direction mistakes (C++)
    if (lang === 'cpp') {
      if (/\bcin\s*<</.test(codePart)) {
        const col = codePart.indexOf('cin') + 1;
        problems.push({
          id: `cpp-cin-stream-${lineNum}`,
          line: lineNum,
          column: col,
          endLine: lineNum,
          endColumn: col + 6,
          severity: 'error',
          category: 'Stream Error',
          message: "SyntaxError: Invalid stream operator '<<' with 'cin'",
          suggestion: "Use '>>' (extraction operator) with cin: cin >> variable;",
          source: 'live',
        });
      }

      if (/\bcout\s*>>/.test(codePart)) {
        const col = codePart.indexOf('cout') + 1;
        problems.push({
          id: `cpp-cout-stream-${lineNum}`,
          line: lineNum,
          column: col,
          endLine: lineNum,
          endColumn: col + 7,
          severity: 'error',
          category: 'Stream Error',
          message: "SyntaxError: Invalid stream operator '>>' with 'cout'",
          suggestion: "Use '<<' (insertion operator) with cout: cout << \"...\";",
          source: 'live',
        });
      }
    }

    // 3. Assignment inside 'if (...)' condition
    const ifCondMatch = codePart.match(/^\s*if\s*\(([^)]+)\)/);
    if (ifCondMatch) {
      const cond = ifCondMatch[1];
      if (/(?<![=!<:>])=(?![=])/.test(cond)) {
        const col = codePart.indexOf('=') + 1;
        problems.push({
          id: `cpp-assign-in-if-${lineNum}`,
          line: lineNum,
          column: col,
          endLine: lineNum,
          endColumn: col + 1,
          severity: 'warning',
          category: 'Condition Warning',
          message: "Warning: Using assignment '=' in 'if' condition",
          suggestion: "Did you mean '==' for comparison?",
          source: 'live',
        });
      }
    }

    // 4. Missing semicolon check inside function blocks
    if (insideBlockDepth > 0) {
      // Common statement prefixes that require semicolons
      const isStatement =
        /\b(return\b|printf\s*\(|scanf\s*\(|cout\s*<<|cin\s*>>)/.test(codePart) ||
        /\b(int|float|double|char|bool|auto|void|long|short|unsigned|size_t|string)\s+[a-zA-Z_]\w*/.test(codePart) ||
        /^[a-zA-Z_]\w*(\[[^\]]*\])?\s*(=|\+=|-=|\*=|\/=|%=)/.test(trimmedCode);

      const isExempt =
        trimmedCode.endsWith(';') ||
        trimmedCode.endsWith('{') ||
        trimmedCode.endsWith('}') ||
        trimmedCode.endsWith(':') ||
        trimmedCode.endsWith('\\') ||
        trimmedCode.startsWith('#') ||
        /^\s*(if|else|for|while|do|switch|case|default)\b/.test(trimmedCode);

      if (isStatement && !isExempt) {
        problems.push({
          id: `c-missing-semicolon-${lineNum}`,
          line: lineNum,
          column: codePart.trimEnd().length + 1,
          endLine: lineNum,
          endColumn: codePart.trimEnd().length + 2,
          severity: 'error',
          category: 'Missing Semicolon',
          message: "SyntaxError: Expected ';' at end of statement",
          suggestion: "Add a semicolon ';' at the end of the line.",
          source: 'live',
        });
      }
    }
  }
}

/**
 * Java syntax checking.
 */
function checkJavaSyntax(lines: string[], problems: SyntaxProblem[]) {
  let hasClass = false;
  let codeLineCount = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      continue;
    }

    codeLineCount++;
    const commentIdx = rawLine.indexOf('//');
    const codePart = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
    const trimmedCode = codePart.trim();

    if (/\b(class|interface|enum)\s+\w+/.test(trimmedCode)) {
      hasClass = true;
    }

    // Missing semicolon on common Java statements
    const isJavaStatement =
      /System\.out\.(println|print|printf)\s*\(/.test(codePart) ||
      /\breturn\b/.test(codePart) ||
      /\b(int|float|double|char|boolean|String|long|short|byte)\s+[a-zA-Z_]\w*/.test(codePart);

    const isExempt =
      trimmedCode.endsWith(';') ||
      trimmedCode.endsWith('{') ||
      trimmedCode.endsWith('}') ||
      trimmedCode.endsWith(':') ||
      /^\s*(if|else|for|while|do|switch|case|default|class|interface|public|private|protected)\b/.test(trimmedCode);

    if (isJavaStatement && !isExempt) {
      problems.push({
        id: `java-missing-semicolon-${lineNum}`,
        line: lineNum,
        column: codePart.trimEnd().length + 1,
        endLine: lineNum,
        endColumn: codePart.trimEnd().length + 2,
        severity: 'error',
        category: 'Missing Semicolon',
        message: "SyntaxError: ';' expected",
        suggestion: "Add a semicolon ';' at the end of the statement.",
        source: 'live',
      });
    }
  }

  if (!hasClass && codeLineCount > 2) {
    problems.push({
      id: 'java-missing-class',
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 10,
      severity: 'warning',
      category: 'Class Definition',
      message: 'Java code must be enclosed within a class definition',
      suggestion: "Wrap your code in 'public class Main { ... }'.",
      source: 'live',
    });
  }
}

/**
 * JavaScript syntax checking.
 */
function checkJavaScriptSyntax(lines: string[], problems: SyntaxProblem[]) {
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('//')) continue;

    // Common JS mistakes:
    // e.g. 'elif' instead of 'else if'
    if (/^\s*elif\b/.test(trimmed)) {
      const col = rawLine.indexOf('elif') + 1;
      problems.push({
        id: `js-elif-${lineNum}`,
        line: lineNum,
        column: col,
        endLine: lineNum,
        endColumn: col + 4,
        severity: 'error',
        category: 'Invalid Keyword',
        message: "SyntaxError: In JavaScript, use 'else if', not 'elif'",
        suggestion: "Replace 'elif' with 'else if'.",
        source: 'live',
      });
    }
  }
}

/**
 * Parse compiler error logs (from GCC, G++, Python, Java, Node) into structured SyntaxProblems
 * to display alongside live errors in the Monaco editor.
 */
export function parseCompilerErrors(
  stderr: string | null,
  compileOutput: string | null,
  languageName: string
): SyntaxProblem[] {
  const text = [compileOutput, stderr].filter(Boolean).join('\n');
  if (!text.trim()) return [];

  const problems: SyntaxProblem[] = [];
  const lines = text.split('\n');
  const lang = languageName.toLowerCase();

  // GCC / G++ pattern: file.cpp:5:10: error: expected ';' before 'return'
  const gccPattern = /^(?:.*?):(\d+):(\d+):\s*(error|warning|fatal error):\s*(.*)$/i;

  // Java pattern: Main.java:5: error: ';' expected
  const javaPattern = /^(?:.*?):(\d+):\s*(error|warning):\s*(.*)$/i;

  // Python pattern: File "...", line 5 ... SyntaxError: invalid syntax
  let pyLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // GCC / Clang
    const gccMatch = line.match(gccPattern);
    if (gccMatch) {
      const lineNum = parseInt(gccMatch[1], 10);
      const colNum = parseInt(gccMatch[2], 10);
      const isWarn = gccMatch[3].toLowerCase() === 'warning';
      const msg = gccMatch[4].trim();

      problems.push({
        id: `compiler-gcc-${lineNum}-${colNum}-${i}`,
        line: lineNum,
        column: colNum,
        endLine: lineNum,
        endColumn: colNum + 5,
        severity: isWarn ? 'warning' : 'error',
        category: isWarn ? 'Compiler Warning' : 'Compiler Error',
        message: msg,
        suggestion: 'Review the compiler message and check the indicated line.',
        source: 'compiler',
      });
      continue;
    }

    // Java
    const javaMatch = line.match(javaPattern);
    if (javaMatch) {
      const lineNum = parseInt(javaMatch[1], 10);
      const isWarn = javaMatch[2].toLowerCase() === 'warning';
      const msg = javaMatch[3].trim();

      problems.push({
        id: `compiler-java-${lineNum}-${i}`,
        line: lineNum,
        column: 1,
        endLine: lineNum,
        endColumn: 30,
        severity: isWarn ? 'warning' : 'error',
        category: isWarn ? 'Compiler Warning' : 'Compiler Error',
        message: msg,
        suggestion: 'Inspect the line for missing symbols or type incompatibilities.',
        source: 'compiler',
      });
      continue;
    }

    // Python tracebacks
    if (lang === 'python') {
      const pyLineMatch = line.match(/File\s+"[^"]+",\s+line\s+(\d+)/i);
      if (pyLineMatch) {
        pyLine = parseInt(pyLineMatch[1], 10);
        continue;
      }

      const pyErrorMatch = line.match(/^([A-Za-z]+Error):\s*(.*)$/);
      if (pyErrorMatch && pyLine > 0) {
        problems.push({
          id: `compiler-py-${pyLine}-${i}`,
          line: pyLine,
          column: 1,
          endLine: pyLine,
          endColumn: 25,
          severity: 'error',
          category: pyErrorMatch[1],
          message: `${pyErrorMatch[1]}: ${pyErrorMatch[2]}`,
          suggestion: 'Check the syntax and variables on the highlighted line.',
          source: 'compiler',
        });
        pyLine = 0;
        continue;
      }
    }
  }

  return problems;
}
