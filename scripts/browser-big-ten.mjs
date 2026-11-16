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
    const ensureDrawn=async label=>{
      const count=await evalJs(`(()=>{
        const canvas=document.querySelector('#viewport3d');
        if(!canvas||canvas.hidden)return 0;
        const gl=canvas.getContext('webgl2');
        if(!gl)return 0;
        const width=canvas.width,height=canvas.height;
        const pixels=new Uint8Array(width*height*4);
        gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let visible=0;
        for(let y=0;y<height;y+=8)for(let x=0;x<width;x+=8){
          if(pixels[(y*width+x)*4+3]>28)visible++;
        }
        return visible;
      })()`);
      if(count<40)throw Error('Actual WebGL2 framebuffer is blank: '+label+' '+count);
    };
    await send('Page.enable');await send('Runtime.enable');
    // The home page must offer the same one-click native studio workflow as OSU.
    await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/'});
    await poll(async()=>await evalJs(`(()=>{
      const ids=[...document.querySelectorAll('[data-bigten]')].map(b=>b.dataset.bigten);
      return ids.length===17 && !!document.querySelector('[data-preset="schott"]') &&
        !!document.querySelector('[data-view="exterior"]') &&
        typeof document.querySelector('[data-bigten="illinois"]')?.onclick==='function' &&
        !!document.querySelector('#title');
    })()`),75);
    for(const [id,arena] of [['illinois','State Farm Center'],
      ['purdue','Mackey Arena'],['washington','Alaska Airlines Arena at Hec Edmundson Pavilion']]){
      await evalJs(`document.querySelector('[data-bigten="${id}"]').click()`);
      let probes=0;
      await poll(async()=>{
        const state=await evalJs(`JSON.stringify((()=>{
          const canvas=document.querySelector('#viewport3d');
          return {
            title:document.querySelector('#title')?.textContent,
            active:document.querySelector('[data-bigten="${id}"]')?.classList.contains('active'),
            seats:document.querySelector('#visualCount')?.textContent,
            canvas:!!canvas&&canvas.width>200&&canvas.height>200&&!!canvas.getContext('webgl2'),
            warning:document.querySelector('#warnings')?.textContent,
            loaderHidden:document.querySelector('#loading')?.hidden,
            subtitle:document.querySelector('#subtitle')?.textContent
          };
        })())`);
        const info=state?JSON.parse(state):{};
        if(++probes===6||probes===20)
          console.log('Native studio '+id+' selection probe:',JSON.stringify(info));
        if(info.warning?.startsWith('Unable to open'))throw Error(info.warning);
        return info.title===arena&&info.active&&info.seats!=='—'&&info.canvas;
      },50);
      await evalJs("document.querySelector('[data-view=exterior]').click()");
      await poll(async()=>await evalJs(`(()=>{
        const selected=document.querySelector('[data-view=exterior]')?.classList.contains('current');
        return selected&&document.querySelector('#viewLabel')?.textContent.includes('Complete building');
      })()`));
      await delay(400);
      const snapshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const file=join(out,'studio-'+id+'-exterior.png');
      writeFileSync(file,Buffer.from(snapshot.data,'base64'));
      if(statSync(file).size<18000)throw Error('Native studio 3D exterior view is blank: '+id);
    }
    // All eight first-wave interiors must be accessible as section diagrams,
    // 3D seating bowls and eye-level views from the existing OSU homepage.
    // Every school now has a dedicated interior scene. Verify each one
    // through the actual main website, not only a standalone offline export.
    const allBigTen=ARENAS;
    const currentCatalog=JSON.parse(readFileSync('data/big-ten/arenas-2026-27.json'));
    for(const id of allBigTen){
      const arena=currentCatalog.venues.find(v=>v.id===id).venue.name;
      await evalJs(`document.querySelector('[data-bigten="${id}"]').click()`);
      await poll(async()=>await evalJs(`(()=>{
        const title=document.querySelector('#title')?.textContent;
        const active=document.querySelector('[data-bigten="${id}"]')?.classList.contains('active');
        const options=[...document.querySelector('#sectionPicker')?.options||[]].map(o=>o.value);
        return title===${JSON.stringify(arena)}&&active&&options.length>=12;
      })()`),95);
      const required={ucla:['206A','206B','224C'],
        illinois:['101','121','248'],indiana:['A','M','AA','MM'],
        wisconsin:['101','215','328'],washington:['1','14']};
      const labels=await evalJs(`[...document.querySelector('#sectionPicker').options].map(o=>o.value)`);
      for(const name of required[id]||[])
        if(!labels.includes(name))throw Error('Missing real '+id+' section '+name);
      await evalJs("document.querySelector('[data-view=top]').click()");
      await poll(async()=>await evalJs("document.querySelector('#viewport2d')?.width>300"));
      await delay(320);
      const map=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const mapPath=join(out,'studio-'+id+'-sections.png');
      writeFileSync(mapPath,Buffer.from(map.data,'base64'));
      if(statSync(mapPath).size<18000)throw Error('Blank native section map '+id);
      await evalJs("document.querySelector('[data-view=overview]').click()");
      await poll(async()=>await evalJs(`(()=>{
        const c=document.querySelector('#viewport3d');
        return document.querySelector('[data-view=overview]')?.classList.contains('current')&&
          c?.width>300 && !c.hidden && !!c.getContext('webgl2');
      })()`));
      await delay(450);
      await ensureDrawn('native stadium interior '+id);
      const render=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const renderPath=join(out,'studio-'+id+'-interior.png');
      writeFileSync(renderPath,Buffer.from(render.data,'base64'));
      if(statSync(renderPath).size<18000)throw Error('Blank first-wave interior '+id);
      await evalJs(`(()=>{
        const selector=document.querySelector('#sectionPicker');
        const value=[...selector.options].map(o=>o.value).find(Boolean);
        selector.value=value;
        selector.dispatchEvent(new Event('change',{bubbles:true}));
        document.querySelector('[data-view=human]').click();
      })()`);
      await poll(async()=>await evalJs("document.querySelector('[data-view=human]')?.classList.contains('current')"));
      await delay(280);
      const view=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const viewPath=join(out,'studio-'+id+'-seat-eye.png');
      writeFileSync(viewPath,Buffer.from(view.data,'base64'));
      if(statSync(viewPath).size<18000)throw Error('Blank school-native seat view '+id);
      console.log('Main-page arena interior '+id+': section plan, full bowl, and seat-eye render verified');
    }
    await evalJs("document.querySelector('[data-preset=schott]').click()");
    await poll(async()=>await evalJs(`(()=>{
      return document.querySelector('#title')?.textContent.includes('Schottenstein Center')&&
        document.querySelector('[data-preset=schott]')?.classList.contains('active')&&
        [...document.querySelectorAll('[data-bigten]')].every(b=>!b.classList.contains('active'));
    })()`),100);
    await evalJs("document.querySelector('[data-view=overview]').click()");
    await poll(async()=>await evalJs(`(()=>{
      const c=document.querySelector('#viewport3d');
      return document.querySelector('[data-view=overview]')?.classList.contains('current')&&
        c?.width>300&&!c.hidden&&!!c.getContext('webgl2');
    })()`));
    await delay(450);
    await ensureDrawn('Ohio State Schottenstein Center lower-bowl mesh');
    const osuOverview=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const osuImage=join(out,'studio-ohio-state-smoothed-interior.png');
    writeFileSync(osuImage,Buffer.from(osuOverview.data,'base64'));
    if(statSync(osuImage).size<18000)throw Error('OSU three-tier smoothed interior screenshot is blank');
    await evalJs("document.querySelector('[data-view=top]').click()");
    await poll(async()=>await evalJs("document.querySelector('[data-view=top]')?.classList.contains('current')"));
    await delay(250);
    const osuMap=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const osuMapImage=join(out,'studio-ohio-state-sections.png');
    writeFileSync(osuMapImage,Buffer.from(osuMap.data,'base64'));
    if(statSync(osuMapImage).size<18000)throw Error('OSU section map screenshot is blank');
    console.log('All 17 Big Ten native website interiors and OSU smoothed bowl rendered');
    console.log('Native studio: three Big Ten exterior previews and OSU preset verified');
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
