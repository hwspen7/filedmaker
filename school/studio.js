import { generateSeats, SURFACES } from '../src/model.mjs';
import { StadiumScene } from '../src/scene.js';
import { createSchoolProject, applySchoolRowPlan, applySchoolSurvey, schoolReadiness, schoolExampleRowsCSV } from '../src/schoolPipeline.mjs';
import { buildSchoolViewerHTML } from '../src/schoolPublisher.mjs';
const $=id=>document.getElementById(id);
let project=createSchoolProject('college-gym',{school:$('schoolName').value,venue:$('venueName').value});
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
$('build').addEventListener('click',()=>{if(!confirm('Replace this draft with a newly generated school template?'))return;try{project=createSchoolProject($('profile').value,{school:$('schoolName').value,venue:$('venueName').value,city:$('city').value,country:$('country').value});render();}catch(e){toast(e.message,true);}});
$('rowsCsv').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>8_000_000)throw Error('Row CSV exceeds 8MB.');project=applySchoolRowPlan(project,await file.text());render();toast(`Imported school-provided row labels: ${model.capacity.toLocaleString()} seat positions (XYZ estimated).`);}catch(err){toast(err.message,true);}finally{e.target.value='';}});
$('surveyCsv').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>32_000_000)throw Error('Survey CSV exceeds 32MB.');project=applySchoolSurvey(project,await file.text());render();toast('Imported school-provided XYZ positions. Independent measurement verification remains required.');}catch(err){toast(err.message,true);}finally{e.target.value='';}});
$('exampleCsv').onclick=()=>save('school-rows-example.csv',schoolExampleRowsCSV(),'text/csv;charset=utf-8');
$('clearRows').onclick=()=>{try{const copy=structuredClone(project);copy.survey.mode='generated';copy.survey.seats=[];copy.school.status='draft';copy.school.seatCoordinateMethod='parametric-estimate';project=copy;render();}catch(e){toast(e.message,true);}};
$('publish').onclick=()=>{try{save(slug()+'-seat-preview.html',buildSchoolViewerHTML(project),'text/html;charset=utf-8');toast('Standalone preview exported. This is not a live ticketing website.');}catch(e){toast(e.message,true);}};
$('exportJson').onclick=()=>save(slug()+'.filedmaker.json',JSON.stringify({format:'filedmaker-project',project},null,2),'application/json');
$('exportSeats').onclick=()=>{if(!model)return;const esc=v=>'"'+String(v).replace(/"/g,'""')+'"';const rows=['seat_id,section,row,seat,x_m,y_m,z_m,data_source'];for(const s of model.seats){rows.push([s.uid,s.sectionId,s.row,s.number,s.x.toFixed(4),s.y.toFixed(4),s.z.toFixed(4),project.school?.seatCoordinateMethod||'estimated'].map(esc).join(','));}save(slug()+'-seats.csv',rows.join('\r\n'),'text/csv;charset=utf-8');};
$('exportGlb').onclick=async()=>{if(!stadium)return toast('3D renderer unavailable.',true);try{const blob=await stadium.exportGLB();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=slug()+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('GLB downloaded. Venue geometry may be estimated.');}catch(e){toast('GLB export failed: '+e.message,true);}};
$('orbit').onclick=()=>setView('orbit');$('plan').onclick=()=>setView('plan');$('human').onclick=()=>setView('seat');
function step(direction){if(!model||!selected||!model.seats.length)return;const at=model.seats.findIndex(s=>s.uid===selected.uid);chooseSeat(model.seats[(at+direction+model.seats.length)%model.seats.length]);}
$('prevSeat').onclick=()=>step(-1);$('nextSeat').onclick=()=>step(1);
render();
