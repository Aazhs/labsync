/**
 * Error classifier — Tier 1 (Syntax) based on compiler/runtime output
 * Future: Tier 2 (Logic) and Tier 3 (Conceptual) via pattern heuristics
 */

export type ErrorTier = 'syntax' | 'logic' | 'conceptual' | 'none';

export type ClassifiedError = {
  tier: ErrorTier;
  category: string;
  message: string;
  suggestion: string;
  line?: number;
};

// Common syntax error patterns by language
const SYNTAX_PATTERNS: { pattern: RegExp; category: string; suggestion: string }[] = [
  // Python
  { pattern: /SyntaxError:\s*invalid syntax/i, category: 'Invalid Syntax', suggestion: 'Check for missing colons, parentheses, or incorrect indentation.' },
  { pattern: /IndentationError/i, category: 'Indentation Error', suggestion: 'Python uses whitespace for blocks. Check your indentation is consistent.' },
  { pattern: /NameError:\s*name '(\w+)' is not defined/i, category: 'Undefined Variable', suggestion: 'The variable has not been declared. Check for typos in variable names.' },
  { pattern: /TypeError/i, category: 'Type Mismatch', suggestion: 'You are using incompatible types. Check the types of your variables.' },
  { pattern: /IndexError/i, category: 'Index Out of Range', suggestion: 'You are accessing an index that does not exist. Check your loop bounds.' },
  
  // C/C++
  { pattern: /error:\s*expected ';'/i, category: 'Missing Semicolon', suggestion: 'Add a semicolon at the end of the statement.' },
  { pattern: /error:\s*use of undeclared identifier/i, category: 'Undeclared Variable', suggestion: 'Declare the variable before using it.' },
  { pattern: /error:\s*expected '\)'/i, category: 'Missing Parenthesis', suggestion: 'Check for matching opening and closing parentheses.' },
  { pattern: /error:\s*expected '\}'/i, category: 'Missing Brace', suggestion: 'Check for matching opening and closing curly braces.' },
  { pattern: /segmentation fault/i, category: 'Segmentation Fault', suggestion: 'You are accessing memory that is not allocated. Check your pointers and array bounds.' },
  
  // Java
  { pattern: /error:\s*';' expected/i, category: 'Missing Semicolon', suggestion: 'Add a semicolon at the end of the statement.' },
  { pattern: /error:\s*cannot find symbol/i, category: 'Undefined Symbol', suggestion: 'The variable or method has not been declared. Check for typos.' },
  { pattern: /error:\s*incompatible types/i, category: 'Type Mismatch', suggestion: 'The types do not match. Check your variable types and return types.' },
  { pattern: /NullPointerException/i, category: 'Null Reference', suggestion: 'You are using an object that is null. Check your object initialization.' },
  
  // JavaScript
  { pattern: /ReferenceError:\s*(\w+) is not defined/i, category: 'Undefined Variable', suggestion: 'The variable has not been declared. Check for typos.' },
  { pattern: /SyntaxError:\s*Unexpected token/i, category: 'Unexpected Token', suggestion: 'There is a syntax issue. Check for missing brackets, commas, or operators.' },
  
  // General
  { pattern: /compilation error/i, category: 'Compilation Failed', suggestion: 'Your code has errors that prevent it from compiling. Review the error messages above.' },
  { pattern: /runtime error/i, category: 'Runtime Error', suggestion: 'Your code compiled but crashed while running. Check for logic errors.' },
  { pattern: /time limit exceeded/i, category: 'Time Limit Exceeded', suggestion: 'Your code is taking too long. Check for infinite loops or optimize your algorithm.' },
];

export function classifyError(stderr: string | null, compileOutput: string | null, statusDescription: string): ClassifiedError {
  const errorText = [stderr, compileOutput, statusDescription].filter(Boolean).join('\n');
  
  if (!errorText || statusDescription === 'Accepted') {
    return { tier: 'none', category: 'No Error', message: '', suggestion: '' };
  }

  // Tier 1: Syntax — match against known patterns
  for (const { pattern, category, suggestion } of SYNTAX_PATTERNS) {
    const match = errorText.match(pattern);
    if (match) {
      // Try to extract line number
      const lineMatch = errorText.match(/line (\d+)/i) || errorText.match(/:(\d+):/);
      const line = lineMatch ? parseInt(lineMatch[1]) : undefined;
      
      return {
        tier: 'syntax',
        category,
        message: errorText.split('\n')[0],
        suggestion,
        line,
      };
    }
  }

  // Tier 2: Logic — (stub) detect from repeated failures
  if (statusDescription === 'Wrong Answer') {
    return {
      tier: 'logic',
      category: 'Incorrect Output',
      message: 'Your code runs but produces wrong output.',
      suggestion: 'Compare your output with expected. Check your loop conditions and edge cases.',
    };
  }

  // Default: unclassified
  return {
    tier: 'syntax',
    category: 'Compilation/Runtime Error',
    message: errorText.split('\n')[0],
    suggestion: 'Review the error message carefully and check the indicated line.',
  };
}
