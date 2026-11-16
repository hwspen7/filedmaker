import {SPORT_DEFAULTS,newVenue,normalizeVenue,parseVenueRows} from '../src/workbench/contract.mjs';
import {registerCourt} from '../src/workbench/registration.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {buildWorkbenchPreview} from '../src/workbench/adapter.mjs';
import {applyVenueEdit} from '../src/workbench/editing.mjs';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {NativeVenueRenderer} from '../src/next/webgl.js';
import {buildOfflineSchoolViewerHTML} from '../src/schoolPublisher.mjs';
import {importRowFile} from '../src/workbench/imports/tabular.mjs';
import {parseVectorFile,vectorToImage} from '../src/workbench/imports/vector.mjs';
import {describeFile,appendSource,assessSources} from '../src/workbench/sources.mjs';
import {createHistory} from '../src/workbench/history.mjs';
import {assessRegistration} from '../src/workbench/registration-audit.mjs';
import {compareVenueProjects} from '../src/workbench/diff.mjs';
import {openPdfFile,renderPdfPage,closePdfFile} from '../src/workbench/imports/pdf.mjs';
import {reviewReadiness,suggestionQueue} from '../src/workbench/review.mjs';
import {setupWorkflow} from './workflow.js';
import {getVenueCase} from '../src/workbench/caseCatalog.mjs';
import {makeAikenUnverifiedOperatorDraft} from '../src/workbench/qa/aiken-operator-draft.mjs';

const $=id=>document.getElementById(id);
const canvas=$('planCanvas'),modelCanvas=$('modelCanvas'),ctx=canvas.getContext('2d');
let venue=newVenue(),registration=null,image=null,editorMode='select',draftPoints=[];
let preview=null,renderer=null,selectedSection='',selectedSeat=null,drag=null,viewMode='plan';
let pendingRows=null,vectorDrawing=null,pdfHandle=null,workflowUI=null;
const history=createHistory();
const number=n=>Number(n||0).toLocaleString('en-US');
const safeName=()=>venue.venue.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'school-venue';
const mimeCSV='text/csv;charset=utf-8';
const requestedDownloads=[];
function refreshActivity(){
  const list=venue.changeLog??[];
  $('projectActivity').textContent=list.length?
    list.slice(-12).reverse().map(entry=>entry.event).join('\n'):'No project edits yet';
  $('exportActivity').textContent=requestedDownloads.length?
    requestedDownloads.map(entry=>entry).join('\n'):'No downloads requested in this tab';
}
function recordEdit(before,action){
  if(JSON.stringify(before)===JSON.stringify(venue))return;
  history.record(before,action);
  venue.changeLog=[...(venue.changeLog||[]),{event:action,at:new Date().toISOString()}].slice(-200);
  $('undo').disabled=!history.canUndo;
  $('redo').disabled=!history.canRedo;
}
async function restoreDocument(next){
  const oldImage=image,oldFile=venue.plan.name;
  const checked=normalizeVenue(next);
  let restoredImage=null;
  if(checked.plan.imageData){
    restoredImage=new Image();restoredImage.src=checked.plan.imageData;
    await restoredImage.decode();
  }else if(checked.plan.name===oldFile)restoredImage=oldImage;
  if(pdfHandle){closePdfFile(pdfHandle).catch(()=>{});pdfHandle=null;}
  $('pdfPageWrap').hidden=true;
  $('pdfStatus').textContent='No active PDF reader. Reattach the source PDF to review another page.';
  venue=checked;image=restoredImage;selectedSeat=null;selectedSection='';
  registration=image&&venue.calibration.corners.length===4?
    registerCourt(venue.calibration.corners,venue.court.width,venue.court.length):null;
  preview=null;vectorDrawing=null;editorMode='select';draftPoints=[];
  sync();tryPreview();
  if(venue.plan.name&&!image)message('Geometry restored. Reattach the source image for overlay editing.',true);
}
async function stepHistory(direction){
  const state=direction==='back'?history.undo(venue):history.redo(venue);
  if(!state)return;
  try{await restoreDocument(state.venue);message(state.action+' restored');}
  catch(e){message('Cannot restore edit: '+e.message,true);}
  $('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo;
}
$('undo').onclick=()=>stepHistory('back');
$('redo').onclick=()=>stepHistory('forward');
window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){
    if(e.target.matches('input,textarea,[contenteditable]'))return;
    e.preventDefault();stepHistory(e.shiftKey?'forward':'back');
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&
      !e.target.matches('input,textarea,[contenteditable]')){
    e.preventDefault();stepHistory('forward');
  }
});
function message(text,bad=false){
  $('workStatus').textContent=text;
  $('workStatus').style.color=bad?'#ac3e37':'#71808c';
}
function save(name,data,mime='application/json'){
  const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  requestedDownloads.unshift('Requested · '+name);
  if(requestedDownloads.length>12)requestedDownloads.length=12;
  refreshActivity();
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
  renderPdfSuggestions();
  $('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo;
  $('publishedCount').textContent=venue.officialCapacity==null?'—':number(venue.officialCapacity);
  refreshSections();
  refreshRowControls();
}
function renderPdfSuggestions(){
  const root=$('pdfLabels');root.replaceChildren();
  const matching=suggestionQueue(venue.plan?.labels||[],venue.rows,venue.sections);
  if(!matching.length){
    const note=document.createElement('span');
    note.className='quiet';
    note.textContent='No text labels match the current row list. Trace sections manually.';
    root.append(note);return;
  }
  for(const hint of matching.slice(0,24)){
    const b=document.createElement('button');b.type='button';
    b.textContent=hint.id+' · label';
    b.title='Text from PDF only. The section outline must be traced manually.';
    b.onclick=()=>{
      $('newSectionId').value=hint.id;
      workflowUI?.go('calibrate');
      if(registration){editorMode='trace';draftPoints=[];repaint();}
      message('Suggested '+hint.id+'. Confirm this label, then trace its four actual section corners.');
    };
    root.append(b);
  }
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
function refreshRowControls(preferredSection=null,preferredRow=null){
  const sections=$('rowEditSection'),rows=$('rowEditRow');
  const currentSection=preferredSection??sections.value;
  const currentRow=preferredRow??rows.value;
  sections.replaceChildren(...venue.sections.map(s=>new Option(s.id,s.id)));
  const target=venue.sections.find(s=>s.id===currentSection)||
    venue.sections.find(s=>s.id===selectedSection)||venue.sections[0];
  if(!target){rows.replaceChildren();fillRowFields();return;}
  sections.value=target.id;
  const available=venue.rows.filter(r=>r.section.toLowerCase()===target.id.toLowerCase());
  rows.replaceChildren(...available.map(r=>new Option(r.row,r.row)));
  if(available.some(r=>r.row===currentRow))rows.value=currentRow;
  fillRowFields();
}
function fillRowFields(){
  const section=$('rowEditSection').value,label=$('rowEditRow').value;
  const r=venue.rows.find(r=>r.section===section&&r.row===label);
  const fields=['rowEditSeats','rowEditFirst','rowEditNumbers','rowEditGaps',
    'rowInsetStart','rowInsetEnd','rowDepthOffset','rowEditElevation'];
  if(!r){
    fields.forEach(id=>$(id).value='');
    $('rowEditStatus').textContent=section?'No row inventory for this section. Add a staff-estimated row below.':
      'Import or create sections and source rows first.';
    return;
  }
  $('rowEditSeats').value=r.seats;$('rowEditFirst').value=r.first;
  $('rowEditNumbers').value=(r.seatNumbers??[]).join('|');
  $('rowEditGaps').value=(r.gaps??[]).map(g=>g.after+':'+g.width).join('|');
  $('rowEditDirection').value=r.seatDirection;
  $('rowEditType').value=r.seatType;
  $('rowInsetStart').value=r.insetStartM??0;
  $('rowInsetEnd').value=r.insetEndM??0;
  $('rowDepthOffset').value=r.depthOffsetM??0;
  $('rowEditElevation').value=r.elevation??'';
  $('rowEditStatus').textContent=r.operatorEdited?
    'Staff-edited · original count '+(r.sourceSeats??'not supplied')+
      ' · pending source verification':
    'Imported/fixture row · '+r.seats+' modeled seats · unverified geometry';
  const valid=new Set(r.seatNumbers.length?r.seatNumbers:
    Array.from({length:r.seats},(_,i)=>String(r.first+i)));
  if(!valid.has($('seatEditNumber').value))
    $('seatEditNumber').value=r.seatNumbers[0]??String(r.first);
  fillSeatOffsetFields();
}
function fillSeatOffsetFields(){
  const row=venue.rows.find(r=>r.section===$('rowEditSection').value&&
    r.row===$('rowEditRow').value);
  const number=$('seatEditNumber').value.trim();
  const override=row?.seatOverrides?.find(o=>o.number===number);
  $('seatShiftX').value=override?.dx??0;
  $('seatShiftY').value=override?.dy??0;
  $('seatShiftZ').value=override?.dz??0;
}
function commitOperatorEdit(edit,summary,preferredRow=null){
  try{
    const before=structuredClone(venue);
    const result=applyVenueEdit(venue,edit);
    venue=result.venue;selectedSeat=null;
    recordEdit(before,summary+' · '+result.affected);
    sync();
    refreshRowControls(edit.section,preferredRow??edit.row);
    tryPreview();
    if(edit.type==='set-seat-offset'||edit.type==='clear-seat-offset'){
      $('seatEditNumber').value=edit.number;fillSeatOffsetFields();
    }
    message(summary+' saved · '+(result.seatDelta>=0?'+':'')+result.seatDelta+
      ' seats. Check original school evidence before delivery.');
    return true;
  }catch(e){message('Edit rejected: '+e.message,true);return false;}
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
    // A selected source row is visible on the calibrated 2D drawing.
    const section=$('rowEditSection').value,row=$('rowEditRow').value;
    if(section&&row){
      ctx.fillStyle='#e49b3b';ctx.strokeStyle='#fefefe';ctx.lineWidth=1;
      for(const seat of preview.seats)if(seat.section===section&&seat.row===row){
        const p=worldToScreen(seat,g);
        ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
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
  const review=reviewReadiness(venue);
  $('reviewChecklist').replaceChildren(...review.steps.map(step=>{
    const row=document.createElement('div');
    row.className=step.done?'complete':'';
    row.textContent=(step.done?'✓ ':'○ ')+step.label;
    return row;
  }));
  renderPdfSuggestions();
  $('workspaceName').textContent=venue.venue;
  $('sectionCount').textContent=number(venue.sections.length);
  $('rowCount').textContent=number(venue.rows.length);
  $('mappedCount').textContent=number(preview?.seats.length??0);
  const staffEdits=venue.rows.filter(r=>r.operatorEdited).length;
  $('quickStats').title=staffEdits?
    staffEdits+' rows changed by staff; original evidence needs reconciliation':
    'Source and elevation verification required';
  $('quickStats').textContent=preview?
    number(preview.seats.length)+' modeled positions · '+number(venue.sections.length)+' sections · needs review':
    venue.rows.length?number(venue.rows.length)+' source rows · not yet modeled':
    'No seats generated';
  $('publishedCount').textContent=venue.officialCapacity==null?'—':number(venue.officialCapacity);
  $('evidenceStatus').textContent=preview?.quality?.blockingCount?'Geometry blocked':
    preview?'Unverified model · human review required':
    venue.plan.name||venue.rows.length?'Import / calibration in progress':'Awaiting source files';
  $('modeLabel').textContent=editorMode==='select'?'Select · drag a section corner to adjust':
    editorMode==='calibrate'?'Calibration · mark all four court corners':
    'Tracing · front left → front right → rear right → rear left';
  $('emptyCanvas').hidden=!!(image||venue.rows.length||venue.sections.length||preview)||viewMode!=='plan';
  $('canvasOverlay').hidden=!(image||venue.rows.length||venue.sections.length||preview)||viewMode!=='plan';
  $('canvasOverlay').textContent=editorMode==='calibrate'?'Click the four court corners in order: near left, near right, far right, far left.':
    editorMode==='trace'?'Trace '+(draftPoints.length+1)+'/4: '+['front left','front right','rear right','rear left'][draftPoints.length]:
    image&&!registration?'Image loaded. Mark four court corners before tracing sections.':
    'Drag section corners to correct the footprint. Imported row counts are never changed to match a target capacity.';
  const sourceStatus=assessSources(venue);
  $('sourceLedger').textContent=venue.sources?.length?
    venue.sources.map(item=>item.role+' · '+item.name+' · SHA-256 '+item.sha256.slice(0,12)+
      ' · '+item.review).join('\n'):
      (venue.rows.length||venue.sections.length?
        'No hashed source files attached. Verify and reattach original evidence before delivery.':
        'No source files attached.');
  let calibrationNote='';
  if(venue.calibration.corners.length===4){
    const state=assessRegistration(venue.calibration.corners,venue.court.width,
      venue.court.length,venue.calibration.checkpoints||[]);
    calibrationNote='Plan calibration: '+state.status+
      (state.rmsErrorM===null?' (no independent check points)':
       ' (independent RMS '+state.rmsErrorM.toFixed(3)+' m)');
  }
  $('qa').textContent=preview?[
    'Source seats: '+number(preview.audit.declaredSeats),
    'Generated positions: '+number(preview.audit.mappedSeats),
    'Geometry: '+preview.audit.coordinateStatus,
    'QA status: '+preview.quality.status+'; '+preview.quality.blockingCount+' blocking / '+
      preview.quality.reviewCount+' review findings',
    ...preview.quality.issues.slice(0,16).map(i=>i.severity.toUpperCase()+' '+i.code+' · '+i.detail),
    ...preview.warnings.slice(0,5),
    ...sourceStatus.issues,calibrationNote,
    ...venue.notes.slice(0,5).map(note=>'PROJECT NOTE · '+note)
  ].filter(Boolean).join('\n'):
    [venue.rows.length?'Import completed. Trace each row-bearing section and generate a model.':
    'Awaiting source rows and traced sections.',...sourceStatus.issues,calibrationNote,
    ...venue.notes.slice(0,5).map(note=>'PROJECT NOTE · '+note)].filter(Boolean).join('\n');
  refreshActivity();
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
    message('Generated '+number(next.seats.length)+
      ' positions from current project rows. Source and elevation verification remain required.');
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
  const before=structuredClone(venue);
  const id=$('newSectionId').value.trim();
  if(!/^[a-z0-9][a-z0-9 _-]{0,29}$/i.test(id))throw Error('Enter a section ID (letters, numbers, spaces, hyphen)');
  if(venue.sections.some(s=>s.id.toLowerCase()===id.toLowerCase()))throw Error('This section ID already exists');
  const world=points.map(p=>p.world),trace=image?points.map(p=>p.pixel):[];
  venue.sections.push({id,front:[world[0],world[1]],back:[world[3],world[2]],
    trace,baseHeight:.45,rowRise:.28,provenance:'operator-traced/estimated'});
  selectedSection=id;
  recordEdit(before,'Trace section '+id);
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
        const before=structuredClone(venue);
        venue.calibration.corners=structuredClone(draftPoints);
        recordEdit(before,'Calibrate drawing against playing surface');
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
    if(preview&&workflowUI?.current==='model'){
      let nearest=null,distance=10;
      for(const seat of preview.seats){
        const xy=worldToScreen(seat,g),d=Math.hypot(xy.x-p.x,xy.y-p.y);
        if(d<distance){distance=d;nearest=seat;}
      }
      if(nearest){
        selectedSection=nearest.section;
        $('sectionSelect').value=selectedSection;
        updateSectionFields();
        refreshRowControls(nearest.section,nearest.row);
        message('Selected '+nearest.section+' / '+nearest.row+
          ' on the plan. The row editor is ready.');
        repaint();return;
      }
    }
    let section=venue.sections.find(s=>s.id===selectedSection);
    let handle=-1;
    if(section)handle=cornerList(section).findIndex(q=>{
      const pos=worldToScreen(q,g);return Math.hypot(pos.x-p.x,pos.y-p.y)<14;
    });
    if(handle>=0){
      drag={id:selectedSection,handle,before:structuredClone(venue)};
      canvas.setPointerCapture(event.pointerId);return;
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
    if(event.shiftKey){
      world.x=Math.round(world.x*10)/10;
      world.z=Math.round(world.z*10)/10;
    }
    section[key[0]][key[1]]=world;
    if(image&&registration&&section.trace.length===4)section.trace[drag.handle]=sourcePixel(p,g);
    draw();
  }catch(e){message(e.message,true);}
});
function releasePointer(event){
  if(!drag)return;
  const completed=drag;drag=null;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  try{
    const candidate=normalizeVenue(venue);
    if(candidate.rows.length&&candidate.rows.every(r=>candidate.sections.some(s=>
      s.id.toLowerCase()===r.section.toLowerCase()))){
      const geometry=generateTracedVenue(candidate);
      if(geometry.quality.blockingCount)
        throw Error('Dragged contour causes '+geometry.quality.blockingCount+' blocking geometry issues');
    }
    venue=candidate;
    recordEdit(completed.before,'Adjust traced section '+completed.id);
    sync();tryPreview();
  }catch(e){
    venue=completed.before;sync();tryPreview();
    message('Drag reverted: '+e.message,true);
  }
}
canvas.addEventListener('pointerup',releasePointer);
canvas.addEventListener('pointercancel',releasePointer);
const fieldHandler=()=>{
  try{const before=structuredClone(venue);venue=validateFields();
    recordEdit(before,'Update venue metadata');
    registration=venue.calibration.corners.length===4&&image?
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
  recordEdit(old,'Change playing-surface type');
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
  commitOperatorEdit({type:'set-section-elevation',section:$('sectionSelect').value,
    baseHeight:$('baseHeight').value,rowRise:$('rowRise').value},'Adjust section elevation');
};
$('moveSelectedSection').onclick=()=>{
  if(commitOperatorEdit({type:'translate-section',section:$('sectionSelect').value,
    dx:$('sectionMoveX').value,dz:$('sectionMoveZ').value},'Move section')){
    $('sectionMoveX').value='0';$('sectionMoveZ').value='0';
  }
};
$('resizeSelectedSection').onclick=()=>{
  const percent=$('sectionWidthPct').value.trim();
  if(commitOperatorEdit({type:'resize-section',section:$('sectionSelect').value,
    factor:percent?Number(percent)/100:null},'Resize section'))
    $('sectionWidthPct').value='100';
};
$('rowEditSection').onchange=()=>{refreshRowControls($('rowEditSection').value);draw();};
$('rowEditRow').onchange=()=>{fillRowFields();draw();};
$('seatEditNumber').onchange=()=>fillSeatOffsetFields();
$('seatApplyOffset').onclick=()=>{
  const section=$('rowEditSection').value,row=$('rowEditRow').value;
  commitOperatorEdit({type:'set-seat-offset',section,row,
    number:$('seatEditNumber').value.trim(),
    dx:$('seatShiftX').value,dy:$('seatShiftY').value,dz:$('seatShiftZ').value},
    'Adjust individual seat',row);
};
$('seatResetOffset').onclick=()=>{
  const section=$('rowEditSection').value,row=$('rowEditRow').value;
  commitOperatorEdit({type:'clear-seat-offset',section,row,
    number:$('seatEditNumber').value.trim()},'Clear individual seat correction',row);
};
$('applyRowEdit').onclick=()=>{
  const section=$('rowEditSection').value,row=$('rowEditRow').value;
  if(!section||!row){message('Select an existing section and row.',true);return;}
  const current=venue.rows.find(r=>r.section===section&&r.row===row);
  const labels=$('rowEditNumbers').value.trim();
  const count=Number($('rowEditSeats').value);
  if(current?.seatNumbers?.length&&count!==current.seats&&!labels&&
    !confirm('Clear explicit source seat labels and replace them with provisional sequential numbers?'))return;
  commitOperatorEdit({type:'update-row',section,row,changes:{
    seats:$('rowEditSeats').value,first:$('rowEditFirst').value,
    seatNumbers:labels,seatDirection:$('rowEditDirection').value,
    seatType:$('rowEditType').value,gaps:$('rowEditGaps').value,
    insetStartM:$('rowInsetStart').value,insetEndM:$('rowInsetEnd').value,
    depthOffsetM:$('rowDepthOffset').value,
    elevation:$('rowEditElevation').value.trim()===''?null:$('rowEditElevation').value
  }},'Update row',row);
};
$('rowAdd').onclick=()=>{
  const section=$('rowEditSection').value;
  const row=$('rowNewLabel').value.trim(),seats=$('rowNewSeats').value;
  if(commitOperatorEdit({type:'add-row',section,afterRow:$('rowEditRow').value||null,
    newRow:{row,seats}},'Add provisional row',row))$('rowNewLabel').value='';
};
for(const [button,direction] of [['rowMoveUp','up'],['rowMoveDown','down']])
  $(button).onclick=()=>{
    const section=$('rowEditSection').value,row=$('rowEditRow').value;
    commitOperatorEdit({type:'move-row',section,row,direction},'Reorder row',row);
  };
$('rowRemove').onclick=()=>{
  const section=$('rowEditSection').value,row=$('rowEditRow').value;
  if(!section||!row)return;
  if(!confirm('Remove row '+section+'/'+row+'? This changes the source-model seat count and requires manual reconciliation.'))return;
  commitOperatorEdit({type:'remove-row',section,row},'Remove staff-reviewed row');
};
$('removeSection').onclick=()=>{
  const id=selectedSection;
  if(!id)return;
  if(!confirm('Remove section '+id+'? Imported row records will be retained until corrected.'))return;
  const before=structuredClone(venue);
  venue.sections=venue.sections.filter(s=>s.id!==id);
  recordEdit(before,'Remove section '+id);
  selectedSection='';refreshSections();tryPreview();
};
async function installRows(file,index=0){
  if(file.size>16_000_000)throw Error('Row inventory exceeds 16 MB');
  const imported=await importRowFile(file,{sheetIndex:index});
  const source=await describeFile(file,{role:'seat-rows',origin:'school-supplied'});
  const before=structuredClone(venue);
  const next=appendSource(venue,source);
  next.rows=imported.rows;next.rowSourceId=source.id;
  venue=normalizeVenue(next);
  recordEdit(before,'Import '+imported.format+' row inventory: '+file.name);
  tryPreview();
  message('Imported '+number(imported.rows.length)+' rows from '+file.name+
    ' ('+imported.format+'). Original counts preserved.');
  if(imported.sheets.length){
    $('sheetWrap').hidden=imported.sheets.length<=1;
    $('sheetSelect').replaceChildren(...imported.sheets.map((name,i)=>new Option(name,String(i))));
    $('sheetSelect').value=String(index);
  }else $('sheetWrap').hidden=true;
}
$('rowsFile').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    pendingRows=file;await installRows(file);
    if(pdfHandle&&venue.plan.pageNumber){
      const sheet=await renderPdfPage(pdfHandle,venue.plan.pageNumber,venue.rows);
      venue.plan.labels=sheet.labels;repaint();
    }
  }
  catch(e){message('Row import rejected: '+e.message,true);}
  finally{event.target.value='';}
};
$('sheetSelect').onchange=async()=>{
  if(!pendingRows)return;
  try{
    await installRows(pendingRows,Number($('sheetSelect').value));
    if(pdfHandle&&venue.plan.pageNumber){
      const sheet=await renderPdfPage(pdfHandle,venue.plan.pageNumber,venue.rows);
      venue.plan.labels=sheet.labels;repaint();
    }
  }
  catch(e){message('Worksheet import rejected: '+e.message,true);}
};

async function adoptPdfPage(handle,page,source=null){
  if(venue.sections.length&&!confirm('Choosing a different drawing page will clear current traced sections. Continue?'))return false;
  const imported=await renderPdfPage(handle,page,venue.rows);
  const loaded=new Image();loaded.src=imported.imageData;await loaded.decode();
  const before=structuredClone(venue);
  let next=structuredClone(venue);
  if(source){next=appendSource(next,source);next.planSourceId=source.id;}
  next.plan={
    name:handle.name+' · page '+page,mime:'application/pdf',
    width:imported.width,height:imported.height,
    imageData:imported.imageData.length<6_000_000?imported.imageData:'',
    pageNumber:page,labels:imported.labels
  };
  next.calibration={corners:[],checkpoints:[]};
  next.sections=[];next.vectorCandidates=[];
  venue=normalizeVenue(next);image=loaded;registration=null;selectedSection='';
  viewMode='plan';canvas.hidden=false;modelCanvas.hidden=true;tab('plan');
  selectedSeat=null;editorMode='calibrate';draftPoints=[];preview=null;
  recordEdit(before,'Review PDF page '+page+' of '+handle.name);
  sync();repaint();resize();
  const analysis=imported.summary;
  $('pdfStatus').textContent='PDF page '+page+'/'+handle.count+
    ' · '+analysis.textCount+' selectable text items · '+
    analysis.matchingLabels+' section-label suggestions · operator confirmation required';
  message('PDF page rendered locally. '+analysis.assistance+
    '. Calibrate the court and trace boundaries manually.');
  return true;
}
$('pdfFile').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  let next=null;
  try{
    if(venue.sections.length&&!confirm('Importing a PDF resets current traced sections. Continue?'))return;
    next=await openPdfFile(file);
    const source=await describeFile(file,{role:'reference-plan',origin:'school-supplied'});
    const accepted=await adoptPdfPage(next,1,source);
    if(!accepted)return;
    if(pdfHandle)await closePdfFile(pdfHandle);
    pdfHandle=next;next=null;
    $('pdfPageWrap').hidden=pdfHandle.count<=1;
    $('pdfPage').replaceChildren(...Array.from({length:pdfHandle.count},
      (_,i)=>new Option('Page '+(i+1),String(i+1))));
    $('pdfPage').value='1';
  }catch(e){
    $('pdfStatus').textContent='PDF import failed. Your existing venue is retained.';
    message('PDF import rejected: '+e.message,true);
  }finally{
    if(next)await closePdfFile(next).catch(()=>{});
    event.target.value='';
  }
};
$('pdfPage').onchange=async()=>{
  if(!pdfHandle)return;
  const old=venue.plan.pageNumber;
  try{
    const applied=await adoptPdfPage(pdfHandle,Number($('pdfPage').value));
    if(!applied)$('pdfPage').value=String(old);
  }catch(e){
    $('pdfPage').value=String(old);
    message('PDF page could not be rendered: '+e.message,true);
  }
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
    const source=await describeFile(file,{role:'reference-plan',origin:'school-supplied'});
    const before=structuredClone(venue);
    venue=appendSource(venue,source);
    venue.planSourceId=source.id;venue.vectorCandidates=[];
    venue.plan={name:file.name,mime:file.type,width:image.width,height:image.height,imageData:'',
      pageNumber:null,labels:[]};
    if(pdfHandle){await closePdfFile(pdfHandle);pdfHandle=null;}
    $('pdfPageWrap').hidden=true;
    if(file.size<3_500_000){
      venue.plan.imageData=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));
        reader.onerror=()=>reject(Error('Unable to read plan image'));reader.readAsDataURL(file);
      });
    }
    venue.calibration.corners=[];venue.sections=[];selectedSection='';
    registration=null;preview=null;editorMode='calibrate';draftPoints=[];
    recordEdit(before,'Import raster drawing '+file.name);
    viewMode='plan';canvas.hidden=false;modelCanvas.hidden=true;tab('plan');
    sync();repaint();resize();message('Source image loaded and hashed. Calibrate four court corners; then trace sections.');
  }catch(e){message(e.message,true);}
  finally{event.target.value='';}
};
$('csvExample').onclick=()=>save('example-rows.csv',
  'section,row,seats,seat_start,tier,seat_type\r\nHOME,A,12,1,T1,bleacher\r\nHOME,B,12,1,T1,bleacher\r\nAWAY,A,10,1,T1,chair\r\n',mimeCSV);
$('fixture').onclick=()=>{
  const before=structuredClone(venue);
  venue=fictionalGym();registration=null;image=null;preview=null;selectedSection='';
  if(pdfHandle){closePdfFile(pdfHandle).catch(()=>{});pdfHandle=null;}
  $('pdfPageWrap').hidden=true;
  $('pdfStatus').textContent='No active PDF. Import a source drawing for manual review.';
  recordEdit(before,'Load fictional geometry fixture');
  editorMode='select';draftPoints=[];sync();tryPreview();
  workflowUI?.go('model');
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
      if(venue.rows.some(r=>r.section===s.sectionId&&r.row===s.row)){
        refreshRowControls(s.sectionId,s.row);
        $('seatEditNumber').value=String(s.number);fillSeatOffsetFields();
      }
    });}
    catch(e){message('WebGL2 unavailable: '+e.message,true);viewMode='plan';canvas.hidden=false;modelCanvas.hidden=true;repaint();return;}
  }
  renderer.load(preview.plan);renderer.resize();
  renderer.view(mode==='eye'?'human':'overview',selectedSeat);
  if(mode==='eye'&&!selectedSeat)message('Select a seat in 3D overview before entering Seat view.',true);
}
function tab(mode){
  $('canvasOverlay').hidden=mode!=='plan'||!(image||venue.rows.length||venue.sections.length||preview);
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
    const before=structuredClone(venue);
    let loadedImage=null;
    if(next.plan.imageData){
      loadedImage=new Image();loadedImage.src=next.plan.imageData;
      await loadedImage.decode();
    }
    if(pdfHandle){await closePdfFile(pdfHandle);pdfHandle=null;}
    $('pdfPageWrap').hidden=true;
    $('pdfStatus').textContent='No active PDF reader. Reattach the source PDF to review another page.';
    venue=next;image=loadedImage;registration=image&&next.calibration.corners.length===4?
      registerCourt(next.calibration.corners,next.court.width,next.court.length):null;
    preview=null;selectedSeat=null;selectedSection='';editorMode='select';draftPoints=[];
    recordEdit(before,'Import editable project');
    sync();tryPreview();message('Editable venue project opened.');
  }catch(e){message('Invalid project: '+e.message,true);}
  finally{event.target.value='';}
};
$('compareProject').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    if(file.size>12_000_000)throw Error('Previous project exceeds 12 MB');
    const prior=normalizeVenue(JSON.parse(await file.text()));
    const comparison=compareVenueProjects(prior,validateFields());
    $('delta').textContent=[
      'Seat-count delta: '+(comparison.seatDelta>0?'+':'')+comparison.seatDelta,
      'Section edits: '+comparison.sectionChanges.length,
      'Row edits: '+comparison.rowChanges.length,
      'New source files: '+comparison.sourceChanges.length,
      'Venue or sport changed: '+(comparison.venueChanged||comparison.sportChanged)
    ].join('\n');
    save(safeName()+'-project-diff.json',JSON.stringify(comparison,null,2));
    message('Project difference report created without overwriting the active project.');
  }catch(e){message('Compare failed: '+e.message,true);}
  finally{e.target.value='';}
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
    independentRegistration:preview.venue.calibration.corners.length===4?
      assessRegistration(preview.venue.calibration.corners,preview.venue.court.width,
      preview.venue.court.length,preview.venue.calibration.checkpoints||[]):null,
    sourceManifest:preview.venue.sources,sourceReview:assessSources(preview.venue),
    quality:preview.quality,changeLog:preview.venue.changeLog,
    staffEditLedger:preview.venue.editLedger,
    staffEditSummary:{
      editedRows:preview.venue.rows.filter(r=>r.operatorEdited).length,
      addedRows:preview.venue.rows.filter(r=>r.operatorAdded).length,
      changedSourceSeatCounts:preview.venue.rows.filter(r=>
        r.sourceSeats!==null&&r.sourceSeats!==undefined&&
        r.seats!==r.sourceSeats).length,
      deletedRowEvents:preview.venue.editLedger.filter(e=>e.operation==='remove-row').length,
      adjustedSeats:preview.venue.rows.reduce((n,r)=>n+(r.seatOverrides?.length??0),0),
      sourceReconciliationRequired:preview.venue.editLedger.length>0
    },
    ...preview.audit,rowRuns:preview.rowRuns,warnings:preview.warnings},null,2));
};
$('publish').onclick=async()=>{
  if(!preview){message('Generate a model first.',true);return;}
  if(preview.quality.blockingCount){
    message('Fix '+preview.quality.blockingCount+' blocking geometry issues before exporting.',true);return;
  }
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

$('addCheck').onclick=()=>{
  try{
    if(venue.calibration.corners.length!==4)throw Error('Calibrate the court first');
    const values=['checkPX','checkPY','checkX','checkZ'].map(id=>Number($(id).value));
    if(values.some((n,i)=>!$( ['checkPX','checkPY','checkX','checkZ'][i]).value.trim()||!Number.isFinite(n)))
      throw Error('Enter four valid calibration check coordinates');
    const [pixelX,pixelY,actualX,actualZ]=values;
    const before=structuredClone(venue);
    venue.calibration.checkpoints.push({pixelX,pixelY,actualX,actualZ});
    venue=normalizeVenue(venue);
    recordEdit(before,'Add independent calibration checkpoint');
    repaint();message('Independent plan registration check point added.');
  }catch(e){message(e.message,true);}
};
$('vectorFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    if(file.size>4_000_000)throw Error('Vector file exceeds 4 MB');
    const vectors=parseVectorFile(await file.text(),file.name);
    const raster=vectorToImage(vectors.contours,vectors.width,vectors.height);
    const loaded=new Image();loaded.src=raster.url;await loaded.decode();
    const source=await describeFile(file,{role:'reference-plan',origin:'school-supplied'});
    const before=structuredClone(venue);
    const next=appendSource(venue,source);
    next.planSourceId=source.id;
    next.plan={name:file.name,mime:file.type||'image/svg+xml',width:loaded.width,
      height:loaded.height,imageData:raster.url,pageNumber:null,labels:[]};
    next.calibration={corners:[],checkpoints:[]};
    next.sections=[];
    next.vectorCandidates=vectors.contours.map(item=>({
      id:item.id,kind:item.kind,
      points:item.points.map(p=>({x:p.x*raster.scale,y:p.y*raster.scale}))
    }));
    venue=normalizeVenue(next);image=loaded;vectorDrawing=vectors;registration=null;
    if(pdfHandle){await closePdfFile(pdfHandle);pdfHandle=null;}
    $('pdfPageWrap').hidden=true;
    selectedSection='';preview=null;editorMode='calibrate';draftPoints=[];
    recordEdit(before,'Import '+vectors.format+' vector plan '+file.name);
    viewMode='plan';canvas.hidden=false;modelCanvas.hidden=true;tab('plan');
    sync();repaint();resize();
    message(vectors.format+' contours imported ('+vectors.contours.length+
      '). Mark four court corners before reviewing section candidates.');
  }catch(err){message('Vector import rejected: '+err.message,true);}
  finally{e.target.value='';}
};
$('matchVectors').onclick=()=>{
  try{
    if(!registration)throw Error('Calibrate the drawing before matching vector sections');
    const names=new Set(venue.rows.map(r=>r.section.toLowerCase()));
    const candidates=venue.vectorCandidates.filter(c=>
      c.points.length===4&&names.has(c.id.toLowerCase())&&
      !venue.sections.some(s=>s.id.toLowerCase()===c.id.toLowerCase()));
    const counts=new Map();
    for(const c of candidates)counts.set(c.id.toLowerCase(),(counts.get(c.id.toLowerCase())||0)+1);
    const unique=candidates.filter(c=>counts.get(c.id.toLowerCase())===1);
    if(!unique.length)throw Error('No unique four-corner SVG/DXF labels match imported row section IDs');
    if(!confirm('Review '+unique.length+' labeled vector section candidates and import them as estimated contours?'))return;
    const before=structuredClone(venue);
    for(const item of unique){
      const p=item.points.map(q=>registration.toWorld(q));
      // Four-point contours have two candidate opposite edge pairs.
      // Select the closer edge as the inner front boundary.
      const edges=[[0,1,2,3],[1,2,3,0]];
      const center=(a,b)=>Math.hypot((p[a].x+p[b].x)/2,(p[a].z+p[b].z)/2);
      const front=edges.map(pair=>({pair,near:Math.min(center(pair[0],pair[1]),
        center(pair[2],pair[3]))})).sort((a,b)=>a.near-b.near)[0].pair;
      const nearA=center(front[0],front[1]),nearB=center(front[2],front[3]);
      const order=nearA<=nearB?front:[front[3],front[2],front[1],front[0]];
      venue.sections.push({
        id:item.id,front:[p[order[0]],p[order[1]]],
        back:[p[order[3]],p[order[2]]],trace:item.points,
        baseHeight:.45,rowRise:.28,provenance:'vector-label/operator-review'
      });
    }
    venue=normalizeVenue(venue);
    recordEdit(before,'Review and import '+unique.length+' vector section candidates');
    selectedSection=unique[0].id;refreshSections();tryPreview();
    message('Imported '+unique.length+' labeled contour candidates. Check their orientation and geometry.');
  }catch(err){message(err.message,true);}
};

const observer=new ResizeObserver(()=>resize());observer.observe(canvas.parentElement);
sync();repaint();resize();

$('openExisting').onclick=()=>$('openProject').click();
$('emptyUpload').onclick=()=>$('pdfFile').click();
workflowUI=setupWorkflow({onStageChange:stage=>{
  if(stage==='source'||stage==='calibrate')$('showPlan').click();
  if(stage==='model'&&preview)$('show3d').click();
  if(stage==='review'&&preview&&viewMode==='plan')$('show3d').click();
  requestAnimationFrame(()=>resize());
}});
function showCaseContext(c){
  $('caseContext').hidden=false;
  $('caseContextTitle').textContent=c.title+' · '+c.subtitle;
  $('caseContextText').textContent=c.description+
    (c.id==='aiken-high'?' All 30 displayed model rows and dimensions are assumed for QA.':'');
  $('caseContextSource').hidden=!c.source;
  if(c.source)$('caseContextSource').href=c.source;
}
$('caseContextDismiss').onclick=()=>{$('caseContext').hidden=true;};
function toggleDetails(force){
  const open=force??!document.querySelector('.layout').classList.contains('details-open');
  document.querySelector('.layout').classList.toggle('details-open',open);
  $('detailsBackdrop').hidden=!open;
  $('detailsToggle').setAttribute('aria-expanded',String(open));
  if(open)$('detailsClose').focus();
  else $('detailsToggle').focus();
}
$('detailsToggle').onclick=()=>toggleDetails();
$('detailsClose').onclick=()=>toggleDetails(false);
$('detailsBackdrop').onclick=()=>toggleDetails(false);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.querySelector('.layout').classList.contains('details-open'))
    toggleDetails(false);
});

async function openRequestedCase(){
  const params=new URLSearchParams(location.search);
  const example=params.get('example'),caseId=params.get('case');
  if(example==='fictional'){
    const c=getVenueCase('fictional-gym');showCaseContext(c);
    $('fixture').click();
  }else if(example==='aiken'){
    const c=getVenueCase('aiken-high');showCaseContext(c);
    try{
      const before=structuredClone(venue);
      venue=makeAikenUnverifiedOperatorDraft();
      image=null;registration=null;selectedSeat=null;selectedSection='';
      preview=null;editorMode='select';draftPoints=[];
      if(pdfHandle){await closePdfFile(pdfHandle);pdfHandle=null;}
      $('pdfPageWrap').hidden=true;
      $('pdfStatus').textContent='No PDF is attached to this demonstration. Open the real source document separately.';
      recordEdit(before,'Open Aiken operator-estimated example');
      sync();tryPreview();workflowUI.go('model');
      message('Aiken demo: published bank totals, assumed 30 rows and section geometry. NOT an official model.');
    }catch(e){message('Could not open the Aiken example: '+e.message,true);}
  }else if(caseId){
    const c=getVenueCase(caseId);
    if(c){
      showCaseContext(c);
      const before=structuredClone(venue);
      venue.school=c.subtitle;venue.venue=c.title;
      if(c.capacity!==null&&c.source){
        venue.officialCapacity=c.capacity;venue.capacitySource=c.source;
      }
      venue.notes=[c.description,'Source case metadata only. No verified row inventory or measured geometry is attached.'];
      venue=normalizeVenue(venue);
      recordEdit(before,'Load published case metadata: '+c.title);
      sync();repaint();workflowUI.go('source');
      message('Download the referenced source document and import it locally. No seats or geometry were fabricated.');
    }
  }
}
openRequestedCase();
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
