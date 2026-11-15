#!/usr/bin/env node
// Native Chrome DevTools Protocol acceptance: real WebGL2 context and PNG frames.
// No Playwright dependency, no external page/CDN.
import { spawn,execFileSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const port=5189,debugPort=9238;
function findChrome(){
  if(process.env.CHROME_BIN)return process.env.CHROME_BIN;
  for(const bin of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{return execFileSync('which',[bin],{encoding:'utf8'}).trim();}catch{}
  }
  throw Error('Chrome/Chromium executable missing');
}
async function poll(fn,attempts=35){
  let last;
  for(let i=0;i<attempts;i++){
    try{const value=await fn();if(value)return value;}catch(e){last=e;}
    await delay(600);
  }
  throw last??Error('Timed out waiting for browser state');
}
function devtools(url){
  const socket=new WebSocket(url),pending=new Map();let id=0;
  const ready=new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{
    const msg=JSON.parse(event.data);if(!msg.id)return;
    const task=pending.get(msg.id);if(!task)return;pending.delete(msg.id);
    msg.error?task.reject(Error(JSON.stringify(msg.error))):task.resolve(msg.result);
  });
  const send=async(method,params={})=>{
    await ready;const key=++id;
    return await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{pending.delete(key);reject(Error('Browser command timed out: '+method));},30000);
      pending.set(key,{resolve:data=>{clearTimeout(timeout);resolve(data);},reject:e=>{clearTimeout(timeout);reject(e);}});
      socket.send(JSON.stringify({id:key,method,params}));
    });
  };
  return {send,close:()=>socket.close()};
}
async function main(){
  const work=mkdtempSync(join(tmpdir(),'filedmaker-chrome-'));
  const dir=resolve(process.env.VISUAL_OUTPUT??'artifacts/visual');
  mkdirSync(dir,{recursive:true});
  const server=spawn(process.execPath,['scripts/server.mjs'],{
    env:{...process.env,PORT:String(port)},stdio:'ignore'
  });
  const chrome=spawn(findChrome(),[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
    '--disable-gpu-sandbox','--disable-features=Vulkan','--hide-scrollbars',
    '--window-size=1366,920','--remote-debugging-port='+debugPort,
    '--user-data-dir='+work,'about:blank'
  ],{stdio:'ignore'});
  let client;
  try{
    await poll(async()=>{const r=await fetch('http://127.0.0.1:'+port+'/');return r.ok;});
    const pages=await poll(async()=>{
      const r=await fetch('http://127.0.0.1:'+debugPort+'/json');
      const data=await r.json();return data.find(p=>p.type==='page'&&p.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
    });
    client=devtools(pages);
    await client.send('Page.enable');await client.send('Runtime.enable');
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/'});
    const evaluate=async expression=>{
      const reply=await client.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(reply.exceptionDetails)throw Error('Browser exception: '+JSON.stringify(reply.exceptionDetails));
      return reply.result?.value;
    };
    for(const [preset,file] of [['schott','osu'],['procedural','arena'],['procedural-football','stadium']]){
      if(preset!=='schott')await evaluate("document.querySelector('[data-preset="+preset+"]')?.click()");
      const state=await poll(async()=>{
        const value=await evaluate("({loaded:document.querySelector('#loading')?.hidden,shown:document.querySelector('#visualCount')?.textContent,canvas:document.querySelector('#viewport3d')?.width,webgl:!!document.querySelector('#viewport3d')?.getContext('webgl2'),warning:document.querySelector('#warnings')?.textContent})");
        return value?.loaded && Number(value.shown.replace(/,/g,''))>0 ? value : null;
      },60);
      if(!state.webgl||state.canvas<100)throw Error('WebGL2 not rendered for '+preset+': '+JSON.stringify(state));
      if(/validation failed/i.test(state.warning))throw Error('Geometry QA failed: '+state.warning);
      await delay(1200);
      const result=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const target=join(dir,file+'.png');writeFileSync(target,Buffer.from(result.data,'base64'));
      if(statSync(target).size<12000)throw Error('Screenshot is suspiciously small: '+target);
      console.log(file+': WebGL2 OK; '+state.shown+' estimated seats; PNG '+statSync(target).size+' bytes');
      await evaluate("document.querySelector('[data-view=building]').click()");
      const building=await evaluate("document.querySelector('[data-view=building]').classList.contains('current')");
      if(!building)throw Error('Building view did not open for '+file);
      await delay(650);
      const exterior=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      if(exterior.data===result.data)throw Error('Building view did not change the frame for '+file);
      writeFileSync(join(dir,file+'-building.png'),Buffer.from(exterior.data,'base64'));
      await evaluate("document.querySelector('[data-view=overview]').click()");
      if(file==='osu'){
        // Orbit close to vertical to expose inward pinching in the plan.
        await evaluate("(()=>{const c=document.querySelector('#viewport3d');const r=c.getBoundingClientRect();const x=r.left+r.width*.50,y=r.top+r.height*.50;const capture=c.setPointerCapture;c.setPointerCapture=()=>{};try{for(const [kind,dy] of [['pointerdown',0],['pointermove',-142],['pointerup',-142]])c.dispatchEvent(new PointerEvent(kind,{bubbles:true,pointerId:1,clientX:x,clientY:y+dy,buttons:kind==='pointerup'?0:1}));}finally{c.setPointerCapture=capture;}})()");
        await delay(650);
        const overhead=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        if(overhead.data===result.data)throw Error('The overhead orbit did not change the frame');
        writeFileSync(join(dir,'osu-overhead.png'),Buffer.from(overhead.data,'base64'));
        await evaluate("document.querySelector('[data-view=overview]').click()");

        // Capture a separate architectural elevation to inspect the depth of
        // the rear gallery and external façade, not merely the overhead plan.
        await evaluate("(()=>{const c=document.querySelector('#viewport3d');const r=c.getBoundingClientRect();const x=r.left+r.width*.5,y=r.top+r.height*.5;const capture=c.setPointerCapture;c.setPointerCapture=()=>{};try{for(const [kind,dy] of [['pointerdown',0],['pointermove',34],['pointerup',34]])c.dispatchEvent(new PointerEvent(kind,{bubbles:true,pointerId:1,clientX:x,clientY:y+dy,buttons:kind==='pointerup'?0:1}));}finally{c.setPointerCapture=capture;}return true})()");
        await delay(650);
        const facadeImage=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        if(facadeImage.data===result.data)throw Error('Architecture camera test produced an identical frame');
        const facadePath=join(dir,'osu-facade.png');
        writeFileSync(facadePath,Buffer.from(facadeImage.data,'base64'));
        if(statSync(facadePath).size<12000)throw Error('OSU façade screenshot missing');
        await evaluate("document.querySelector('[data-view=overview]').click()");
        const markers=await evaluate("document.querySelectorAll('.area-label.exit').length");
        if(markers!==0)throw Error('Removed EXIT overlays unexpectedly returned');
        const selected=await evaluate("(()=>{const select=document.querySelector('#sectionPicker');if(!select)return false;const pick=[...select.options].find(o=>o.value==='323')||[...select.options].find(o=>o.value);if(!pick)return false;select.value=pick.value;select.dispatchEvent(new Event('change',{bubbles:true}));return !document.querySelector('[data-view=human]').disabled})()");
        if(!selected)throw Error('Cannot select an OSU spectator seat for interior acceptance');
        await evaluate("document.querySelector('[data-view=section]').click()");
        const section=await poll(async()=>await evaluate("document.querySelector('[data-view=section]')?.classList.contains('current')"),30);
        if(!section)throw Error('OSU 3D section close-up did not open');
        await delay(750);
        const sectionShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        const sectionPath=join(dir,'osu-section.png');writeFileSync(sectionPath,Buffer.from(sectionShot.data,'base64'));
        if(statSync(sectionPath).size<12000)throw Error('OSU 3D section screenshot is empty');
        await evaluate("document.querySelector('[data-view=human]').click()");
        const interior=await poll(async()=>await evaluate("document.querySelector('[data-view=human]')?.classList.contains('current')"),30);
        if(!interior)throw Error('OSU interior seat view did not open');
        await delay(850);
        const frame=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        const closeup=join(dir,'osu-seat.png');writeFileSync(closeup,Buffer.from(frame.data,'base64'));
        if(statSync(closeup).size<12000)throw Error('OSU seat-view screenshot is empty');
        const upperRow=await evaluate(`(()=>{
          const section=document.querySelector('#sectionPicker');
          section.value='305';
          section.dispatchEvent(new Event('change',{bubbles:true}));
          const row=document.querySelector('#rowPicker');
          row.value='U';
          row.dispatchEvent(new Event('change',{bubbles:true}));
          return row.value==='U'&&document.querySelector('#seatDetails').textContent.includes('305 · Row U');
        })()`);
        if(!upperRow)throw Error('The upper-row roof check could not select section 305, row U');
        await evaluate(`(()=>{
          const canvas=document.querySelector('#viewport3d');
          const {left,top,width,height}=canvas.getBoundingClientRect();
          const capture=canvas.setPointerCapture;
          canvas.setPointerCapture=()=>{};
          try{
            for(const [type,dy] of [['pointerdown',0],['pointermove',245],['pointerup',245]]){
              canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,
                clientX:left+width/2,clientY:top+height/2+dy,buttons:type==='pointerup'?0:1}));
            }
          }finally{canvas.setPointerCapture=capture;}
        })()`);
        await delay(650);
        const roofFrame=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        if(roofFrame.data===frame.data)throw Error('The upper-row roof check did not change the frame');
        writeFileSync(join(dir,'osu-upper-roof.png'),Buffer.from(roofFrame.data,'base64'));
        for(const [id,rowLabel] of [['314','A2'],['323','B2'],['321','Q'],['327','A']]){
          await evaluate(`(()=>{
            const section=document.querySelector('#sectionPicker');
            section.value='${id}';
            section.dispatchEvent(new Event('change',{bubbles:true}));
            const row=document.querySelector('#rowPicker');
            row.value='${rowLabel}';
            row.dispatchEvent(new Event('change',{bubbles:true}));
            document.querySelector('[data-view=section]').click();
          })()`);
          const focused=await evaluate(`document.querySelector('#seatDetails').textContent.includes('${id} · Row ${rowLabel}')`);
          if(!focused)throw Error('Could not focus the refined rear row in '+id);
          await delay(450);
          const frame=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
          writeFileSync(join(dir,'osu-refined-'+id+'.png'),Buffer.from(frame.data,'base64'));
        }
        for(const [sectionId,file] of [['317','corner-terrace'],['310','opposite-terrace']]){
          await evaluate(`(()=>{
            const section=document.querySelector('#sectionPicker');
            section.value='${sectionId}';
            section.dispatchEvent(new Event('change',{bubbles:true}));
            const row=document.querySelector('#rowPicker');
            row.value='U';
            row.dispatchEvent(new Event('change',{bubbles:true}));
            document.querySelector('[data-view=section]').click();
            const canvas=document.querySelector('#viewport3d');
            const {left,top,width,height}=canvas.getBoundingClientRect();
            const capture=canvas.setPointerCapture;
            canvas.setPointerCapture=()=>{};
            try{
              for(const [type,dx,dy] of [['pointerdown',0,0],['pointermove',-540,48],['pointerup',-540,48]]){
                canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,
                  clientX:left+width/2+dx,clientY:top+height/2+dy,buttons:type==='pointerup'?0:1}));
              }
            }finally{canvas.setPointerCapture=capture;}
          })()`);
          const focused=await evaluate(`document.querySelector('#seatDetails').textContent.includes('${sectionId} · Row U')`);
          if(!focused)throw Error('Could not focus the upper terrace for section '+sectionId);
          await delay(650);
          const corner=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
          writeFileSync(join(dir,'osu-'+file+'.png'),Buffer.from(corner.data,'base64'));
        }
        console.log('osu-seat: human-eye WebGL2 screenshot verified');
        await evaluate("document.querySelector('[data-view=overview]').click()");
      }
    }
    await evaluate("document.querySelector('#generateName').value='Custom QA Soccer Stadium';document.querySelector('#generateSurface').value='soccer';document.querySelector('#generateSections').value='22';document.querySelector('#generateLowerRows').value='13';document.querySelector('#generateUpperRows').value='18';document.querySelector('#generateCapacity').value='16500';document.querySelector('#generateVenue').click()");
    const custom=await poll(async()=>{
      const state=await evaluate("({name:document.querySelector('#title')?.textContent,loaded:document.querySelector('#loading')?.hidden,seats:document.querySelector('#visualCount')?.textContent,webgl:!!document.querySelector('#viewport3d')?.getContext('webgl2'),warning:document.querySelector('#warnings')?.textContent})");
      return state?.name==='Custom QA Soccer Stadium' && state.loaded && Number(state.seats.replace(/,/g,''))>0 ? state:null;
    },60);
    if(!custom.webgl||/validation failed/i.test(custom.warning))throw Error('Custom venue form did not render correctly: '+JSON.stringify(custom));
    await delay(1100);
    const screenshot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const name=join(dir,'custom.png');writeFileSync(name,Buffer.from(screenshot.data,'base64'));
    if(statSync(name).size<12000)throw Error('Custom screenshot is blank');
    console.log('custom: WebGL2 OK; '+custom.seats+' estimated seats');
  } finally {
    client?.close();chrome.kill('SIGKILL');server.kill('SIGTERM');
    rmSync(work,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
