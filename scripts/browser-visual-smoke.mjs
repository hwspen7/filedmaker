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
    }
  } finally {
    client?.close();chrome.kill('SIGKILL');server.kill('SIGTERM');
    rmSync(work,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
