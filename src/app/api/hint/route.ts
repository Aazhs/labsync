import { NextRequest, NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
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
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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

export async function POST(request: NextRequest) {
  try {
    const { code, error, language, history = [] } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    const userMessage = `My ${language} code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nError I'm getting:\n${error || 'No error, but my code is not producing the expected output.'}`;
    
    const messages = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    let hint: string;

    if (GEMINI_KEY) {
      hint = await getHintFromGemini(messages);
    } else if (OPENAI_KEY) {
      hint = await getHintFromOpenAI(messages);
    } else {
      // Local rule-based fallback
      hint = getLocalHint(code, error || '', language);
    }

    return NextResponse.json({ hint });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Hint error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate hint' },
      { status: 500 }
    );
  }
}
