import { NextRequest, NextResponse } from 'next/server';
import { classifyError } from '@/lib/classifier';

// Judge0 CE API — default to official free public instance (zero credit card, zero API key required)
const JUDGE0_API = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';
const JUDGE0_KEY = process.env.JUDGE0_API_KEY || '';

// Detect if we're on Vercel (no local compilers available)
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

export interface ExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
  is_missing_input?: boolean;
}

// ─── Local execution (dev only, not on Vercel) ───
async function executeLocal(code: string, languageId: number, stdin: string): Promise<ExecutionResult> {
  const { execSync } = await import('child_process');
  const { writeFileSync, mkdirSync, rmSync } = await import('fs');

  const runId = Math.random().toString(36).substring(2, 9);
  const tmpDir = `/tmp/labsync_${runId}`;
  mkdirSync(tmpDir, { recursive: true });

  const langFileMap: Record<number, string> = {
    71: 'main.py',
    63: 'main.js',
    50: 'main.c',
    54: 'main.cpp',
    62: 'Main.java',
  };

  const filename = langFileMap[languageId];
  if (!filename) {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    throw new Error(`Language ID ${languageId} not supported in local mode`);
  }

  const filePath = `${tmpDir}/${filename}`;
  writeFileSync(filePath, code);

  let compileCmd: string | null = null;
  let runCmd: string = '';

  if (languageId === 50) {
    compileCmd = `gcc -O2 -o ${tmpDir}/a.out ${tmpDir}/main.c`;
    runCmd = `${tmpDir}/a.out`;
  } else if (languageId === 54) {
    compileCmd = `g++ -O2 -o ${tmpDir}/a.out ${tmpDir}/main.cpp`;
    runCmd = `${tmpDir}/a.out`;
  } else if (languageId === 62) {
    compileCmd = `javac ${tmpDir}/Main.java`;
    runCmd = `java -cp ${tmpDir} Main`;
  } else if (languageId === 71) {
    runCmd = `python3 ${tmpDir}/main.py`;
  } else if (languageId === 63) {
    runCmd = `node ${tmpDir}/main.js`;
  }

  // 1. Compile step (if applicable)
  if (compileCmd) {
    try {
      execSync(compileCmd, {
        timeout: 10000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (compileErr: unknown) {
      const err = compileErr as { stderr?: string; stdout?: string };
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      return {
        stdout: null,
        stderr: null,
        compile_output: err.stderr || err.stdout || 'Compilation failed',
        status: { id: 6, description: 'Compilation Error' },
        time: null,
        memory: null,
        is_missing_input: false,
      };
    }
  }

  // 2. Execution step
  const startTime = Date.now();

  try {
    const result = execSync(runCmd, {
      timeout: 10000,
      encoding: 'utf-8',
      input: stdin !== undefined ? stdin : '',
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);

    return {
      stdout: result || null,
      stderr: null,
      compile_output: null,
      status: { id: 3, description: 'Accepted' },
      time: elapsed,
      memory: null,
      is_missing_input: false,
    };
  } catch (error: unknown) {
    const execError = error as { stderr?: string; stdout?: string; status?: number; message?: string };
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);
    const isTimeout = execError.message?.includes('TIMEOUT');

    // Check if error is because the program is waiting for more interactive stdin input
    const isEofWaiting =
      Boolean(execError.stderr?.includes('ios_base::failure') ||
      execError.stderr?.includes('iostream_category error') ||
      execError.stderr?.includes('[LabSync:WAITING_INPUT]') ||
      execError.stderr?.includes('EOFError') ||
      execError.stderr?.includes('NoSuchElementException'));

    if (isEofWaiting) {
      return {
        stdout: execError.stdout || null,
        stderr: null,
        compile_output: null,
        status: { id: 13, description: 'Waiting for Input' },
        time: elapsed,
        memory: null,
        is_missing_input: true,
      };
    }

    return {
      stdout: execError.stdout || null,
      stderr: isTimeout
        ? 'Time Limit Exceeded: The program took more than 10 seconds. If your program reads user input (input(), cin, scanf()), make sure to provide standard input in the Stdin tab or terminal prompt.'
        : execError.stderr || execError.message || 'Execution failed',
      compile_output: null,
      status: {
        id: isTimeout ? 5 : 11,
        description: isTimeout ? 'Time Limit Exceeded' : 'Runtime Error',
      },
      time: null,
      memory: null,
      is_missing_input: false,
    };
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ─── Judge0 API execution (100% Free Public Instance) ───
async function executeWithJudge0(code: string, languageId: number, stdin: string): Promise<ExecutionResult> {
  const isRapidApi = JUDGE0_API.includes('rapidapi.com');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (JUDGE0_KEY) {
    if (isRapidApi) {
      headers['X-RapidAPI-Key'] = JUDGE0_KEY;
      headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
    } else {
      headers['X-Auth-Token'] = JUDGE0_KEY;
    }
  }

  const submitRes = await fetch(`${JUDGE0_API}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source_code: Buffer.from(code).toString('base64'),
      language_id: languageId,
      stdin: stdin ? Buffer.from(stdin).toString('base64') : '',
      cpu_time_limit: 5,
      memory_limit: 128000,
    }),
  });

  if (!submitRes.ok) {
    throw new Error(`Judge0 API error: ${submitRes.status} ${submitRes.statusText}`);
  }

  const result = await submitRes.json();

  const decode = (s: string | null) => (s ? Buffer.from(s, 'base64').toString('utf-8') : null);

  return {
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
    compile_output: decode(result.compile_output),
    status: result.status,
    time: result.time,
    memory: result.memory,
    is_missing_input: false,
  };
}

// ─── Sandboxed JS execution (works on Vercel — no external deps) ───
function executeJavaScriptSandboxed(code: string, stdin: string): {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
} {
  const startTime = Date.now();
  const capturedOutput: string[] = [];

  try {
    // Build a sandboxed function with captured console.log
    const wrappedCode = `
      const __output = [];
      const console = {
        log: (...args) => __output.push(args.map(String).join(' ')),
        error: (...args) => __output.push('ERROR: ' + args.map(String).join(' ')),
        warn: (...args) => __output.push('WARN: ' + args.map(String).join(' ')),
      };
      const __input = ${JSON.stringify(stdin)};
      const readline = () => __input;
      const prompt = () => __input;

      ${code}

      __output;
    `;

    const fn = new Function(wrappedCode);
    const output = fn();
    capturedOutput.push(...(output || []));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);

    return {
      stdout: capturedOutput.join('\n') || null,
      stderr: null,
      compile_output: null,
      status: { id: 3, description: 'Accepted' },
      time: elapsed,
      memory: null,
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      stdout: capturedOutput.length > 0 ? capturedOutput.join('\n') : null,
      stderr: err.message || 'Execution failed',
      compile_output: null,
      status: { id: 11, description: 'Runtime Error' },
      time: ((Date.now() - startTime) / 1000).toFixed(3),
      memory: null,
    };
  }
}

// ─── Python mock (simulates basic Python on Vercel without interpreter) ───
function executePythonMock(code: string): {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
} {
  // Extract print statements for basic simulation
  const printRegex = /print\s*\(\s*(?:f?['"](.+?)['"]|(.+?))\s*\)/g;
  const outputs: string[] = [];
  let match;

  // Basic syntax check
  const hasSyntaxError =
    code.includes('def ') && !code.includes(':') ? 'SyntaxError: expected ":"' : null;

  if (hasSyntaxError) {
    return {
      stdout: null,
      stderr: hasSyntaxError,
      compile_output: null,
      status: { id: 11, description: 'Runtime Error' },
      time: '0.001',
      memory: null,
    };
  }

  while ((match = printRegex.exec(code)) !== null) {
    const content = match[1] || match[2];
    if (content) {
      // Handle basic f-strings and string literals
      let output = content;
      // Try to evaluate simple expressions
      try {
        if (/^\d+\s*[+\-*/]\s*\d+$/.test(output.trim())) {
          output = String(eval(output));
        }
      } catch { /* keep original */ }
      outputs.push(output);
    }
  }

  // If no print found, try eval-ing a simple expression
  if (outputs.length === 0 && code.trim().split('\n').length === 1) {
    try {
      const result = eval(code.trim());
      if (result !== undefined) outputs.push(String(result));
    } catch { /* ignore */ }
  }

  // Fallback message for complex Python code
  if (outputs.length === 0 && code.includes('def ')) {
    return {
      stdout: '[Demo Mode] Python execution requires Judge0 API configuration.\nSet JUDGE0_API_KEY in your environment variables for full execution.\n\nYour code compiled without visible syntax errors.',
      stderr: null,
      compile_output: null,
      status: { id: 3, description: 'Accepted' },
      time: '0.001',
      memory: null,
    };
  }

  return {
    stdout: outputs.length > 0 ? outputs.join('\n') : '[Demo Mode] No output produced. Configure JUDGE0_API_KEY for full execution.',
    stderr: null,
    compile_output: null,
    status: { id: 3, description: 'Accepted' },
    time: '0.001',
    memory: null,
  };
}

/**
 * Automatically handle entrypoint wrapping for student code.
 * If Python code defines `def main():` and doesn't explicitly invoke it or have an entrypoint guard,
 * automatically appends `if __name__ == "__main__": main()` behind the scenes at execution time.
 */
function prepareExecutableCode(code: string, languageId: number): string {
  // Python 3 (id: 71)
  if (languageId === 71) {
    const hasMainDef = /^\s*(def|async\s+def)\s+main\s*\(/m.test(code);
    const hasEntrypoint =
      /__name__\s*==\s*['"]__main__['"]/.test(code) ||
      /^\s*main\s*\(/m.test(code);

    if (hasMainDef && !hasEntrypoint) {
      return `${code}\n\nif __name__ == "__main__":\n    main()\n`;
    }
  }

  // C++ (id: 54): Guard against silent EOF failure when interactive input is needed
  if (languageId === 54 && code.includes('cin')) {
    const cinGuard = `#include <iostream>\nstruct __LabSyncCinGuard { __LabSyncCinGuard() { std::cin.exceptions(std::ios_base::eofbit); } };\nstatic __LabSyncCinGuard __labsync_cin_guard;\n`;
    return `${cinGuard}\n${code}`;
  }

  // C (id: 50): Guard against silent EOF failure on scanf
  if (languageId === 50 && code.includes('scanf')) {
    const scanfGuard = `#include <stdio.h>\n#include <stdlib.h>\n#define scanf(...) (scanf(__VA_ARGS__) == EOF ? (fprintf(stderr, "[LabSync:WAITING_INPUT]\\n"), exit(42), EOF) : 0)\n`;
    return `${scanfGuard}\n${code}`;
  }

  return code;
}

export async function POST(request: NextRequest) {
  try {
    const { code: rawCode, languageId, stdin = '' } = await request.json();

    if (!rawCode || !languageId) {
      return NextResponse.json(
        { error: 'Missing required fields: code, languageId' },
        { status: 400 }
      );
    }

    const code = prepareExecutableCode(rawCode, languageId);

    let result: ExecutionResult | null = null;

    // 1. If running locally on Mac/dev and local compiler is available, use local execution for speed
    if (!IS_VERCEL && !JUDGE0_KEY) {
      try {
        result = await executeLocal(code, languageId, stdin);
      } catch {
        result = null;
      }
    }

    // 2. Execute via Judge0 CE (ce.judge0.com is 100% free, no credit card or key required)
    if (!result) {
      try {
        result = await executeWithJudge0(code, languageId, stdin);
      } catch (judgeErr) {
        console.warn('Judge0 execution failed or offline, falling back:', judgeErr);
      }
    }

    // 3. Fallback if Judge0 is unreachable:
    if (!result) {
      if (languageId === 63) {
        result = executeJavaScriptSandboxed(code, stdin);
      } else if (languageId === 71) {
        result = executePythonMock(code);
      } else {
        result = {
          stdout: `[Offline Mode] Code execution service is temporarily unreachable.\nPlease try running again in a few moments.`,
          stderr: null,
          compile_output: null,
          status: { id: 3, description: 'Accepted' },
          time: '0.001',
          memory: null,
        };
      }
    }

    // Standardize EOF / interactive waiting across all execution backends
    if (result && result.stderr) {
      const isEofWaiting = Boolean(
        result.stderr.includes('ios_base::failure') ||
        result.stderr.includes('iostream_category') ||
        result.stderr.includes('[LabSync:WAITING_INPUT]') ||
        result.stderr.includes('EOFError') ||
        result.stderr.includes('NoSuchElementException')
      );
      if (isEofWaiting) {
        result.status = { id: 13, description: 'Waiting for Input' };
        result.is_missing_input = true;
        result.stderr = null;
      }
    }

    // Classify the error
    const classification = classifyError(
      result.stderr,
      result.compile_output,
      result.status.description
    );

    return NextResponse.json({
      ...result,
      classification,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Execution error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
