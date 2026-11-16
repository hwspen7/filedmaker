import {SPORT_DEFAULTS,newVenue,normalizeVenue,parseVenueRows} from '../src/workbench/contract.mjs';
import {registerCourt} from '../src/workbench/registration.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {buildWorkbenchPreview} from '../src/workbench/adapter.mjs';
import {applyVenueEdit,applyVenueBatchEdit} from '../src/workbench/editing.mjs';
import {editVenueStructure} from '../src/workbench/structureEditor.mjs';
import {editVenueStructureBatch} from '../src/workbench/structureBatch.mjs';
import {STRUCTURE_CATALOG} from '../src/workbench/structures.mjs';
import {editPlayingSurface} from '../src/workbench/surfaceEditor.mjs';
import {SURFACE_PRESETS,SURFACE_ZONE_KINDS,
  surfaceToWorld,worldToSurface} from '../src/workbench/surface.mjs';
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
let lastMeasurement=null;
const measurementKey=()=>JSON.stringify([venue.plan.name,venue.court,venue.calibration.corners]);
let preview=null,renderer=null,selectedSection='',selectedSeat=null,
  selectedStructure='',selectedStructureIds=new Set(),selectedZone='',activeModelTool='rows',
  activeStructureKind='platform',drag=null,viewMode='plan';
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
  selectedStructure='';selectedStructureIds.clear();selectedZone='';
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
  if(lastMeasurement&&lastMeasurement.key!==measurementKey()){
    lastMeasurement=null;
    $('measureResult').textContent='Source geometry changed. Remeasure the drawing.';
  }
  renderPdfSuggestions();
  $('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo;
  $('publishedCount').textContent=venue.officialCapacity==null?'—':number(venue.officialCapacity);
  refreshSections();
  refreshRowControls();
  refreshStructureControls();
  refreshSurfaceControls();
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
  if(!target){rows.replaceChildren();fillRowFields();refreshSpecialTools();return;}
  sections.value=target.id;
  const available=venue.rows.filter(r=>r.section.toLowerCase()===target.id.toLowerCase());
  rows.replaceChildren(...available.map(r=>new Option(r.row,r.row)));
  if(available.some(r=>r.row===currentRow))rows.value=currentRow;
  fillRowFields();
  refreshSpecialTools();
}

function populateOptions(select,values,desired){
  select.replaceChildren(...values.map(x=>new Option(x,x)));
  if(values.includes(desired))select.value=desired;
}
function refreshSpecialTools(){
  const sectionValues=venue.sections.map(s=>s.id);
  const active=$('rowEditSection').value;
  const batch=$('batchSection');
  const oldBatch=batch.value;
  populateOptions(batch,sectionValues,oldBatch||active);
  const seatSection=$('seatToolSection');
  populateOptions(seatSection,sectionValues,active);
  const seatRows=venue.rows.filter(r=>r.section===$('seatToolSection').value)
    .map(r=>r.row);
  populateOptions($('seatToolRow'),seatRows,$('rowEditRow').value);
  updateBatchPreview();
}
function updateBatchPreview(){
  const id=$('batchSection').value;
  const rows=venue.rows.filter(r=>r.section===id);
  const count=rows.reduce((n,r)=>n+r.seats,0);
  $('batchPreview').textContent=rows.length?
    rows.length+' rows · '+number(count)+' positions · staff review required':
    'Choose a section with source rows.';
}
function activateModelTool(tool){
  const permitted=new Set(['rows','seats','batch','surface','structures','preview']);
  activeModelTool=tool;
  if(!permitted.has(tool))return;
  document.querySelectorAll('[data-model-tool]').forEach(btn=>
    btn.setAttribute('aria-pressed',String(btn.dataset.modelTool===tool)));
  document.querySelectorAll('[data-model-tool-pane]').forEach(pane=>
    pane.hidden=pane.dataset.modelToolPane!==tool);
  if(tool==='seats')$('seatAdvanced').open=true;
}
function commitBatch(edit,summary){
  try{
    const before=structuredClone(venue);
    const result=applyVenueBatchEdit(venue,edit);
    venue=result.venue;selectedSeat=null;
    recordEdit(before,summary+' · '+result.affected);
    sync();tryPreview();
    message(summary+' · '+result.rowsAffected+' rows modified; capacity preserved. '+
      'Source review still required.');
  }catch(e){message('Batch rejected: '+e.message,true);}
}


function refreshSurfaceControls(preferredZone=null){
  const style=venue.surfaceDesign;
  const props={surfaceFloor:'floor',surfaceApron:'apron',surfaceLines:'lines',
    surfaceLane:'lane',surfaceApronWidth:'apronWidth',
    surfaceX:'centerX',surfaceZ:'centerZ',surfaceRotation:'rotation'};
  for(const [id,property] of Object.entries(props))$(id).value=style[property];
  $('surfaceShowMarkings').checked=style.showMarkings;
  $('surfaceShowBoards').checked=style.showBoards;
  $('surfaceWidth').value=venue.court.width;
  $('surfaceLength').value=venue.court.length;
  $('surfaceStatus').textContent=style.preset+' · '+style.zones.length+
    ' painted zones · '+venue.court.width.toFixed(2)+' × '+
    venue.court.length.toFixed(2)+' m · unverified';
  document.querySelectorAll('[data-surface-preset]').forEach(button=>
    button.setAttribute('aria-pressed',String(button.dataset.surfacePreset===style.preset)));
  const select=$('zoneSelect'),id=preferredZone??selectedZone??select.value;
  select.replaceChildren(...style.zones.map(zone=>new Option(zone.label+' · '+zone.id,zone.id)));
  const chosen=style.zones.find(zone=>zone.id===id)||style.zones[0];
  selectedZone=chosen?.id??'';
  if(chosen){
    select.value=chosen.id;
    $('zoneKind').value=chosen.kind;
    $('zoneWidth').value=chosen.width;
    $('zoneDepth').value=chosen.depth;
    $('zoneColor').value=chosen.color;
    $('zoneLabel').value=chosen.label;
    $('zoneX').value=chosen.x;
    $('zoneZ').value=chosen.z;
    $('zoneRotation').value=chosen.rotation;
  }else{
    $('zoneLabel').value='';
    $('zoneX').value='0';
    $('zoneZ').value='0';
    $('zoneRotation').value='0';
  }
}
function surfaceStyleFields(){
  return {floor:$('surfaceFloor').value,apron:$('surfaceApron').value,
    lines:$('surfaceLines').value,lane:$('surfaceLane').value,
    apronWidth:$('surfaceApronWidth').value,
    centerX:$('surfaceX').value,centerZ:$('surfaceZ').value,
    rotation:$('surfaceRotation').value,
    showMarkings:$('surfaceShowMarkings').checked,
    showBoards:$('surfaceShowBoards').checked};
}
function zoneFormFields(){
  return {x:$('zoneX').value,z:$('zoneZ').value,
    width:$('zoneWidth').value,depth:$('zoneDepth').value,
    rotation:$('zoneRotation').value,
    color:$('zoneColor').value,label:$('zoneLabel').value};
}
function commitSurface(command,title){
  try{
    const before=structuredClone(venue);
    const result=editPlayingSurface(venue,command);
    venue=result.venue;
    selectedZone=result.action==='zone-remove'?'':result.id||selectedZone;
    recordEdit(before,title);
    sync();tryPreview();
    refreshSurfaceControls(selectedZone);
    message(title+' saved · playing surface updated · original source seats unchanged. '+
      'Recheck measurements and field markings.');
    return true;
  }catch(e){message('Court edit rejected: '+e.message,true);return false;}
}
function courtHandles(){
  const style=venue.surfaceDesign,{width,length}=venue.court;
  return {center:surfaceToWorld({x:0,z:0},style),
    width:surfaceToWorld({x:width/2,z:0},style),
    length:surfaceToWorld({x:0,z:length/2},style),
    rotate:surfaceToWorld({x:0,z:length/2+2.2},style)};
}
const snap=(value,step=.25)=>Math.round(value/step)*step;
function zoneCenter(zone){
  return surfaceToWorld(zone,venue.surfaceDesign);
}
function fillStructureFields(s){
  const preset=STRUCTURE_CATALOG[s?.kind??activeStructureKind];
  $('structureLabel').value=s?.label??preset.label;
  for(const [id,prop,defaultValue] of [
    ['structureX','x',0],['structureY','y',0],['structureZ','z',0],
    ['structureYaw','yaw',0],['structureWidth','width',preset.width],
    ['structureDepth','depth',preset.depth],['structureHeight','height',preset.height]
  ])$(id).value=s?.[prop]??defaultValue;
  $('structureNote').value=s?.note??'';
}
function refreshStructurePalette(){
  const category=$('structureCategory').value;
  const search=$('structureSearch').value.trim().toLowerCase();
  document.querySelectorAll('[data-structure-kind]').forEach(button=>{
    const spec=STRUCTURE_CATALOG[button.dataset.structureKind];
    const group=button.dataset.structureCategory;
    button.hidden=(category!=='all'&&category!==group)||
      Boolean(search&&!spec.label.toLowerCase().includes(search)&&
        !button.dataset.structureKind.includes(search));
  });
}
function structureHandles(s){
  const a=s.yaw*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
  const at=(x,z)=>({x:s.x+c*x+sn*z,z:s.z-sn*x+c*z});
  return {resize:at(s.width/2,s.depth/2),
    rotate:at(0,s.depth/2+1.6)};
}
function refreshStructureControls(preferred=null){
  const structures=venue.structures??[];
  const valid=new Set(structures.map(s=>s.id));
  selectedStructureIds=new Set([...selectedStructureIds].filter(id=>valid.has(id)));
  const select=$('structureSelect');
  const id=preferred??selectedStructure??select.value;
  select.replaceChildren(...structures.map(s=>
    new Option(s.label+' · '+s.id,s.id)));
  const current=structures.find(s=>s.id===id)||structures[0];
  selectedStructure=current?.id??'';
  if(current&&!selectedStructureIds.size)selectedStructureIds.add(current.id);
  if(current){
    select.value=current.id;activeStructureKind=current.kind;
    fillStructureFields(current);
  }else fillStructureFields(null);
  const multi=$('structureMultiSelect');
  multi.replaceChildren(...structures.map(s=>{
    const option=new Option(s.label+' · '+s.id,s.id);
    option.selected=selectedStructureIds.has(s.id);
    return option;
  }));
  $('structureGroupStatus').textContent=selectedStructureIds.size+
    ' selected · Ctrl-click on the plan or drag an empty area to box-select';
  document.querySelectorAll('[data-structure-kind]').forEach(button=>
    button.setAttribute('aria-pressed',
      String(button.dataset.structureKind===activeStructureKind)));
  refreshStructurePalette();
  $('structureStatus').textContent=structures.length?
    structures.length+' component(s) · '+selectedStructureIds.size+
      ' selected · provisional geometry':
    'No components yet. Choose a type, then add or place it.';
}
function structureFormValues(){
  return {x:$('structureX').value,z:$('structureZ').value,
    y:$('structureY').value,yaw:$('structureYaw').value,
    width:$('structureWidth').value,depth:$('structureDepth').value,
    height:$('structureHeight').value,label:$('structureLabel').value,
    note:$('structureNote').value};
}
function commitStructure(command,title){
  try{
    const before=structuredClone(venue);
    const result=editVenueStructure(venue,command);
    venue=result.venue;selectedStructure=result.action==='remove'?'':result.id;
    selectedStructureIds=new Set(result.action==='remove'?[]:[result.id]);
    recordEdit(before,title+' · '+result.id);
    sync();tryPreview();refreshStructureControls(selectedStructure);
    message(title+' saved. '+result.count+' components · seat count unchanged · source review required.');
    return true;
  }catch(e){message('Component rejected: '+e.message,true);return false;}
}
function commitStructureBatch(command,title){
  try{
    const before=structuredClone(venue);
    const result=editVenueStructureBatch(venue,command);
    venue=result.venue;
    selectedStructureIds=new Set(result.ids);
    selectedStructure=result.ids[0]||'';
    recordEdit(before,title+' · '+result.affected+' components');
    sync();tryPreview();refreshStructureControls(selectedStructure);
    message(title+' completed for '+result.affected+
      ' components · one undo step · source seats unchanged.');
    return true;
  }catch(e){message('Group operation rejected: '+e.message,true);return false;}
}
function selectStructure(id,additive=false){
  if(!(venue.structures??[]).some(s=>s.id===id))return;
  if(additive){
    if(selectedStructureIds.has(id)&&selectedStructureIds.size>1)
      selectedStructureIds.delete(id);
    else selectedStructureIds.add(id);
    selectedStructure=selectedStructureIds.has(id)?id:[...selectedStructureIds][0]||id;
  }else{
    selectedStructure=id;selectedStructureIds=new Set([id]);
  }
  refreshStructureControls(selectedStructure);
  activateModelTool('structures');
  if(selectedStructureIds.size>1)$('structureGroupTools').open=true;
  message(selectedStructureIds.size+' selected · drag to move, or use Arrange multiple components.');
  repaint();
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
  $('rowEditDirection').value=r.seatDirection??'forward';
  $('rowEditType').value=r.seatType??'chair';
  $('rowInsetStart').value=r.insetStartM??0;
  $('rowInsetEnd').value=r.insetEndM??0;
  $('rowDepthOffset').value=r.depthOffsetM??0;
  $('rowEditElevation').value=r.elevation??'';
  $('rowEditStatus').textContent=r.operatorEdited?
    'Staff-edited · original count '+(r.sourceSeats??'not supplied')+
      ' · pending source verification':
    'Imported/fixture row · '+r.seats+' modeled seats · unverified geometry';
  const valid=new Set((r.seatNumbers??[]).length?r.seatNumbers:
    Array.from({length:r.seats},(_,i)=>String(r.first+i)));
  if(!valid.has($('seatEditNumber').value))
    $('seatEditNumber').value=r.seatNumbers?.[0]??String(r.first);
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
  const inset=32;
  // Frame placed structures as well as source contours. Freeze the view
  // bounds while dragging to avoid zoom feedback under the pointer.
  const components=drag?.before?.structures??venue.structures??[];
  const extents=components.map(s=>{
    const angle=s.yaw*Math.PI/180,ca=Math.abs(Math.cos(angle));
    const sn=Math.abs(Math.sin(angle));
    return {x:Math.abs(s.x)+(ca*s.width+sn*s.depth)/2+2,
      z:Math.abs(s.z)+(sn*s.width+ca*s.depth)/2+2};
  });
  const surface=venue.surfaceDesign,angle=surface.rotation*Math.PI/180;
  const ca=Math.abs(Math.cos(angle)),sn=Math.abs(Math.sin(angle));
  const halfWidth=venue.court.width/2+surface.apronWidth;
  const halfLength=venue.court.length/2+surface.apronWidth;
  const maxX=Math.max(venue.court.width/2+18,12,
    ...venue.sections.flatMap(s=>[...s.front,...s.back].map(p=>Math.abs(p.x)+4)),
    ...extents.map(v=>v.x),Math.abs(surface.centerX)+ca*halfWidth+sn*halfLength+4);
  const maxZ=Math.max(venue.court.length/2+9,20,
    ...venue.sections.flatMap(s=>[...s.front,...s.back].map(p=>Math.abs(p.z)+4)),
    ...extents.map(v=>v.z),Math.abs(surface.centerZ)+sn*halfWidth+ca*halfLength+4);
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
  const surfaceStyle=venue.surfaceDesign;
  const court=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>
    worldToScreen(surfaceToWorld({x:x*venue.court.width/2,
      z:z*venue.court.length/2},surfaceStyle),g));
  if(!image||registration)outline(court,image?'#7ba7ab25':
    surfaceStyle.floor+'7c',surfaceStyle.lines,2);
  if(!image||registration){
    const center=worldToScreen(surfaceToWorld({x:0,z:0},surfaceStyle),g);
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


  // Editable surface overlays are drawn in source-world coordinates.
  for(const zone of surfaceStyle.zones){
    const a=zone.rotation*Math.PI/180,c=Math.cos(a),sin=Math.sin(a);
    const local=([x,z])=>{
      const rotate={x:zone.x+x*c+z*sin,z:zone.z-x*sin+z*c};
      return worldToScreen(surfaceToWorld(rotate,surfaceStyle),g);
    };
    const d=zone.kind==='stripe'?Math.min(zone.depth,.25):zone.depth;
    const vertices=zone.kind==='circle'?
      Array.from({length:40},(_,i)=>{
        const t=i*2*Math.PI/40;return local([Math.cos(t)*zone.width/2,
          Math.sin(t)*zone.depth/2]);
      }):
      [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,z])=>
        local([x*zone.width,z*d]));
    outline(vertices,zone.color+'78',zone.id===selectedZone?'#bb782b':zone.color,
      zone.id===selectedZone?2.8:1.4);
    if(activeModelTool==='surface'&&zone.id===selectedZone){
      const center=worldToScreen(zoneCenter(zone),g);
      ctx.beginPath();ctx.arc(center.x,center.y,6,0,Math.PI*2);
      ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#bf8134';ctx.lineWidth=2;ctx.stroke();
    }
  }
  if(activeModelTool==='surface'&&workflowUI?.current==='model'){
    const controls=courtHandles();
    for(const [kind,p] of Object.entries(controls)){
      const q=worldToScreen(p,g);
      ctx.beginPath();ctx.arc(q.x,q.y,kind==='center'?7:6,0,Math.PI*2);
      ctx.fillStyle=kind==='center'?'#ffd285':kind==='rotate'?'#8cacb9':'#fff';
      ctx.fill();
      ctx.strokeStyle='#3d6c7e';ctx.lineWidth=2;ctx.stroke();
    }
  }
  // Source-derived components are drawn above seating plans for reliable
  // selection, but never change the official aisle or row inventory.
  for(const s of venue.structures??[]){
    const angle=s.yaw*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle);
    const half=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
    const boundary=half.map(([x,z])=>worldToScreen({
      x:s.x+c*x*s.width+sn*z*s.depth,
      z:s.z-sn*x*s.width+c*z*s.depth
    },g));
    const chosen=selectedStructureIds.has(s.id);
    outline(boundary,chosen?'#8cb9c088':'#668b9766',
      chosen?'#276d8c':'#56717e',chosen?3:1.5);
    const center=worldToScreen(s,g);
    // Keep the canvas free from overlapping component labels. The active
    // object shows its ID only while editing the construction layer.
    if(chosen&&activeModelTool==='structures'){
      ctx.fillStyle='#193c50';ctx.font='700 10px system-ui';
      ctx.textAlign='center';ctx.fillText(s.id,center.x,center.y-14);
    }
    if(chosen&&activeModelTool==='structures'){
      ctx.beginPath();ctx.arc(center.x,center.y,5,0,2*Math.PI);
      ctx.fillStyle='#ffc16a';ctx.fill();
      if(activeModelTool==='structures'&&s.id===selectedStructure)
        for(const [kind,pos] of Object.entries(structureHandles(s))){
        const q=worldToScreen(pos,g);
        ctx.beginPath();ctx.arc(q.x,q.y,kind==='rotate'?6:7,0,Math.PI*2);
        ctx.fillStyle=kind==='rotate'?'#b9e1e6':'#fff';
        ctx.fill();ctx.strokeStyle='#276d8c';ctx.lineWidth=2;ctx.stroke();
      }
    }
  }
  if(lastMeasurement&&lastMeasurement.key===measurementKey()){
    const a=worldToScreen(lastMeasurement.start,g),b=worldToScreen(lastMeasurement.end,g);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    ctx.strokeStyle='#c18031';ctx.lineWidth=2.5;ctx.stroke();
    for(const pos of [a,b]){
      ctx.beginPath();ctx.arc(pos.x,pos.y,4.5,0,2*Math.PI);
      ctx.fillStyle='#f3b35c';ctx.fill();
    }
    ctx.fillStyle='#8a501f';ctx.font='bold 12px system-ui';
    ctx.fillText(lastMeasurement.distance.toFixed(2)+' m',
      (a.x+b.x)/2,(a.y+b.y)/2-10);
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
  if(drag?.kind==='box'){
    const a=drag.start,b=drag.end;
    ctx.save();
    ctx.strokeStyle='#196c94';ctx.fillStyle='#3b8db022';
    ctx.lineWidth=1.5;ctx.setLineDash([6,4]);
    const left=Math.min(a.x,b.x),top=Math.min(a.y,b.y);
    const w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
    ctx.fillRect(left,top,w,h);ctx.strokeRect(left,top,w,h);
    ctx.restore();
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
    number(preview.seats.length)+' seats · '+number(venue.sections.length)+
      ' sections · '+(venue.structures?.length??0)+' components · needs review':
    venue.rows.length?number(venue.rows.length)+' source rows · not yet modeled':
    'No seats generated';
  $('publishedCount').textContent=venue.officialCapacity==null?'—':number(venue.officialCapacity);
  $('evidenceStatus').textContent=preview?.quality?.blockingCount?'Geometry blocked':
    preview?'Unverified model · human review required':
    venue.plan.name||venue.rows.length?'Import / calibration in progress':'Awaiting source files';
  $('modeLabel').textContent=editorMode==='place-structure'?
    'Place component · click a point on the calibrated 2D plan':
    editorMode==='place-zone'?'Paint zone · click a point on the calibrated 2D plan':
    editorMode==='select'&&activeModelTool==='surface'?
      'Court · drag handles to move, resize or rotate':
    editorMode==='select'&&activeModelTool==='structures'?
      'Build · drag to move, Ctrl-click to multi-select, or box-select empty space':
    editorMode==='select'?'Select · drag a section corner to adjust':
    editorMode==='calibrate'?'Calibration · mark all four court corners':
    editorMode==='measure'?'Ruler · select two plan points':
    'Tracing · front left → front right → rear right → rear left';
  $('emptyCanvas').hidden=!!(image||venue.rows.length||venue.sections.length||preview)||viewMode!=='plan';
  $('canvasOverlay').hidden=!(image||venue.rows.length||venue.sections.length||preview)||viewMode!=='plan';
  $('canvasOverlay').textContent=editorMode==='place-structure'?
    'Click on the plan to place '+STRUCTURE_CATALOG[activeStructureKind].label+
    '. This will not alter source seat counts.':
    editorMode==='place-zone'?
      'Click the calibrated plan to place the selected painted area.':
    editorMode==='select'&&activeModelTool==='surface'?
      'Drag the golden center to reposition the court, white handles to resize, or the blue handle to rotate.':
    editorMode==='select'&&activeModelTool==='structures'?
      'Select a component to move, resize or rotate it. The numeric controls are optional.':
    editorMode==='measure'?'Select two points on the plan for a provisional distance.':
    editorMode==='calibrate'?'Click the four court corners in order: near left, near right, far right, far left.':
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
    if(editorMode==='measure'){
      const world=screenToWorld(p,g);
      draftPoints.push({world});
      if(draftPoints.length===2){
        const [a,b]=draftPoints.map(x=>x.world),distance=Math.hypot(b.x-a.x,b.z-a.z);
        lastMeasurement={start:a,end:b,distance,key:measurementKey()};
        $('measureResult').textContent='Plan-derived distance '+distance.toFixed(3)+
          ' m · Not an independently verified measurement.';
        draftPoints=[];editorMode='select';
        message('Plan ruler completed. Confirm drawing scale before using any dimensions.');
      }else message('Measure a second point on the drawing.');
      repaint();return;
    }
    if(editorMode==='place-zone'){
      const world=screenToWorld(p,g),local=worldToSurface(world,venue.surfaceDesign);
      const ok=commitSurface({action:'zone-add',kind:$('zoneKind').value,
        x:snap(local.x),z:snap(local.z),width:$('zoneWidth').value,
        depth:$('zoneDepth').value,color:$('zoneColor').value},
        'Place custom surface marking');
      if(ok){editorMode='select';activateModelTool('surface');}
      repaint();return;
    }
    if(editorMode==='place-structure'){
      const world=screenToWorld(p,g);
      const values=structureFormValues();
      const success=commitStructure({action:'add',kind:activeStructureKind,
        ...values,x:world.x,z:world.z},
        'Place '+STRUCTURE_CATALOG[activeStructureKind].label);
      if(success){
        if(!$('structureRepeat').checked)editorMode='select';
        selectedSection='';draw();
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
    if(workflowUI?.current==='model'&&activeModelTool==='surface'){
      const design=venue.surfaceDesign;
      let candidate=null,distance=13;
      for(const zone of design.zones){
        const q=worldToScreen(zoneCenter(zone),g);
        const d=Math.hypot(q.x-p.x,q.y-p.y);
        if(d<distance){candidate=zone;distance=d;}
      }
      if(candidate){
        selectedZone=candidate.id;refreshSurfaceControls(selectedZone);
        drag={kind:'zone',id:selectedZone,before:structuredClone(venue)};
        canvas.setPointerCapture(event.pointerId);
        draw();return;
      }
      let handle=null;distance=16;
      for(const [kind,world] of Object.entries(courtHandles())){
        const q=worldToScreen(world,g),d=Math.hypot(q.x-p.x,q.y-p.y);
        if(d<distance){handle=kind;distance=d;}
      }
      if(handle){
        drag={kind:'court',handle,before:structuredClone(venue)};
        canvas.setPointerCapture(event.pointerId);
        return;
      }
    }
    if(workflowUI?.current==='model'&&(venue.structures?.length??0)){
      const selected=venue.structures.find(s=>s.id===selectedStructure);
      if(selected&&activeModelTool==='structures'){
        for(const [mode,point] of Object.entries(structureHandles(selected))){
          const q=worldToScreen(point,g);
          if(Math.hypot(q.x-p.x,q.y-p.y)<15){
            drag={kind:'structure',mode,id:selected.id,before:structuredClone(venue)};
            canvas.setPointerCapture(event.pointerId);
            return;
          }
        }
      }
      let closest=null,distance=18;
      for(const structure of venue.structures){
        const q=worldToScreen(structure,g),d=Math.hypot(q.x-p.x,q.y-p.y);
        if(d<distance){closest=structure;distance=d;}
      }
      if(closest){
        if(event.ctrlKey||event.metaKey){
          selectStructure(closest.id,true);return;
        }
        const grouped=activeModelTool==='structures'&&
          selectedStructureIds.size>1&&selectedStructureIds.has(closest.id);
        if(!grouped)selectStructure(closest.id);
        else{selectedStructure=closest.id;refreshStructureControls(closest.id);}
        const world=screenToWorld(p,g);
        drag={kind:grouped?'structure-group':'structure',mode:'move',id:closest.id,
          ids:grouped?[...selectedStructureIds]:[closest.id],
          offsetX:world.x-closest.x,offsetZ:world.z-closest.z,
          before:structuredClone(venue)};
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      if(activeModelTool==='structures'){
        drag={kind:'box',start:p,end:p,additive:event.ctrlKey||event.metaKey};
        canvas.setPointerCapture(event.pointerId);
        draw();return;
      }
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
  if(drag.kind==='box'){
    drag.end=pointer(event);draw();return;
  }
  if(drag.kind==='structure-group'){
    try{
      const position=screenToWorld(pointer(event),layout());
      const anchor=drag.before.structures.find(s=>s.id===drag.id);
      if(!anchor)return;
      const step=event.shiftKey?.05:.25;
      const dx=snap(position.x-(drag.offsetX??0)-anchor.x,step);
      const dz=snap(position.z-(drag.offsetZ??0)-anchor.z,step);
      for(const id of drag.ids){
        const original=drag.before.structures.find(s=>s.id===id);
        const current=venue.structures.find(s=>s.id===id);
        if(original&&current){current.x=original.x+dx;current.z=original.z+dz;}
      }
      draw();
    }catch{}
    return;
  }
  if(drag.kind==='court'||drag.kind==='zone'){
    try{
      const world=screenToWorld(pointer(event),layout()),design=venue.surfaceDesign;
      if(drag.kind==='zone'){
        const zone=design.zones.find(s=>s.id===drag.id);
        if(zone){
          const local=worldToSurface(world,design);
          zone.x=snap(local.x,event.shiftKey?.05:.25);
          zone.z=snap(local.z,event.shiftKey?.05:.25);
        }
      }else if(drag.handle==='center'){
        design.centerX=snap(world.x,event.shiftKey?.05:.25);
        design.centerZ=snap(world.z,event.shiftKey?.05:.25);
      }else{
        const local=worldToSurface(world,design);
        if(drag.handle==='width'){
          venue.court.width=Math.min(160,Math.max(8,snap(2*Math.abs(local.x),.25)));
        }else if(drag.handle==='length'){
          venue.court.length=Math.min(200,Math.max(15,snap(2*Math.abs(local.z),.25)));
        }else if(drag.handle==='rotate'){
          const angle=Math.atan2(world.x-design.centerX,world.z-design.centerZ)*180/Math.PI;
          design.rotation=Math.max(-180,Math.min(180,snap(angle,5)));
        }
      }
      draw();
    }catch{}
    return;
  }
  if(drag.kind==='structure'){
    try{
      const position=screenToWorld(pointer(event),layout());
      const step=event.shiftKey?.05:.25;
      const structure=venue.structures.find(s=>s.id===drag.id);
      if(structure&&Number.isFinite(position.x+position.z)){
        if(drag.mode==='resize'){
          const a=structure.yaw*Math.PI/180,c=Math.cos(a),sin=Math.sin(a);
          const x=position.x-structure.x,z=position.z-structure.z;
          const localX=c*x-sin*z,localZ=sin*x+c*z;
          structure.width=Math.min(30,Math.max(.4,snap(2*Math.abs(localX),step)));
          structure.depth=Math.min(24,Math.max(.08,snap(2*Math.abs(localZ),step)));
        }else if(drag.mode==='rotate'){
          structure.yaw=Math.max(-180,Math.min(180,
            snap(Math.atan2(position.x-structure.x,
              position.z-structure.z)*180/Math.PI,5)));
        }else{
          structure.x=snap(position.x-(drag.offsetX??0),step);
          structure.z=snap(position.z-(drag.offsetZ??0),step);
        }
        draw();
      }
    }catch{}
    return;
  }
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
  if(completed.kind==='box'){
    const a=completed.start,b=completed.end;
    if(Math.hypot(b.x-a.x,b.y-a.y)>=8){
      const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x);
      const top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
      const selected=venue.structures.filter(s=>{
        const point=worldToScreen(s,layout());
        return point.x>=left&&point.x<=right&&point.y>=top&&point.y<=bottom;
      }).map(s=>s.id);
      if(!completed.additive)selectedStructureIds.clear();
      for(const id of selected)selectedStructureIds.add(id);
      selectedStructure=[...selectedStructureIds][0]||'';
      refreshStructureControls(selectedStructure);
      if(selectedStructureIds.size>1)$('structureGroupTools').open=true;
      message(selectedStructureIds.size+' components selected with the plan box.');
    }
    draw();return;
  }
  if(completed.kind==='structure-group'){
    const before=completed.before.structures.find(s=>s.id===completed.id);
    const after=venue.structures.find(s=>s.id===completed.id);
    const dx=after.x-before.x,dz=after.z-before.z;
    venue=completed.before;
    if(dx||dz)commitStructureBatch({
      action:'translate',ids:completed.ids,dx,dz
    },'Move selected components');
    else{sync();tryPreview();}
    return;
  }
  if(completed.kind==='court'||completed.kind==='zone'){
    const changed=structuredClone(venue);
    venue=completed.before;
    let command=null,summary='Move playing surface';
    if(completed.kind==='zone'){
      const zone=changed.surfaceDesign.zones.find(s=>s.id===completed.id);
      if(zone)command={action:'zone-update',id:zone.id,
        changes:{x:zone.x,z:zone.z}};
      summary='Move painted floor zone';
    }else if(completed.handle==='width'||completed.handle==='length'){
      command={action:'dimensions',width:changed.court.width,length:changed.court.length};
      summary='Resize court on 2D plan';
    }else{
      command={action:'style',changes:{
        centerX:changed.surfaceDesign.centerX,centerZ:changed.surfaceDesign.centerZ,
        rotation:changed.surfaceDesign.rotation}};
    }
    if(command)commitSurface(command,summary);
    else {sync();tryPreview();}
    return;
  }
  try{
    const candidate=normalizeVenue(venue);
    if(candidate.rows.length&&candidate.rows.every(r=>candidate.sections.some(s=>
      s.id.toLowerCase()===r.section.toLowerCase()))){
      const geometry=generateTracedVenue(candidate);
      if(geometry.quality.blockingCount)
        throw Error('Dragged contour causes '+geometry.quality.blockingCount+' blocking geometry issues');
    }
    venue=candidate;
    recordEdit(completed.before,(completed.kind==='structure'?'Move component ':'Adjust traced section ')+completed.id);
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
  if((old.sections.length||old.rows.length||old.structures?.length)&&!confirm('Changing venue type will reset the traced sections, rows and draft components. Continue?')){
    $('sport').value=old.sport;return;
  }
  venue=newVenue($('sport').value);venue.school=old.school;venue.venue=old.venue;
  selectedStructure='';selectedStructureIds.clear();selectedZone='';
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
$('measureTool').onclick=()=>{
  if(image&&!registration){
    message('Calibrate the court before measuring distances on a drawing.',true);return;
  }
  editorMode='measure';draftPoints=[];
  $('measureResult').textContent='Select the first plan point, then the second.';
  repaint();
};
$('measureClear').onclick=()=>{
  lastMeasurement=null;draftPoints=[];editorMode='select';
  $('measureResult').textContent='No plan measurement yet.';
  repaint();
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
$('rowEditRow').onchange=()=>{fillRowFields();refreshSpecialTools();draw();};
$('seatToolSection').onchange=()=>refreshRowControls($('seatToolSection').value);
$('seatToolRow').onchange=()=>refreshRowControls($('seatToolSection').value,$('seatToolRow').value);
$('batchSection').onchange=()=>updateBatchPreview();
$('batchApplyStyle').onclick=()=>commitBatch({section:$('batchSection').value,
  kind:'seat-type',seatType:$('batchSeatType').value},'Batch seat style');
$('batchApplyInsets').onclick=()=>commitBatch({section:$('batchSection').value,
  kind:'end-insets',insetStartM:$('batchInsetStart').value,
  insetEndM:$('batchInsetEnd').value},'Batch row clearance');
document.querySelectorAll('[data-model-tool]').forEach(button=>
  button.onclick=()=>activateModelTool(button.dataset.modelTool));

$('openReviewFromScene').onclick=()=>workflowUI?.go('review');

document.querySelectorAll('[data-surface-preset]').forEach(button=>
  button.onclick=()=>commitSurface({action:'preset',
    preset:button.dataset.surfacePreset},'Set playing surface palette'));
$('surfaceApplyStyle').onclick=()=>commitSurface({
  action:'style',changes:surfaceStyleFields()
},'Edit floor colors, markings and placement');
$('surfaceApplyDimensions').onclick=()=>commitSurface({
  action:'dimensions',width:$('surfaceWidth').value,
  length:$('surfaceLength').value
},'Resize documented playing area');
$('surfaceReset').onclick=()=>commitSurface({
  action:'reset'
},'Reset playing surface finish');
$('surfaceEditOnPlan').onclick=()=>{
  if(image&&!registration){
    message('Calibrate the source plan before manipulating the playing surface.',true);
    return;
  }
  $('showPlan').click();
  activateModelTool('surface');
  editorMode='select';
  repaint();
  message('Drag the center handle to move, the side handles to resize, or the upper handle to rotate. Hold Shift for fine snapping.');
};
$('zoneAdd').onclick=()=>{
  commitSurface({action:'zone-add',kind:$('zoneKind').value,
    x:0,z:0,width:$('zoneWidth').value,depth:$('zoneDepth').value,
    color:$('zoneColor').value},'Add painted floor area');
};
$('zonePlace').onclick=()=>{
  if(image&&!registration){
    message('Calibrate the court drawing before locating a painted zone.',true);
    return;
  }
  $('showPlan').click();activateModelTool('surface');
  $('surfaceZones').open=true;
  editorMode='place-zone';
  repaint();
  message('Click the plan to place the zone. The shape and size can be adjusted afterwards.');
};
$('zoneSelect').onchange=()=>{
  selectedZone=$('zoneSelect').value;
  refreshSurfaceControls(selectedZone);draw();
};
$('zoneApply').onclick=()=>{
  if(!selectedZone)return message('Select a painted zone first.',true);
  commitSurface({action:'zone-update',id:selectedZone,
    changes:zoneFormFields()},'Edit painted floor area');
};
$('zoneDuplicate').onclick=()=>{
  if(!selectedZone)return message('Select a painted zone first.',true);
  commitSurface({action:'zone-duplicate',id:selectedZone},'Duplicate floor area');
};
$('zoneRemove').onclick=()=>{
  if(!selectedZone)return message('Select a painted zone first.',true);
  commitSurface({action:'zone-remove',id:selectedZone},'Remove painted floor area');
};

function setStructureKind(kind){
  if(!Object.hasOwn(STRUCTURE_CATALOG,kind))return;
  activeStructureKind=kind;
  fillStructureFields(null);
  document.querySelectorAll('[data-structure-kind]').forEach(button=>
    button.setAttribute('aria-pressed',
      String(button.dataset.structureKind===kind)));
  const category=STRUCTURE_CATALOG[kind].category||
    ({platform:'access',stairs:'access',rail:'access',portal:'access',
      wall:'structure',scoreboard:'equipment',table:'equipment'}[kind]??'access');
  if($('structureCategory').value!=='all')$('structureCategory').value=category;
  refreshStructurePalette();
  $('structureStatus').textContent='Ready to create '+STRUCTURE_CATALOG[kind].label+
    '. Set the dimensions, then add or place on the 2D plan.';
}
document.querySelectorAll('[data-structure-kind]').forEach(button=>
  button.onclick=()=>setStructureKind(button.dataset.structureKind));
$('structureCategory').onchange=()=>refreshStructurePalette();
$('structureSearch').oninput=()=>refreshStructurePalette();
$('structureMultiSelect').onchange=()=>{
  const selected=[...$('structureMultiSelect').selectedOptions].map(o=>o.value);
  selectedStructureIds=new Set(selected);
  selectedStructure=selected[0]||'';
  refreshStructureControls(selectedStructure);
  repaint();
};
$('structureSelectAll').onclick=()=>{
  selectedStructureIds=new Set(venue.structures.map(s=>s.id));
  selectedStructure=[...selectedStructureIds][0]||'';
  refreshStructureControls(selectedStructure);repaint();
};
$('structureSelectOne').onclick=()=>{
  selectedStructureIds=new Set(selectedStructure?[selectedStructure]:[]);
  refreshStructureControls(selectedStructure);repaint();
};
for(const [button,action] of [
  ['structureGroupAlign','align'],['structureGroupSpace','distribute'],
  ['structureGroupMirror','mirror'],['structureGroupMove','translate'],
  ['structureGroupCopy','duplicate'],['structureGroupArray','array']
]){
  $(button).onclick=()=>{
    const command={action,ids:[...selectedStructureIds]};
    if(['align','distribute','mirror'].includes(action))
      command.axis=$('structureGroupAxis').value;
    else{
      command.dx=$('structureGroupDx').value;
      command.dz=$('structureGroupDz').value;
      if(action==='array')command.copies=$('structureGroupCopies').value;
    }
    commitStructureBatch(command,{
      align:'Align selected component centers',
      distribute:'Space selected components evenly',
      mirror:'Mirror selected component layout',
      translate:'Move selected components',
      duplicate:'Duplicate selected components',
      array:'Create repeated component array'
    }[action]);
  };
}
$('structureGroupRemove').onclick=()=>{
  const ids=[...selectedStructureIds];
  if(!ids.length)return message('Select components to remove.',true);
  if(!confirm('Remove '+ids.length+' selected draft components?'))return;
  commitStructureBatch({action:'remove',ids},'Remove selected components');
};
document.querySelectorAll('[data-structure-nudge]').forEach(button=>
  button.onclick=()=>{
    const s=venue.structures.find(x=>x.id===selectedStructure);
    if(!s)return message('Select a component to move.',true);
    const delta={left:[-.25,0],right:[.25,0],up:[0,-.25],down:[0,.25]}
      [button.dataset.structureNudge];
    if(!delta)return;
    commitStructure({action:'update',id:s.id,
      changes:{x:Math.round((s.x+delta[0])*100)/100,
        z:Math.round((s.z+delta[1])*100)/100}},'Nudge venue component');
  });
$('structureSelect').onchange=()=>selectStructure($('structureSelect').value);
$('structureAdd').onclick=()=>{
  commitStructure({action:'add',kind:activeStructureKind,
    ...structureFormValues()},'Add '+STRUCTURE_CATALOG[activeStructureKind].label);
};
$('structureApply').onclick=()=>{
  if(!selectedStructure)return message('Select or create a component first.',true);
  commitStructure({action:'update',id:selectedStructure,
    changes:structureFormValues()},'Edit venue component');
};
$('structurePickOnPlan').onclick=()=>{
  if(image&&!registration){
    message('Calibrate the source drawing before placing components on the plan.',true);
    return;
  }
  $('showPlan').click();
  editorMode='place-structure';
  draftPoints=[];
  repaint();
  message('Click the 2D plan to place '+STRUCTURE_CATALOG[activeStructureKind].label+
    '. Hold Shift while dragging to snap to a 10 cm grid.');
};
$('structureDuplicate').onclick=()=>{
  if(!selectedStructure)return message('Select a component first.',true);
  commitStructure({action:'duplicate',id:selectedStructure},'Duplicate venue component');
};
$('structureRotate').onclick=()=>{
  const s=venue.structures.find(s=>s.id===selectedStructure);
  if(!s)return message('Select a component first.',true);
  const next=((s.yaw+90+180)%360)-180;
  commitStructure({action:'update',id:s.id,changes:{yaw:next}},'Rotate venue component');
};
$('structureRemove').onclick=()=>{
  if(!selectedStructure)return message('Select a component first.',true);
  if(!confirm('Remove '+selectedStructure+' from this editable draft?'))return;
  commitStructure({action:'remove',id:selectedStructure},'Remove venue component');
};
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
        activateModelTool('seats');
      }
    });}
    catch(e){message('WebGL2 unavailable: '+e.message,true);viewMode='plan';canvas.hidden=false;modelCanvas.hidden=true;repaint();return;}
  }
  renderer.onStructurePick=structure=>selectStructure(structure.id);
  renderer.onFrame=current=>{
    const metrics=current.framingMetrics();
    modelCanvas.dataset.seatingWidth=(metrics.seatWidth*100).toFixed(1);
    modelCanvas.dataset.seatingHeight=(metrics.seatHeight*100).toFixed(1);
  };
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

function requireModelCamera(){
  if(!preview){message('Generate a 3D preview first.',true);return null;}
  if(viewMode==='plan')open3d('overview');
  return renderer;
}
$('cameraFit').onclick=()=>{
  const view=requireModelCamera();if(!view)return;
  view.focusOnModel();$('cameraZoom').value='120';$('cameraZoomLabel').textContent='120%';
};
$('cameraTop').onclick=()=>{
  const view=requireModelCamera();if(!view)return;
  view.view('top');viewMode='overview';tab('overview');
};
$('cameraFocus').onclick=()=>{
  const view=requireModelCamera();if(!view)return;
  const section=$('rowEditSection').value||$('sectionSelect').value;
  if(!view.focusOnSection(section))message('Choose a section with modeled seats.',true);
  else{viewMode='overview';tab('overview');}
};
$('cameraZoom').oninput=()=>{
  const view=requireModelCamera();if(!view)return;
  const percent=Number($('cameraZoom').value);
  view.setEditorZoom(100/percent);
  $('cameraZoomLabel').textContent=percent+'%';
};
$('cameraCapture').onclick=()=>{
  try{
    if(!preview)throw Error('Generate a model before saving its image');
    const source=viewMode==='plan'?canvas.toDataURL('image/png'):
      renderer?.capture();
    if(!source)throw Error('3D capture is unavailable');
    const a=document.createElement('a');a.href=source;
    a.download=safeName()+'-model.png';a.click();
    requestedDownloads.unshift('Requested · '+a.download);
    refreshActivity();
  }catch(e){message(e.message,true);}
};
$('toggleTools').onclick=()=>{
  const collapsed=document.querySelector('.content-grid').classList.toggle('tools-collapsed');
  $('toggleTools').setAttribute('aria-pressed',String(collapsed));
  $('toggleTools').textContent=collapsed?'Show tools':'Hide tools';
  requestAnimationFrame(resize);
};
activateModelTool('rows');
window.addEventListener('keydown',event=>{
  if(event.target?.closest?.('input,textarea,select,[contenteditable],button'))return;
  const key=event.key.toLowerCase();
  const building=workflowUI?.current==='model'&&activeModelTool==='structures';
  if(building&&selectedStructureIds.size&&
      (event.ctrlKey||event.metaKey)&&!event.altKey&&key==='d'){
    event.preventDefault();
    if(selectedStructureIds.size>1)commitStructureBatch({
      action:'duplicate',ids:[...selectedStructureIds],dx:1,dz:0
    },'Duplicate selected components');
    else $('structureDuplicate').click();
    return;
  }
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(building&&selectedStructureIds.size&&
      ['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
    event.preventDefault();
    const step=event.shiftKey?.05:.25;
    const dx=key==='arrowleft'?-step:key==='arrowright'?step:0;
    const dz=key==='arrowup'?-step:key==='arrowdown'?step:0;
    if(selectedStructureIds.size>1)commitStructureBatch({
      action:'translate',ids:[...selectedStructureIds],dx,dz
    },'Nudge selected components');
    else{
      const s=venue.structures.find(s=>s.id===selectedStructure);
      if(s)commitStructure({action:'update',id:s.id,changes:{
        x:Math.round((s.x+dx)*100)/100,z:Math.round((s.z+dz)*100)/100
      }},'Nudge venue component');
    }
    return;
  }
  if(building&&selectedStructureIds.size&&key==='delete'){
    event.preventDefault();$('structureGroupRemove').click();return;
  }
  if(key==='f'){$('cameraFit').click();}
  else if(key==='t'){$('cameraTop').click();}
  else if(key==='v'){$('showPlan').click();}
});
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
    venue=next;image=loadedImage;selectedStructure='';selectedStructureIds.clear();selectedZone='';
    registration=image&&next.calibration.corners.length===4?
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
