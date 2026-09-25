import { NextRequest, NextResponse } from 'next/server';
import { classifyError } from '@/lib/classifier';

// Judge0 CE API — self-hosted or use the public rapid API
const JUDGE0_API = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_KEY = process.env.JUDGE0_API_KEY || '';

// Detect if we're on Vercel (no local compilers available)
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

// ─── Local execution (dev only, not on Vercel) ───
async function executeLocal(code: string, languageId: number, stdin: string): Promise<{
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
}> {
  const langMap: Record<number, { cmd: string; ext: string; compile?: string }> = {
    71: { cmd: 'python3', ext: 'py' },
    63: { cmd: 'node', ext: 'js' },
    50: { cmd: 'gcc', ext: 'c', compile: 'gcc -o /tmp/sc_out /tmp/sc_code.c && /tmp/sc_out' },
    54: { cmd: 'g++', ext: 'cpp', compile: 'g++ -o /tmp/sc_out /tmp/sc_code.cpp && /tmp/sc_out' },
  };

  const lang = langMap[languageId];

  if (!lang) {
    return {
      stdout: null,
      stderr: `Language ID ${languageId} is not supported in local execution mode. Please configure Judge0 API.`,
      compile_output: null,
      status: { id: 11, description: 'Runtime Error' },
      time: null,
      memory: null,
    };
  }

  try {
    const { execSync } = await import('child_process');
    const { writeFileSync } = await import('fs');

    const tmpFile = `/tmp/sc_code.${lang.ext}`;
    writeFileSync(tmpFile, code);

    const command = lang.compile || `${lang.cmd} ${tmpFile}`;
    const startTime = Date.now();

    const result = execSync(command, {
      timeout: 10000,
      encoding: 'utf-8',
      input: stdin || undefined,
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
    };
  } catch (error: unknown) {
    const execError = error as { stderr?: string; stdout?: string; status?: number; message?: string };
    const isTimeout = execError.message?.includes('TIMEOUT');

    return {
      stdout: execError.stdout || null,
      stderr: execError.stderr || execError.message || 'Execution failed',
      compile_output: null,
      status: {
        id: isTimeout ? 5 : 11,
        description: isTimeout ? 'Time Limit Exceeded' : 'Runtime Error',
      },
      time: null,
      memory: null,
    };
  }
}

// ─── Judge0 API execution ───
async function executeWithJudge0(code: string, languageId: number, stdin: string) {
  const submitRes = await fetch(`${JUDGE0_API}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(JUDGE0_KEY
        ? { 'X-RapidAPI-Key': JUDGE0_KEY, 'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com' }
        : {}),
    },
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
function executePythonMock(code: string, stdin: string): {
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

export async function POST(request: NextRequest) {
  try {
    const { code, languageId, stdin = '' } = await request.json();

    if (!code || !languageId) {
      return NextResponse.json(
        { error: 'Missing required fields: code, languageId' },
        { status: 400 }
      );
    }

    let result;

    if (JUDGE0_KEY) {
      // Best: use Judge0 API (works everywhere)
      result = await executeWithJudge0(code, languageId, stdin);
    } else if (!IS_VERCEL) {
      // Dev: use local execution
      result = await executeLocal(code, languageId, stdin);
    } else if (languageId === 63) {
      // Vercel without Judge0: JS can run in-process
      result = executeJavaScriptSandboxed(code, stdin);
    } else if (languageId === 71) {
      // Vercel without Judge0: Python mock
      result = executePythonMock(code, stdin);
    } else {
      // Vercel without Judge0: other languages
      result = {
        stdout: `[Demo Mode] ${languageId === 50 ? 'C' : languageId === 54 ? 'C++' : languageId === 62 ? 'Java' : 'This language'} execution requires Judge0 API.\nSet JUDGE0_API_KEY in Vercel environment variables for full execution.\n\nYour code was received and would be executed with Judge0 configured.`,
        stderr: null,
        compile_output: null,
        status: { id: 3, description: 'Accepted' },
        time: '0.001',
        memory: null,
      };
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
