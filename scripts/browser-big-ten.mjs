#!/usr/bin/env node
// Browser-verified 3D and seat-view screenshots for mapped Big Ten arenas.
// Uses Chromium DevTools, WebGL2 and an actual local HTTP server.
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,statSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const PORT=5294,DEBUG=9294,ARENAS=['illinois','indiana','iowa','maryland','michigan','michigan-state',
  'minnesota','nebraska','northwestern','oregon','penn-state','purdue',
  'rutgers','ucla','usc','washington','wisconsin'];
const out=resolve(process.env.VISUAL_OUTPUT??'artifacts/big-ten-visual');
function chromeBinary(){
  if(process.env.CHROME_BIN)return process.env.CHROME_BIN;
  for(const cmd of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{return execFileSync('which',[cmd],{encoding:'utf8'}).trim();}catch{}
  }
  throw Error('Chrome is missing');
}
async function poll(fn,tries=60){
  let last;
  for(let i=0;i<tries;i++){
    try{const x=await fn();if(x)return x;}catch(e){last=e;}
    await delay(550);
  }
  throw last??Error('Timed out waiting for browser output');
}
async function main(){
  mkdirSync(out,{recursive:true});
  const scratch=mkdtempSync(join(tmpdir(),'bigten-chrome-'));
  const server=spawn(process.execPath,['scripts/server.mjs'],
    {env:{...process.env,PORT:String(PORT)},stdio:'ignore'});
  const chrome=spawn(chromeBinary(),[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
    '--disable-gpu-sandbox','--disable-features=Vulkan','--hide-scrollbars',
    '--window-size=1440,920','--remote-debugging-port='+DEBUG,
    '--user-data-dir='+scratch,'about:blank'
  ],{stdio:'ignore'});
  let socket;const pending=new Map();let counter=0;
  try{
    await poll(async()=>{const r=await fetch('http://127.0.0.1:'+PORT+'/');return r.ok;});
    const url=await poll(async()=>{
      const r=await fetch('http://127.0.0.1:'+DEBUG+'/json');
      const pages=await r.json();
      return pages.find(p=>p.type==='page'&&p.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
    });
    socket=new WebSocket(url);
    await new Promise((ok,err)=>{
      socket.addEventListener('open',ok,{once:true});
      socket.addEventListener('error',err,{once:true});
    });
    socket.addEventListener('message',e=>{
      const message=JSON.parse(e.data);
      const item=pending.get(message.id);
      if(!item)return;
      pending.delete(message.id);clearTimeout(item.timeout);
      message.error?item.reject(Error(JSON.stringify(message.error))):item.resolve(message.result);
    });
    const send=(method,params={})=>new Promise((resolve,reject)=>{
      const id=++counter;
      const timeout=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},40000);
      pending.set(id,{resolve,reject,timeout});
      socket.send(JSON.stringify({id,method,params}));
    });
    const evalJs=async expression=>{
      const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
      return result.result?.value;
    };
    await send('Page.enable');await send('Runtime.enable');
    for(const venue of ARENAS){
      const path='http://127.0.0.1:'+PORT+'/build/big-ten-18/'+venue+'/venue-preview.html';
      await send('Page.navigate',{url:path});
      const model=await poll(async()=>await evalJs(`(()=>{
        const data=document.querySelector('#payload')?.textContent;
        if(!data||!document.querySelector('#three'))return null;
        const payload=JSON.parse(data);
        return {seats:payload.seats.length,school:payload.school,
          hasMap:!!document.querySelector('#stage'),
          names:[...new Set(payload.seats.map(s=>s.sectionId))].slice(0,10)};
      })()`),75);
      if(model.seats<2000||model.school==='School venue')
        throw Error('Missing school metadata or seats: '+venue+' '+JSON.stringify(model));
      const merged=await evalJs("!document.querySelector('#building')");
      if(!merged)throw Error('Legacy standalone Building tab remains in '+venue);
      await evalJs("document.querySelector('#three').click()");
      await poll(async()=>await evalJs(`(()=>{
        const canvas=document.querySelector('#stage');
        return canvas&&!canvas.hidden&&canvas.width>200&&canvas.height>200&&!!canvas.getContext('webgl2')
      })()`),60);
      await delay(1200);
      const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const target=join(out,venue+'-3d.png');
      writeFileSync(target,Buffer.from(image.data,'base64'));
      if(statSync(target).size<18000)throw Error('Empty 3D WebGL screenshot '+venue);
      const roof=await evalJs(`(()=>{
        const payload=JSON.parse(document.querySelector('#payload').textContent);
        const meshes=payload.packedArchitecture||{};
        return ['roofWhite','roofCopper','roofSlate','roofPale']
          .some(key=>typeof meshes[key]==='string'&&meshes[key].length>1000);
      })()`);
      if(!roof)throw Error('Missing source-specific exterior roof mesh: '+venue);
      await evalJs("document.querySelector('#exterior').click()");
      await poll(async()=>await evalJs("document.querySelector('#exterior').classList.contains('active')"));
      await delay(650);
      const outside=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const exteriorFile=join(out,venue+'-exterior.png');
      writeFileSync(exteriorFile,Buffer.from(outside.data,'base64'));
      if(statSync(exteriorFile).size<18000)throw Error('Empty exterior screenshot '+venue);
            await evalJs(`(()=>{
        const payload=JSON.parse(document.querySelector('#payload').textContent);
        const seat=${venue==='michigan'?"payload.seats.find(s=>s.sectionId==='205'&&s.row==='22')":"null"} ||
          payload.seats.find(s=>s.tier===0&&s.number===4)||payload.seats[0];
        if(!seat)throw Error('No representative seat');
        document.querySelector('#search').value=seat.uid;
        document.querySelector('#find').click();
        document.querySelector('#eye').click();
      })()`);
      await poll(async()=>await evalJs("document.querySelector('#eye').classList.contains('active')"));
      await delay(700);
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const file=join(out,venue+'-seat-view.png');
      writeFileSync(file,Buffer.from(shot.data,'base64'));
      if(statSync(file).size<18000)throw Error('Empty 3D seat screenshot '+venue);
      console.log(venue+': '+model.seats+' source-mapped seats, WebGL2 screenshot verified');
    }
  }finally{
    socket?.close();
    server.kill('SIGKILL');chrome.kill('SIGKILL');
    // Chromium can still flush profile files after SIGKILL; cleanup must
    // never turn a successful 3D render into a failed visual audit.
    try{rmSync(scratch,{recursive:true,force:true,maxRetries:12,retryDelay:250});}
    catch(error){console.warn('Chrome temporary profile cleanup:',error.message);}
  }
}
main().catch(e=>{console.error('Big Ten browser acceptance failed:',e);process.exitCode=1;});
