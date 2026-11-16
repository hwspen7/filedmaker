import {SPORT_DEFAULTS,newVenue,normalizeVenue,parseVenueRows} from '../src/workbench/contract.mjs';
import {registerCourt} from '../src/workbench/registration.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {buildWorkbenchPreview} from '../src/workbench/adapter.mjs';
import {NativeVenueRenderer} from '../src/next/webgl.js';
import {buildOfflineSchoolViewerHTML} from '../src/schoolPublisher.mjs';

const $=id=>document.getElementById(id);
const canvas=$('planCanvas'),modelCanvas=$('modelCanvas'),ctx=canvas.getContext('2d');
let venue=newVenue(),registration=null,image=null,editorMode='select',draftPoints=[];
let preview=null,renderer=null,selectedSection='',selectedSeat=null,drag=null,viewMode='plan';
const number=n=>Number(n||0).toLocaleString('en-US');
const safeName=()=>venue.venue.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'school-venue';
const mimeCSV='text/csv;charset=utf-8';
function message(text,bad=false){
  $('workStatus').textContent=text;
  $('workStatus').style.color=bad?'#ac3e37':'#71808c';
}
function save(name,data,mime='application/json'){
  const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function validateFields(){
  const candidate=structuredClone(venue);
  candidate.school=$('school').value.trim();
  candidate.venue=$('venue').value.trim();
  candidate.sport=$('sport').value;
  candidate.court={width:Number($('courtWidth').value),length:Number($('courtLength').value)};
  candidate.officialCapacity=$('capacity').value.trim()?Number($('capacity').value):null;
  candidate.capacitySource=$('capacitySource').value.trim();
  return normalizeVenue(candidate);
}
function sync(){
  $('school').value=venue.school;
  $('venue').value=venue.venue;
  $('sport').value=venue.sport;
  $('courtWidth').value=venue.court.width;
  $('courtLength').value=venue.court.length;
  $('capacity').value=venue.officialCapacity??'';
  $('capacitySource').value=venue.capacitySource;
  $('workspaceName').textContent=venue.venue;
  $('sourceName').textContent=venue.plan.name||'No drawing attached';
  $('publishedCount').textContent=venue.officialCapacity==null?'—':number(venue.officialCapacity);
  refreshSections();
}
function refreshSections(){
  const select=$('sectionSelect'),previous=selectedSection;
  select.replaceChildren(new Option('No section selected',''));
  for(const s of venue.sections)select.add(new Option(s.id,s.id));
  if(venue.sections.some(s=>s.id===previous))select.value=previous;
  else selectedSection='';
  updateSectionFields();
}
function updateSectionFields(){
  const s=venue.sections.find(s=>s.id===selectedSection);
  $('baseHeight').value=s?s.baseHeight:'';
  $('rowRise').value=s?s.rowRise:'';
}
function layout(){
  const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);
  const inset=32, maxX=Math.max(venue.court.width/2+18,12,...venue.sections.flatMap(s=>[...s.front,...s.back].map(p=>Math.abs(p.x)+4)));
  const maxZ=Math.max(venue.court.length/2+9,20,...venue.sections.flatMap(s=>[...s.front,...s.back].map(p=>Math.abs(p.z)+4)));
  const scale=Math.min((w-2*inset)/(2*maxX),(h-2*inset)/(2*maxZ));
  if(image){
    const scaleImage=Math.min((w-2*inset)/image.width,(h-2*inset)/image.height);
    return {w,h,imageRect:{x:(w-image.width*scaleImage)/2,
      y:(h-image.height*scaleImage)/2,width:image.width*scaleImage,height:image.height*scaleImage},
      scale,center:[w/2,h/2]};
  }
  return {w,h,scale,center:[w/2,h/2],imageRect:null};
}
function worldToScreen(p,g){
  if(image&&registration){
    const px=registration.toImage(p),r=g.imageRect;
    return {x:r.x+px.x*r.width/image.width,y:r.y+px.y*r.height/image.height};
  }
  return {x:g.center[0]+p.x*g.scale,y:g.center[1]+p.z*g.scale};
}
function sourcePixel(p,g){
  if(!image)return null;
  const r=g.imageRect;
  return {x:(p.x-r.x)*image.width/r.width,y:(p.y-r.y)*image.height/r.height};
}
function screenToWorld(p,g){
  if(image){
    if(!registration)throw Error('Calibrate four playing-surface corners before tracing sections');
    return registration.toWorld(sourcePixel(p,g));
  }
  return {x:(p.x-g.center[0])/g.scale,z:(p.y-g.center[1])/g.scale};
}
function cornerList(s){return [s.front[0],s.front.at(-1),s.back.at(-1),s.back[0]];}
function outline(points,fill,stroke,width=1.3){
  if(!points.length)return;
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
}
function resize(){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
  if(w!==canvas.width||h!==canvas.height){canvas.width=Math.max(w,1);canvas.height=Math.max(h,1);}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
  renderer?.resize();
}
function draw(){
  if(viewMode!=='plan')return;
  const g=layout(),{w,h}=g;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#edf0ee';ctx.fillRect(0,0,w,h);
  if(image){
    const r=g.imageRect;
    ctx.drawImage(image,r.x,r.y,r.width,r.height);
    ctx.fillStyle='#ffffff27';ctx.fillRect(r.x,r.y,r.width,r.height);
  }
  const court=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>worldToScreen({x:x*venue.court.width/2,z:z*venue.court.length/2},g));
  if(!image||registration)outline(court,image?'#7ba7ab25':'#b9d1d2','#f8fafa',2);
  if(!image||registration){
    const center=worldToScreen({x:0,z:0},g);
    ctx.beginPath();ctx.ellipse(center.x,center.y,Math.max(2,1.83*(image?2:g.scale)),Math.max(2,1.83*(image?2:g.scale)),0,0,Math.PI*2);
    ctx.strokeStyle='#e6ffff';ctx.lineWidth=1;ctx.stroke();
  }
  for(const s of venue.sections){
    const polygon=cornerList(s).map(p=>worldToScreen(p,g)),active=s.id===selectedSection;
    outline(polygon,active?'#4e8cb766':'#456e9566',active?'#19557c':'#ffffff',active?2.5:1);
    const mid=polygon.reduce((m,p)=>({x:m.x+p.x/4,y:m.y+p.y/4}),{x:0,y:0});
    ctx.fillStyle='#102d45';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(s.id,mid.x,mid.y);
  }
  if(preview){
    ctx.fillStyle='#233e62b0';
    const stride=Math.max(1,Math.ceil(preview.seats.length/7000));
    for(let i=0;i<preview.seats.length;i+=stride){
      const p=worldToScreen(preview.seats[i],g);
      ctx.beginPath();ctx.arc(p.x,p.y,1.55,0,Math.PI*2);ctx.fill();
    }
  }
  if(selectedSection){
    const s=venue.sections.find(s=>s.id===selectedSection);
    if(s)for(const point of cornerList(s)){
      const p=worldToScreen(point,g);
      ctx.beginPath();ctx.arc(p.x,p.y,5.3,0,Math.PI*2);
      ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#1f577e';ctx.lineWidth=2;ctx.stroke();
    }
  }
  if(editorMode==='calibrate'){
    const all=[...venue.calibration.corners,...draftPoints];
    for(let i=0;i<all.length;i++){
      const p=all[i],s=sourcePixel(p,g);
      const q=(!image||!s)?p:{x:g.imageRect.x+p.x*g.imageRect.width/image.width,
        y:g.imageRect.y+p.y*g.imageRect.height/image.height};
      ctx.fillStyle='#ef9242';ctx.beginPath();ctx.arc(q.x,q.y,5,0,2*Math.PI);ctx.fill();
      ctx.fillStyle='#142b3e';ctx.fillText(String(i+1),q.x+12,q.y-10);
    }
  }
  if(editorMode==='trace'&&draftPoints.length){
    const points=draftPoints.map(p=>worldToScreen(p.world,g));
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
    ctx.strokeStyle='#bf6f25';ctx.lineWidth=2;ctx.stroke();
    for(const p of points){ctx.beginPath();ctx.arc(p.x,p.y,4,0,2*Math.PI);ctx.fillStyle='#bf6f25';ctx.fill();}
  }
}
function repaint(){
  $('workspaceName').textContent=venue.venue;
  $('sectionCount').textContent=number(venue.sections.length);
  $('rowCount').textContent=number(venue.rows.length);
  $('mappedCount').textContent=number(preview?.seats.length??0);
  $('publishedCount').textContent=venue.officialCapacity==null?'—':number(venue.officialCapacity);
  $('modeLabel').textContent=editorMode==='select'?'Select · drag a section corner to adjust':
    editorMode==='calibrate'?'Calibration · mark all four court corners':
    'Tracing · front left → front right → rear right → rear left';
  $('canvasOverlay').textContent=editorMode==='calibrate'?'Click the four court corners in order: near left, near right, far right, far left.':
    editorMode==='trace'?'Trace '+(draftPoints.length+1)+'/4: '+['front left','front right','rear right','rear left'][draftPoints.length]:
    image&&!registration?'Image loaded. Mark four court corners before tracing sections.':
    'Drag section corners to correct the footprint. Imported row counts are never changed to match a target capacity.';
  $('qa').textContent=preview?[
    'Source seats: '+number(preview.audit.declaredSeats),
    'Generated positions: '+number(preview.audit.mappedSeats),
    'Geometry: '+preview.audit.coordinateStatus,
    ...preview.warnings].join('\n'):
    venue.rows.length?'Import completed. Trace each row-bearing section and generate a model.':
    'Awaiting source rows and traced sections.';
  draw();
}
function tryPreview(){
  try{
    venue=validateFields();
    if(!venue.rows.length||!venue.sections.length){preview=null;repaint();return;}
    const next=buildWorkbenchPreview(venue);
    preview=next;
    if(renderer)renderer.load(preview.plan);
    if(viewMode!=='plan')open3d(viewMode);
    message('Generated '+number(next.seats.length)+' source-based positions. Geometry remains estimated.');
  }catch(e){preview=null;message(e.message,true);}
  repaint();
}
function pointer(event){
  const r=canvas.getBoundingClientRect();
  return {x:event.clientX-r.left,y:event.clientY-r.top};
}
function pickSection(point,g){
  for(const s of [...venue.sections].reverse()){
    const poly=cornerList(s).map(p=>worldToScreen(p,g));
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if(((a.y>point.y)!==(b.y>point.y))&&(point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x))inside=!inside;
    }
    if(inside)return s.id;
  }
  return '';
}
function commitSection(points){
  const id=$('newSectionId').value.trim();
  if(!/^[a-z0-9][a-z0-9 _-]{0,29}$/i.test(id))throw Error('Enter a section ID (letters, numbers, spaces, hyphen)');
  if(venue.sections.some(s=>s.id.toLowerCase()===id.toLowerCase()))throw Error('This section ID already exists');
  const world=points.map(p=>p.world),trace=image?points.map(p=>p.pixel):[];
  venue.sections.push({id,front:[world[0],world[1]],back:[world[3],world[2]],
    trace,baseHeight:.45,rowRise:.28,provenance:'operator-traced/estimated'});
  selectedSection=id;
  $('newSectionId').value='SECTION-'+(venue.sections.length+1);
  refreshSections();
}
canvas.addEventListener('pointerdown',event=>{
  if(viewMode!=='plan')return;
  const p=pointer(event),g=layout();
  try{
    if(editorMode==='calibrate'){
      if(!image)throw Error('Upload a bitmap court plan before calibration');
      const px=sourcePixel(p,g);
      if(px.x<0||px.y<0||px.x>image.width||px.y>image.height)throw Error('Choose a corner inside the image');
      draftPoints.push(px);
      if(draftPoints.length===4){
        const attempt=registerCourt(draftPoints,venue.court.width,venue.court.length);
        venue.calibration.corners=structuredClone(draftPoints);
        registration=attempt;draftPoints=[];editorMode='select';
        for(const s of venue.sections)if(s.trace.length===4){
          const ps=s.trace.map(q=>registration.toWorld(q));
          s.front=[ps[0],ps[1]];s.back=[ps[3],ps[2]];
        }
        tryPreview();
      }
      repaint();return;
    }
    if(editorMode==='trace'){
      const world=screenToWorld(p,g),pixel=image?sourcePixel(p,g):null;
      draftPoints.push({world,pixel});
      if(draftPoints.length===4){
        const next=[...draftPoints];draftPoints=[];
        commitSection(next);editorMode='select';tryPreview();
      }
      repaint();return;
    }
    let section=venue.sections.find(s=>s.id===selectedSection);
    let handle=-1;
    if(section)handle=cornerList(section).findIndex(q=>{
      const pos=worldToScreen(q,g);return Math.hypot(pos.x-p.x,pos.y-p.y)<14;
    });
    if(handle>=0){
      drag={id:selectedSection,handle};canvas.setPointerCapture(event.pointerId);return;
    }
    selectedSection=pickSection(p,g);
    $('sectionSelect').value=selectedSection;updateSectionFields();repaint();
  }catch(e){message(e.message,true);draftPoints=[];repaint();}
});
canvas.addEventListener('pointermove',event=>{
  if(!drag)return;
  const section=venue.sections.find(s=>s.id===drag.id);
  if(!section)return;
  try{
    const p=pointer(event),g=layout(),world=screenToWorld(p,g);
    if(!Number.isFinite(world.x+world.z)||Math.abs(world.x)>2000||Math.abs(world.z)>2000)return;
    const key=[['front',0],['front',section.front.length-1],
      ['back',section.back.length-1],['back',0]][drag.handle];
    section[key[0]][key[1]]=world;
    if(image&&registration&&section.trace.length===4)section.trace[drag.handle]=sourcePixel(p,g);
    draw();
  }catch(e){message(e.message,true);}
});
function releasePointer(event){
  if(!drag)return;
  drag=null;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  tryPreview();
}
canvas.addEventListener('pointerup',releasePointer);
canvas.addEventListener('pointercancel',releasePointer);
const fieldHandler=()=>{
  try{venue=validateFields();registration=venue.calibration.corners.length===4&&image?
    registerCourt(venue.calibration.corners,venue.court.width,venue.court.length):null;tryPreview();}
  catch(e){message(e.message,true);}
};
for(const id of ['school','venue','courtWidth','courtLength','capacity','capacitySource']){
  $(id).addEventListener('change',fieldHandler);
}
$('sport').onchange=()=>{
  const old=venue;
  if((old.sections.length||old.rows.length)&&!confirm('Changing venue type will reset the traced sections and rows. Continue?')){
    $('sport').value=old.sport;return;
  }
  venue=newVenue($('sport').value);venue.school=old.school;venue.venue=old.venue;
  image=null;registration=null;selectedSection='';preview=null;sync();repaint();
};
$('calibrate').onclick=()=>{
  if(!image){message('Upload a supported plan image first.',true);return;}
  editorMode='calibrate';draftPoints=[];repaint();
};
$('trace').onclick=()=>{
  if(image&&!registration){message('Calibrate the playing surface before tracing.',true);return;}
  editorMode='trace';draftPoints=[];repaint();
};
$('sectionSelect').onchange=()=>{selectedSection=$('sectionSelect').value;updateSectionFields();repaint();};
$('applySection').onclick=()=>{
  const s=venue.sections.find(s=>s.id===$('sectionSelect').value);
  if(!s){message('Select a section first.',true);return;}
  s.baseHeight=Number($('baseHeight').value);s.rowRise=Number($('rowRise').value);
  tryPreview();
};
$('removeSection').onclick=()=>{
  const id=selectedSection;
  if(!id)return;
  if(!confirm('Remove section '+id+'? Imported row records will be retained until corrected.'))return;
  venue.sections=venue.sections.filter(s=>s.id!==id);
  selectedSection='';refreshSections();tryPreview();
};
$('rowsFile').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>8_000_000)throw Error('Row CSV exceeds 8 MB');
    const rows=parseVenueRows(await file.text());
    venue.rows=rows;tryPreview();
    message('Imported '+number(rows.length)+' source rows; geometries remain provisional.');
  }catch(e){message(e.message,true);}
  finally{event.target.value='';}
};
$('planFile').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Upload PNG, JPEG or WebP. Export a PDF page as an image first.');
    if(file.size>8_000_000)throw Error('Plan images must be at most 8 MB');
    const url=URL.createObjectURL(file),loaded=new Image();
    try{
      loaded.src=url;await loaded.decode();
      if(loaded.width>20000||loaded.height>20000)throw Error('Image dimensions exceed 20,000 pixels');
      image=loaded;
    }finally{URL.revokeObjectURL(url);}
    venue.plan={name:file.name,mime:file.type,width:image.width,height:image.height,imageData:''};
    if(file.size<3_500_000){
      venue.plan.imageData=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));
        reader.onerror=()=>reject(Error('Unable to read plan image'));reader.readAsDataURL(file);
      });
    }
    venue.calibration.corners=[];venue.sections=[];selectedSection='';
    registration=null;preview=null;editorMode='calibrate';draftPoints=[];
    sync();repaint();message('Source image loaded. Calibrate four court corners; then trace sections.');
  }catch(e){message(e.message,true);}
  finally{event.target.value='';}
};
$('csvExample').onclick=()=>save('example-rows.csv',
  'section,row,seats,seat_start,tier,seat_type\r\nHOME,A,12,1,T1,bleacher\r\nHOME,B,12,1,T1,bleacher\r\nAWAY,A,10,1,T1,chair\r\n',mimeCSV);
$('fixture').onclick=()=>{
  venue=fictionalGym();registration=null;image=null;preview=null;selectedSection='';
  editorMode='select';draftPoints=[];sync();tryPreview();
  message('Loaded an explicitly fictional 1,500-seat geometry exercise.');
};
function open3d(mode){
  if(!preview){message('Trace sections, import rows, and generate a valid model first.',true);viewMode='plan';canvas.hidden=false;modelCanvas.hidden=true;repaint();return;}
  viewMode=mode;canvas.hidden=true;modelCanvas.hidden=false;
  if(!renderer){
    try{renderer=new NativeVenueRenderer(modelCanvas,s=>{
      selectedSeat=s;
      $('seatDetails').textContent='Section '+s.sectionId+' · Row '+s.row+' · Seat '+s.number+
        '\nX '+s.x.toFixed(2)+' m / Y '+s.y.toFixed(2)+' m / Z '+s.z.toFixed(2)+' m';
      renderer.highlight(s);
    });}
    catch(e){message('WebGL2 unavailable: '+e.message,true);viewMode='plan';canvas.hidden=false;modelCanvas.hidden=true;repaint();return;}
  }
  renderer.load(preview.plan);renderer.resize();
  renderer.view(mode==='eye'?'human':'overview',selectedSeat);
  if(mode==='eye'&&!selectedSeat)message('Select a seat in 3D overview before entering Seat view.',true);
}
function tab(mode){
  $('showPlan').classList.toggle('active',mode==='plan');
  $('show3d').classList.toggle('active',mode==='overview');
  $('showEye').classList.toggle('active',mode==='eye');
}
$('showPlan').onclick=()=>{viewMode='plan';canvas.hidden=false;modelCanvas.hidden=true;tab('plan');resize();};
$('show3d').onclick=()=>{open3d('overview');tab(viewMode);};
$('showEye').onclick=()=>{if(!selectedSeat){message('Click a seat in 3D overview first.',true);return;}open3d('eye');tab(viewMode);};
$('generate').onclick=()=>tryPreview();
$('saveProject').onclick=()=>{
  try{venue=validateFields();save(safeName()+'.filedmaker-workbench.json',JSON.stringify(venue,null,2));message('Editable source project saved.');}
  catch(e){message(e.message,true);}
};
$('openProject').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>12_000_000)throw Error('Project file exceeds 12 MB');
    const next=normalizeVenue(JSON.parse(await file.text()));
    let loadedImage=null;
    if(next.plan.imageData){
      loadedImage=new Image();loadedImage.src=next.plan.imageData;
      await loadedImage.decode();
    }
    venue=next;image=loadedImage;registration=image&&next.calibration.corners.length===4?
      registerCourt(next.calibration.corners,next.court.width,next.court.length):null;
    preview=null;selectedSeat=null;selectedSection='';editorMode='select';draftPoints=[];
    sync();tryPreview();message('Editable venue project opened.');
  }catch(e){message('Invalid project: '+e.message,true);}
  finally{event.target.value='';}
};
$('saveSeats').onclick=()=>{
  if(!preview){message('Generate a model first.',true);return;}
  const esc=v=>{
    let t=String(v??'');
    if(/^[=+@-]/.test(t))t="'"+t;
    return '"'+t.replace(/"/g,'""')+'"';
  };
  const lines=['seat_id,section,row,seat,x_m,y_m,z_m,coordinate_status'];
  for(const s of preview.seats)lines.push(
    [s.id,s.section,s.row,s.number,s.x.toFixed(4),s.y.toFixed(4),s.z.toFixed(4),'estimated'].map(esc).join(','));
  save(safeName()+'-seats.csv',lines.join('\r\n'),mimeCSV);
};
$('saveReport').onclick=()=>{
  if(!preview){message('Generate a model first.',true);return;}
  save(safeName()+'-audit.json',JSON.stringify({venue:preview.venue.venue,
    sourceDrawing:preview.venue.plan.name,calibrated:preview.venue.calibration.corners.length===4,
    ...preview.audit,rowRuns:preview.rowRuns,warnings:preview.warnings},null,2));
};
$('publish').onclick=async()=>{
  if(!preview){message('Generate a model first.',true);return;}
  try{
    const response=await fetch('../src/next/webgl.js',{cache:'no-store'});
    if(!response.ok)throw Error('Offline WebGL source missing');
    const html=buildOfflineSchoolViewerHTML(preview.project,await response.text());
    save(safeName()+'-preview.html',html,'text/html;charset=utf-8');
    message('Offline 2D/3D preview exported. School validation is still required.');
  }catch(e){message(e.message,true);}
};
const newId=document.createElement('label');
newId.textContent='New section ID';
const newInput=document.createElement('input');
newInput.id='newSectionId';newInput.maxLength=30;newInput.value='SECTION-1';
newId.append(newInput);$('trace').parentElement.before(newId);
const observer=new ResizeObserver(()=>resize());observer.observe(canvas.parentElement);
sync();repaint();resize();
document.documentElement.dataset.workbenchReady="true";
(async()=>{
  const el=$('buildTag');
  try{
    const response=await fetch('/__filedmaker/status',{cache:'no-store'});
    if(!response.ok)return;
    const info=await response.json();
    el.textContent=info.branch+' @ '+String(info.commit).slice(0,9);
  }catch{el.textContent='Local workbench';}
})();
