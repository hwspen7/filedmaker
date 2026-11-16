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
  const school = await fetch(`http://127.0.0.1:${port}/school/`);
  assert.equal(school.status, 200);
  assert.match(await school.text(), /School Venue Studio/);
  const schoolModule = await fetch(`http://127.0.0.1:${port}/src/schoolPipeline.mjs`);
  assert.equal(schoolModule.status, 200);
  assert.match(schoolModule.headers.get('content-type'), /javascript/);
  const seatEngine = await fetch(`http://127.0.0.1:${port}/src/seatFirst.mjs`);
  assert.equal(seatEngine.status, 200);
  assert.match(await seatEngine.text(), /importTicketRoster/);
  const module = await fetch(`http://127.0.0.1:${port}/src/model.mjs`);
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /javascript/);
  assert.match(await module.text(), /generateSeats/);
  const missing = await fetch(`http://127.0.0.1:${port}/src/missing.js`);
  assert.equal(missing.status, 404);
  const cases=await fetch(`http://127.0.0.1:${port}/cases/`);
  assert.equal(cases.status,200);
  assert.match(await cases.text(),/Choose a venue/);
  const caseScript=await fetch(`http://127.0.0.1:${port}/cases/cases.js`);
  assert.equal(caseScript.status,200);
  const caseCatalog=await fetch(`http://127.0.0.1:${port}/src/workbench/caseCatalog.mjs`);
  assert.equal(caseCatalog.status,200);
  const workbench=await fetch(`http://127.0.0.1:${port}/workbench/`);
  assert.equal(workbench.status,200);
  assert.match(await workbench.text(),/Venue Workbench/);
  for(const hidden of ['/package.json','/.git/config','/.github/workflows/quality.yml',
                        '/scripts/server.mjs','/tests/fixtures/row-workbook.base64.txt']){
    const denied=await fetch(`http://127.0.0.1:${port}${hidden}`);
    assert.equal(denied.status,403,'Must not serve '+hidden);
  }
  const pdfModule=await fetch(`http://127.0.0.1:${port}/__filedmaker/pdf/pdf.mjs`);
  assert.equal(pdfModule.status,200);
  assert.match(pdfModule.headers.get('content-type'),/javascript/);
  const pdfWorker=await fetch(`http://127.0.0.1:${port}/__filedmaker/pdf/pdf.worker.mjs`);
  assert.equal(pdfWorker.status,200);
  assert.ok((await pdfWorker.text()).length>10000);
  const prohibited=await fetch(`http://127.0.0.1:${port}/__filedmaker/pdf/../../package.json`);
  assert.notEqual(prohibited.status,200);
  const request = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' });
  assert.equal(request.status, 405);
});
