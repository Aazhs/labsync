import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { POST } from '../src/app/api/hint/route';

const brokenProgram = [
  '#include <iostream>',
  'int main() {',
  '  int total = 2;',
  '  std::cout << totl;',
  '}',
].join('\n');
const compileOutput = [
  "main.cpp: In function ‘int main()’:",
  'main.cpp:4:16: error: ‘totl’ was not declared in this scope',
  '    4 |   std::cout << totl;',
  '      |                ^~~~',
].join('\n');
const failedRun = {
  code: brokenProgram, language: 'C++', filename: 'main.cpp', compileOutput, status: 'Compilation Error',
};

function request(body: object) {
  return new Request('http://localhost/api/hint', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const env = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL'] as const;
function isolateProviders(t: TestContext) {
  const previous = env.map((key) => [key, process.env[key]] as const);
  for (const key of env) delete process.env[key];
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('hints carry the latest question, source and diagnostic through provider failover', async (t) => {
  isolateProviders(t);
  process.env.GEMINI_API_KEY = 'gemini-test-key';
  process.env.OPENAI_API_KEY = 'openai-test-key';
  const fetchProvider = t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (url.includes('generativelanguage.googleapis.com')) {
      assert.match(url, /\/gemini-3\.5-flash-lite:generateContent$/);
      assert.equal(new Headers(init.headers).get('x-goog-api-key'), 'gemini-test-key');
      assert.equal(JSON.parse(body.contents.at(-1).parts[0].text).latestStudentMessage, followUp);
      return new Response(null, { status: 503 });
    }
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer openai-test-key');
    assert.equal(body.messages[1].content, 'Check where the name is declared.');
    const context = JSON.parse(body.messages.at(-1).content);
    assert.equal(context.latestStudentMessage, followUp);
    assert.equal(context.source, brokenProgram);
    assert.equal(context.language, 'C++');
    assert.equal(context.diagnostic.category, 'Undeclared name');
    assert.equal(context.diagnostic.line, 4);
    assert.equal(context.compilerOutput, compileOutput);
    return Response.json({ choices: [{ message: { content: 'What name is visible inside this block?' } }] });
  });
  const followUp = 'Which block should I look in?';
  const response = await POST(request({
    ...failedRun,
    message: followUp,
    history: [{ role: 'assistant', content: 'Check where the name is declared.' }],
  }));
  assert.equal(fetchProvider.mock.callCount(), 2);
  assert.deepEqual(await response.json(), { hint: 'What name is visible inside this block?' });
});

test('missing providers use a concrete compiler hint and advance on follow-up', async (t) => {
  isolateProviders(t);
  const first = await (await POST(request(failedRun))).json();
  assert.match(first.hint, /\btotl\b.*line 4/);
  assert.match(first.hint, /spelling/);
  const second = await (await POST(request({
    ...failedRun,
    message: 'How do I check this?',
    history: [{ role: 'assistant', content: first.hint }],
  }))).json();
  assert.notEqual(second.hint, first.hint);
  assert.match(second.hint, /different function or block/);
});

test('an exhausted provider chain guides an accepted result from expected versus actual', async (t) => {
  isolateProviders(t);
  process.env.GEMINI_API_KEY = 'gemini-test-key';
  process.env.OPENAI_API_KEY = 'openai-test-key';
  const provider = t.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.includes('generativelanguage.googleapis.com')) return Response.json({ candidates: [] });
    throw Error('Provider failure');
  });
  const run = {
    code: 'int main() {\n  std::cout << 8;\n}',
    language: 'C++',
    status: 'Accepted',
    output: '8\n',
  };
  const first = await (await POST(request(run))).json();
  assert.equal(provider.mock.callCount(), 2);
  assert.match(first.hint, /“8”.*expect.*line 2/);
  const followUp = await (await POST(request({ ...run, message: 'On line 2 I expected 12 but got 8.' }))).json();
  assert.match(followUp.hint, /Trace.*Which value.*line 2/);
});
