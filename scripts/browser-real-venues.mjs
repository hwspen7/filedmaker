#!/usr/bin/env node
// Real external PDF acceptance in an actual local Chrome workbench.
// Does not invent rows, sections or official geometry from document titles.
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as sleep} from 'node:timers/promises';
const port=5218,debug=9268;
const chromeBinary=()=>{
  if(process.env.CHROME_BIN)return process.env.CHROME_BIN;
  for(const cmd of ['google-chrome','chromium','chromium-browser']){
    try{return execFileSync('which',[cmd],{encoding:'utf8'}).trim();}catch{}
  }
  throw Error('Chrome not installed');
};
async function poll(fn,retries=70){
  let last;
  for(let i=0;i<retries;i++){
    try{const value=await fn();if(value)return value;}catch(e){last=e;}
    await sleep(550);
  }
  throw last??Error('Browser readiness timeout');
}
const connect=async url=>{
  const socket=new WebSocket(url),pending=new Map();let sequence=0;
  await new Promise((resolve,reject)=>{
    socket.addEventListener('open',resolve,{once:true});
    socket.addEventListener('error',reject,{once:true});
  });
  socket.addEventListener('message',event=>{
    const data=JSON.parse(event.data),request=pending.get(data.id);
    if(!request)return;pending.delete(data.id);
    data.error?request.reject(Error(JSON.stringify(data.error))):request.resolve(data.result);
  });
  return {send:(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;pending.set(id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  }),close:()=>socket.close()};
};
const manifest=JSON.parse(readFileSync('artifacts/real-school/manifest.json','utf8'));
if(manifest.sources.length<2)throw Error('At least two downloaded source PDFs required');
const out=resolve('artifacts/real-school');mkdirSync(out,{recursive:true});
const temp=mkdtempSync(join(tmpdir(),'filedmaker-real-'));
const server=spawn(process.execPath,['scripts/server.mjs'],
  {env:{...process.env,PORT:String(port),FILEDMAKER_TEST_FIXTURES:'1'},stdio:'ignore'});
const chrome=spawn(chromeBinary(),[
  '--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
  '--disable-gpu-sandbox','--disable-features=Vulkan',
  '--window-size=1366,920','--remote-debugging-port='+debug,
  '--user-data-dir='+temp,'about:blank'
],{stdio:'ignore'});
let client;
try{
  await poll(async()=>{const r=await fetch('http://127.0.0.1:'+port+'/');return r.ok;});
  const ws=await poll(async()=>{
    const r=await fetch('http://127.0.0.1:'+debug+'/json');
    const list=await r.json();
    return list.find(p=>p.type==='page'&&p.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
  });
  client=await connect(ws);
  await client.send('Page.enable');await client.send('Runtime.enable');
  const evaluate=async expression=>{
    const response=await client.send('Runtime.evaluate',{
      expression,returnByValue:true,awaitPromise:true});
    if(response.exceptionDetails)throw Error('Chrome: '+JSON.stringify(response.exceptionDetails));
    return response.result?.value;
  };
  const findings=[];
  for(const item of manifest.sources){
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/workbench/'});
    await poll(async()=>await evaluate("document.documentElement.dataset.workbenchReady==='true'"));
    const uri='/tests/fixtures/'+item.fixture;
    const code="(async()=>{const r=await fetch("+JSON.stringify(uri)+");"+
      "if(!r.ok)throw Error('Missing CI PDF source');"+
      "const data=(await r.text()).trim();"+
      "const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));"+
      "const f=new File([bytes],"+JSON.stringify(item.name)+",{type:'application/pdf'});"+
      "const t=new DataTransfer();t.items.add(f);"+
      "const el=document.querySelector('#pdfFile');el.files=t.files;"+
      "el.dispatchEvent(new Event('change',{bubbles:true}));return bytes.length})()";
    const size=await evaluate(code);
    const loaded=await poll(async()=>{
      const state=await evaluate("({name:document.querySelector('#sourceName')?.textContent,"+
        "status:document.querySelector('#pdfStatus')?.textContent,"+
        "ledger:document.querySelector('#sourceLedger')?.textContent,"+
        "seats:document.querySelector('#mappedCount')?.textContent,"+
        "sections:document.querySelector('#sectionCount')?.textContent,"+
        "checklist:document.querySelector('#reviewChecklist')?.textContent,"+
        "pageCount:document.querySelector('#pdfPage')?.options.length,"+
        "error:document.querySelector('#workStatus')?.textContent})");
      return state?.name?.includes(item.name)&&state?.status?.startsWith('PDF page')?state:null;
    },100);
    if(size!==item.bytes||!loaded.ledger.includes(item.sha256.slice(0,12)))
      throw Error('PDF input/hash mismatch: '+item.id);
    if(loaded.seats!=='0'||loaded.sections!=='0'||
      !loaded.checklist.includes('Trace each row-bearing section'))
      throw Error('PDF must not fabricate school seating: '+item.id+' '+JSON.stringify(loaded));
    const page=Math.min(item.page,loaded.pageCount);
    if(page>1){
      await evaluate("(()=>{const sel=document.querySelector('#pdfPage');"+
        "sel.value="+JSON.stringify(String(page))+";"+
        "sel.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
      await poll(async()=>await evaluate(
        "document.querySelector('#pdfStatus')?.textContent.startsWith('PDF page "+page+"/')"));
    }
    const state=await evaluate("({status:document.querySelector('#pdfStatus').textContent,"+
      "matches:document.querySelectorAll('#pdfLabels button').length,"+
      "canvas:document.querySelector('#planCanvas').width,"+
      "seats:document.querySelector('#mappedCount').textContent,"+
      "sections:document.querySelector('#sectionCount').textContent})");
    if(state.canvas<100||state.seats!=='0'||state.sections!=='0')
      throw Error('Invalid real PDF manual-review state: '+item.id);
    const screenshot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(out,item.id+'.png'),Buffer.from(screenshot.data,'base64'));

    if(item.id==='aiken-high-taylor-gym'){
      // Source-based exact bank totals + explicitly ASSUMED staff row layout.
      // This proves an editable preliminary 3D model, NOT a real seating reconstruction.
      const load="(async()=>{"+
        "const {makeAikenUnverifiedOperatorDraft}=await import('/src/workbench/qa/aiken-operator-draft.mjs');"+
        "const draft=makeAikenUnverifiedOperatorDraft();"+
        "const file=new File([JSON.stringify(draft)],'aiken-operator-estimate.json',{type:'application/json'});"+
        "const transfer=new DataTransfer();transfer.items.add(file);"+
        "const el=document.querySelector('#openProject');el.files=transfer.files;"+
        "el.dispatchEvent(new Event('change',{bubbles:true}));"+
        "return {rows:draft.rows.length,estimated:draft.notes.some(x=>x.includes('ASSUMED'))}})()";
      const metadata=await evaluate(load);
      const ready=await poll(async()=>{
        const state=await evaluate("({venue:document.querySelector('#workspaceName').textContent,"+
          "seats:document.querySelector('#mappedCount').textContent,"+
          "sections:document.querySelector('#sectionCount').textContent,"+
          "qa:document.querySelector('#qa').textContent})");
        return state.seats==='1,418'&&state.sections==='4'?state:null;
      },55);
      if(!metadata.estimated||!ready.venue.includes('operator-estimated')||
        !ready.qa.includes('review'))
        throw Error('Unverified operator draft lost estimation flags: '+JSON.stringify(ready));
      await evaluate("document.querySelector('#show3d').click()");
      const visible=await poll(async()=>await evaluate(
        "(()=>{const c=document.querySelector('#modelCanvas');return !c.hidden&&!!c.getContext('webgl2')})()"),45);
      if(!visible)throw Error('Aiken operator-draft failed native 3D rendering');
      await sleep(550);
      const frame=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      writeFileSync(join(out,'aiken-unverified-operator-draft-3d.png'),Buffer.from(frame.data,'base64'));
      console.log('REAL BANK TOTALS + UNVERIFIED ROW GEOMETRY: Aiken 1,418 illustrated in WebGL2; not official');
    }

    const summary={id:item.id,url:item.url,sha256:item.sha256,bytes:size,
      page,pageCount:loaded.pageCount,text:state.status,sectionHints:state.matches,
      realSourceParsed:true,seatsInvented:0,sectionsInvented:0,
      operatorReviewMandatory:true,screenshot:item.id+'.png'};
    findings.push(summary);
    console.log('REAL PDF VERIFIED '+JSON.stringify(summary));
  }
  writeFileSync(join(out,'browser-results.json'),JSON.stringify({findings},null,2));
  if(findings.length!==manifest.sources.length)throw Error('Incomplete live PDF validation');
}finally{
  client?.close();chrome.kill('SIGKILL');server.kill('SIGTERM');
  rmSync(temp,{recursive:true,force:true});
}
