import { generateSeats } from '../src/model.mjs';
import { createSchoolProject, applySchoolRowPlan, schoolExampleRowsCSV } from '../src/schoolPipeline.mjs';
import { ticketReconciliation } from '../src/seatFirst.mjs';
import { VIEW_DEFAULTS } from '../src/view.mjs';
import { seatColor, canSelectOfficialSeat } from '../src/seatPresentation.mjs';

const $ = id => document.getElementById(id);
const modelKey = 'filedmaker.viewer.project';
function getProject() {
  try {
    const value = localStorage.getItem(modelKey);
    if (value) return JSON.parse(value);
  } catch { /* The fallback has clearly labeled demo data. */ }
  return applySchoolRowPlan(createSchoolProject('college-gym', {
    school: 'Illustrative school (demo)', venue: 'Illustrative Basketball Gym (demo)',
  }), schoolExampleRowsCSV());
}

let model, project, seats, selected = null, highlighted = null;
try {
  project = getProject();
  model = generateSeats(project);
  seats = model.seats;
} catch (e) {
  $('error').hidden = false;
  $('error').textContent = `Project could not be loaded: ${e.message}`;
  project = createSchoolProject('college-gym',{school:'Illustrative school (demo)',venue:'Demo Gym'});
  model = generateSeats(project); seats = model.seats;
}
const source = (project.ticketing?.coordinates && project.ticketing.coordinates !== 'none' ? project.ticketing.coordinates : null) || project.school?.seatCoordinateMethod || 'estimated';
const reconcile = ticketReconciliation(project, seats.length);
$('name').textContent = project.school?.venue || project.title;
$('topTitle').textContent = project.school?.venue || project.title;
$('school').textContent = project.school?.school || 'Custom school venue';
$('seatCount').textContent = seats.length.toLocaleString();
$('capacity').textContent = reconcile.officialCapacity === null ? 'Not supplied' : reconcile.officialCapacity.toLocaleString();
$('source').textContent = source.includes('estimated') || source.includes('parametric') ? 'Estimated placement' : 'Imported / unverified';
$('dataNote').textContent = `Source: ${source}. ${canSelectOfficialSeat(project,model.seatOrigin)?'Imported seat identifiers; positions may remain estimated.':'These are illustrative positions, NOT official ticket seats.'} Published capacity and model count are separate. School approval required.`;
$('topSub').textContent = `${model.surface.label} · ${seats.length.toLocaleString()} seat identities`;
$('bottom').textContent = `${seats.length.toLocaleString()} ticket/seat identities · ${source} · approximate preview · no real-time availability or checkout`;
const tiers = [...new Set(seats.map(s => s.tier))].sort((a,b) => a-b);
for(const tier of tiers) {const o=new Option(model.tiers[tier]?.label || `Level ${tier+1}`, String(tier)); $('tier').add(o);}
const sections = [...new Set(seats.map(s=>s.sectionId))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
for(const section of sections) $('section').add(new Option(section,section));
const byId = new Map(seats.map(s=>[String(s.uid),s]));
const colors=[0,1,2,3].map(t=>seatColor(project,t,0));
const canvas=$('seatmap'),ctx=canvas.getContext('2d',{alpha:false});
let width=0,height=0,scale=1,tx=0,ty=0,mode='map',scene=null,loading3d=false;
let drawQueued=false,grid=new Map(),labelBoxes=[];
let minX=-model.surface.width/2-8,maxX=model.surface.width/2+8;
let minZ=-model.surface.length/2-8,maxZ=model.surface.length/2+8;
for(const s of seats){minX=Math.min(minX,s.x);maxX=Math.max(maxX,s.x);minZ=Math.min(minZ,s.z);maxZ=Math.max(maxZ,s.z);}
const spanX=maxX-minX,spanZ=maxZ-minZ;
function size(){
 const b=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 width=b.width||450;height=b.height||400;
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 queueDraw();
}
function fit(){scale=Math.min((width-65)/spanX,(height-95)/spanZ);scale=Math.max(.1,scale);tx=width/2-(minX+maxX)/2*scale;ty=height/2-(minZ+maxZ)/2*scale;queueDraw();}
function px(x){return x*scale+tx;}function py(z){return z*scale+ty;}
const visible = s => ($('tier').value==='all' || Number($('tier').value)===s.tier) && ($('section').value==='all'||$('section').value===s.sectionId);
const round = (x,y,w,h,r) => {ctx.beginPath();ctx.roundRect(x,y,w,h,Math.max(0,r));};
function drawCourt(){
 const s=model.surface,w=s.width,l=s.length;
 ctx.save();ctx.fillStyle='#dce2dc';ctx.fillRect(0,0,width,height);
 ctx.fillStyle=s.sport==='basketball'?'#cbab7c':'#4b8b67';
 const x=px(-w/2),y=py(-l/2),ww=w*scale,hh=l*scale;
 ctx.fillRect(x,y,ww,hh);
 if(s.sport!=='basketball'){
  for(let i=0;i<10;i++){if(i%2===0){ctx.fillStyle='#ffffff0b';ctx.fillRect(x,y+hh*i/10,ww,hh/10);}}
 }
 ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(.75,.07*scale);ctx.strokeRect(x,y,ww,hh);
 ctx.beginPath();ctx.moveTo(x,py(0));ctx.lineTo(x+ww,py(0));ctx.stroke();
 if(s.sport==='basketball'){
  ctx.beginPath();ctx.arc(px(0),py(0),1.83*scale,0,Math.PI*2);ctx.stroke();
  for(const z of [-l/2,l/2]){
   const sign=Math.sign(z),center=z-sign*5.79;
   ctx.strokeRect(px(-2.45),py(Math.min(z,center)),4.9*scale,Math.abs(z-center)*scale);
   ctx.beginPath();ctx.arc(px(0),py(z-sign*1.575),.2286*scale,0,Math.PI*2);ctx.stroke();
  }
 } else if(s.sport==='football'){
  for(let i=0;i<=20;i++){const z=(-l/2+(s.endZone||9.144))+i*(l-2*(s.endZone||9.144))/20;
   ctx.beginPath();ctx.moveTo(x,py(z));ctx.lineTo(x+ww,py(z));ctx.stroke();
  }
  ctx.fillStyle='#fff';ctx.font='bold 12px system-ui';ctx.textAlign='center';
  for(const sign of [-1,1])ctx.fillText('END ZONE',px(0),py(sign*(l/2-(s.endZone||9.144)/2)));
 }else{
  ctx.beginPath();ctx.arc(px(0),py(0),9.15*scale,0,Math.PI*2);ctx.stroke();
 }
 ctx.restore();
}
function draw(){
 drawQueued=false;if(!width||!height)return;drawCourt();
 grid=new Map();labelBoxes=[];
 const cells=new Map();let visibleN=0;
 for(let i=0;i<seats.length;i++){
  const s=seats[i];if(!visible(s))continue;
  const x=px(s.x),y=py(s.z);if(x<-8||x>width+8||y<-8||y>height+8)continue;
  visibleN++;
  const r=Math.max(1.15,Math.min(3.7,scale*.14));
  ctx.fillStyle=seatColor(project,s.tier,s.sectionIndex)||colors[0];
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  if(s===selected){ctx.strokeStyle='#f79336';ctx.lineWidth=2.8;ctx.beginPath();ctx.arc(x,y,r+5,0,Math.PI*2);ctx.stroke();}
  else if(s===highlighted){ctx.strokeStyle='#f79336';ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(x,y,r+3,0,Math.PI*2);ctx.stroke();}
  const key=`${Math.floor(x/20)}:${Math.floor(y/20)}`;
  if(!grid.has(key))grid.set(key,[]);grid.get(key).push({s,x,y});
  let rec=cells.get(s.sectionId);if(!rec)cells.set(s.sectionId,rec={x:0,y:0,n:0,tier:s.tier});
  rec.x+=x;rec.y+=y;rec.n++;
 }
 // Section labels only at useful zoom levels. Never flood an overview with hundreds of labels.
 const shown=(($('section').value==='all')?[...cells.entries()]:[...cells.entries()].filter(([id])=>id===$('section').value));
 const limit=Math.min(12,Math.max(4,Math.floor(width/110)));
 shown.sort((a,b)=>b[1].n-a[1].n);
 ctx.font='600 11px system-ui';ctx.textBaseline='middle';ctx.textAlign='center';
 for(const [id,r] of shown.slice(0,limit)){
  if(r.n<2)continue;const x=r.x/r.n,y=r.y/r.n;
  const tw=Math.max(50,ctx.measureText(id).width+22),th=25;
  if(labelBoxes.some(b=>Math.abs(b.x-x)<(b.w+tw)/2+6 && Math.abs(b.y-y)<25))continue;
  round(x-tw/2,y-th/2,tw,th,7);ctx.fillStyle='#ffffffeb';ctx.fill();ctx.strokeStyle='#ced8db';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#203f57';ctx.fillText(id,x,y+1);
  labelBoxes.push({id,x,y,w:tw,h:th});
 }
 ctx.textAlign='left';ctx.fillStyle='#476075';ctx.font='11px system-ui';
 ctx.fillText(`Visible positions: ${visibleN.toLocaleString()}`,17,height-36);
}
function queueDraw(){if(!drawQueued){drawQueued=true;requestAnimationFrame(draw);}}
function near(x,y){
 const cx=Math.floor(x/20),cy=Math.floor(y/20);let best=null,bd=14*14;
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
  for(const p of grid.get(`${cx+dx}:${cy+dy}`)||[]){const d=(p.x-x)**2+(p.y-y)**2;if(d<bd){bd=d;best=p.s;}}
 }
 return best;
}
function choose(s,focus=false){
 if(!s)return;selected=s;highlighted=null;
 $('selected').replaceChildren();const strong=document.createElement('strong');strong.textContent=`${s.sectionId} · Row ${s.row} · Seat ${s.number}`;
 const p=document.createElement('p');p.textContent=`Seat ID: ${s.uid}\nLevel: ${model.tiers[s.tier]?.label||'Imported level'}\nSeat position: ${source.includes('estimated')?'estimated':'imported, not independently verified'}\nX ${s.x.toFixed(2)} · Y ${s.y.toFixed(2)} · Z ${s.z.toFixed(2)} m`;
 p.style.whiteSpace='pre-line';$('selected').append(strong,p);
 $('topSub').textContent=`Selected ${s.sectionId} · Row ${s.row} · Seat ${s.number}`;
 if(focus && mode==='map'){scale=Math.max(scale,Math.min(13,Math.max(width,height)/50));tx=width/2-s.x*scale;ty=height/2-s.z*scale;}
 if(scene){scene.highlight(s);if(mode==='seat')scene.setView('seat');if(mode==='section')scene.setView('section');}
 queueDraw();
}
function locate(query){
 const q=query.trim().toLowerCase();if(!q)return null;
 return byId.get(query)||seats.find(s=>String(s.uid).toLowerCase()===q)||seats.find(s=>String(s.sectionId).toLowerCase()+' '+String(s.row).toLowerCase()+' '+String(s.number).toLowerCase()===q)||seats.find(s=>String(s.uid).toLowerCase().includes(q));
}
const sectionFirst=new Map();for(const s of seats)if(!sectionFirst.has(s.sectionId))sectionFirst.set(s.sectionId,s);
$('tier').onchange=()=>{queueDraw();};$('section').onchange=()=>{if($('section').value!=='all'&&mode==='map'){const s=sectionFirst.get($('section').value);if(s){const all=seats.filter(v=>v.sectionId===s.sectionId);const cx=all.reduce((a,v)=>a+v.x,0)/all.length,cz=all.reduce((a,v)=>a+v.z,0)/all.length;scale=Math.max(scale,Math.min(12,(width-100)/Math.max(8,Math.sqrt(all.length)*.53)));tx=width/2-cx*scale;ty=height/2-cz*scale;}}queueDraw();};
$('searchBtn').onclick=()=>{const s=locate($('search').value);if(s){$('section').value='all';$('tier').value='all';choose(s,true);}else setError('No matching seat. Check the school ticket identifier or select a section.');};
$('search').onkeydown=e=>{if(e.key==='Enter')$('searchBtn').click();};
$('clearBtn').onclick=()=>{$('search').value='';$('section').value='all';$('tier').value='all';fit();};
let pointer=null;
canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,tx,ty,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
 const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
 if(pointer){const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(dx,dy)>4)pointer.moved=true;if(pointer.moved){tx=pointer.tx+dx;ty=pointer.ty+dy;queueDraw();return;}}
 const s=near(x,y);highlighted=s;
 $('hoverInfo').hidden=!s;
 if(s){$('hoverInfo').textContent=`${s.sectionId} · Row ${s.row} · Seat ${s.number}`;$('hoverInfo').style.left=Math.min(width-195,x+15)+'px';$('hoverInfo').style.top=Math.min(height-60,y+15)+'px';}
 queueDraw();
});
canvas.addEventListener('pointerup',e=>{
 if(pointer&&!pointer.moved){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
   const label=labelBoxes.find(b=>Math.abs(x-b.x)<b.w/2&&Math.abs(y-b.y)<b.h/2);
   if(label){$('section').value=label.id;$('section').dispatchEvent(new Event('change'));}
   else choose(near(x,y));
 }
 pointer=null;
});
canvas.addEventListener('pointercancel',()=>{pointer=null;});
canvas.addEventListener('pointerleave',()=>{$('hoverInfo').hidden=true;highlighted=null;queueDraw();});
canvas.addEventListener('wheel',e=>{if(mode!=='map')return;e.preventDefault();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const wx=(x-tx)/scale,wz=(y-ty)/scale;scale=Math.max(.18,Math.min(60,scale*(e.deltaY>0?.86:1.16)));tx=x-wx*scale;ty=y-wz*scale;queueDraw();},{passive:false});
$('zoomIn').onclick=()=>{if(mode==='map'){scale*=1.22;tx=width/2-(width/2-tx)*1.22;ty=height/2-(height/2-ty)*1.22;queueDraw();}};
$('zoomOut').onclick=()=>{if(mode==='map'){scale/=1.22;tx=width/2-(width/2-tx)/1.22;ty=height/2-(height/2-ty)/1.22;queueDraw();}};
$('fit').onclick=fit;
$('phone').onclick=()=>{$('phoneFrame').hidden=!$('phoneFrame').hidden;};
function setError(message){$('error').hidden=false;$('error').textContent=message;}
function setView(which){
 mode=which;canvas.hidden=which!=='map';$('scene').hidden=which==='map';
 for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===which);
 $('canvasNote').textContent=which==='map'?'Drag to pan · Scroll to zoom · Click a seat · Click a section label to filter':which==='seat'?'Drag to turn your head · Scroll to adjust field of view':'Drag to orbit · Scroll to zoom · Click a seat';
 if(scene){scene.setView(which==='map'?'plan':which);scene.resize();}
}
async function open3d(which){
 if(which==='seat'&&!selected){setError('Select a seat on the 2D map first.');return;}
 if(which==='section'&&!selected){setError('Choose a seat in the section first.');return;}
 setView(which);
 if(scene){scene.setViewOptions({posture:$('posture').value,target:$('target').value});return;}
 if(loading3d)return;loading3d=true;
 try{
  const {StadiumScene}=await import('../src/scene.js');
  scene=new StadiumScene($('scene'),s=>choose(s),section=>{const s=sectionFirst.get(section);if(s)choose(s);});
  scene.load(model);scene.highlight(selected);
  scene.setViewOptions({posture:$('posture').value,target:$('target').value});scene.setView(which);scene.resize();
  $('error').hidden=true;
 }catch(e){setView('map');setError('Three-dimensional rendering could not load. The exact seat IDs and the 2D map remain available. '+e.message);}finally{loading3d=false;}
}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>b.dataset.view==='map'?setView('map'):open3d(b.dataset.view);
$('seatView').onclick=()=>open3d('seat');
for(const id of ['posture','target'])$(id).onchange=()=>{if(scene)scene.setViewOptions({posture:$('posture').value,target:$('target').value});};
function step(direction){if(!selected)return;const a=seats.findIndex(s=>s.uid===selected.uid);choose(seats[(a+direction+seats.length)%seats.length]);}
$('previous').onclick=()=>step(-1);$('next').onclick=()=>step(1);
const favKey='filedmaker.saved-seats.'+String(project.title||'draft');let fav=[];
try{fav=JSON.parse(localStorage.getItem(favKey)||'[]').filter(id=>byId.has(id)).slice(0,100);}catch{}
function renderFavorites(){$('favorites').replaceChildren();if(!fav.length){$('favorites').textContent='No saved seats';return;}for(const id of fav){const s=byId.get(id),b=document.createElement('button');b.textContent=`${s.sectionId} · Row ${s.row} · Seat ${s.number}`;b.onclick=()=>choose(s,true);$('favorites').append(b);}}
$('favorite').onclick=()=>{if(!selected)return;const id=String(selected.uid);fav=fav.includes(id)?fav.filter(x=>x!==id):[id,...fav].slice(0,100);try{localStorage.setItem(favKey,JSON.stringify(fav));}catch{}renderFavorites();$('favorite').textContent=fav.includes(id)?'★ Saved':'☆ Save seat';};renderFavorites();
$('share').onclick=async()=>{if(!selected){setError('Select a seat first.');return;}const u=new URL(location.href);u.hash='seat='+encodeURIComponent(selected.uid);try{await navigator.clipboard.writeText(u.href);$('share').textContent='Link copied';}catch{setError('Copy this local link manually: '+u.href);}};
const comparison=[null,null];
function renderComparison(slot){
 const item=comparison[slot],target=$(slot?'compareRight':'compareLeft');target.replaceChildren();
 if(!item){target.textContent=(slot?'B':'A')+' · Not selected';return;}
 if(item.photo){const img=document.createElement('img');img.src=item.photo;img.alt='Captured simulated viewpoint';target.append(img);}
 const text=document.createElement('span');text.textContent=(slot?'B':'A')+' · '+item.section+' / '+item.row+' / '+item.seat;target.append(text);
}
for(const [slot,id] of [[0,'compareA'],[1,'compareB']])$(id).onclick=()=>{
 if(!selected)return;comparison[slot]={id:selected.uid,section:selected.sectionId,row:selected.row,seat:selected.number,photo:scene&&mode==='seat'?scene.capture():null};renderComparison(slot);
};
let photoURL=null;$('photo').onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10_000_000){setError('Please upload JPEG, PNG or WebP under 10 MB.');return;}if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(f);const im=new Image();im.src=photoURL;im.alt='Local reference photo';$('photoPreview').replaceChildren(im);};
const hash=new URLSearchParams(location.hash.slice(1));if(hash.has('seat')&&byId.has(hash.get('seat')))choose(byId.get(hash.get('seat')));
const ro=new ResizeObserver(()=>{size();if(scale<=1)fit();});ro.observe(canvas.parentElement);
size();fit();
