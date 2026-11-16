import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const port = Number(process.env.PORT || 5174);
function gitValue(...args){
  try{return execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:1500,
    stdio:['ignore','pipe','ignore']}).trim();}
  catch{return null;}
}
const buildInfo={
  branch:process.env.GITHUB_REF_NAME||gitValue('branch','--show-current')||'unknown',
  commit:process.env.GITHUB_SHA||gitValue('rev-parse','HEAD')||'unknown',
  root,venueCount:2,source:'local-checkout'
};
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(path==='/__filedmaker/pdf/pdf.mjs'||path==='/__filedmaker/pdf/pdf.worker.mjs'){
      // Strictly allow these two pinned PDF.js distribution assets only.
      const moduleName=path.endsWith('pdf.worker.mjs')?'pdf.worker.mjs':'pdf.mjs';
      const pdfAsset=resolve(root,'node_modules','pdfjs-dist','build',moduleName);
      const directory=resolve(root,'node_modules','pdfjs-dist','build');
      const actual=await realpath(pdfAsset);
      if(!actual.startsWith(directory+sep)){res.writeHead(403);res.end();return;}
      const asset=await readFile(actual);
      res.writeHead(200,{'content-type':'text/javascript; charset=utf-8',
        'cache-control':'no-store','x-content-type-options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:asset);
      return;
    }
    if(path==='/__filedmaker/status'){
      res.writeHead(200,{'content-type':'application/json; charset=utf-8',
        'cache-control':'no-store','x-content-type-options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:JSON.stringify(buildInfo));
      return;
    }
    // Do not expose private working-tree files, Git internals, workflows,
    // scripts or dependency folders through a local development web server.
    const parts=path.split('/').filter(Boolean);
    const allowedDirs=new Set(['src','workbench','school','viewer','legacy','examples','data']);
    const publicRoot=new Set(['index.html','studio.css','styles.css','favicon.svg']);
    const testFixture=process.env.FILEDMAKER_TEST_FIXTURES==='1'&&
      /^\/tests\/fixtures\/[A-Za-z0-9_.-]+\.base64\.txt$/.test(path);
    if(parts.some(p=>p.startsWith('.')||p==='..')||
      (!testFixture&&(parts.length>1?!allowedDirs.has(parts[0]):
        parts.length===1&&!allowedDirs.has(parts[0])&&!publicRoot.has(parts[0])))){
      res.writeHead(403);res.end('Forbidden');return;
    }
    const requestFile = path.endsWith('/') ? `${path}index.html` : path;
    const file = resolve(root, `.${requestFile}`);
    if (file !== root && !file.startsWith(`${root}${sep}`)) { res.writeHead(403); res.end(); return; }
    if (!(await stat(file)).isFile()) { res.writeHead(404); res.end(); return; }
    const real=await realpath(file);
    if(real!==root&&!real.startsWith(`${root}${sep}`)){res.writeHead(403);res.end();return;}
    const data = await readFile(real);
    res.writeHead(200, { 'content-type': mime[extname(real)] || 'application/octet-stream',
      'cache-control': 'no-store','x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer','x-frame-options':'SAMEORIGIN' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`FiledMaker at http://127.0.0.1:${port}/`);
  console.log(`Serving ${buildInfo.branch} @ ${buildInfo.commit.slice(0,12)} from ${buildInfo.root}`);
});
server.on('error',error=>{
  if(error.code==='EADDRINUSE'){
    console.error(`Port ${port} is already occupied. That may be an OLD FiledMaker
server serving another checkout or branch. Use scripts/launch-workbench.ps1
to start the verified development branch on a fresh port.`);
    process.exitCode=1;
    return;
  }
  throw error;
});
