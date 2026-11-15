import { generateSeats, SURFACES } from '../src/model.mjs';
import { SeatScene as StadiumScene } from '../src/next/compatScene.js';
import { createSchoolProject, applySchoolRowPlan, applySchoolSurvey, schoolReadiness, schoolExampleRowsCSV } from '../src/schoolPipeline.mjs';
import { buildSchoolViewerHTML, buildOfflineSchoolViewerHTML } from '../src/schoolPublisher.mjs';
import { enableSeatFirst, importTicketRoster, ticketReconciliation, ticketMappingCSV, demoTicketRosterCSV } from '../src/seatFirst.mjs';
const $=id=>document.getElementById(id);
let project=createSchoolProject('college-gym',{school:$('schoolName').value,venue:$('venueName').value,primaryColor:$('schoolColor').value});
let model=null,stadium=null,selected=null,view='orbit';
const text=(id,value)=>$(id).textContent=value;
function toast(m,error=false){text('message',m);$('message').style.color=error?'#ad3227':'#4f6657';}
function save(name,content,mime='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function slug(){return project.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'school-venue';}
function chooseSeat(s){selected=s;stadium?.highlight(s);if(!s)return;text('chosen',`${s.sectionId} · Row ${s.row} · Seat ${s.number}\nX ${s.x.toFixed(2)} m / Y ${s.y.toFixed(2)} m / Z ${s.z.toFixed(2)} m`);if(view==='seat')stadium?.setView('seat');}
function render(){
  model=generateSeats(project);selected=null;const r=schoolReadiness(project,model);
  const reconciliation=ticketReconciliation(project,model.capacity);
  text('officialCount',reconciliation.officialCapacity===null?'Not provided':reconciliation.officialCapacity.toLocaleString());
  text('inventoryCount',reconciliation.inventoryCount===null?'Not imported':reconciliation.inventoryCount.toLocaleString());
  text('deltaCount',reconciliation.inventoryVsOfficial===null?'Pending':(reconciliation.inventoryVsOfficial===0?'Counts match · unverified':`${reconciliation.inventoryVsOfficial>0?'+':''}${reconciliation.inventoryVsOfficial.toLocaleString()} vs official`));
  $('officialCapacity').value=project.ticketing?.officialCapacity??'';
  $('capacitySource').value=project.ticketing?.capacitySource??'';
  $('capacityScope').value=project.ticketing?.capacityScope??'';
  text('title',project.title);text('count',r.seatCount.toLocaleString());text('method',r.sourceMethod);text('sections',String(model.project.sections.filter(s=>s.enabled).length));
  text('court',`${model.surface.length.toFixed(1)} × ${model.surface.width.toFixed(1)} m`);
  text('sidebarStatus',r.sourceMethod+' · local preview');text('chosen','Click any seat in the model.');
  const q=$('quality');q.replaceChildren();
  for(const s of r.blockers){const line=document.createElement('div'),icon=document.createElement('i'),message=document.createElement('span');icon.textContent='!';message.textContent=s;line.append(icon,message);q.append(line);}
  try { if(!stadium)stadium=new StadiumScene($('canvas'),chooseSeat,()=>{});stadium.load(model);stadium.setView('orbit');view='orbit';setModes(); }
  catch(e){$('canvasError').hidden=false;text('canvasError','3D engine unavailable. '+e.message+' — Project JSON and seat preview generation are still supported.');}
  toast(`${r.seatCount.toLocaleString()} seat positions generated · ${r.sourceMethod}`);
}
function setModes(){for(const id of ['orbit','plan','human'])$(id).classList.toggle('active',(id==='human'?'seat':id)===view);}
function setView(v){if(v==='seat'&&!selected){toast('Select a seat first.',true);return;}if(!stadium){toast('3D renderer not loaded.',true);return;}view=v;stadium.setView(v);setModes();}
$('build').addEventListener('click',()=>{if(!confirm('Replace this draft with a newly generated school template?'))return;try{project=createSchoolProject($('profile').value,{school:$('schoolName').value,venue:$('venueName').value,primaryColor:$('schoolColor').value,city:$('city').value,country:$('country').value});render();}catch(e){toast(e.message,true);}});
$('rowsCsv').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>8_000_000)throw Error('Row CSV exceeds 8MB.');project=applySchoolRowPlan(project,await file.text());render();toast(`Imported school-provided row labels: ${model.capacity.toLocaleString()} seat positions (XYZ estimated).`);}catch(err){toast(err.message,true);}finally{e.target.value='';}});
$('ticketCsv').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>32_000_000)throw Error('Ticket CSV exceeds 32MB.');const result=importTicketRoster(project,await file.text(),`Uploaded file: ${file.name}`);project=result.project;render();toast(`${result.report.inventoryCount.toLocaleString()} ticket identities preserved · ${result.report.status}. Positions are ${project.ticketing.coordinates}; ${result.unmatchedSections.length} section placements are schematic.`);}catch(err){toast(err.message,true);}finally{e.target.value='';}});
$('surveyCsv').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>32_000_000)throw Error('Survey CSV exceeds 32MB.');project=applySchoolSurvey(project,await file.text());render();toast('Imported school-provided XYZ positions. Independent measurement verification remains required.');}catch(err){toast(err.message,true);}finally{e.target.value='';}});
$('exampleCsv').onclick=()=>save('school-rows-example.csv',schoolExampleRowsCSV(),'text/csv;charset=utf-8');
$('ticketExample').onclick=()=>save('fictional-ticket-roster.csv',demoTicketRosterCSV(),'text/csv;charset=utf-8');
$('setCapacity').onclick=()=>{try{const raw=$('officialCapacity').value.trim(),source=$('capacitySource').value.trim(),scope=$('capacityScope').value.trim();if(raw&&!source)throw Error('Provide an HTTPS source for an official capacity figure.');const copy=structuredClone(project);copy.ticketing={...(copy.ticketing||{}),officialCapacity:raw===''?null:Number(raw),capacitySource:source,capacityScope:scope};project=enableSeatFirst(copy);render();toast('Capacity reference recorded. This does not create or remove ticket seats.');}catch(err){toast(err.message,true);}};
$('clearRows').onclick=()=>{try{const copy=structuredClone(project);copy.survey.mode='generated';copy.survey.seats=[];if(copy.ticketing){copy.ticketing.inventoryCount=null;copy.ticketing.inventoryMode='none';copy.ticketing.coordinates='none';copy.ticketing.inventorySource='';}copy.school.status='draft';copy.school.seatCoordinateMethod='parametric-estimate';project=copy;render();}catch(e){toast(e.message,true);}};
$('openViewer').onclick=()=>{try{localStorage.setItem('filedmaker.viewer.project',JSON.stringify(project));window.open('../viewer/','_blank','noopener');toast('Seat Viewer opened with current seat identities.');}catch(e){toast('Could not open viewer: '+e.message,true);}};
$('publish').onclick=async()=>{try{const response=await fetch('../src/next/webgl.js');if(!response.ok)throw Error('Local WebGL renderer was not found.');const rendererSource=await response.text();save(slug()+'-seat-preview.html',buildOfflineSchoolViewerHTML(project,rendererSource),'text/html;charset=utf-8');toast('Standalone offline 2D/3D preview exported. Not a live ticketing website.');}catch(e){toast(e.message,true);}};
$('exportTicketMapping').onclick=()=>{try{save(slug()+'-ticket-mapping.csv',ticketMappingCSV(project),'text/csv;charset=utf-8');toast('Ticket identity mapping exported. No live inventory is linked.');}catch(e){toast(e.message,true);}};
$('exportJson').onclick=()=>save(slug()+'.filedmaker.json',JSON.stringify({format:'filedmaker-project',project},null,2),'application/json');
$('exportSeats').onclick=()=>{if(!model)return;const esc=v=>'"'+String(v).replace(/"/g,'""')+'"';const rows=['seat_id,section,row,seat,x_m,y_m,z_m,data_source'];for(const s of model.seats){rows.push([s.uid,s.sectionId,s.row,s.number,s.x.toFixed(4),s.y.toFixed(4),s.z.toFixed(4),project.school?.seatCoordinateMethod||'estimated'].map(esc).join(','));}save(slug()+'-seats.csv',rows.join('\r\n'),'text/csv;charset=utf-8');};
$('exportGlb').onclick=async()=>{if(!stadium)return toast('3D renderer unavailable.',true);try{const blob=await stadium.exportGLB();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=slug()+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('GLB downloaded. Venue geometry may be estimated.');}catch(e){toast('GLB export failed: '+e.message,true);}};
$('orbit').onclick=()=>setView('orbit');$('plan').onclick=()=>setView('plan');$('human').onclick=()=>setView('seat');
function step(direction){if(!model||!selected||!model.seats.length)return;const at=model.seats.findIndex(s=>s.uid===selected.uid);chooseSeat(model.seats[(at+direction+model.seats.length)%model.seats.length]);}
$('prevSeat').onclick=()=>step(-1);$('nextSeat').onclick=()=>step(1);
render();
