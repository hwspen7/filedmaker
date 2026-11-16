#!/usr/bin/env node
// Browser acceptance for the standalone lightweight venue-builder route.
// Exercises live controls in headless Chrome, not only pure geometry functions.
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const port=5194,debugPort=9241;
function chromeBinary(){
  if(process.env.CHROME_BIN)return process.env.CHROME_BIN;
  for(const bin of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{return execFileSync('which',[bin],{encoding:'utf8'}).trim();}catch{}
  }
  throw Error('Chrome/Chromium not available');
}
async function poll(fn,tries=45){
  let last;
  for(let i=0;i<tries;i++){
    try{const x=await fn();if(x)return x;}catch(error){last=error;}
    await delay(350);
  }
  throw last??Error('Browser did not become ready');
}
function cdp(url){
  const ws=new WebSocket(url),pending=new Map();let id=0;
  const ready=new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    const request=pending.get(message.id);
    if(!request)return;
    pending.delete(message.id);
    message.error?request.reject(Error(JSON.stringify(message.error))):
      request.resolve(message.result);
  });
  return {
    send:async(method,params={})=>{
      await ready;
      const key=++id;
      return await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>{
          pending.delete(key);reject(Error('Timeout: '+method));
        },20000);
        pending.set(key,{
          resolve:v=>{clearTimeout(timeout);resolve(v);},
          reject:e=>{clearTimeout(timeout);reject(e);}
        });
        ws.send(JSON.stringify({id:key,method,params}));
      });
    },
    close:()=>ws.close()
  };
}
async function main(){
  const folder=mkdtempSync(join(tmpdir(),'filedmaker-builder-'));
  const output=resolve(process.env.VISUAL_OUTPUT??'artifacts/visual');
  mkdirSync(output,{recursive:true});
  const server=spawn(process.execPath,['scripts/server.mjs'],{
    env:{...process.env,PORT:String(port)},stdio:'ignore'
  });
  const chrome=spawn(chromeBinary(),[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--disable-gpu-sandbox','--window-size=1400,920',
    '--remote-debugging-port='+debugPort,'--user-data-dir='+folder,'about:blank'
  ],{stdio:'ignore'});
  let client;
  try{
    await poll(async()=>{const r=await fetch('http://127.0.0.1:'+port+'/workbench/builder/');return r.ok;});
    const target=await poll(async()=>{
      const r=await fetch('http://127.0.0.1:'+debugPort+'/json');
      const data=await r.json();
      return data.find(p=>p.type==='page')?.webSocketDebuggerUrl;
    });
    client=cdp(target);
    await client.send('Page.enable');await client.send('Runtime.enable');
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/workbench/builder/'});
    const evaluate=async expression=>{
      const reply=await client.send('Runtime.evaluate',{
        expression,returnByValue:true,awaitPromise:true
      });
      if(reply.exceptionDetails)throw Error('Browser JS exception: '+JSON.stringify(reply.exceptionDetails));
      return reply.result?.value;
    };
    const initial=await poll(async()=>{
      const value=await evaluate("({name:document.querySelector('#projectName')?.value,seats:document.querySelector('#seatCount')?.textContent,parts:document.querySelectorAll('.object-button').length,w:document.querySelector('#scene')?.width})");
      return value?.w>200&&value?.parts===4&&/1,468/.test(value.seats)?value:null;
    });
    console.log('Builder loaded: '+initial.name+', '+initial.seats+', '+initial.parts+' stands');
    // The inspector must change the actual model and recalculate seats.
    const edited=await evaluate("(()=>{document.querySelector('.object-button').click();const inputs=document.querySelectorAll('#fieldList input');const width=inputs[4];width.value='30';width.dispatchEvent(new Event('change',{bubbles:true}));return {parts:document.querySelectorAll('.object-button').length,seats:document.querySelector('#seatCount').textContent,selected:document.querySelector('#selectionType').textContent}})()");
    if(!edited.seats||/1,468/.test(edited.seats)||!edited.selected.includes('Seating'))
      throw Error('Stand editing did not recalculate seats: '+JSON.stringify(edited));
    const restored=await evaluate("(()=>{document.querySelector('#undo').click();return document.querySelector('#seatCount').textContent})()");
    if(restored!==initial.seats)throw Error('Undo did not restore seat count');
    const added=await evaluate("(()=>{document.querySelector('.part[data-kind=stage]').click();return {count:document.querySelectorAll('.object-button').length,selection:document.querySelector('#selectionType').textContent}})()");
    if(added.count!==5||added.selection!=='Concert stage')
      throw Error('Adding a stage failed: '+JSON.stringify(added));
    await delay(250);
    // Move the selected stage directly on the 3D canvas, not via a form.
    const moved=await evaluate("(()=>{const c=document.querySelector('#scene'),r=c.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2-10;const capture=c.setPointerCapture,has=c.hasPointerCapture;try{c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;for(const [kind,dx] of [['pointerdown',0],['pointermove',48],['pointerup',48]])c.dispatchEvent(new PointerEvent(kind,{bubbles:true,button:0,buttons:kind==='pointerup'?0:1,pointerId:3,clientX:x+dx,clientY:y}));}finally{c.setPointerCapture=capture;c.hasPointerCapture=has;}return {selected:document.querySelector('#selectionType').textContent,x:document.querySelectorAll('#fieldList input')[1]?.value,status:document.querySelector('#status').textContent}})()");
    if(moved.selected!=='Concert stage'||Math.abs(Number(moved.x))<.1)
      throw Error('Direct canvas movement did not change stage position: '+JSON.stringify(moved));
    await evaluate("document.querySelector('#topView').click()");
    const top=await evaluate("document.querySelector('#viewName').textContent");
    if(top!=='Top-down layout')throw Error('Top-down view failed');
    await evaluate("document.querySelector('#orbitView').click()");
    const rotated=await evaluate("document.querySelector('#viewName').textContent");
    if(rotated!=='Editable 3D layout')throw Error('3D view restore failed');
    await evaluate("document.querySelector('#save').click()");
    const saved=await evaluate("localStorage.getItem('filedmaker-venue-builder')");
    if(!saved||!saved.includes('stage-1'))throw Error('Local project save failed');
    await delay(650);
    const frame=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const filepath=join(output,'venue-builder-first-slice.png');
    writeFileSync(filepath,Buffer.from(frame.data,'base64'));
    if(statSync(filepath).size<12000)throw Error('Builder canvas screenshot is suspiciously small');
    console.log('Builder browser acceptance passed; screenshot '+filepath);
    // A single training hall must show three distinct basketball surfaces.
    await evaluate("(()=>{window.confirm=()=>true;const a=document.querySelector('#activity');a.value='training';document.querySelector('#newProject').click();})()");
    const training=await poll(async()=>await evaluate("({courts:[...document.querySelectorAll('.object-button')].filter(x=>x.textContent.includes('Basketball court')).length,hoops:[...document.querySelectorAll('.object-button')].filter(x=>x.textContent.includes('Basketball hoop')).length,parts:document.querySelectorAll('.object-button').length})"));
    if(training.courts!==3||training.hoops!==6||training.parts<15)
      throw Error('Three-court training layout is incomplete: '+JSON.stringify(training));
    await delay(450);
    const trainingShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(output,'venue-builder-three-courts.png'),
      Buffer.from(trainingShot.data,'base64'));
    // Assemblies are user-inserted groups, not background sample geometry.
    const assembled=await evaluate("(()=>{const before=document.querySelectorAll('.object-button').length;document.querySelectorAll('.assembly')[0].click();return {before,after:document.querySelectorAll('.object-button').length}})()");
    if(assembled.after-assembled.before!==3)
      throw Error('Basketball assembly did not insert court and two hoops: '+JSON.stringify(assembled));
    // Switching a stand to arc must regenerate its real seat inventory.
    await evaluate("(()=>{document.querySelector('#activity').value='basketball';document.querySelector('#newProject').click();document.querySelector('.object-button').click();const shape=document.querySelector('#fieldList select');shape.value='arc';shape.dispatchEvent(new Event('change',{bubbles:true}));})()");
    const arc=await evaluate("({seats:document.querySelector('#seatCount').textContent,shape:document.querySelector('#fieldList select')?.value,arcField:[...document.querySelectorAll('#fieldList label')].some(x=>x.textContent.includes('Total arc angle'))})");
    if(arc.shape!=='arc'||!arc.arcField||arc.seats===initial.seats)
      throw Error('Curved seating did not regenerate: '+JSON.stringify(arc));
    await delay(400);
    const arcShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(output,'venue-builder-curved-seating.png'),
      Buffer.from(arcShot.data,'base64'));
    // Import a tiny offline OBJ asset and ensure provenance stays attached.
    await evaluate("(()=>{const file=new File(['v 0 0 0\\nv 1 0 0\\nv 0 1 0\\nf 1 2 3'],'cube.obj',{type:'text/plain'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#assetFile');input.files=dt.files;document.querySelector('#assetLicense').value='CC0';input.dispatchEvent(new Event('change',{bubbles:true}));})()");
    const imported=await poll(async()=>{
      const value=await evaluate("({selected:document.querySelector('#selectionType')?.textContent,provenance:document.querySelector('#fieldList')?.textContent})");
      return value?.selected==='Imported OBJ model'?value:null;
    });
    if(imported.selected!=='Imported OBJ model'||!imported.provenance.includes('CC0'))
      throw Error('OBJ import did not preserve provenance: '+JSON.stringify(imported));
    console.log('Extended builder acceptance passed: 3 courts, assembly, arc seating, OBJ import');

  }finally{
    client?.close();chrome.kill('SIGTERM');server.kill('SIGTERM');
    await delay(150);rmSync(folder,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
