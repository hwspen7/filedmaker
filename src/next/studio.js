// Rebuilt school venue front end. Uses native WebGL2 and a single shared plan.
import { createOhioStadiumProject, createSchottensteinCenterProject } from '../venues.mjs';
import { createSchoolProject } from '../schoolPipeline.mjs';
import { generateSeats, validateProject } from '../model.mjs';
import { importTicketRoster } from '../seatFirst.mjs';
import { buildVenuePlan } from './venuePlan.mjs';
import { seatColor } from '../seatPresentation.mjs';
import { NativeVenueRenderer } from './webgl.js';
const $=id=>document.getElementById(id);
let project=null,model=null,plan=null,renderer=null,selected=null,mode='overview';
const palettePresets={
  slate:['#5e747e','#7b9099','#97aab2','#bacbd1'],
  navy:['#173e61','#356994','#6197c1','#91b8d4'],
  scarlet:['#9a3344','#ac6170','#8e99a0','#bdc4ca']
};
const fmt=n=>Number(n||0).toLocaleString('en-US');
const limited=s=>String(s??'').slice(0,150);
function download(filename,content,type='application/json'){
  const a=document.createElement('a'),u=URL.createObjectURL(new Blob([content],{type}));
  a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);
}
function error(message){$('warnings').textContent=limited(message);$('warnings').style.color='#a04444';}
function setPreset(name){
  try{
    if(name==='ohio')project=createOhioStadiumProject();
    else if(name==='schott')project=createSchottensteinCenterProject();
    else project=createSchoolProject('college-gym',{school:'Demonstration school',venue:'Example Gymnasium'});
    document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));
    selected=null;renderProject();
  }catch(e){error(e.message)}
}
function previewMode(){return plan?.hasRoster?'Imported ticket inventory':'Schematic visual reference';}
function renderProject(){
  const start=performance.now();$('loading').hidden=false;
  try{
    model=generateSeats(project);
    plan=buildVenuePlan(model,{palette:palettePresets[$('palette').value],detail:$('detail').value});
    if(!renderer){try{renderer=new NativeVenueRenderer($('viewport3d'),seat=>selectSeat(seat));}catch(e){error(e.message);mode='top';}}
    if(renderer)renderer.load(plan);
    const name=project.school?.venue||project.title;
    $('title').textContent=name.replace(/ — .*/, '');
    $('subtitle').textContent=`${project.city||'United States'} · ${model.surface.label} · ${plan.hasRoster?'ticket roster loaded':'estimated seating arrangement'}`;
    $('officialCapacity').textContent=plan.official.officialCapacity===null?'Not published':fmt(plan.official.officialCapacity);
    $('capacitySource').textContent=plan.official.officialCapacity!==null?'Published venue capacity, not a seat-inventory claim':'No verified capacity supplied';
    $('visualCount').textContent=fmt(model.seats.length);
    $('ticketCount').textContent=fmt(plan.hasRoster?plan.official.inventoryCount:0);
    $('capacityNote').textContent=plan.hasRoster
      ?`Imported ${fmt(plan.official.inventoryCount)} ticket IDs. ${plan.official.officialCapacity===null?'Official capacity not supplied.':`Published capacity ${fmt(plan.official.officialCapacity)}. Inventory difference ${fmt(plan.official.inventoryVsOfficial)}.`} Coordinates remain ${project.ticketing.coordinates==='estimated'?'estimated':'unverified'} until validated.`
      :`Showing ${fmt(model.seats.length)} synthetic locations. These are NOT the published capacity, verified section layout, ticket IDs or live availability.`;
    $('rowsCount').textContent=fmt(plan.rowRuns);$('gapCount').textContent=fmt(plan.aisleBreaks);
    $('kindCount').textContent=plan.chairCount>plan.benchCount?'Chairs':'Bleachers';
    $('sourceTag').textContent=plan.hasRoster?'Ticket list imported':'Illustrative geometry';
    $('modelStatus').innerHTML='<span class="pulse"></span> '+(plan.hasRoster?'Roster / geometry unverified':'Schematic preview');
    $('reviewFlag').textContent=plan.hasRoster?'ROSTER':'REFERENCE';
    $('warnings').style.color='';$('warnings').textContent=(plan.invalidRows||plan.positionCollisions)
      ?`Geometry warning: ${plan.invalidRows} elevation discontinuities and ${plan.positionCollisions} overlapping seat coordinates. Review imported survey data.`
      :plan.hasRoster?'Verify real seat geometry, inventory completeness and allowed ticketing use before publication.':'No verified per-seat dataset. Do not label generated positions as real seats.';
    $('searchHelp').textContent=plan.hasRoster?'Search the imported seat IDs or section, row and seat.':'Search synthetic IDs for preview only. Official row and seat IDs are not known.';
    selectSeat(null);view(mode==='human'?'overview':mode);
    $('renderInfo').textContent=`WebGL2 · ${fmt(plan.instanceCount)} meshes · ${Math.round(performance.now()-start)} ms setup`;
  }catch(e){console.error(e);error(e.message);}finally{$('loading').hidden=true;}
}
function selectSeat(seat){
  selected=seat;
  $('seatDetails').replaceChildren();
  const title=document.createElement('strong');title.textContent=seat?`${seat.sectionId} · Row ${seat.row} · Seat ${seat.number}`:'No seat selected';$('seatDetails').append(title);
  const note=document.createElement('p');note.textContent=seat?(plan.hasRoster?`Imported seat ID: ${seat.uid}. Coordinates ${project.ticketing.coordinates==='estimated'?'estimated, not measured':'supplied but not verified'}.`:`${seat.uid} — synthetic position. This is not an actual ticketed seat.`):'Click a seat or find its ID. Views are approximate until validated against a real seat map.';$('seatDetails').append(note);
  if(seat){$('selectedPreview').textContent=plan.hasRoster?`Ticket reference ${seat.uid}`:`Illustrative position · ${seat.sectionId} / row ${seat.row}`;}
  else $('selectedPreview').textContent='Select a location to inspect a schematic seat view';
  if(mode==='human'&&seat)renderer?.view('human',seat);
  else if(mode==='section'&&seat)renderer?.view('section',seat);
}
function view(which){
  if(which==='human'&&!selected){error('Choose a seat to enter human-eye mode.');return;}
  if(which==='section'&&!selected){error('Choose a seat or search an identifier before focusing a section.');return;}
  mode=which;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('current',b.dataset.view===which));
  $('viewport3d').hidden=which==='top';$('viewport2d').hidden=which!=='top';
  $('viewLabel').textContent=({overview:'Whole venue / overview',top:'2D seating / plan',section:'Selected section / close-up',human:'Human-eye approximation'})[which];
  $('viewHint').textContent=which==='top'?'Click a point to inspect · Schematic layout':which==='human'?'Drag to look around · Scroll to change field of view':'Drag to orbit · Scroll to zoom · Click a seat';
  if(which==='top')drawMap();else {renderer?.view(which,selected);renderer?.resize();}
}
function drawMap(){
  if(!plan)return;const c=$('viewport2d'),dpr=Math.min(devicePixelRatio||1,2),r=c.getBoundingClientRect();c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#e0e6e4';ctx.fillRect(0,0,c.width,c.height);
  let bound=Math.max(plan.surface.width/2+8,plan.surface.length/2+8);
  for(const s of plan.seats)bound=Math.max(bound,Math.abs(s.x)+5,Math.abs(s.z)+5);
  const scale=Math.min(c.width,c.height)*.44/bound,cx=c.width/2,cy=c.height/2;
  const pos=s=>[cx+s.x*scale,cy+s.z*scale];
  const fw=plan.surface.width*scale,fl=plan.surface.length*scale;
  ctx.fillStyle=plan.surface.sport==='basketball'?'#b6b8b7':'#35744d';ctx.fillRect(cx-fw/2,cy-fl/2,fw,fl);
  ctx.strokeStyle='#f8fafa';ctx.lineWidth=1.5*dpr;ctx.strokeRect(cx-fw/2,cy-fl/2,fw,fl);
  ctx.beginPath();ctx.moveTo(cx-fw/2,cy);ctx.lineTo(cx+fw/2,cy);ctx.stroke();
  const step=Math.max(1,Math.ceil(plan.seats.length/8500));const radius=plan.seats.length>16000?1*dpr:1.5*dpr;
  for(let i=0;i<plan.seats.length;i+=step){const s=plan.seats[i],p=pos(s),levels=['#456c85','#5e8caa','#85aabf','#a4beca'];ctx.fillStyle=levels[s.tier%4];ctx.beginPath();ctx.arc(p[0],p[1],radius,0,Math.PI*2);ctx.fill();}
  if(selected){const p=pos(selected);ctx.fillStyle='#e39942';ctx.strokeStyle='#fff';ctx.lineWidth=2*dpr;ctx.beginPath();ctx.arc(...p,5*dpr,0,Math.PI*2);ctx.fill();ctx.stroke();}
  c.onclick=e=>{const b=c.getBoundingClientRect(),x=(e.clientX-b.left)*c.width/b.width,y=(e.clientY-b.top)*c.height/b.height;let best=null,min=20*dpr*20*dpr;
    for(const s of plan.seats){const p=pos(s),d=(p[0]-x)**2+(p[1]-y)**2;if(d<min){best=s;min=d;}}
    if(best){selectSeat(best);drawMap();}
  };
}
function cycleSeat(delta){if(!selected||!plan)return;const i=plan.seats.findIndex(s=>s.uid===selected.uid);if(i>=0)selectSeat(plan.seats[Math.max(0,Math.min(plan.seats.length-1,i+delta))]);if(mode==='top')drawMap();}
function search(){if(!plan)return;const q=$('search').value.trim().toLowerCase();if(!q)return;
  const s=plan.seats.find(s=>s.uid.toLowerCase()===q)||plan.seats.find(s=>s.uid.toLowerCase().includes(q)||s.sectionId.toLowerCase()===q);
  if(s){selectSeat(s);view('section');$('searchHelp').textContent=`Found ${s.uid}. ${plan.hasRoster?'Imported ticket ID':'Synthetic identifier only'}.`;}
  else $('searchHelp').textContent='No matching seat in the loaded data.';
}
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>setPreset(b.dataset.preset));
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
$('previous').onclick=()=>cycleSeat(-1);$('next').onclick=()=>cycleSeat(1);$('goHuman').onclick=()=>view('human');
$('search').addEventListener('keydown',e=>{if(e.key==='Enter')search();});
$('search').addEventListener('search',search);
$('palette').onchange=renderProject;$('detail').onchange=renderProject;
$('csv').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const text=await file.text();const result=importTicketRoster(project,text,file.name);project=result.project;selected=null;renderProject();$('searchHelp').textContent=`Imported ${fmt(result.report.inventoryCount)} seat IDs from ${file.name}.`;}
  catch(ex){error('CSV rejected: '+ex.message);}finally{e.target.value='';}
};
$('openProject').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{const decoded=JSON.parse(await file.text());project=validateProject(decoded.project||decoded);selected=null;document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));renderProject();}catch(ex){error('Invalid project: '+ex.message);}finally{e.target.value='';}
};
$('exportProject').onclick=()=>{if(project)download('filedmaker-project.json',JSON.stringify(project,null,2));};
$('capture').onclick=()=>{
  if(mode==='top'){drawMap();$('viewport2d').toBlob(b=>{if(b){const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='venue-plan.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);}});return;}
  if(renderer){const a=document.createElement('a');a.href=renderer.capture();a.download='venue-view.png';a.click();}
};
window.addEventListener('resize',()=>{renderer?.resize();if(mode==='top')drawMap();});
setPreset('schott');
