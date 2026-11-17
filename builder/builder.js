// Data-only school venue reconstruction workbench.
// All model geometry is derived from manually entered, source-aware rows and
// section curves. The editor does not read, scan or infer PDF/image plans.
import {
  createReconstruction,addRectangularBank,fictionalReconstruction,
  normalizeReconstruction,generateReconstruction,
} from '../src/reconstruction/core.mjs';
import {parseVenueRows} from '../src/workbench/contract.mjs';
import {NativeVenueRenderer} from '../src/next/webgl.js';

const $=id=>document.getElementById(id);
const KEY='filedmaker.data-first-reconstruction';
const clone=value=>structuredClone(value);
const escapeHTML=text=>String(text).replace(/[&<>"']/g,c=>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let project=fictionalReconstruction();
let selectedId=project.sections[0]?.id??null;
let output=null,renderer=null,currentMode='plan',currentCamera='overview',selectedSeat=null;
let pending=null,dragging=null;
let scale=10,worldCenter={x:0,z:0};
const pointer={};
try{
  const stored=localStorage.getItem(KEY);
  if(stored){
    const parsed=normalizeReconstruction(JSON.parse(stored));
    project=parsed;selectedId=project.sections[0]?.id??null;
  }
}catch{ /* Invalid cached drafts never replace a valid demonstration. */ }
const section=()=>project.sections.find(s=>s.id===selectedId)||null;
const setStatus=(message,error=false)=>{
  $('status').classList.toggle('error',error);
  $('status').textContent=message;
};
const saveDraft=()=>{
  try{localStorage.setItem(KEY,JSON.stringify(project));}
  catch{/* Local storage is only a convenience; the explicit JSON export remains available. */}
};
const number=(value,field,min,max)=>{
  const n=Number(value);
  if(value===''||!Number.isFinite(n)||n<min||n>max)
    throw Error(field+' must be between '+min+' and '+max);
  return n;
};
const integer=(value,field,min,max)=>{
  const n=number(value,field,min,max);
  if(!Number.isInteger(n))throw Error(field+' must be an integer');
  return n;
};
function download(file,content,type){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');
  a.href=url;a.download=file;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function updateMeta(){
  $('school').value=project.school;
  $('venue').value=project.venue;
  $('sport').value=project.sport;
  $('courtWidth').value=project.court.width;
  $('courtLength').value=project.court.length;
  $('capacity').value=project.officialCapacity??'';
  $('capacitySource').value=project.capacitySource??'';
  $('notes').value=project.notes??'';
}
function updateSectionList(){
  const list=$('sectionList');list.replaceChildren();
  const choice=$('sectionSelect');choice.replaceChildren(new Option('请选择分区',''));
  for(const s of project.sections){
    const button=document.createElement('button');button.className='section-item';
    if(s.id===selectedId)button.classList.add('active');
    const title=document.createElement('strong');title.textContent=s.id;
    const meta=document.createElement('small');
    meta.textContent=s.tier+' · '+s.rows.length+' 排';
    button.append(title,meta);
    button.onclick=()=>{selectedId=s.id;renderAll(false);};
    list.append(button);
    choice.add(new Option(s.id+' · '+s.tier,s.id));
  }
  choice.value=selectedId||'';
  $('sectionCount').textContent=project.sections.length+' 个';
}
function parseGaps(raw){
  if(!String(raw).trim())return [];
  return String(raw).split('|').map(entry=>{
    const match=/^(\d+)\s*:\s*(\d+(?:\.\d+)?)$/.exec(entry.trim());
    if(!match)throw Error('Use AFTER:WIDTH_M for each aisle, separated by |');
    return {after:Number(match[1]),width:Number(match[2])};
  });
}
function displayGaps(gaps){
  return (gaps||[]).map(g=>g.after+':'+g.width).join('|');
}
function updateEditor(){
  const s=section();
  $('noSelection').hidden=Boolean(s);
  $('sectionEditor').hidden=!s;
  if(!s)return;
  $('sectionId').value=s.id;
  $('tier').value=s.tier;
  $('baseHeight').value=s.baseHeight;
  $('rowRise').value=s.rowRise;
  $('source').value=s.source??'';
  $('rowCount').textContent=s.rows.length+' 排';
  $('bulkRowCount').value=String(Math.max(1,s.rows.length));
  $('bulkSeatCount').value=String(s.rows[0]?.seats??20);
  $('frontCoords').value=s.front.map(p=>p.x+','+p.z).join('; ');
  $('backCoords').value=s.back.map(p=>p.x+','+p.z).join('; ');
  const advanced=$('advancedRow'),oldIndex=Number(advanced.value||0);
  advanced.replaceChildren();
  s.rows.forEach((r,i)=>advanced.add(new Option(r.label+' ('+(i+1)+')',String(i))));
  advanced.value=String(Math.min(Math.max(0,oldIndex),s.rows.length-1));
  loadAdvanced();
  const tbody=$('rowEditor');tbody.replaceChildren();
  s.rows.forEach((r,index)=>{
    const tr=document.createElement('tr');
    for(const [field,value,type] of [
      ['label',r.label,'text'],['seats',r.seats,'number'],
      ['first',r.first,'number'],['gaps',displayGaps(r.gaps),'text'],
      ['elevation',r.elevation??'','number'],
    ]){
      const td=document.createElement('td'),input=document.createElement('input');
      input.type=type;input.value=String(value);input.dataset.row=String(index);
      input.dataset.field=field;input.setAttribute('aria-label',field+' row '+(index+1));
      if(type==='number')input.step=field==='elevation'?'.01':'1';
      if(field==='elevation')input.placeholder='估算';
      td.append(input);tr.append(td);
    }
    const last=document.createElement('td'),button=document.createElement('button');
    button.textContent='×';button.type='button';button.title='Remove row';
    button.onclick=()=>{
      s.rows.splice(index,1);updateEditor();schedulePreview();
    };
    last.append(button);tr.append(last);tbody.append(tr);
  });
}
const normalizedBounds=()=>{
  const p=[{x:-project.court.width/2,z:-project.court.length/2},
    {x:project.court.width/2,z:project.court.length/2}];
  for(const s of project.sections)p.push(...s.front,...s.back);
  return {
    minX:Math.min(...p.map(v=>v.x)),maxX:Math.max(...p.map(v=>v.x)),
    minZ:Math.min(...p.map(v=>v.z)),maxZ:Math.max(...p.map(v=>v.z)),
  };
};
function fit(){
  const b=normalizedBounds(),canvas=$('planCanvas');
  const w=canvas.clientWidth||700,h=canvas.clientHeight||550;
  worldCenter={x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2};
  scale=Math.max(.2,Math.min((w-85)/(b.maxX-b.minX+3),(h-95)/(b.maxZ-b.minZ+3)));
  draw();
}
const toScreen=p=>({
  x:($('planCanvas').clientWidth||700)/2+(p.x-worldCenter.x)*scale,
  y:($('planCanvas').clientHeight||550)/2+(p.z-worldCenter.z)*scale,
});
const toWorld=p=>({
  x:(p.x-($('planCanvas').clientWidth||700)/2)/scale+worldCenter.x,
  z:(p.y-($('planCanvas').clientHeight||550)/2)/scale+worldCenter.z,
});
const imagePos=event=>{
  const rect=$('planCanvas').getBoundingClientRect();
  return {x:event.clientX-rect.left,y:event.clientY-rect.top};
};
function arcPoint(path,t){
  const lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.z-path[i].z));
  let remaining=lengths.reduce((sum,n)=>sum+n,0)*t;
  for(let i=0;i<lengths.length;i++){
    if(remaining<=lengths[i]||i===lengths.length-1){
      const f=lengths[i]?Math.max(0,Math.min(1,remaining/lengths[i])):0;
      return {x:path[i].x+(path[i+1].x-path[i].x)*f,
        z:path[i].z+(path[i+1].z-path[i].z)*f};
    }
    remaining-=lengths[i];
  }
  return path.at(-1);
}
function drawPolyline(ctx,points){
  if(!points.length)return;
  const first=toScreen(points[0]);ctx.beginPath();ctx.moveTo(first.x,first.y);
  for(const pt of points.slice(1)){const p=toScreen(pt);ctx.lineTo(p.x,p.y);}
}
function draw(){
  const canvas=$('planCanvas'),w=canvas.clientWidth||700,h=canvas.clientHeight||550;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  }
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#edf1f2';ctx.fillRect(0,0,w,h);
  const bounds=[toWorld({x:0,y:0}),toWorld({x:w,y:h})];
  const grid=scale>=7?2:scale>=3?5:10;
  ctx.strokeStyle='#dce4e8';ctx.lineWidth=1;
  for(let x=Math.floor(bounds[0].x/grid)*grid;x<=bounds[1].x;x+=grid){
    const p=toScreen({x,z:0});ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,h);ctx.stroke();
  }
  for(let z=Math.floor(bounds[0].z/grid)*grid;z<=bounds[1].z;z+=grid){
    const p=toScreen({x:0,z});ctx.beginPath();ctx.moveTo(0,p.y);ctx.lineTo(w,p.y);ctx.stroke();
  }
  const a=toScreen({x:-project.court.width/2,z:-project.court.length/2});
  const b=toScreen({x:project.court.width/2,z:project.court.length/2});
  ctx.fillStyle=project.sport.includes('basketball')?'#cda977':'#568568';
  ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
  ctx.strokeStyle='#fff';ctx.lineWidth=1.8;ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);
  ctx.beginPath();ctx.moveTo(a.x,(a.y+b.y)/2);ctx.lineTo(b.x,(a.y+b.y)/2);ctx.stroke();
  if(project.sport.includes('basketball')){
    ctx.beginPath();ctx.arc((a.x+b.x)/2,(a.y+b.y)/2,1.83*scale,0,Math.PI*2);ctx.stroke();
  }
  for(const s of project.sections){
    const active=s.id===selectedId;
    const outline=[...s.front,...[...s.back].reverse()];
    drawPolyline(ctx,outline);ctx.closePath();
    ctx.fillStyle=active?'#387abf75':'#7ba4be70';ctx.fill();
    ctx.strokeStyle=active?'#2475c5':'#7794ad';ctx.lineWidth=active?2.3:1;ctx.stroke();
    for(let i=0;i<s.rows.length;i++){
      const t=(i+.5)/s.rows.length;
      const points=Array.from({length:17},(_,j)=>{
        const f=arcPoint(s.front,j/16),b=arcPoint(s.back,j/16);
        return {x:f.x+(b.x-f.x)*t,z:f.z+(b.z-f.z)*t};
      });
      drawPolyline(ctx,points);ctx.strokeStyle=active?'#2b76be75':'#5d849c65';
      ctx.lineWidth=.8;ctx.stroke();
    }
    const centerF=arcPoint(s.front,.5),centerB=arcPoint(s.back,.5);
    const center=toScreen({x:(centerF.x+centerB.x)/2,z:(centerF.z+centerB.z)/2});
    ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#173d5c';
    ctx.fillText(s.id,center.x,center.y);
  }
  if(output){
    const seats=output.seats;
    const stride=Math.max(1,Math.ceil(seats.length/9000));
    ctx.fillStyle='#225a91b0';
    for(let i=0;i<seats.length;i+=stride){
      const p=toScreen(seats[i]);ctx.beginPath();ctx.arc(p.x,p.y,1.3,0,Math.PI*2);ctx.fill();
    }
  }
  if(section()){
    const s=section();
    for(const [edge,color] of [['front','#2876b8'],['back','#c17b39']]){
      drawPolyline(ctx,s[edge]);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();
      for(const p of s[edge]){
        const b=toScreen(p);ctx.fillStyle='#fff';ctx.strokeStyle=color;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    }
  }
}
function pointInside(point,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a.z>point.z)!==(b.z>point.z)&&
       point.x<(b.x-a.x)*(point.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside;
}
// Exact curve coordinates and row metadata are manually entered, not inferred.
function parseCoords(input,label){
  const parts=String(input).split(';').map(v=>v.trim()).filter(Boolean);
  if(parts.length<2||parts.length>32)throw Error(label+' needs 2–32 control points');
  return parts.map(part=>{
    const pair=part.split(',').map(x=>x.trim());
    if(pair.length!==2)throw Error(label+' points must be X,Z');
    return {x:number(pair[0],label+' X',-2000,2000),
      z:number(pair[1],label+' Z',-2000,2000)};
  });
}
function loadAdvanced(){
  const s=section(),r=s?.rows[Number($('advancedRow').value)];
  for(const id of ['advancedSeatType','advancedDirection','advancedInsetStart',
    'advancedInsetEnd','advancedDepth','advancedNumbers'])
    $(id).disabled=!r;
  if(!r)return;
  $('advancedSeatType').value=r.seatType;
  $('advancedDirection').value=r.seatDirection||'forward';
  $('advancedInsetStart').value=r.insetStartM??0;
  $('advancedInsetEnd').value=r.insetEndM??0;
  $('advancedDepth').value=r.depthOffsetM??0;
  $('advancedNumbers').value=(r.seatNumbers||[]).join('|');
}
$('advancedRow').onchange=loadAdvanced;
$('applyAdvanced').onclick=()=>{
  const s=section(),i=Number($('advancedRow').value),r=s?.rows[i];
  if(!r)return;
  const old=clone(r);
  try{
    r.seatType=$('advancedSeatType').value;
    r.seatDirection=$('advancedDirection').value;
    r.insetStartM=number($('advancedInsetStart').value,'Left inset',0,30);
    r.insetEndM=number($('advancedInsetEnd').value,'Right inset',0,30);
    r.depthOffsetM=number($('advancedDepth').value,'Depth offset',-3,3);
    const data=$('advancedNumbers').value.trim();
    r.seatNumbers=data?data.split('|').map(x=>x.trim()):[];
    normalizeReconstruction(project);
    updateEditor();schedulePreview();
  }catch(error){s.rows[i]=old;updateEditor();setStatus(error.message,true);}
};
$('applyCoords').onclick=()=>{
  const s=section();if(!s)return;
  const front=clone(s.front),back=clone(s.back);
  try{
    s.front=parseCoords($('frontCoords').value,'Front curve');
    s.back=parseCoords($('backCoords').value,'Rear curve');
    normalizeReconstruction(project);
    updateEditor();fit();schedulePreview();
  }catch(error){
    s.front=front;s.back=back;updateEditor();setStatus(error.message,true);
  }
};

const canvas=$('planCanvas');
canvas.addEventListener('pointerdown',e=>{
  const p=imagePos(e),s=section();
  if(s){
    for(const edge of ['front','back'])for(let index=0;index<s[edge].length;index++){
      const h=toScreen(s[edge][index]);
      if(Math.hypot(h.x-p.x,h.y-p.y)<13){
        dragging={edge,index,id:s.id};
        canvas.setPointerCapture(e.pointerId);return;
      }
    }
  }
  const world=toWorld(p);
  const hit=[...project.sections].reverse().find(s=>
    pointInside(world,[...s.front,...[...s.back].reverse()]));
  if(hit){selectedId=hit.id;renderAll(false);}
});
canvas.addEventListener('pointermove',e=>{
  if(!dragging)return;
  const s=section();if(!s||s.id!==dragging.id)return;
  const p=toWorld(imagePos(e));
  s[dragging.edge][dragging.index]={
    x:Math.round(p.x*100)/100,z:Math.round(p.z*100)/100,
  };
  draw();
});
const stopDrag=()=>{
  if(!dragging)return;
  dragging=null;
  schedulePreview();
};
canvas.addEventListener('pointerup',stopDrag);
canvas.addEventListener('pointercancel',stopDrag);

function reflect2d(){
  $('planCanvas').hidden=currentMode!=='plan';
  $('sceneCanvas').hidden=currentMode==='plan';
  $('show2d').classList.toggle('chosen',currentMode==='plan');
  $('show3d').classList.toggle('chosen',currentMode!=='plan');
  $('canvasHint').textContent=currentMode==='plan'?
    '选择分区，拖动蓝色前沿与橙色后沿控制点':
    '左键拖动旋转 · 滚轮缩放 · 点击座椅选择位置';
  if(currentMode==='plan')draw();
  else{
    if(!renderer){
      try{
        renderer=new NativeVenueRenderer($('sceneCanvas'),s=>{
          selectedSeat=s;
          $('selectedSeat').textContent=s?
            s.sectionId+' · '+s.row+' 排 · '+s.number+' 座（位置估算）':'未选座';
          if(s)renderer.highlight(s);
        });
      }catch(error){setStatus(error.message,true);currentMode='plan';reflect2d();return;}
    }
    if(output?.plan){
      renderer.load(output.plan);
      if(!selectedSeat)selectedSeat=output.plan.seats[0]||null;
      if(selectedSeat)renderer.highlight(selectedSeat);
      renderer.view(currentCamera,selectedSeat);
      renderer.resize();
    }
  }
}
let rebuildTimer;
function schedulePreview(){
  output=null;saveDraft();draw();
  clearTimeout(rebuildTimer);
  rebuildTimer=setTimeout(rebuild,320);
}
function rebuild(){
  clearTimeout(rebuildTimer);
  try{
    const result=generateReconstruction(project);
    output=result;
    setStatus('生成完成：逐排数据与座位数量一致。几何和未提供的高度仍需校准。');
    const stats=result.sourceProject.totals;
    $('statSections').textContent=stats.sections.toLocaleString();
    $('statRows').textContent=stats.rows.toLocaleString();
    $('statSeats').textContent=stats.seats.toLocaleString();
    $('statDifference').textContent=result.sourceProject.officialCapacity==null?'—':
      (stats.seats-result.sourceProject.officialCapacity).toLocaleString();
    $('summary').textContent=result.sourceProject.venue+' · '+stats.seats.toLocaleString()+' 座 · 位置估算';
    $('warnings').replaceChildren();
    for(const msg of result.warnings.slice(0,8)){
      const li=document.createElement('li');li.textContent=msg;$('warnings').append(li);
    }
    if(currentMode!=='plan'&&renderer){
      renderer.load(result.plan);
      selectedSeat=selectedSeat&&result.plan.seats.find(s=>s.uid===selectedSeat.uid)
        ||result.plan.seats[0]||null;
      if(selectedSeat)renderer.highlight(selectedSeat);
      renderer.view(currentCamera,selectedSeat);renderer.resize();
    }
    draw();
    saveDraft();
  }catch(error){
    output=null;setStatus('生成未通过：'+error.message,true);
    $('summary').textContent='需要修正输入数据';
    const sections=project.sections||[];
    const rows=sections.reduce((n,s)=>n+s.rows.length,0);
    $('statSections').textContent=String(sections.length);
    $('statRows').textContent=String(rows);
    $('statSeats').textContent='—';$('statDifference').textContent='—';
    $('warnings').replaceChildren();
    draw();
  }
}
function renderAll(refit=true){
  updateMeta();updateSectionList();updateEditor();
  if(refit)fit();else draw();
  schedulePreview();
}
$('sectionSelect').addEventListener('change',e=>{
  selectedId=e.target.value||null;renderAll(false);
});
$('sectionEditor').addEventListener('change',event=>{
  const s=section();if(!s)return;
  const id=event.target.id;
  if(!['sectionId','tier','baseHeight','rowRise','source'].includes(id))return;
  try{
    if(id==='sectionId'){
      const next=event.target.value.trim();
      if(!next||next.length>30||project.sections.some(x=>x!==s&&x.id.toLowerCase()===next.toLowerCase()))
        throw Error('Invalid or duplicate section ID');
      s.id=next;selectedId=next;
    }else if(id==='baseHeight')s.baseHeight=number(event.target.value,'Base elevation',0,80);
    else if(id==='rowRise')s.rowRise=number(event.target.value,'Row rise',.05,1.5);
    else if(id==='source')s.source=event.target.value.trim();
    else s.tier=event.target.value;
    renderAll(false);
  }catch(error){setStatus(error.message,true);updateEditor();}
});
$('rowEditor').addEventListener('change',event=>{
  const input=event.target,s=section();
  if(!s||!input.matches('input[data-row]'))return;
  const i=Number(input.dataset.row),field=input.dataset.field,row=s.rows[i];
  if(!row)return;
  const old=clone(row);
  try{
    if(field==='label'){
      row.label=input.value.trim();
      if(!row.label||s.rows.some((r,k)=>k!==i&&r.label.toLowerCase()===row.label.toLowerCase()))
        throw Error('Row labels must be unique in a section');
    }else if(field==='seats'){
      row.seats=integer(input.value,'Seat count',1,300);
      if(row.seatNumbers?.length&&row.seats!==old.seats)
        throw Error('A row with explicit seat numbers cannot change count until identifiers are updated');
    }else if(field==='first')row.first=integer(input.value,'First seat number',1,100000);
    else if(field==='gaps')row.gaps=parseGaps(input.value);
    else if(field==='elevation')row.elevation=input.value.trim()===''?null:number(input.value,'Row elevation',0,100);
    // Reject inconsistent edits immediately rather than changing ticket rows.
    normalizeReconstruction(project);
    updateEditor();schedulePreview();
  }catch(error){
    s.rows[i]=old;updateEditor();setStatus(error.message,true);
  }
});
for(const [field,target,type] of [
  ['school','school','text'],['venue','venue','text'],
  ['sport','sport','select'],['courtWidth','court.width','number'],
  ['courtLength','court.length','number'],['capacity','officialCapacity','optional'],
  ['capacitySource','capacitySource','text'],['notes','notes','text'],
]){
  $(field).addEventListener('change',e=>{
    const old=clone(project);
    try{
      let v=e.target.value;
      if(type==='number')v=number(v,field,field==='courtWidth'?8:15,field==='courtWidth'?160:200);
      if(type==='optional')v=v.trim()===''?null:integer(v,'Official capacity',1,150000);
      if(target.includes('.')){
        const [a,b]=target.split('.');project[a][b]=v;
      }else project[target]=v;
      normalizeReconstruction(project);
      renderAll(false);
    }catch(error){project=old;updateMeta();setStatus(error.message,true);}
  });
}
$('addSection').onclick=()=>{
  try{
    const id=$('newSectionId').value.trim()||'S'+(project.sections.length+1);
    project=addRectangularBank(project,{id,side:$('sectionSide').value});
    selectedId=id;$('newSectionId').value='';
    renderAll(true);
  }catch(error){setStatus(error.message,true);}
};
$('deleteSection').onclick=()=>{
  const s=section();if(!s)return;
  if(!window.confirm('Delete section '+s.id+' and all its rows?'))return;
  project.sections=project.sections.filter(x=>x!==s);
  selectedId=project.sections[0]?.id||null;renderAll(true);
};
function addControlPoint(edge){
  const s=section();if(!s)return;
  const points=s[edge],i=Math.max(0,Math.floor((points.length-1)/2));
  const a=points[i],b=points[i+1];
  points.splice(i+1,0,{x:(a.x+b.x)/2,z:(a.z+b.z)/2});
  renderAll(false);
}
function removeControlPoint(edge){
  const s=section();if(!s)return;
  if(s[edge].length<=2){setStatus('Each section edge needs at least two points',true);return;}
  s[edge].splice(Math.floor(s[edge].length/2),1);
  renderAll(false);
}
$('frontPoint').onclick=()=>addControlPoint('front');
$('backPoint').onclick=()=>addControlPoint('back');
$('removeFrontPoint').onclick=()=>removeControlPoint('front');
$('removeBackPoint').onclick=()=>removeControlPoint('back');
$('addRow').onclick=()=>{
  const s=section();if(!s)return;
  if(s.rows.length>=120){setStatus('Maximum 120 rows per section',true);return;}
  const previous=s.rows.at(-1);
  const candidate=previous?{...clone(previous),label:String(s.rows.length+1),gaps:[],seatNumbers:[],elevation:null}:
    {label:'1',seats:20,first:1,seatType:'chair',seatDirection:'forward',
      gaps:[],seatNumbers:[],elevation:null,insetStartM:0,insetEndM:0,depthOffsetM:0};
  while(s.rows.some(r=>r.label===candidate.label))
    candidate.label=String(Number(candidate.label)+1);
  s.rows.push(candidate);updateEditor();schedulePreview();
};
$('removeRow').onclick=()=>{
  const s=section();if(!s||!s.rows.length)return;
  s.rows.pop();updateEditor();schedulePreview();
};
$('replaceRows').onclick=()=>{
  const s=section();if(!s)return;
  try{
    const rows=integer($('bulkRowCount').value,'Rows',1,100),
      seats=integer($('bulkSeatCount').value,'Seats per row',1,300);
    if(!window.confirm('Replace all row and aisle data for '+s.id+'?'))return;
    s.rows=Array.from({length:rows},(_,i)=>({
      label:String(i+1),seats,first:1,seatType:'chair',
      seatDirection:'forward',gaps:[],seatNumbers:[],elevation:null,
      insetStartM:0,insetEndM:0,depthOffsetM:0,
    }));
    updateEditor();schedulePreview();
  }catch(error){setStatus(error.message,true);}
};
$('importRows').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>2_000_000)throw Error('CSV limit is 2 MB');
    const parsed=parseVenueRows(await file.text());
    const next=clone(project);
    const lookup=new Map(next.sections.map(s=>[s.id.toLowerCase(),s]));
    const grouped=new Map(next.sections.map(s=>[s.id.toLowerCase(),[]]));
    for(const r of parsed){
      const key=r.section.toLowerCase();
      if(!lookup.has(key))throw Error('CSV row '+r.section+'/'+r.row+' refers to an unknown section');
      const s=lookup.get(key);
      if(s.tier!==r.tier)throw Error('Tier mismatch for '+r.section+'/'+r.row);
      grouped.get(key).push({
        label:r.row,seats:r.seats,first:r.first,seatType:r.seatType,
        seatDirection:r.seatDirection,gaps:r.gaps,
        seatNumbers:r.seatNumbers,elevation:r.elevation,
        insetStartM:r.insetStartM,insetEndM:r.insetEndM,depthOffsetM:r.depthOffsetM,
      });
    }
    for(const s of next.sections){
      const rows=grouped.get(s.id.toLowerCase());
      if(rows.length)s.rows=rows;
    }
    normalizeReconstruction(next);project=next;renderAll(true);
    setStatus('CSV imported: '+parsed.length+' rows. Geometry requires review.');
  }catch(error){setStatus(error.message,true);}
  event.target.value='';
});
$('importProject').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>4_000_000)throw Error('Project JSON limit is 4 MB');
    const next=normalizeReconstruction(JSON.parse(await file.text()));
    project=next;selectedId=project.sections[0]?.id||null;selectedSeat=null;
    renderAll(true);setStatus('Imported structured venue project');
  }catch(error){setStatus('Cannot open JSON: '+error.message,true);}
  event.target.value='';
});
$('saveProject').onclick=()=>{
  try{
    const data=normalizeReconstruction(project);
    download('filedmaker-'+project.venue.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json',
      JSON.stringify(data,null,2)+'\n','application/json');
    setStatus('Project exported as editable JSON');
  }catch(error){setStatus(error.message,true);}
};
$('downloadRows').onclick=()=>{
  try{
    if(!output)throw Error('Build a valid model before exporting seats');
    const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const lines=['id,section,row,seat,x_m,y_m,z_m,coordinate_status'];
    for(const s of output.seats){
      lines.push([s.id,s.section,s.row,s.number,
        s.x.toFixed(4),s.y.toFixed(4),s.z.toFixed(4),
        'estimated_or_operator_provided_unverified'].map(esc).join(','));
    }
    download('filedmaker-seat-coordinates.csv',lines.join('\r\n')+'\r\n','text/csv');
    setStatus('Generated seat coordinates exported. The file is not an official survey.');
  }catch(error){setStatus(error.message,true);}
};
$('newProject').onclick=()=>{
  if(!window.confirm('Start a new blank project? Export the current project first if needed.'))return;
  project=createReconstruction();
  selectedId=null;selectedSeat=null;output=null;renderAll(true);
};
$('openDemo').onclick=()=>{
  if(!window.confirm('Load the fictional demonstration and replace the current draft?'))return;
  project=fictionalReconstruction();
  selectedId=project.sections[0].id;selectedSeat=null;renderAll(true);
};
$('show2d').onclick=()=>{
  currentMode='plan';reflect2d();
};
$('show3d').onclick=()=>{
  if(!output){rebuild();if(!output)return;}
  currentMode='model';reflect2d();
};
$('viewOverview').onclick=()=>{
  currentCamera='overview';
  if(currentMode==='plan'){$('show3d').click();return;}
  renderer?.view(currentCamera,selectedSeat);
};
$('viewHuman').onclick=()=>{
  if(!output){rebuild();if(!output)return;}
  selectedSeat=selectedSeat||output.plan.seats.find(s=>s.tier===0)||output.plan.seats[0];
  if(!selectedSeat){setStatus('No seats available for a human-eye preview',true);return;}
  $('selectedSeat').textContent=selectedSeat.sectionId+' · '+selectedSeat.row+' 排 · '+selectedSeat.number+' 座';
  currentCamera='human';
  if(currentMode==='plan'){$('show3d').click();return;}
  renderer.highlight(selectedSeat);
  renderer.view('human',selectedSeat);
};
$('fitPlan').onclick=fit;
$('rebuild').onclick=rebuild;
new ResizeObserver(()=>{if(currentMode==='plan')fit();else renderer?.resize();})
  .observe($('canvasHost'));
// The five real-school showcase files contain manual, editable geometry.
// Their chart identifiers are sourced, while unmeasured seat XYZ stays estimated.
const SHOWCASE_IDS=new Set(['illinois','indiana','michigan','purdue','wisconsin']);
const caseCache=new Map();
function loadCase(id){
  if(!SHOWCASE_IDS.has(id))return Promise.reject(Error('Unknown Big Ten case'));
  if(!caseCache.has(id)){
    const url=new URL('../data/reconstruction-showcase/'+id+'.json',import.meta.url);
    caseCache.set(id,fetch(url).then(async response=>{
      if(!response.ok)throw Error('Cannot load '+id+' dataset ('+response.status+')');
      const raw=await response.json();
      return normalizeReconstruction(raw);
    }));
  }
  return caseCache.get(id);
}
function drawCaseMiniature(canvas,venue){
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#edf3f7';ctx.fillRect(0,0,w,h);
  const all=[{x:-venue.court.width/2,z:-venue.court.length/2},
    {x:venue.court.width/2,z:venue.court.length/2}];
  for(const s of venue.sections)all.push(...s.front,...s.back);
  const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x)),
    minZ=Math.min(...all.map(p=>p.z)),maxZ=Math.max(...all.map(p=>p.z));
  const scale=Math.min((w-17)/(maxX-minX+1),(h-12)/(maxZ-minZ+1));
  const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
  const xy=p=>({x:w/2+(p.x-cx)*scale,y:h/2+(p.z-cz)*scale});
  const tiers=['T3','T2','T1'];
  const fills={T1:'#6ca6d0',T2:'#3c7eb4',T3:'#b5cede'};
  const strokes={T1:'#e5f2fd',T2:'#b5d7ec',T3:'#8daac1'};
  for(const level of tiers){
    for(const section of venue.sections.filter(s=>s.tier===level)){
      const poly=[...section.front,...section.back.toReversed()];
      if(!poly.length)continue;
      const first=xy(poly[0]);ctx.beginPath();ctx.moveTo(first.x,first.y);
      for(const point of poly.slice(1)){
        const p=xy(point);ctx.lineTo(p.x,p.y);
      }
      ctx.closePath();ctx.fillStyle=fills[level];ctx.fill();
      ctx.strokeStyle=strokes[level];ctx.lineWidth=.55;ctx.stroke();
    }
  }
  const min=xy({x:-venue.court.width/2,z:-venue.court.length/2}),
    max=xy({x:venue.court.width/2,z:venue.court.length/2});
  ctx.fillStyle='#d7b485';ctx.fillRect(min.x,min.y,max.x-min.x,max.y-min.y);
  ctx.strokeStyle='#fff';ctx.lineWidth=1.1;ctx.strokeRect(min.x,min.y,max.x-min.x,max.y-min.y);
  ctx.beginPath();ctx.moveTo(min.x,(min.y+max.y)/2);
  ctx.lineTo(max.x,(min.y+max.y)/2);ctx.stroke();
}
function markCaseSelection(id){
  for(const card of document.querySelectorAll('[data-showcase]')){
    const active=card.dataset.showcase===id;
    card.classList.toggle('active',active);
    card.setAttribute('aria-pressed',active?'true':'false');
  }
}
async function openBigTenCase(id){
  const active=document.querySelector('[data-showcase="'+id+'"]');
  if(active?.disabled)return;
  if(active)active.disabled=true;
  $('showcaseState').textContent='正在加载 '+id+' 的完整分区和座位数据…';
  try{
    const data=await loadCase(id);
    project=clone(data);
    selectedId=project.sections[0]?.id??null;
    selectedSeat=null;
    currentMode='plan';
    renderAll(true);
    markCaseSelection(id);
    const link=new URL(location.href);
    link.searchParams.set('case',id);
    history.replaceState(null,'',link);
    // Let the loading label paint before the expensive native WebGL build.
    await new Promise(resolve=>requestAnimationFrame(resolve));
    rebuild();
    if(!output)throw Error('Venue geometry failed the build QA rules');
    currentMode='model';reflect2d();
    $('showcaseState').textContent=data.school+' · '+data.totals.sections+
      ' 分区，'+data.totals.seats.toLocaleString()+' 个估算模型座位。可编辑，非官方三维模型。';
  }catch(error){
    $('showcaseState').textContent='加载失败：'+error.message;
    setStatus('Big Ten case '+id+': '+error.message,true);
  }finally{
    if(active)active.disabled=false;
  }
}
for(const button of document.querySelectorAll('[data-showcase]')){
  const id=button.dataset.showcase;
  button.onclick=()=>openBigTenCase(id);
  loadCase(id).then(data=>{
    drawCaseMiniature(document.querySelector('[data-case-image="'+id+'"]'),data);
    const stats=document.querySelector('[data-case-stats="'+id+'"]');
    if(stats)stats.textContent=data.totals.sections+' 分区 · '+
      data.totals.rows.toLocaleString()+' 排';
  }).catch(error=>{
    const stats=document.querySelector('[data-case-stats="'+id+'"]');
    if(stats)stats.textContent='数据读取失败';
  });
}
const requestedCase=new URLSearchParams(location.search).get('case');
if(requestedCase&&SHOWCASE_IDS.has(requestedCase))
  openBigTenCase(requestedCase);

renderAll(true);
