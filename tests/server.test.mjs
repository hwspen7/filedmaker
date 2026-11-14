import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const port = 53817;
let server;
test('static server serves the app and module with correct MIME types', async t => {
  server = spawn(process.execPath, ['scripts/server.mjs'], { env: { ...process.env, PORT: String(port) } });
  t.after(() => server?.kill());
  await Promise.race([
    once(server.stdout, 'data'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Server startup timeout')), 3000)),
  ]);
  const root = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(root.status, 200);
  assert.match(root.headers.get('content-type'), /text\/html/);
  assert.match(await root.text(), /FiledMaker/);
  const module = await fetch(`http://127.0.0.1:${port}/src/model.mjs`);
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /javascript/);
  assert.match(await module.text(), /generateSeats/);
  const missing = await fetch(`http://127.0.0.1:${port}/missing.js`);
  assert.equal(missing.status, 404);
  const request = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' });
  assert.equal(request.status, 405);
});
