import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/execute/route';

const code = `#include <iostream>
int main() {
  int n;
  std::cin >> n;
  int best = 0;
  for (int i = 0; i < n; ++i) {
    int mark;
    std::cin >> mark;
    if (mark > best) best = mark;
  }
  std::cout << best << '\\n';
}`;

test('GCC cin exhaustion prompts for missing input and a complete retry succeeds', async (t) => {
  const inputs: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, options: { body: string }) => {
    const request = JSON.parse(options.body);
    assert.match(Buffer.from(request.source_code, 'base64').toString(), /std::cin.exceptions/);
    const stdin = Buffer.from(request.stdin, 'base64').toString();
    inputs.push(stdin);
    return Response.json(
      stdin.trim().split(/\s+/).length < 4
        ? {
            stderr: Buffer.from(
              "terminate called after throwing an instance of 'std::__ios_failure'\n  what():  basic_ios::clear: iostream error\n"
            ).toString('base64'),
            status: { id: 11, description: 'Runtime Error (NZEC)' },
          }
        : { stdout: Buffer.from('94\n').toString('base64'), status: { id: 3, description: 'Accepted' } }
    );
  });

  async function run(stdin: string) {
    const response = await POST(new NextRequest('http://localhost/api/execute', {
      method: 'POST',
      body: JSON.stringify({ code, languageId: 54, stdin }),
    }));
    assert.equal(response.status, 200);
    return response.json();
  }

  for (const stdin of ['', '3\n80\n']) {
    const result = await run(stdin);
    assert.equal(result.is_missing_input, true);
    assert.equal(result.status.description, 'Waiting for Input');
    assert.equal(result.stderr, null);
    assert.equal(result.classification.tier, 'none');
  }

  const complete = await run('3\n80\n76\n94\n');
  assert.equal(complete.status.description, 'Accepted');
  assert.equal(complete.stdout, '94\n');
  assert.deepEqual(inputs, ['', '3\n80\n', '3\n80\n76\n94\n']);
});
