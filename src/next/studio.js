// Rebuilt school venue front end. Uses native WebGL2 and a single shared plan.
import { createOhioStadiumProject, createSchottensteinCenterProject } from '../venues.mjs';
import { createSchoolProject } from '../schoolPipeline.mjs';
import { generateSeats, validateProject } from '../model.mjs';
import { importTicketRoster } from '../seatFirst.mjs';
import { buildVenuePlan } from './venuePlan.mjs';
import { seatColor } from '../seatPresentation.mjs';
import { SCHOTTENSTEIN_CHART_URL, SCHOTTENSTEIN_REFERENCE_VIEWS, SCHOTTENSTEIN_COURT_SOURCE, SCHOTTENSTEIN_BOARD_SOURCE } from '../schottensteinSeating.mjs';
import { NativeVenueRenderer } from './webgl.js';
import { createProceduralProject, PROCEDURAL_DEMOS } from './engines/factory.mjs';
const $=id=>document.getElementById(id);
let project=null,model=null,plan=null,renderer=null,selected=null,mode='overview';
let seatsBySection=new Map();
let areaLabels=[],visibleAreaLabels=[];
const palettePresets={
  slate:['#5e747e','#7b9099','#97aab2','#bacbd1'],
  navy:['#255583','#3f79a6','#76a7cd','#aacbe2'],
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
    else if(name==='schott')project={...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'};
    else if(name==='procedural')project=createProceduralProject(PROCEDURAL_DEMOS.arena);
    else if(name==='procedural-football')project=createProceduralProject(PROCEDURAL_DEMOS.stadium);
    else project=createSchoolProject('college-gym',{school:'Demonstration school',venue:'Example Gymnasium'});
    document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));
    selected=null;renderProject();
  }catch(e){error(e.message)}
}
function prepareAreaLabels(){
  const rowCenters=new Map();
  for(const row of model.seatingRows??[]){
    if(!rowCenters.has(row.sectionId))rowCenters.set(row.sectionId,[]);
    rowCenters.get(row.sectionId).push(row);
  }
  const labels=[];
  for(const section of model.sectionFootprints??[]){
    const rows=rowCenters.get(section.id)??[];
    const frontSlot=Math.floor(section.depthRows*.20);
    let anchor=null;
    for(const row of rows){
      const offset=Math.abs(row.slot-frontSlot);
      if(!anchor||offset<anchor.offset||(offset===anchor.offset&&row.width>anchor.width)){
        anchor={x:(row.left.x+row.right.x)/2,y:row.y,z:(row.left.z+row.right.z)/2,offset,width:row.width};
      }
    }
    if(!anchor&&seatsBySection.has(section.id)){
      const seats=[...seatsBySection.get(section.id).values()].flat();
      const {labelPoint}=section;
      const distance=seat=>Math.hypot(seat.x-labelPoint.x,seat.z-labelPoint.z);
      anchor=seats.reduce((closest,seat)=>distance(seat)<distance(closest)?seat:closest);
    }
    if(anchor)labels.push({section:section.id,text:section.id,width:28,height:18,point:[anchor.x,anchor.y+1.12,anchor.z]});
  }
  for(const feature of plan.features){
    if(feature.outline)labels.push({text:feature.label,width:feature.kind==='accessible'?117:72,height:20,point:[feature.x,feature.y+1.12,feature.z]});
  }
  areaLabels=labels.map(label=>{
    const node=document.createElement(label.section?'button':'span');
    node.className=label.section?'area-label':'area-label zone';
    node.textContent=label.text;
    node.style.setProperty('--badge-width',`${label.width}px`);
    node.style.setProperty('--badge-height',`${label.height}px`);
    if(label.section){
      node.type='button';
      node.setAttribute('aria-label',`Focus section ${label.section}`);
      node.onclick=()=>{pickSection(label.section);view('section');};
    }
    node.hidden=true;
    return {...label,node};
  });
  $('areaLabels').replaceChildren(...areaLabels.map(label=>label.node));
}
function positionAreaLabels(scene){
  const layer=$('areaLabels');
  visibleAreaLabels=[];
  layer.hidden=!areaLabels.length||(mode!=='overview'&&mode!=='section');
  if(layer.hidden)return;
  const bounds=layer.getBoundingClientRect();
  const sx=bounds.width/scene.canvas.width,sy=bounds.height/scene.canvas.height;
  const occupied=[...layer.parentElement.querySelectorAll('.status-pill, .viewport-float.bottom span')].map(node=>{
    const r=node.getBoundingClientRect();
    return {left:r.left-bounds.left-4,top:r.top-bounds.top-4,right:r.right-bounds.left+4,bottom:r.bottom-bounds.top+4};
  });
  const projected=[];
  for(const label of areaLabels){
    label.node.hidden=true;
    const p=scene.projectPoint(label.point);
    if(!p)continue;
    const x=p[0]*sx,y=p[1]*sy;
    const active=label.section!==undefined&&label.section===selected?.sectionId;
    const width=active?84:label.width,height=active?25:label.height;
    const gap=mode==='overview'?6:2;
    const box={left:x-width/2-gap,right:x+width/2+gap,top:y-height/2-gap,bottom:y+height/2+gap};
    if(box.left<0||box.top<0||box.right>bounds.width||box.bottom>bounds.height)continue;
    projected.push({...label,x,y,box,active,depth:p[2]});
  }
  projected.sort((a,b)=>Number(b.active)-Number(a.active)||Number(Boolean(a.section))-Number(Boolean(b.section))||a.depth-b.depth);
  for(const label of projected){
    const {box,node,x,y,active}=label;
    if(occupied.some(r=>box.left<r.right&&box.right>r.left&&box.top<r.bottom&&box.bottom>r.top))continue;
    occupied.push(box);
    node.style.left=`${x}px`;
    node.style.top=`${y}px`;
    node.dataset.selected=String(active);
    const text=active?`Section ${label.section}`:label.text;
    if(node.textContent!==text)node.textContent=text;
    node.hidden=false;
    visibleAreaLabels.push(label);
  }
}
function renderProject(){
  const start=performance.now(),previous=selected?.uid;
  $('loading').hidden=false;
  try{
    model=generateSeats(project);
    seatsBySection=new Map();
    for(const seat of model.seats){
      if(!seatsBySection.has(seat.sectionId))seatsBySection.set(seat.sectionId,new Map());
      const rows=seatsBySection.get(seat.sectionId);
      const row=String(seat.row);
      if(!rows.has(row))rows.set(row,[]);
      rows.get(row).push(seat);
    }
    plan=buildVenuePlan(model,{palette:palettePresets[$('palette').value],detail:$('detail').value});
    prepareAreaLabels();
    if(!renderer){try{renderer=new NativeVenueRenderer($('viewport3d'),seat=>selectSeat(seat));}catch(e){error(e.message);mode='top';}}
    if(renderer){renderer.onFrame=positionAreaLabels;renderer.load(plan);}
    $('rosterRequirements').textContent=model.sectionFootprints
      ?'CSV with section, row, seat, x_m, y_m and z_m. Use seat centers at tread height in the court-centered frame.'
      :'CSV with section, row, seat and optional measured x/y/z. Original identifiers are preserved.';
    $('rosterExample').hidden=Boolean(model.sectionFootprints);
    $('cameraTarget').value='center';$('phoneView').checked=false;
    renderer?.setViewOptions({target:'center',zoom:1});
    const name=project.school?.venue||project.title;
    $('title').textContent=name.replace(/ — .*/, '');
    const seating=plan.hasRoster?'ticket roster loaded':model.proceduralGeometry?'six-engine procedural demonstration':model.seatingRows?'capacity-matched reconstruction':'estimated seating arrangement';
    $('subtitle').textContent=`${project.city||'United States'} · ${model.surface.label} · ${seating}`;
    $('officialCapacity').textContent=plan.official.officialCapacity===null?'Not published':fmt(plan.official.officialCapacity);
    const capacitySource=$('capacitySource');
    capacitySource.textContent='No verified capacity supplied';
    if(plan.official.officialCapacity!==null){
      const link=document.createElement('a');
      link.href=plan.official.officialSource;
      link.target='_blank';
      link.rel='noopener';
      link.textContent=plan.official.capacityWithStudents===null?'Published capacity source ↗'
        :`${fmt(plan.official.capacityWithStudents)} with students · Season record book ↗`;
      capacitySource.replaceChildren(link);
    }
    $('visualCount').textContent=fmt(model.seats.length);
    $('ticketCount').textContent=fmt(plan.hasRoster?plan.official.inventoryCount:0);
    $('capacityNote').textContent=plan.hasRoster
      ?`Imported ${fmt(plan.official.inventoryCount)} ticket IDs. ${plan.official.officialCapacity===null?'Official capacity not supplied.':`Published capacity ${fmt(plan.official.officialCapacity)}. Inventory difference ${fmt(plan.official.inventoryVsOfficial)}.`} Coordinates remain ${project.ticketing.coordinates==='estimated'?'estimated':'unverified'} until validated.`
      :model.proceduralGeometry
        ?`This is a synthetic venue, not a real stadium. ${fmt(model.seats.length)} estimated seats. Target ${fmt(model.proceduralSpec.targetCapacity??0)} is illustrative and not a published capacity.`
        :model.seatingRows
          ?`The model contains ${fmt(model.seats.length)} seats. The section chart and published rows guide their placement. Individual seat positions and sightlines are approximate.`
        :`${fmt(model.seats.length)} modeled positions. Seat coordinates and sightlines are estimated.`;
    $('referenceViews').hidden=!model.sectionFootprints;
    if(model.sectionFootprints){
      const source=document.createElement('a');
      source.href=SCHOTTENSTEIN_CHART_URL;source.target='_blank';source.rel='noopener';
      source.textContent='Ohio State basketball seating chart';
      $('capacityNote').append(' ',source);
    }
    $('rowsCount').textContent=fmt(plan.rowRuns);$('gapCount').textContent=fmt(plan.aisleBreaks);
    $('kindCount').textContent=plan.chairCount>plan.benchCount?'Chairs':'Bleachers';
    $('sourceTag').textContent=plan.hasRoster?'Ticket list imported':model.proceduralGeometry?'Procedural 3D preview':model.seatingRows?'Photo-referenced preview':'Illustrative geometry';
    $('modelStatus').innerHTML='<span class="pulse"></span> '+(plan.hasRoster?'Roster / geometry unverified':'Schematic preview');
    $('reviewFlag').textContent=plan.hasRoster?'ROSTER':'REFERENCE';
    $('warnings').style.color='';$('warnings').textContent=plan.engineAudit&&!plan.engineAudit.passed
      ?'Six-engine geometry validation failed: '+plan.engineAudit.errors.join(', ')
      :plan.engineAudit?.warnings.length?plan.engineAudit.warnings.join(' ') 
      :(plan.invalidRows||plan.positionCollisions)
      ?`Geometry warning: ${plan.invalidRows} elevation discontinuities and ${plan.positionCollisions} overlapping seat coordinates. Review imported survey data.`
      :plan.hasRoster?'Verify real seat geometry, inventory completeness and allowed ticketing use before publication.':'No verified per-seat dataset. Do not label generated positions as real seats.';
    $('searchHelp').textContent=plan.hasRoster?'Search the imported seat IDs or section, row and seat.':'Search preview locations by section, row and seat. Published row labels are shown where documented.';
    const restored=plan.seats.find(seat=>seat.uid===previous)??null;
    setOptions($('sectionPicker'),[...seatsBySection.keys()].sort(natural),'Choose section');
    selectSeat(restored);
    view(!renderer?'top':(!restored&&(mode==='human'||mode==='section'))?'overview':mode);
    const setupTime=Math.round(performance.now()-start);
    $('renderInfo').textContent=renderer?'WebGL2 · Offline':'2D map only';
    $('renderInfo').title=`${fmt(plan.instanceCount)} instances · ${setupTime} ms setup`;
  }catch(e){console.error(e);error(e.message);}finally{$('loading').hidden=true;}
}
const natural=(a,b)=>a.localeCompare(b,'en',{numeric:true,sensitivity:'base'});
function setOptions(select,values,placeholder){
  const options=values.map(value=>new Option(value,value));
  if(placeholder)options.unshift(new Option(placeholder,''));
  select.replaceChildren(...options);
  select.disabled=!values.length;
}
function syncSeatPicker(seat){
  $('sectionPicker').value=seat?.sectionId??'';
  const rows=seatsBySection.get(seat?.sectionId);
  const values=rows?[...rows.keys()]:[];
  if(!model?.seatingRows)values.sort(natural);
  setOptions($('rowPicker'),values);
  if(seat)$('rowPicker').value=String(seat.row);
  const numbers=rows?.get(String(seat?.row))??[];
  setOptions($('seatPicker'),numbers.map(s=>String(s.number)).sort(natural));
  if(seat)$('seatPicker').value=String(seat.number);
}
function pickSection(id){
  const rows=seatsBySection.get(id);
  if(!rows)return;
  const keys=[...rows.keys()];
  if(!model?.seatingRows)keys.sort(natural);
  const seats=rows.get(keys[Math.floor(keys.length/2)]);
  selectSeat(seats[Math.floor(seats.length/2)]);
}
function pickReferenceSeat(reference){
  const seats=seatsBySection.get(reference.section)?.get(reference.row);
  if(seats?.length)selectSeat(seats[Math.floor(seats.length/2)]);
}
function selectSeat(seat){
  selected=seat;
  syncSeatPicker(seat);
  for(const id of ['goHuman','previous','next'])$(id).disabled=!seat;
  document.querySelector('[data-view="human"]').disabled=!(seat||model.seatingRows)||!renderer;
  document.querySelector('[data-view="section"]').disabled=!seat||!renderer;
  if(mode==='top')drawMap();
  $('seatDetails').replaceChildren();
  const title=document.createElement('strong');title.textContent=seat?`${seat.sectionId} · Row ${seat.row} · Seat ${seat.number}`:'No seat selected';$('seatDetails').append(title);
  const note=document.createElement('p');note.textContent=seat?(plan.hasRoster?`Imported seat ID: ${seat.uid}. Coordinates ${project.ticketing.coordinates==='estimated'?'estimated, not measured':'supplied but not verified'}.`:`${seat.uid} — synthetic position. This is not an actual ticketed seat.`):'Click a seat or find its ID. Views are approximate until validated against a real seat map.';$('seatDetails').append(note);
  const section=model.seatingRows&&model.sectionFootprints.find(item=>item.id===seat?.sectionId);
  if(section){
    const rows=seatsBySection.get(section.id);
    const count=[...rows.values()].reduce((sum,items)=>sum+items.length,0);
    const inventory=document.createElement('p');
    const method=section.publishedRowCounts?'published row counts':'allocated by row width';
    inventory.textContent=`${fmt(count)} modeled seats · ${fmt(rows.size)} rows · ${method}`;
    $('seatDetails').append(inventory);
  }
  updateReferencePhoto(seat);
  if(seat){$('selectedPreview').textContent=plan.hasRoster?`Ticket reference ${seat.uid}`:`Illustrative position · ${seat.sectionId} / row ${seat.row}`;}
  else $('selectedPreview').textContent='Select a location to inspect a schematic seat view';
  if(mode==='human'&&seat)renderer?.view('human',seat);
  else if(mode==='section'&&seat)renderer?.view('section',seat);
  else if(renderer){
    renderer.highlight(seat);
    positionAreaLabels(renderer);
  }
}
function updateReferencePhoto(seat){
  const reference=SCHOTTENSTEIN_REFERENCE_VIEWS.find(item=>item.section===seat?.sectionId);
  const target=$('referenceSource');
  if(!model.seatingRows||!reference){
    target.textContent='Choose a reference position to compare with a published photo.';
    return;
  }
  const link=document.createElement('a');
  link.href=reference.source;
  link.target='_blank';
  link.rel='noopener';
  link.textContent=`Section ${reference.section} · Row ${reference.row} photo reference ↗`;
  target.replaceChildren(link);
}
function view(which){
  if(which!=='top'&&!renderer)return;
  if(which==='human'&&!selected&&model.seatingRows)pickReferenceSeat(SCHOTTENSTEIN_REFERENCE_VIEWS[0]);
  if(which==='human'&&!selected){error('Choose a seat to enter seat view.');return;}
  if(which==='section'&&!selected){error('Choose a seat or search an identifier before focusing a section.');return;}
  mode=which;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('current',b.dataset.view===which));
  $('cameraControls').hidden=!renderer||which==='top';
  $('cameraTarget').parentElement.hidden=which!=='human';
  $('phoneView').parentElement.hidden=which!=='human';
  const basketball=plan.surface.sport==='basketball';
  for(const option of $('cameraTarget').options)if(option.value!=='center')option.hidden=!basketball;
  $('viewport3d').hidden=which==='top';$('viewport2d').hidden=which!=='top';
  $('viewLabel').textContent=({overview:'Whole venue / overview',top:'2D seating map',section:'Selected section / close-up',human:'View from selected seat'})[which];
  $('viewHint').textContent=which==='top'
    ?(plan.features.length?'Select a section · Gold dots mark venue features':model.sectionFootprints?'Select a numbered section':'Select a seat on the map')
    :which==='human'?'Drag to look around · Scroll to change field of view':'Drag to orbit · Scroll to zoom · Click a seat';
  if(which==='top'){
    $('areaLabels').hidden=true;
    drawMap();
  }else {renderer?.view(which,selected);renderer?.resize();}
}
function drawMap(){
  if(!plan)return;
  const c=$('viewport2d'),dpr=Math.min(devicePixelRatio||1,2),r=c.getBoundingClientRect();
  if(!r.width||!r.height)return;
  c.width=Math.round(r.width*dpr);
  c.height=Math.round(r.height*dpr);
  const ctx=c.getContext('2d'),cx=c.width/2,cy=c.height/2;
  const chart=model.sectionFootprints;
  const horizontal=chart||plan.surface.sport==='basketball';
  const palette=palettePresets[$('palette').value];
  const tint=(tier,index)=>palette?.[tier]||(model.seatingRows?['#903549','#823348','#743245'][tier]:seatColor(project,tier,index));
  let extentX=plan.surface.width/2+8,extentZ=plan.surface.length/2+8;
  for(const s of plan.seats){
    extentX=Math.max(extentX,Math.abs(s.x)+3);
    extentZ=Math.max(extentZ,Math.abs(s.z)+3);
  }
  for(const section of chart??[]){
    for(const p of section.outlines.flat()){
      extentX=Math.max(extentX,Math.abs(p.x)+3);
      extentZ=Math.max(extentZ,Math.abs(p.z)+3);
    }
  }
  const scale=.47*Math.min(c.width/(horizontal?extentZ:extentX),c.height/(horizontal?extentX:extentZ));
  const pos=s=>horizontal?[cx+(chart?-s.z:s.z)*scale,cy+s.x*scale]:[cx+s.x*scale,cy+s.z*scale];
  ctx.fillStyle='#e8e8e5';
  ctx.fillRect(0,0,c.width,c.height);
  const fw=(horizontal?plan.surface.length:plan.surface.width)*scale;
  const fl=(horizontal?plan.surface.width:plan.surface.length)*scale;
  const court=plan.courtStyle;
  if(court){
    const border=court.apronWidth*scale*.5;
    ctx.fillStyle=court.apron;
    ctx.fillRect(cx-fw/2-border,cy-fl/2-border,fw+2*border,fl+2*border);
  }
  ctx.fillStyle=court?.wood??(plan.surface.sport==='basketball'?'#d9bb87':'#35744d');
  ctx.fillRect(cx-fw/2,cy-fl/2,fw,fl);
  if(court){
    const laneLength=court.laneSize.length*scale,laneWidth=court.laneSize.width*scale;
    ctx.fillStyle=court.lane;
    ctx.fillRect(cx-fw/2,cy-laneWidth/2,laneLength,laneWidth);
    ctx.fillRect(cx+fw/2-laneLength,cy-laneWidth/2,laneLength,laneWidth);
  }
  ctx.strokeStyle=court?.lines??'#fff';
  ctx.lineWidth=1.25*dpr;
  ctx.strokeRect(cx-fw/2,cy-fl/2,fw,fl);
  ctx.beginPath();
  if(horizontal){ctx.moveTo(cx,cy-fl/2);ctx.lineTo(cx,cy+fl/2);}
  else {ctx.moveTo(cx-fw/2,cy);ctx.lineTo(cx+fw/2,cy);}
  ctx.stroke();
  if(plan.surface.sport==='basketball'){
    ctx.beginPath();ctx.arc(cx,cy,1.83*scale,0,Math.PI*2);ctx.stroke();
  }
  const hitAreas=[];
  if(chart){
    for(const {id,tier,outlines,labelPoint} of chart){
      const available=seatsBySection.has(id);
      const path=new Path2D();
      for(const outline of outlines){
        const points=outline.map(pos);
        path.moveTo(...points[0]);
        points.slice(1).forEach(p=>path.lineTo(...p));
        path.closePath();
      }
      const sectionColor=id===selected?.sectionId?'#a9495e':available?tint(tier,0):'#d5e0eb';
      ctx.fillStyle=sectionColor;
      ctx.fill(path);
      ctx.strokeStyle='#f2efec';
      ctx.lineWidth=.8*dpr;
      ctx.stroke(path);
      const center=pos(labelPoint);
      const labelOutside=!ctx.isPointInPath(path,...center);
      const [r,g,b]=[1,3,5].map(index=>parseInt(sectionColor.slice(index,index+2),16));
      const lightSection=(.2126*r+.7152*g+.0722*b)/255>.62;
      ctx.fillStyle=!available||labelOutside||lightSection?'#263844':'#fff';
      const fontSize=Math.max(7,Math.min(12,scale*1.65/dpr));
      ctx.font=`600 ${fontSize*dpr}px system-ui`;
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText(id,...center);
      if(available)hitAreas.push({id,path,center});
    }
  }
  if(!chart||plan.hasRoster){
    const step=Math.max(1,Math.ceil(plan.seats.length/8500));
    const radius=plan.seats.length>16000?1*dpr:1.5*dpr;
    ctx.fillStyle=tint(0,0);
    for(let i=0;i<plan.seats.length;i+=step){
      const s=plan.seats[i],p=pos(s);
      ctx.fillStyle=chart?'#182b40':tint(s.tier,s.sectionIndex);
      ctx.beginPath();ctx.arc(...p,radius,0,Math.PI*2);ctx.fill();
    }
  }
  for(const feature of plan.features){
    const point=pos(feature);
    ctx.fillStyle='#e6b986';ctx.strokeStyle='#283847';ctx.lineWidth=dpr;
    ctx.beginPath();ctx.arc(...point,2.6*dpr,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  if(selected){
    ctx.fillStyle='#ffc26b';ctx.strokeStyle='#fff';ctx.lineWidth=1.4*dpr;
    ctx.beginPath();ctx.arc(...pos(selected),3.6*dpr,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  c.onclick=e=>{
    const b=c.getBoundingClientRect(),x=(e.clientX-b.left)*c.width/b.width,y=(e.clientY-b.top)*c.height/b.height;
    if(!chart||plan.hasRoster){
      let best=null,min=((chart?5:18)*dpr)**2;
      for(const s of plan.seats){
        const p=pos(s),d=(p[0]-x)**2+(p[1]-y)**2;
        if(d<min){best=s;min=d;}
      }
      if(best){selectSeat(best);return;}
    }
    const section=hitAreas.find(hit=>ctx.isPointInPath(hit.path,x,y))
      ?? hitAreas.find(({center})=>Math.hypot(center[0]-x,center[1]-y)<10*dpr);
    if(section)pickSection(section.id);
  };
}
function cycleSeat(delta){
  if(!selected)return;
  const row=seatsBySection.get(selected.sectionId).get(String(selected.row));
  const index=row.indexOf(selected);
  selectSeat(row[Math.max(0,Math.min(row.length-1,index+delta))]);
}
function search(){
  if(!plan)return;
  const q=$('search').value.trim().toLowerCase();
  if(!q)return;
  const section=[...seatsBySection.keys()].find(id=>id.toLowerCase()===q);
  if(section){pickSection(section);if(renderer)view('section');return;}
  const labels=q.split(/\s*[/,]\s*|\s+/);
  const seat=plan.seats.find(s=>s.uid.toLowerCase()===q)
    || (labels.length===3&&plan.seats.find(s=>
      [s.sectionId,s.row,s.number].every((part,i)=>String(part).toLowerCase()===labels[i])))
    || plan.seats.find(s=>s.uid.toLowerCase().includes(q));
  if(seat){
    selectSeat(seat);
    if(renderer)view('human');
    $('searchHelp').textContent=`Found ${seat.uid}.`;
  }else $('searchHelp').textContent='No matching seat in the loaded data.';
}
for(const [label,url] of [['Court',SCHOTTENSTEIN_COURT_SOURCE],['Video displays',SCHOTTENSTEIN_BOARD_SOURCE]]){
  const source=document.createElement('a');
  source.href=url;
  source.textContent=label+' ↗';
  source.target='_blank';
  source.rel='noopener';
  $('arenaSources').append(source);
}
for(const reference of SCHOTTENSTEIN_REFERENCE_VIEWS){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=reference.label;
  button.onclick=()=>{
    pickReferenceSeat(reference);
    if(renderer)view('human');else view('top');
  };
  $('referenceButtons').append(button);
}
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>setPreset(b.dataset.preset));
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
$('sectionPicker').onchange=e=>{
  if(e.target.value)pickSection(e.target.value);
  else {
    if(mode==='human'||mode==='section')view('overview');
    selectSeat(null);
  }
};
$('rowPicker').onchange=e=>{
  const seats=seatsBySection.get(selected.sectionId).get(e.target.value);
  selectSeat(seats.find(s=>String(s.number)===String(selected.number))??seats[0]);
};
$('seatPicker').onchange=e=>{
  const seats=seatsBySection.get(selected.sectionId).get(String(selected.row));
  selectSeat(seats.find(s=>String(s.number)===e.target.value));
};
$('cameraTarget').onchange=e=>renderer?.setViewOptions({target:e.target.value});
$('phoneView').onchange=e=>renderer?.setViewOptions({zoom:e.target.checked?2.3:1});
$('resetCamera').onclick=()=>{
  $('cameraTarget').value='center';$('phoneView').checked=false;
  renderer?.setViewOptions({target:'center',zoom:1});
  renderer?.view(mode,selected);
};
$('previous').onclick=()=>cycleSeat(-1);$('next').onclick=()=>cycleSeat(1);$('goHuman').onclick=()=>view('human');
$('search').addEventListener('keydown',e=>{if(e.key==='Enter')search();});
$('search').addEventListener('search',search);
$('palette').onchange=renderProject;$('detail').onchange=renderProject;
$('csv').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const text=await file.text();
    const result=importTicketRoster(project,text,file.name,{requireCoordinates:Boolean(model.sectionFootprints)});
    project=result.project;selected=null;renderProject();
    $('searchHelp').textContent=`Imported ${fmt(result.report.inventoryCount)} seat IDs from ${file.name}.`;
  }
  catch(ex){error('CSV rejected: '+ex.message);}finally{e.target.value='';}
};
$('openProject').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{const decoded=JSON.parse(await file.text());project=validateProject(decoded.project||decoded);selected=null;document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));renderProject();}catch(ex){error('Invalid project: '+ex.message);}finally{e.target.value='';}
};
$('exportProject').onclick=()=>{if(project)download('filedmaker-project.json',JSON.stringify(project,null,2));};
function captureVenue(){
  renderer.render();
  const scene=renderer.canvas;
  if(!visibleAreaLabels.length)return scene.toDataURL('image/png');
  const image=document.createElement('canvas');
  image.width=scene.width;image.height=scene.height;
  const ctx=image.getContext('2d');
  ctx.drawImage(scene,0,0);
  const frame=scene.getBoundingClientRect();
  ctx.scale(image.width/frame.width,image.height/frame.height);
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const {x,y,width,height,text,section,active} of visibleAreaLabels){
    ctx.fillStyle=section?(active?'#7c263b':'#263748f0'):'#f3f6f9f5';
    ctx.strokeStyle=section?'#ffffffb8':'#aebfce';
    ctx.beginPath();
    ctx.roundRect(x-width/2,y-height/2,width,height,5);
    ctx.fill();ctx.stroke();
    ctx.fillStyle=section?'#fff':'#203043';
    ctx.font=section?'700 11px system-ui':'650 10px system-ui';
    ctx.fillText(text,x,y);
  }
  return image.toDataURL('image/png');
}
$('capture').onclick=()=>{
  if(mode==='top'){drawMap();$('viewport2d').toBlob(b=>{if(b){const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='venue-plan.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);}});return;}
  if(renderer){const a=document.createElement('a');a.href=captureVenue();a.download='venue-view.png';a.click();}
};
window.addEventListener('resize',()=>{renderer?.resize();if(mode==='top')drawMap();});
setPreset('schott');
