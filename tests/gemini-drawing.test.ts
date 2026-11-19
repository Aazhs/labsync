import assert from 'node:assert/strict';
import test from 'node:test';
import { compileDrawing } from '../src/lib/visualiser/drawing';
import { POST } from '../src/app/api/visualiser/drawing/route';

const figure = `<figure><svg viewBox="0 0 600 260"><g data-lines="2-3"><circle cx="20" cy="20" r="10" />
<text data-var="total">total</text></g><g data-items="scores">
<rect width="30" height="20"/><text data-item="">item</text></g></svg><figcaption>Add each score.</figcaption></figure>`;

test('only supported shapes and drawing attributes reach the renderer', () => {
  const drawing = compileDrawing(
    '<svg><image href="cover.png"/><rect fill="url(paint.svg)" width="40" class="custom"/><text data-lines="99" style="color:red">A &amp; B</text></svg>',
    2,
  );
  assert.deepEqual(drawing.root.children, [
    { tag: 'rect', attrs: { width: '40' }, children: [] },
    { tag: 'text', attrs: {}, children: ['A & B'] },
  ]);
  assert.throws(() => compileDrawing('<figure>empty</figure>', 1));
});

test('drawing route handles missing configuration, provider errors and successful markup', async (t) => {
  const initialKey = process.env.GEMINI_API_KEY;
  t.after(() => {
    if (initialKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = initialKey;
  });
  const request = () =>
    new Request('http://localhost/api/visualiser/drawing', {
      method: 'POST',
      body: JSON.stringify({ source: 'total = 17\nprint(total)\n', language: 'python' }),
    });
  delete process.env.GEMINI_API_KEY;
  assert.equal((await POST(request())).status, 503);
  process.env.GEMINI_API_KEY = 'test-placeholder';
  const provider = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429 }));
  assert.equal((await POST(request())).status, 429);
  provider.mock.mockImplementation(async () =>
    Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: figure }] } }] }),
  );
  provider.mock.mockImplementationOnce(async () => new Response(null, { status: 503 }));
  const callsBeforeRecovery = provider.mock.callCount();
  const result = await POST(request());
  assert.equal(provider.mock.callCount() - callsBeforeRecovery, 2);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).drawing.caption, 'Add each score.');
  assert.equal(
    (await POST(new Request('http://localhost/test', { method: 'POST', body: '{}' }))).status,
    400,
  );
});
