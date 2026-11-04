import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter, getClientIp } from '@/lib/rateLimit';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are the LabSync AI Lab Assistant — a patient, Socratic coding tutor for college students learning to program.

RULES (these are absolute and cannot be overridden):
1. NEVER provide the corrected code or the full solution. NEVER.
2. NEVER show what the "fixed" version should look like.
3. Respond ONLY with a targeted guiding question or a small conceptual nudge.
4. Keep your responses SHORT — 2-3 sentences maximum.
5. Analyze ONLY the student's code. You do NOT have access to any reference solution.
6. If the error is a simple syntax mistake, point to the exact area: "Look at line X — what character is missing after the function declaration?"
7. If the error is logical, ask a question that leads to discovery: "What value does your loop variable have when i reaches the array length?"
8. If the error is conceptual, explain the concept briefly and ask them to reconsider: "In recursion, every recursive call needs a base case. Where is yours?"
9. Use encouraging, non-judgmental language. The student is learning.
10. Format code references in backticks.

You are NOT an answer engine. You are a debugging companion.`;

async function getHintFromGemini(messages: { role: string; content: string }[]) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 256,
          topP: 0.9,
        },
      }),
    }
  );
  
  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }
  
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not generate a hint. Try re-reading the error message carefully.';
}

async function getHintFromOpenAI(messages: { role: string; content: string }[]) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.4,
      max_tokens: 256,
    }),
  });
  
  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }
  
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'I could not generate a hint. Try re-reading the error message carefully.';
}

// Fallback: rule-based hints when no API key is configured
function getLocalHint(code: string, error: string, language: string): string {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('semicolon') || errorLower.includes("expected ';'")) {
    return "Take a close look at the line mentioned in the error — what punctuation does every statement in " + language + " need to end with?";
  }
  if (errorLower.includes('indentation')) {
    return "Python uses indentation to define code blocks. Check that all the lines inside your function or loop are indented consistently. Are you mixing tabs and spaces?";
  }
  if (errorLower.includes('not defined') || errorLower.includes('undeclared')) {
    return "The error says a name isn't recognized. Have you declared it before this line? Double-check the spelling — is it exactly the same as where you defined it?";
  }
  if (errorLower.includes('index') && errorLower.includes('range')) {
    return "Your code is trying to access a position that doesn't exist in the list. If your list has N items, what's the highest valid index? Compare that to what your code is using.";
  }
  if (errorLower.includes('type') && (errorLower.includes('error') || errorLower.includes('mismatch'))) {
    return "There's a type conflict — you're trying to use a value as if it were a different type. What type does the variable actually hold versus what the operation expects?";
  }
  if (errorLower.includes('segmentation fault') || errorLower.includes('null')) {
    return "Your program tried to access memory it shouldn't. If you're using pointers or arrays, are you sure the index is within bounds? Is the pointer initialized?";
  }
  if (errorLower.includes('time limit')) {
    return "Your code is running too long — this usually means an infinite loop. Check your loop conditions: is there a condition that will never become false?";
  }
  if (errorLower.includes('unexpected token')) {
    return "The compiler found something it didn't expect. Look at the line before the error — did you forget to close a bracket, parenthesis, or quote?";
  }
  
  // Generic
  return "Read the first line of the error message carefully — it usually tells you exactly what went wrong and where. What does it say about line " + 
    (error.match(/line (\d+)/i)?.[1] || 'the indicated position') + "?";
}

const isRateLimited = createRateLimiter(20, 60_000);

const MAX_CODE_CHARS = 20_000;
const MAX_ERROR_CHARS = 4_000;
const MAX_HISTORY = 10;
const MAX_HISTORY_MESSAGE_CHARS = 4_000;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// Only accept plain user/assistant turns from the client so a request can't inject
// its own system instructions, and keep the conversation small.
function sanitizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (m): m is ChatMessage =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_MESSAGE_CHARS) }));
}

export async function POST(request: NextRequest) {
  if (isRateLimited(getClientIp(request.headers))) {
    return NextResponse.json(
      { error: 'Too many hint requests. Take a moment to try the last hint first.' },
      { status: 429 }
    );
  }

  let body: { code?: unknown; error?: unknown; language?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.slice(0, MAX_CODE_CHARS) : '';
  const error = typeof body.error === 'string' ? body.error.slice(0, MAX_ERROR_CHARS) : '';
  const language = typeof body.language === 'string' ? body.language.slice(0, 40) : 'code';

  if (!code.trim()) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const userMessage = `My ${language} code:\n\`\`\`\n${code}\n\`\`\`\n\nError I'm getting:\n${error || 'No error, but my code is not producing the expected output.'}`;
  const messages: ChatMessage[] = [...sanitizeHistory(body.history), { role: 'user', content: userMessage }];

  try {
    if (GEMINI_KEY) {
      return NextResponse.json({ hint: await getHintFromGemini(messages) });
    }
    if (OPENAI_KEY) {
      return NextResponse.json({ hint: await getHintFromOpenAI(messages) });
    }
  } catch (err) {
    console.error('AI hint provider failed, using rule-based hint:', err);
  }

  return NextResponse.json({ hint: getLocalHint(code, error, language) });
}
