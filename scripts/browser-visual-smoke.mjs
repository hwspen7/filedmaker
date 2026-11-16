#!/usr/bin/env node
// Native Chrome DevTools Protocol acceptance: real WebGL2 context and PNG frames.
// No Playwright dependency, no external page/CDN.
import { spawn,execFileSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {makeSchoolPdf} from '../tests/fixtures/synthetic-pdf.mjs';
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
    env:{...process.env,PORT:String(port),FILEDMAKER_TEST_FIXTURES:'1'},stdio:'ignore'
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
    for(const [preset,file] of [['schott','osu'],['ohio','ohio-stadium']]){
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
      // Building and seating share one 3D overview, without an opaque roof.
      const merged=await evaluate("({tab:!!document.querySelector('[data-view=building]'),overview:document.querySelector('[data-view=overview]')?.classList.contains('current')})");
      if(merged.tab||!merged.overview)throw Error('3D overview has not replaced the Building tab');
      // Lower the camera in the SAME overview to inspect entrance buildings.
      await evaluate("(()=>{const c=document.querySelector('#viewport3d');const r=c.getBoundingClientRect();const x=r.left+r.width*.5,y=r.top+r.height*.5;const capture=c.setPointerCapture;c.setPointerCapture=()=>{};try{for(const [kind,dy] of [['pointerdown',0],['pointermove',82],['pointerup',82]])c.dispatchEvent(new PointerEvent(kind,{bubbles:true,pointerId:1,clientX:x,clientY:y+dy,buttons:kind==='pointerup'?0:1}));}finally{c.setPointerCapture=capture;}return true})()");
      await delay(650);
      const exterior=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      if(exterior.data===result.data)throw Error('Unified 3D overview orbit did not change the frame for '+file);
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
        for(const [id,rowLabel] of [['314','A2'],['323','U'],['321','U'],['322','U'],['324','U'],['325','U'],['326','U'],['327','A'],['333','U'],['334','U']]){
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
        console.log('osu-seat: human-eye WebGL2 screenshot verified');
        await evaluate("document.querySelector('[data-view=overview]').click()");
      }
    }
    // Verify the new end-to-end school workbench in a real browser.
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/workbench/'});
    await poll(async()=>await evaluate("document.documentElement.dataset.workbenchReady==='true'"),60);
    await evaluate("document.querySelector('#fixture').click()");
    const ready=await poll(async()=>{
      const state=await evaluate(
        "({count:document.querySelector('#mappedCount')?.textContent,sections:document.querySelector('#sectionCount')?.textContent,error:document.querySelector('#workStatus')?.textContent})"
      );
      return state?.count==='1,500'&&state?.sections==='4'?state:null;
    },60);
    if(ready.count!=='1,500'||ready.sections!=='4')
      throw Error('Fictional 1,500-seat fixture did not reconcile: '+JSON.stringify(ready));
    await evaluate("document.querySelector('#show3d').click()");
    const rendered=await poll(async()=>await evaluate("(()=>{const c=document.querySelector('#modelCanvas');return !c.hidden&&c.width>300&&!!c.getContext('webgl2')})()"),50);
    if(!rendered)throw Error('Workbench did not render in native WebGL2');
    await delay(850);
    const workbenchShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const workbenchImage=join(dir,'workbench-gym.png');
    writeFileSync(workbenchImage,Buffer.from(workbenchShot.data,'base64'));
    if(statSync(workbenchImage).size<14000)throw Error('Workbench screenshot is blank');
    console.log('workbench: 1,500 seats preserved, 4 independent banks, native WebGL2 verified');
    const workbook=await evaluate(`(async()=>{
      const base64=(await (await fetch('/tests/fixtures/row-workbook.base64.txt')).text()).trim();
      const bytes=Uint8Array.from(atob(base64),x=>x.charCodeAt(0));
      const f=new File([bytes],'test.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const {importRowFile}=await import('/src/workbench/imports/tabular.mjs');
      const home=await importRowFile(f,{sheetIndex:0});
      const away=await importRowFile(f,{sheetIndex:1});
      return {sheets:home.sheets,home:home.rows[0],away:away.rows[0]};
    })()`);
    if(workbook?.sheets?.length!==2||workbook.home?.seats!==18||
      workbook.away?.seats!==12||workbook.away?.section!=='AWAY')
      throw Error('Offline XLSX parsing failed in browser: '+JSON.stringify(workbook));
    const vector=await evaluate(`(async()=>{
      const {parseVectorFile,vectorToImage}=await import('/src/workbench/imports/vector.mjs');
      const xml='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">'+
        '<rect id="HOME" x="10" y="10" width="80" height="30"/>'+
        '<polygon id="AWAY" points="110,10 190,10 190,40 110,40"/></svg>';
      const d=parseVectorFile(xml,'layout.svg');
      return {names:d.contours.map(s=>s.id),png:vectorToImage(d.contours,d.width,d.height).url.startsWith('data:image/png')};
    })()`);
    if(vector?.names?.join(',')!=='HOME,AWAY'||!vector.png)
      throw Error('Safe SVG contour import failed: '+JSON.stringify(vector));
    console.log('imports: XLSX dual worksheets, SVG vector contours and raster preview verified');

    const testPdf64=Buffer.from(makeSchoolPdf()).toString('base64');
    await evaluate(`(()=>{
      window.confirm=()=>true; // Test fixture only: replace manual accept interaction.
      const bytes=Uint8Array.from(atob(${JSON.stringify(testPdf64)}),c=>c.charCodeAt(0));
      const file=new File([bytes],'fictional-school.pdf',{type:'application/pdf'});
      const transfer=new DataTransfer();transfer.items.add(file);
      const input=document.querySelector('#pdfFile');input.files=transfer.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    })()`);
    const pdfFirst=await poll(async()=>{
      const state=await evaluate(`({
        text:document.querySelector('#pdfStatus')?.textContent,
        match:document.querySelectorAll('#pdfLabels button').length,
        file:document.querySelector('#sourceName')?.textContent,
        tab:document.querySelector('#pdfPage')?.value,
        missing:document.querySelector('#reviewChecklist')?.textContent
      })`);
      return state?.match===4&&state.tab==='1'?state:null;
    },70);
    if(!pdfFirst?.file.includes('fictional-school.pdf')||
      !pdfFirst.missing.includes('Trace each row-bearing section'))
      throw Error('PDF did not enter assisted manual review: '+JSON.stringify(pdfFirst));

    // Staff-assisted workflow: after label suggestions, manually register
    // the playing surface and trace all four actual seating-bank edges.
    const traced=await evaluate(`(()=>{
      const c=document.querySelector('#planCanvas');
      const rect=c.getBoundingClientRect();
      const pageW=1160,pageH=800;
      const scale=Math.min((rect.width-64)/pageW,(rect.height-64)/pageH);
      const ox=(rect.width-pageW*scale)/2,oy=(rect.height-pageH*scale)/2;
      const click=(x,y)=>{
        const sx=ox+2*x*scale,sy=oy+2*(400-y)*scale;
        c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,
          pointerId:7,clientX:rect.left+sx,clientY:rect.top+sy}));
      };
      document.querySelector('#calibrate').click();
      for(const [x,y] of [[240,80],[290,80],[290,320],[240,320]])click(x,y);
      const banks=[
        ['WEST-1',230,60,60,160],['EAST-1',300,470,60,160],
        ['WEST-2',230,60,205,305],['EAST-2',300,470,205,305]
      ];
      for(const [name,front,back,low,high] of banks){
        document.querySelector('#newSectionId').value=name;
        document.querySelector('#trace').click();
        for(const [x,y] of [[front,high],[front,low],[back,low],[back,high]])click(x,y);
      }
      return {
        modeled:document.querySelector('#mappedCount').textContent,
        sections:document.querySelector('#sectionCount').textContent,
        checklist:document.querySelector('#reviewChecklist').textContent,
        status:document.querySelector('#workStatus').textContent
      };
    })()`);
    if(traced.modeled!=='1,500'||traced.sections!=='4'||
      !traced.checklist.includes('✓ Trace each row-bearing section'))
      throw Error('PDF + staff tracing did not generate 1,500 original seats: '+
        JSON.stringify(traced));
    await evaluate("document.querySelector('#show3d').click()");
    const pdfModel=await poll(async()=>await evaluate(
      "(()=>{const c=document.querySelector('#modelCanvas');return !c.hidden && !!c.getContext('webgl2')})()"
    ),45);
    if(!pdfModel)throw Error('Staff-traced PDF did not reach the real 3D renderer');
    await delay(300);
    const traceFrame=await client.send('Page.captureScreenshot',
      {format:'png',captureBeyondViewport:false});
    writeFileSync(join(dir,'workbench-pdf-traced-3d.png'),
      Buffer.from(traceFrame.data,'base64'));
    console.log('pdf: manual four-corner calibration + four bank traces -> exact 1,500-seat 3D model');
    await evaluate("document.querySelector('#showPlan').click()");

    await evaluate(`(()=>{
      document.querySelector('#pdfPage').value='2';
      document.querySelector('#pdfPage').dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    })()`);
    const second=await poll(async()=>{
      const state=await evaluate(`({
        status:document.querySelector('#pdfStatus')?.textContent,
        match:document.querySelectorAll('#pdfLabels button').length,
        source:document.querySelector('#sourceLedger')?.textContent,
        path:document.querySelector('#sourceName')?.textContent
      })`);
      return state?.status?.includes('PDF page 2/2')?state:null;
    },70);
    if(second.match!==0||!second.status.includes('0 selectable text items')||
       !second.source.includes('SHA-256')||!second.path.includes('page 2'))
      throw Error('Scanned/unlabeled PDF did not require manual tracing: '+JSON.stringify(second));
    const pdfFrame=await client.send('Page.captureScreenshot',
      {format:'png',captureBeyondViewport:false});
    writeFileSync(join(dir,'workbench-pdf-review.png'),Buffer.from(pdfFrame.data,'base64'));
    console.log('pdf: real local two-page PDF parsed, four row-label hints found, zero-text page required manual tracing');

    // New GPT-style case library: actual browse, category filter, and search.
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/cases/'});
    const library=await poll(async()=>await evaluate(
      "({cards:document.querySelectorAll('#caseGrid .case-card').length,count:document.querySelector('#caseCount')?.textContent})"
    ),50);
    if(library.cards!==10||library.count!=='10')
      throw Error('New case library does not show all ten cases: '+JSON.stringify(library));
    await delay(260);
    const gallery=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(dir,'case-library.png'),Buffer.from(gallery.data,'base64'));
    const filtered=await evaluate("(()=>{document.querySelector('[data-filter=\"schools\"]').click();return document.querySelectorAll('#caseGrid .case-card').length})()");
    if(filtered!==6)throw Error('Real-school filter should show 6 schools, got '+filtered);
    const searched=await evaluate("(()=>{const input=document.querySelector('#searchCases');input.value='aiken';input.dispatchEvent(new Event('input',{bubbles:true}));return document.querySelectorAll('#caseGrid .case-card').length})()");
    if(searched!==1)throw Error('Case search failed for Aiken');
    const accurate=await evaluate("document.querySelector('#caseGrid .case-card')?.textContent.includes('assumed rows')");
    if(!accurate)throw Error('Aiken catalog card lost estimation disclaimer');
    console.log('cases: ten cases listed, six real-school filters, search, evidence labels verified');

    // Real school Aiken: launch a *provisional* interactive model from the case library.
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/workbench/?example=aiken'});
    const aiken=await poll(async()=>await evaluate(
      "({ready:document.documentElement.dataset.workbenchReady,count:document.querySelector('#mappedCount')?.textContent,sections:document.querySelector('#sectionCount')?.textContent,stage:document.documentElement.dataset.activeStage,context:document.querySelector('#caseContextText')?.textContent,qa:document.querySelector('#qa')?.textContent})"
    ),70);
    if(aiken.count!=='1,418'||aiken.sections!=='4'||aiken.stage!=='model'||
       !aiken.context.includes('assumed')||!aiken.qa.includes('PROJECT NOTE'))
      throw Error('Aiken unverified 3D example lost its data and disclaimer: '+JSON.stringify(aiken));
    const aiken3d=await poll(async()=>await evaluate(
      "(()=>{const c=document.querySelector('#modelCanvas');return !c.hidden&&c.width>200&&!!c.getContext('webgl2')})()"
    ),50);
    if(!aiken3d)throw Error('Aiken example failed to open a genuine WebGL model');
    await delay(500);
    const aikenShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(dir,'case-aiken-estimated-3d.png'),Buffer.from(aikenShot.data,'base64'));
    const navigation=await evaluate("(()=>{document.querySelector('[data-open-stage=\"review\"]').click();const a=document.documentElement.dataset.activeStage;const b=document.querySelector('[data-stage-panel=\"review\"]').hidden;document.querySelector('[data-open-stage=\"source\"]').click();return {a,b,source:!document.querySelector('[data-stage-panel=\"source\"]').hidden}})()");
    if(navigation.a!=='review'||navigation.b||!navigation.source)
      throw Error('Four-step workbench navigation is broken: '+JSON.stringify(navigation));

    // Real source-only case should never manufacture a model.
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/workbench/?case=wills-point'});
    const sourceCase=await poll(async()=>await evaluate(
      "({ready:document.documentElement.dataset.workbenchReady,text:document.querySelector('#caseContextText')?.textContent,source:document.querySelector('#caseContextSource')?.href,seats:document.querySelector('#mappedCount')?.textContent,stage:document.documentElement.dataset.activeStage})"
    ),50);
    if(!sourceCase.text.includes('no complete seat inventory')||sourceCase.seats!=='0'||
       sourceCase.stage!=='source'||!sourceCase.source.includes('wills-point'))
      throw Error('Source-only case has invented geometry: '+JSON.stringify(sourceCase));
    await delay(200);
    const noSeats=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(dir,'case-real-source-review.png'),Buffer.from(noSeats.data,'base64'));

    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/workbench/?example=fictional'});
    const synthetic=await poll(async()=>await evaluate(
      "({count:document.querySelector('#mappedCount')?.textContent,stage:document.documentElement.dataset.activeStage})"
    ),60);
    if(synthetic.count!=='1,500'||synthetic.stage!=='model')
      throw Error('Fictional demo deep link is not interactive: '+JSON.stringify(synthetic));
    console.log('workbench UI: four-stage navigation and Aiken/fictional/source-only case deep links verified');



  } finally {
    client?.close();chrome.kill('SIGKILL');server.kill('SIGTERM');
    rmSync(work,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
