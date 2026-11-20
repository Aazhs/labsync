import { NextRequest, NextResponse } from 'next/server';
import { instrument, readRecording } from '@/lib/visualiser/trace';
import { runtimeLanguages } from '@/lib/visualiser/source';
import { classifyError } from '@/lib/classifier';
import { createRateLimiter, getClientIp } from '@/lib/rateLimit';

// Judge0 CE — defaults to the free public instance (no key required).
const JUDGE0_API = (process.env.JUDGE0_API_URL || 'https://ce.judge0.com').replace(/\/+$/, '');
const JUDGE0_KEY = process.env.JUDGE0_API_KEY || '';

// Running student code directly on the host is only safe on a developer's own machine.
// It must be explicitly opted into and is never enabled in production builds.
const ALLOW_LOCAL_EXEC =
  process.env.LABSYNC_LOCAL_EXEC === 'true' && process.env.NODE_ENV !== 'production';

const MAX_CODE_BYTES = 64 * 1024;
const MAX_STDIN_BYTES = 16 * 1024;
const JUDGE0_TIMEOUT_MS = 20_000;

// Judge0 language ids → source filename used for local execution
const SUPPORTED_LANGUAGES: Record<number, string> = {
  71: 'main.py',
  63: 'main.js',
  50: 'main.c',
  54: 'main.cpp',
  62: 'Main.java',
};

export interface ExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
  is_missing_input?: boolean;
}

const isRateLimited = createRateLimiter(30, 60_000);

// ─── Local execution (developer machines only, opt-in via LABSYNC_LOCAL_EXEC) ───
async function executeLocal(code: string, languageId: number, stdin: string): Promise<ExecutionResult> {
  const { execFileSync } = await import('child_process');
  const { mkdtempSync, writeFileSync, rmSync } = await import('fs');
  const { tmpdir } = await import('os');

  const tmpDir = mkdtempSync(`${tmpdir()}/labsync-`);
  const filePath = `${tmpDir}/${SUPPORTED_LANGUAGES[languageId]}`;
  const binPath = `${tmpDir}/a.out`;
  writeFileSync(filePath, code);

  let compile: [string, string[]] | null = null;
  let run: [string, string[]];
  switch (languageId) {
    case 50:
      compile = ['gcc', ['-O2', '-o', binPath, filePath]];
      run = [binPath, []];
      break;
    case 54:
      compile = ['g++', ['-O2', '-o', binPath, filePath]];
      run = [binPath, []];
      break;
    case 62:
      compile = ['javac', [filePath]];
      run = ['java', ['-cp', tmpDir, 'Main']];
      break;
    case 71:
      run = ['python3', [filePath]];
      break;
    default:
      run = ['node', [filePath]];
  }

  try {
    if (compile) {
      try {
        execFileSync(/* turbopackIgnore: true */ compile[0], compile[1], { timeout: 10_000, encoding: 'utf-8', stdio: 'pipe' });
      } catch (compileErr: unknown) {
        const err = compileErr as { stderr?: string; stdout?: string };
        return {
          stdout: null,
          stderr: null,
          compile_output: err.stderr || err.stdout || 'Compilation failed',
          status: { id: 6, description: 'Compilation Error' },
          time: null,
          memory: null,
        };
      }
    }

    const startTime = Date.now();
    try {
      const stdout = execFileSync(/* turbopackIgnore: true */ run[0], run[1], {
        timeout: 10_000,
        encoding: 'utf-8',
        input: stdin,
        maxBuffer: 1024 * 1024,
        stdio: 'pipe',
        cwd: tmpDir,
      });
      return {
        stdout: stdout || null,
        stderr: null,
        compile_output: null,
        status: { id: 3, description: 'Accepted' },
        time: ((Date.now() - startTime) / 1000).toFixed(3),
        memory: null,
      };
    } catch (error: unknown) {
      const execError = error as { stderr?: string; stdout?: string; signal?: string; code?: string };
      const isTimeout = execError.signal === 'SIGTERM' || execError.code === 'ETIMEDOUT';
      return {
        stdout: execError.stdout || null,
        stderr: isTimeout
          ? 'Time Limit Exceeded: the program ran for more than 10 seconds.'
          : execError.stderr || 'Execution failed',
        compile_output: null,
        status: isTimeout
          ? { id: 5, description: 'Time Limit Exceeded' }
          : { id: 11, description: 'Runtime Error' },
        time: null,
        memory: null,
      };
    }
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ─── Judge0 execution ───
async function executeWithJudge0(code: string, languageId: number, stdin: string): Promise<ExecutionResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUDGE0_KEY) {
    if (JUDGE0_API.includes('rapidapi.com')) {
      headers['X-RapidAPI-Key'] = JUDGE0_KEY;
      headers['X-RapidAPI-Host'] = new URL(JUDGE0_API).host;
    } else {
      headers['X-Auth-Token'] = JUDGE0_KEY;
    }
  }

  const submitRes = await fetch(`${JUDGE0_API}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(JUDGE0_TIMEOUT_MS),
    body: JSON.stringify({
      source_code: Buffer.from(code).toString('base64'),
      language_id: languageId,
      stdin: stdin ? Buffer.from(stdin).toString('base64') : '',
      cpu_time_limit: 5,
      memory_limit: 128000,
    }),
  });

  if (!submitRes.ok) {
    throw new Error(`Judge0 responded with ${submitRes.status} ${submitRes.statusText}`);
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

/**
 * Wraps student code so common lab patterns behave as expected:
 * - Python files that define `main()` without calling it get an entrypoint guard.
 * - C/C++ programs reading from an exhausted stdin report "waiting for input" instead of
 *   silently looping on EOF, so the terminal can prompt the student for more input.
 */
function prepareExecutableCode(code: string, languageId: number): string {
  if (languageId === 71) {
    const hasMainDef = /^\s*(def|async\s+def)\s+main\s*\(/m.test(code);
    const hasEntrypoint = /__name__\s*==\s*['"]__main__['"]/.test(code) || /^main\s*\(/m.test(code);
    if (hasMainDef && !hasEntrypoint) {
      return `${code}\n\nif __name__ == "__main__":\n    main()\n`;
    }
  }

  if (languageId === 54 && code.includes('cin')) {
    const cinGuard = `#include <iostream>\nstruct __LabSyncCinGuard { __LabSyncCinGuard() { std::cin.exceptions(std::ios_base::eofbit); } };\nstatic __LabSyncCinGuard __labsync_cin_guard;\n`;
    return `${cinGuard}\n${code}`;
  }

  if (languageId === 50 && code.includes('scanf')) {
    // Preserves scanf's return value so checks like `scanf(...) == 1` keep working.
    const scanfGuard = `#include <stdio.h>\n#include <stdlib.h>\nstatic int __labsync_scanf_check(int r) { if (r == EOF) { fprintf(stderr, "[LabSync:WAITING_INPUT]\\n"); exit(42); } return r; }\n#define scanf(...) __labsync_scanf_check(scanf(__VA_ARGS__))\n`;
    return `${scanfGuard}\n${code}`;
  }

  return code;
}

const WAITING_FOR_INPUT_MARKERS = [
  '[LabSync:WAITING_INPUT]',
  'EOFError',
  'NoSuchElementException',
];

// GCC's libstdc++ reports the cin guard's exception as std::__ios_failure.
const CIN_EOF_MARKERS = ['ios_base::failure', 'iostream_category', 'std::__ios_failure'];

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (isRateLimited(getClientIp(request.headers))) {
    return errorResponse('Too many runs in a short time. Wait a few seconds and try again.', 429);
  }

  let body: { code?: unknown; languageId?: unknown; stdin?: unknown; trace?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Request body must be JSON.', 400);
  }

  const { code: rawCode, languageId, stdin = '' } = body;
  if (typeof rawCode !== 'string' || !rawCode.trim()) {
    return errorResponse('There is no code to run.', 400);
  }
  if (typeof languageId !== 'number' || !(languageId in SUPPORTED_LANGUAGES)) {
    return errorResponse('Unsupported language.', 400);
  }
  if (typeof stdin !== 'string') {
    return errorResponse('stdin must be a string.', 400);
  }
  if (Buffer.byteLength(rawCode) > MAX_CODE_BYTES) {
    return errorResponse(`Code is too large (limit ${MAX_CODE_BYTES / 1024} KB).`, 413);
  }
  if (Buffer.byteLength(stdin) > MAX_STDIN_BYTES) {
    return errorResponse(`Input is too large (limit ${MAX_STDIN_BYTES / 1024} KB).`, 413);
  }

  const language = Object.keys(runtimeLanguages).find(key => runtimeLanguages[key] === languageId)!;
  const mark = body.trace === true ? `__LS_${crypto.randomUUID().replaceAll('-', '')}__` : '';
  let code = rawCode;
  if (mark) {
    try {
      code = instrument(rawCode, language, mark, language === 'python' ? prepareExecutableCode(rawCode, languageId) : rawCode);
    } catch {
      return errorResponse('Could not prepare this file for recording. Its source walkthrough is available.', 422);
    }
  }
  if (!mark || language !== 'python') code = prepareExecutableCode(code, languageId);

  let result: ExecutionResult;
  try {
    result = ALLOW_LOCAL_EXEC
      ? await executeLocal(code, languageId, stdin)
      : await executeWithJudge0(code, languageId, stdin);
  } catch (err) {
    console.error('Code execution failed:', err);
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return errorResponse(
      timedOut
        ? 'The code execution service took too long to respond. Please try again.'
        : 'The code execution service is unreachable right now. Please try again in a moment.',
      503
    );
  }

  const stderr = result.stderr ?? '';
  const cinNeedsInput =
    languageId === 54 &&
    rawCode.includes('cin') &&
    CIN_EOF_MARKERS.some((marker) => stderr.includes(marker));
  const needsInput = cinNeedsInput || WAITING_FOR_INPUT_MARKERS.some((marker) => stderr.includes(marker));
  if (result.status.id !== 3 && needsInput) {
    result.status = { id: 13, description: 'Waiting for Input' };
    result.is_missing_input = true;
    result.stderr = null;
  }

  if (mark) {
    const recording = readRecording(result.stdout || '', rawCode, language, mark);
    return NextResponse.json({
      recording,
      status: result.status,
      diagnostic: (result.compile_output || result.stderr || '').slice(0, 1600),
    });
  }

  const classification = classifyError(result.stderr, result.compile_output, result.status.description);
  return NextResponse.json({ ...result, classification });
}
