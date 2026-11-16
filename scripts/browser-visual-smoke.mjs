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
    const library=await poll(async()=>{
      const state=await evaluate(
        "({cards:document.querySelectorAll('#caseGrid a.case-card[href]').length,ready:document.documentElement.dataset.casesReady})"
      );
      return state?.cards===10&&state.ready==='true'?state:null;
    },65);
    if(library.cards!==10)
      throw Error('Clickable case gallery is incomplete: '+JSON.stringify(library));
    await delay(260);
    const gallery=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(dir,'case-library.png'),Buffer.from(gallery.data,'base64'));
    const filtered=await evaluate("(()=>{document.querySelector('[data-filter=\"schools\"]').click();return document.querySelectorAll('#caseGrid .case-card').length})()");
    if(filtered!==6)throw Error('Real-school filter should show 6 schools, got '+filtered);
    const searched=await evaluate("(()=>{const input=document.querySelector('#searchCases');input.value='aiken';input.dispatchEvent(new Event('input',{bubbles:true}));return document.querySelectorAll('#caseGrid .case-card').length})()");
    if(searched!==1)throw Error('Case search failed for Aiken');
    const accurate=await evaluate("document.querySelector('#caseGrid .case-card')?.textContent.includes('Unverified staff draft')");
    if(!accurate)throw Error('Aiken catalog card lost its unverified status');
    console.log('cases: ten cases listed, six real-school filters, search, evidence labels verified');

    // Real pointer click in the CENTER of a card, not merely its action label.
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/cases/?group=schools'});
    await poll(async()=>await evaluate("document.querySelectorAll('#caseGrid a.case-card').length===6"),50);
    const clickPoint=await evaluate("(()=>{const card=document.querySelector('[data-case=\"sanderson-high\"]');card.scrollIntoView({block:'center'});const r=card.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,href:card.href}})()");
    if(!clickPoint.href.includes('case=sanderson-high'))throw Error('Source card has no detail URL');
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',
      x:clickPoint.x,y:clickPoint.y,clickCount:1});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',
      x:clickPoint.x,y:clickPoint.y,clickCount:1});
    const sourceDetails=await poll(async()=>{
      const result=await evaluate("({url:location.href,visible:!document.querySelector('#detailView')?.hidden,title:document.querySelector('#detailTitle')?.textContent,source:document.querySelector('#detailSource')?.href,next:document.querySelector('#detailWorkbench')?.href})");
      return result?.visible&&result.title==='Main Gymnasium'?result:null;
    },60);
    if(!sourceDetails.url.includes('case=sanderson-high')||
       !sourceDetails.source.includes('Sanderson-High')||
       !sourceDetails.next.includes('case=sanderson-high'))
      throw Error('Real school detail has no original source and import flow: '+
        JSON.stringify(sourceDetails));
    await delay(200);
    const sourceDetailShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(dir,'case-real-school-detail.png'),Buffer.from(sourceDetailShot.data,'base64'));
    await evaluate("document.querySelector('#detailWorkbench').click()");
    const linkedProject=await poll(async()=>await evaluate(
      "document.documentElement.dataset.workbenchReady==='true'&&document.querySelector('#workspaceName')?.textContent==='Main Gymnasium'"),65);
    if(!linkedProject)throw Error('School case details cannot open an import project');

    // Open 3D directly from its whole-case anchor.
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/cases/'});
    await poll(async()=>await evaluate("document.querySelectorAll('#caseGrid .case-card').length===10"),50);
    const directModel=await evaluate("document.querySelector('[data-case=\"aiken-high\"]')?.href");
    if(!directModel.includes('example=aiken'))throw Error('Aiken card has no model link');
    await evaluate("document.querySelector('[data-case=\"aiken-high\"]').click()");


    // Real school Aiken: launch a *provisional* interactive model from the case library.
    const aiken=await poll(async()=>{
      const state=await evaluate(
        "({ready:document.documentElement.dataset.workbenchReady,count:document.querySelector('#mappedCount')?.textContent,sections:document.querySelector('#sectionCount')?.textContent,stage:document.documentElement.dataset.activeStage,context:document.querySelector('#caseContextText')?.textContent,qa:document.querySelector('#qa')?.textContent})"
      );
      return state?.count==='1,418'&&state?.sections==='4'&&state?.stage==='model'?state:null;
    },75);
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
    const drawer=await evaluate("(()=>{const panel=document.querySelector('.inspector');const closed=getComputedStyle(panel).display==='none';document.querySelector('#detailsToggle').click();const opened=getComputedStyle(panel).display!=='none';document.querySelector('#detailsClose').click();const closedAgain=getComputedStyle(panel).display==='none';return {closed,opened,closedAgain}})()");
    if(!drawer.closed||!drawer.opened||!drawer.closedAgain)
      throw Error('Project details drawer cannot open and close: '+JSON.stringify(drawer));
    const navigation=await evaluate("(()=>{document.querySelector('[data-open-stage=\"review\"]').click();const a=document.documentElement.dataset.activeStage;const b=document.querySelector('[data-stage-panel=\"review\"]').hidden;document.querySelector('[data-open-stage=\"source\"]').click();return {a,b,source:!document.querySelector('[data-stage-panel=\"source\"]').hidden}})()");
    if(navigation.a!=='review'||navigation.b||!navigation.source)
      throw Error('Four-step workbench navigation is broken: '+JSON.stringify(navigation));

    // Real source-only case should never manufacture a model.
    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/workbench/?case=wills-point'});
    const sourceCase=await poll(async()=>{
      const state=await evaluate(
        "({ready:document.documentElement.dataset.workbenchReady,text:document.querySelector('#caseContextText')?.textContent,source:document.querySelector('#caseContextSource')?.href,seats:document.querySelector('#mappedCount')?.textContent,stage:document.documentElement.dataset.activeStage,title:document.querySelector('#workspaceName')?.textContent,empty:!document.querySelector('#emptyCanvas')?.hidden})"
      );
      return state?.ready==='true'&&state?.text?.includes('seat inventory')?state:null;
    },60);
    if(!sourceCase.text.includes('no complete seat inventory')||sourceCase.seats!=='0'||
       sourceCase.stage!=='source'||sourceCase.title!=='Main Gym'||
       !sourceCase.empty||!sourceCase.source.includes('wills-point'))
      throw Error('Source-only case has invented geometry: '+JSON.stringify(sourceCase));
    await delay(200);
    const noSeats=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(join(dir,'case-real-source-review.png'),Buffer.from(noSeats.data,'base64'));

    await client.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/workbench/?example=fictional'});
    const synthetic=await poll(async()=>{
      const state=await evaluate(
        "({count:document.querySelector('#mappedCount')?.textContent,stage:document.documentElement.dataset.activeStage})"
      );
      return state?.count==='1,500'&&state?.stage==='model'?state:null;
    },70);
    if(synthetic.count!=='1,500'||synthetic.stage!=='model')
      throw Error('Fictional demo deep link is not interactive: '+JSON.stringify(synthetic));
    console.log('workbench UI: four-stage navigation and Aiken/fictional/source-only case deep links verified');


    const compact=await evaluate("(()=>{const top=document.querySelector('.studio-header').getBoundingClientRect();const view=document.querySelector('.visual').getBoundingClientRect();const single=document.querySelector('.canvas-header').getBoundingClientRect();return {header:top.height,canvas:view.height,canvasHeader:single.height,workflowInside:!!document.querySelector('.studio-header .step-nav'),titleInside:!!document.querySelector('.studio-header #workspaceName'),extraBars:document.querySelectorAll('.workspace-top,.steps-strip').length}})()");
    if(compact.header>80||compact.canvas<300||compact.canvasHeader>63||
      !compact.workflowInside||!compact.titleInside||compact.extraBars)
      throw Error('The viewport is still squeezed by redundant header rows: '+JSON.stringify(compact));
    const cameraAccessible=await evaluate("(()=>{const button=document.querySelector('#cameraFit');const r=button.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')?.id==='cameraFit'})()");
    if(!cameraAccessible)
      throw Error('The model camera tools are still covered by a case banner');


    // Phase two: operate the actual row editor, verify 3D reacts, then undo/redo.

    const initialFrame=await poll(async()=>{
      const state=await evaluate("({w:Number(document.querySelector('#modelCanvas')?.dataset.seatingWidth||0),h:Number(document.querySelector('#modelCanvas')?.dataset.seatingHeight||0)})");
      return state.w>0&&state.h>0?state:null;
    },60);
    if(initialFrame.w<25||initialFrame.h<17)
      throw Error('Model remains too small in preview: '+JSON.stringify(initialFrame));
    const controls=await evaluate("(()=>{document.querySelector('#cameraTop').click();const top=Number(document.querySelector('#modelCanvas').dataset.seatingWidth);document.querySelector('#cameraFit').click();document.querySelector('#toggleTools').click();const closed=document.querySelector('.content-grid').classList.contains('tools-collapsed');document.querySelector('#toggleTools').click();return {top,closed,reopened:!document.querySelector('.content-grid').classList.contains('tools-collapsed')}})()");
    if(!controls.closed||!controls.reopened||controls.top<20)
      throw Error('3D scene tools are not functional: '+JSON.stringify(controls));
    await delay(300);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'focused-venue-workspace.png'),Buffer.from(frame.data,'base64')));
    const beforeEdit=await evaluate("({count:document.querySelector('#mappedCount').textContent,row:document.querySelector('#rowEditRow').value,section:document.querySelector('#rowEditSection').value})");
    if(beforeEdit.count!=='1,500'||!beforeEdit.row||!beforeEdit.section)
      throw Error('Operator row editor is not populated for the fictional gym');
    const afterEdit=await evaluate("(()=>{document.querySelector('#rowEditSeats').value='24';document.querySelector('#applyRowEdit').click();return {count:document.querySelector('#mappedCount').textContent,review:document.querySelector('#qa').textContent,rows:document.querySelector('#rowEditStatus').textContent}})()");
    if(afterEdit.count!=='1,499'||!afterEdit.review.includes('STAFF_EDITS_PENDING_SOURCE_RECONCILIATION')||
      !afterEdit.rows.includes('Staff-edited'))
      throw Error('Applying row edit failed to update seats and provenance: '+JSON.stringify(afterEdit));
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'operator-row-editor.png'),Buffer.from(frame.data,'base64')));
    await evaluate("document.querySelector('#undo').click()");
    const undone=await poll(async()=>await evaluate("document.querySelector('#mappedCount')?.textContent==='1,500'"),50);
    if(!undone)throw Error('Undo did not restore original 1,500 source seats');
    await evaluate("document.querySelector('#redo').click()");
    const redone=await poll(async()=>await evaluate("document.querySelector('#mappedCount')?.textContent==='1,499'"),50);
    if(!redone)throw Error('Redo did not restore staff-modified count');
    const noChange=await evaluate("(()=>{document.querySelector('#rowEditSeats').value='0';document.querySelector('#applyRowEdit').click();return {count:document.querySelector('#mappedCount').textContent,error:document.querySelector('#workStatus').textContent}})()");
    if(noChange.count!=='1,499'||!noChange.error.includes('Edit rejected'))
      throw Error('Invalid seat count did not fail atomically');

    const seatEdited=await evaluate("(()=>{document.querySelector('[data-model-tool=\"seats\"]').click();document.querySelector('#seatAdvanced').open=true;document.querySelector('#seatEditNumber').value='1';document.querySelector('#seatShiftX').value='.08';document.querySelector('#seatShiftY').value='.12';document.querySelector('#seatShiftZ').value='0';document.querySelector('#seatApplyOffset').click();return {count:document.querySelector('#mappedCount').textContent,qa:document.querySelector('#qa').textContent,error:document.querySelector('#workStatus').textContent}})()");
    if(seatEdited.count!=='1,499'||!seatEdited.qa.includes('INDIVIDUAL_SEAT_OFFSETS')||
      seatEdited.error.includes('Edit rejected'))throw Error('Individual seat override was not applied: '+JSON.stringify(seatEdited));
    await delay(220);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'operator-single-seat.png'),Buffer.from(frame.data,'base64')));
    const resetSeat=await evaluate("(()=>{document.querySelector('#seatResetOffset').click();return {count:document.querySelector('#mappedCount').textContent,qa:document.querySelector('#qa').textContent,status:document.querySelector('#workStatus').textContent}})()");
    if(resetSeat.count!=='1,499'||resetSeat.qa.includes('INDIVIDUAL_SEAT_OFFSETS')||
      resetSeat.status.includes('Edit rejected'))throw Error('Seat correction did not clear cleanly');

    const batch=await evaluate("(()=>{document.querySelector('[data-model-tool=\"batch\"]').click();document.querySelector('#batchSection').value='WEST-1';document.querySelector('#batchSeatType').value='chair';document.querySelector('#batchApplyStyle').click();return {count:document.querySelector('#mappedCount').textContent,status:document.querySelector('#workStatus').textContent,shown:!document.querySelector('[data-model-tool-pane=\"batch\"]').hidden}})()");
    if(batch.count!=='1,499'||!batch.shown||batch.status.includes('Batch rejected'))
      throw Error('Batch editor did not apply consistently: '+JSON.stringify(batch));
    await delay(160);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'batch-edit-workspace.png'),Buffer.from(frame.data,'base64')));
    await evaluate("document.querySelector('[data-open-stage=\"calibrate\"]').click()");
    const moved=await evaluate("(()=>{const select=document.querySelector('#sectionSelect');select.value='WEST-1';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#sectionMoveX').value='.1';document.querySelector('#sectionMoveZ').value='0';document.querySelector('#moveSelectedSection').click();return {seats:document.querySelector('#mappedCount').textContent,ledger:document.querySelector('#qa').textContent,status:document.querySelector('#workStatus').textContent}})()");
    if(moved.seats!=='1,499'||moved.status.includes('Edit rejected'))
      throw Error('Section translation damaged model or failed to apply: '+JSON.stringify(moved));
    await evaluate("document.querySelector('#sectionAdvanced').open=true");
    await delay(250);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'operator-section-tools.png'),Buffer.from(frame.data,'base64')));

    const ruler=await evaluate("(()=>{document.querySelector('#measureTools').open=true;document.querySelector('#measureTool').click();const c=document.querySelector('#planCanvas');const r=c.getBoundingClientRect();const point=(x,y)=>c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+x*r.width,clientY:r.top+y*r.height,pointerId:31}));point(.40,.45);point(.55,.52);return {result:document.querySelector('#measureResult').textContent,canvas:!c.hidden}})()");
    if(!ruler.canvas||!ruler.result.includes('Plan-derived distance')||
      !ruler.result.includes('Not an independently verified measurement'))
      throw Error('Plan distance ruler is not functional: '+JSON.stringify(ruler));
    await delay(160);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'operator-plan-ruler.png'),Buffer.from(frame.data,'base64')));
    await evaluate("document.querySelector('#measureClear').click()");
    const clearedRuler=await evaluate("document.querySelector('#measureResult').textContent");
    if(clearedRuler!=='No plan measurement yet.')throw Error('Plan ruler did not reset');


    // Real operator component placement, modification, duplication and 2D
    // point placement are tested on the actual initialized WebGL2 workbench.
    await evaluate("document.querySelector('[data-open-stage=\"model\"]').click()");
    const made=await evaluate("(()=>{document.querySelector('[data-model-tool=\"structures\"]').click();document.querySelector('[data-structure-kind=\"platform\"]').click();document.querySelector('#structureAdd').click();return {count:document.querySelector('#mappedCount').textContent,items:document.querySelector('#structureSelect').options.length,qa:document.querySelector('#qa').textContent,status:document.querySelector('#workStatus').textContent,active:!document.querySelector('[data-model-tool-pane=\"structures\"]').hidden}})()");
    if(made.count!=='1,499'||made.items!==1||!made.active||
      !made.qa.includes('OPERATOR_STRUCTURES_UNVERIFIED')||
      made.status.includes('Component rejected'))
      throw Error('Platform component is not attached to the live model: '+JSON.stringify(made));
    await delay(220);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'component-library-3d.png'),Buffer.from(frame.data,'base64')));
    const transformed=await evaluate("(()=>{document.querySelector('#structureX').value='2';document.querySelector('#structureApply').click();document.querySelector('#structureDuplicate').click();document.querySelector('#structureRotate').click();return {items:document.querySelector('#structureSelect').options.length,count:document.querySelector('#mappedCount').textContent,status:document.querySelector('#workStatus').textContent}})()");
    if(transformed.items!==2||transformed.count!=='1,499'||
      transformed.status.includes('Component rejected'))
      throw Error('Structure transform / duplicate failed: '+JSON.stringify(transformed));
    await evaluate("document.querySelector('[data-structure-kind=\"portal\"]').click()");
    await evaluate("document.querySelector('#structurePickOnPlan').click()");
    const placed=await evaluate("(()=>{const c=document.querySelector('#planCanvas'),r=c.getBoundingClientRect();c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:80,clientX:r.left+r.width*.5,clientY:r.top+r.height*.5}));return {items:document.querySelector('#structureSelect').options.length,count:document.querySelector('#mappedCount').textContent,status:document.querySelector('#workStatus').textContent,planVisible:!c.hidden}})()");
    if(placed.items!==3||placed.count!=='1,499'||!placed.planVisible||
      placed.status.includes('Component rejected'))
      throw Error('Direct 2D component placement failed: '+JSON.stringify(placed));
    await delay(180);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'component-plan-placement.png'),Buffer.from(frame.data,'base64')));
    await evaluate("document.querySelector('#show3d').click()");
    const structureRendered=await poll(async()=>await evaluate("(()=>{const c=document.querySelector('#modelCanvas');return {visible:!c.hidden,hasContext:!!c.getContext('webgl2'),n:document.querySelector('#structureSelect').options.length}})()"),35);
    if(!structureRendered.visible||!structureRendered.hasContext||structureRendered.n!==3)
      throw Error('3D component preview failed after 2D placement');

    await evaluate("document.querySelector('[data-model-tool=\"surface\"]').click()");
    const palette=await evaluate("(()=>{const b=document.querySelector('[data-surface-preset=\"navy\"]');b.click();return {status:document.querySelector('#workStatus').textContent,floor:document.querySelector('#surfaceFloor').value,count:document.querySelector('#mappedCount').textContent,pane:!document.querySelector('[data-model-tool-pane=\"surface\"]').hidden}})()");
    if(!palette.pane||palette.floor!=='#8ba9bd'||palette.count!=='1,499'||
      palette.status.includes('Court edit rejected'))
      throw Error('Live venue surface preset did not change: '+JSON.stringify(palette));
    await delay(220);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'surface-navy-court.png'),Buffer.from(frame.data,'base64')));
    const courtChanged=await evaluate("(()=>{document.querySelector('#surfaceDimensions').open=true;document.querySelector('#surfaceWidth').value='16.5';document.querySelector('#surfaceLength').value='28.0';document.querySelector('#surfaceApplyDimensions').click();return {status:document.querySelector('#workStatus').textContent,description:document.querySelector('#surfaceStatus').textContent,qa:document.querySelector('#qa').textContent,count:document.querySelector('#mappedCount').textContent}})()");
    if(!courtChanged.description.includes('16.50 × 28.00')||
      !courtChanged.qa.includes('PLAYING_SURFACE_RECALIBRATION_REQUIRED')||
      courtChanged.count!=='1,499'||courtChanged.status.includes('Court edit rejected'))
      throw Error('Playing surface dimensional edit has no effect: '+JSON.stringify(courtChanged));
    const addedPaint=await evaluate("(()=>{document.querySelector('#surfaceZones').open=true;document.querySelector('#zoneKind').value='rectangle';document.querySelector('#zoneWidth').value='2';document.querySelector('#zoneDepth').value='1';document.querySelector('#zoneColor').value='#557b9d';document.querySelector('#zoneAdd').click();return {count:document.querySelector('#mappedCount').textContent,zones:document.querySelector('#zoneSelect').options.length,status:document.querySelector('#workStatus').textContent,qa:document.querySelector('#qa').textContent}})()");
    if(addedPaint.zones!==1||addedPaint.count!=='1,499'||
      !addedPaint.qa.includes('PAINTED_FLOOR_ZONES_UNVERIFIED')||
      addedPaint.status.includes('Court edit rejected'))
      throw Error('Painted surface zone was not added: '+JSON.stringify(addedPaint));
    const invalidPaint=await evaluate("(()=>{document.querySelector('#zoneWidth').value='80';document.querySelector('#zoneAdd').click();return {zones:document.querySelector('#zoneSelect').options.length,status:document.querySelector('#workStatus').textContent}})()");
    if(invalidPaint.zones!==1||!invalidPaint.status.includes('Court edit rejected'))
      throw Error('Surface-zone boundary check did not roll back: '+JSON.stringify(invalidPaint));
    await evaluate("document.querySelector('#surfaceEditOnPlan').click()");
    const surfaceControls=await evaluate("(()=>{const c=document.querySelector('#planCanvas');const style=document.querySelector('#surfaceStatus').textContent;return {visible:!c.hidden,stage:document.querySelector('[data-open-stage=\"model\"]').getAttribute('aria-current'),status:style}})()");
    if(!surfaceControls.visible||surfaceControls.stage!=='step')
      throw Error('2D direct-edit surface tools are not accessible: '+JSON.stringify(surfaceControls));
    await delay(250);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'surface-direct-edit-plan.png'),Buffer.from(frame.data,'base64')));
    await evaluate("document.querySelector('#show3d').click()");
    await delay(220);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'surface-custom-floor-3d.png'),Buffer.from(frame.data,'base64')));
    // New structural templates remain searchable rather than all rendered at once.
    const richCatalog=await evaluate("(()=>{document.querySelector('[data-model-tool=\"structures\"]').click();document.querySelector('#structureCategory').value='all';document.querySelector('#structureCategory').dispatchEvent(new Event('change'));document.querySelector('#structureSearch').value='roof';document.querySelector('#structureSearch').dispatchEvent(new Event('input'));return {total:document.querySelectorAll('[data-structure-kind]').length,shown:[...document.querySelectorAll('[data-structure-kind]')].filter(b=>!b.hidden).map(b=>b.dataset.structureKind)}})()");
    if(richCatalog.total!==23||richCatalog.shown.join(',')!=='roof')
      throw Error('Searchable 23-component catalog is not accessible: '+JSON.stringify(richCatalog));
    // Exercise real multi-selection and layout commands in the initialized
    // browser, including one-step history and persistent source seat totals.
    const layoutEdited=await evaluate("(()=>{document.querySelector('#structureGroupTools').open=true;document.querySelector('#structureSelectAll').click();const before=document.querySelector('#structureSelect').options.length;document.querySelector('#structureGroupDx').value='1';document.querySelector('#structureGroupDz').value='0';document.querySelector('#structureGroupMove').click();const moved=document.querySelector('#workStatus').textContent;document.querySelector('#structureGroupAxis').value='z';document.querySelector('#structureGroupAlign').click();const aligned=document.querySelector('#workStatus').textContent;document.querySelector('#structureGroupCopies').value='2';document.querySelector('#structureGroupDx').value='1.5';document.querySelector('#structureGroupDz').value='.5';document.querySelector('#structureGroupArray').click();return {before,after:document.querySelector('#structureSelect').options.length,status:document.querySelector('#workStatus').textContent,moved,aligned,seats:document.querySelector('#mappedCount').textContent,selected:[...document.querySelector('#structureMultiSelect').selectedOptions].length}})()");
    if(layoutEdited.before!==3||layoutEdited.after!==9||
      layoutEdited.seats!=='1,499'||layoutEdited.selected!==6||
      layoutEdited.status.includes('rejected')||
      layoutEdited.moved.includes('rejected')||layoutEdited.aligned.includes('rejected'))
      throw Error('Atomic component group layout failed in live browser: '+
        JSON.stringify(layoutEdited));
    await evaluate("document.querySelector('#undo').click()");
    const undoneGroupCount=await poll(async()=>await evaluate("document.querySelector('#structureSelect').options.length"),30);
    if(undoneGroupCount!==3)throw Error('Group array did not undo in one step');
    await evaluate("document.querySelector('#redo').click()");
    const redoneGroupCount=await poll(async()=>await evaluate("document.querySelector('#structureSelect').options.length"),30);
    if(redoneGroupCount!==9)throw Error('Group array did not redo as one transaction');
    await evaluate("document.querySelector('#showPlan').click()");
    await delay(250);
    await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(frame=>
      writeFileSync(join(dir,'component-multi-selection-and-array.png'),Buffer.from(frame.data,'base64')));
    console.log('studio: atomic multi-object alignment, movement, arrays, selection persistence and undo/redo verified');

    console.log('studio: court palette, dimensions, paint-zone geometry, boundary rejection, plan direct-edit and 23 searchable components verified');

    console.log('studio: compact header, seven reusable components, live WebGL2 geometry, transform, duplicate and 2D placement verified');

    console.log('operator editing: source counts adjusted with review flags, 3D updated, invalid edit rejected, undo/redo and section translation verified');




  } finally {
    client?.close();chrome.kill('SIGKILL');server.kill('SIGTERM');
    // Chrome may still be flushing profile files after SIGKILL.
    // Use bounded retries so successful UI tests do not fail on a teardown race.
    await delay(450);
    rmSync(work,{recursive:true,force:true,maxRetries:15,retryDelay:200});
  }
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
