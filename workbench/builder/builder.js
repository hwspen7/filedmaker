// FiledMaker Venue Builder — interactive 3D scene canvas, no external libraries.
// This builder models conceptual event layouts, not official ticket inventory.
import {PARTS,createProject,addPart,updatePart,removePart,duplicatePart,
  validateProject,countSeats,seatsForStand,rotatedPoint,
  exportProject,importProject} from '../../src/builder/model.mjs';

const $=id=>document.getElementById(id);
const canvas=$('scene'),frame=$('canvasFrame'),ctx=canvas.getContext('2d');
const icons={stand:'▥',stage:'▰',platform:'▭',table:'▣',
  barrier:'━',tower:'♢',booth:'▤',entrance:'⌂'};
const numericFields=[
  ['x','Position X (m)',-200,200,.5],
  ['z','Position Z (m)',-200,200,.5],
  ['yaw','Rotation (degrees)',-3600,3600,5],
  ['width','Width (m)',.3,150,.5],
  ['depth','Depth (m)',.2,100,.5],
  ['height','Height (m)',.1,50,.1]
];
const standFields=[
  ['rows','Seat rows',1,65,1],
  ['rise','Rise per row (m)',.05,1.2,.05],
  ['seatWidth','Seat spacing (m)',.4,1.2,.05],
  ['baseHeight','Front height (m)',0,10,.1]
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let project=createProject('basketball');
let selected=null,history=[],future=[],pointer=null,hitRegions=[];
let view={yaw:-.64,tilt:.82,scale:11,mode:'3d'};
let size={w:800,h:600};
let redrawPending=false;

function status(message,isError=false){
  $('status').textContent=message;
  $('status').style.color=isError?'#b64e45':'#738491';
}
function snapshot(){return exportProject(project);}
function updateStats(){
  $('seatCount').textContent=countSeats(project).toLocaleString('en-US')+' modeled seats';
  $('objectCount').textContent=String(project.parts.length);
  $('undo').disabled=!history.length;
  $('redo').disabled=!future.length;
}
function record(before){
  if(snapshot()===before)return;
  history.push(before);
  if(history.length>60)history.shift();
  future=[];
  updateStats();
}
function commit(next){
  const before=snapshot();
  project=validateProject(next);
  record(before);
  refresh();
}
function transact(edit){
  try{commit(edit());status('Changes applied. Save locally or export to keep this layout.');}
  catch(error){status(error.message,true);renderProperties();}
}
function restore(text){
  project=importProject(text);
  if(selected&&!project.parts.some(p=>p.id===selected))selected=null;
  refresh();
}
function undo(){
  if(!history.length)return;
  const current=snapshot(),last=history.pop();
  future.push(current);restore(last);status('Undid the last change.');
}
function redo(){
  if(!future.length)return;
  const current=snapshot(),next=future.pop();
  history.push(current);restore(next);status('Redid the last change.');
}
function choose(id){
  selected=id;
  renderProperties();
  renderObjectList();
  paintSoon();
}
function makeField(key,caption,value,configuration={}){
  const label=document.createElement('label');
  label.textContent=caption;
  const input=document.createElement('input');
  input.value=String(value);
  input.type=configuration.type||'number';
  if(input.type==='number'){
    input.min=String(configuration.min);
    input.max=String(configuration.max);
    input.step=String(configuration.step);
  }
  if(input.type==='text')input.maxLength=80;
  input.addEventListener('change',()=>{
    if(!selected)return;
    const value=input.type==='number'?Number(input.value):input.value;
    transact(()=>updatePart(project,selected,{[key]:value}));
  });
  label.append(input);
  return label;
}
function renderProperties(){
  const part=project.parts.find(p=>p.id===selected);
  $('selectionType').textContent=part?PARTS[part.kind].label:'No selection';
  $('emptySelection').hidden=Boolean(part);
  $('properties').hidden=!part;
  const fields=$('fieldList');fields.replaceChildren();
  if(!part)return;
  fields.append(makeField('label','Component name',part.label,{type:'text'}));
  for(const [key,caption,min,max,step] of numericFields){
    fields.append(makeField(key,caption,part[key],{min,max,step}));
  }
  if(part.kind==='stand'){
    for(const [key,caption,min,max,step] of standFields){
      fields.append(makeField(key,caption,part[key],{min,max,step}));
    }
    const total=document.createElement('p');
    total.className='hint';
    total.textContent='This stand has '+seatsForStand(part).length.toLocaleString('en-US')+
      ' illustrative seats. Resize the stand or change rows to regenerate them.';
    fields.append(total);
  }
  fields.append(makeField('color','Component color',part.color,{type:'color'}));
}
function renderObjectList(){
  const target=$('objectList');
  target.replaceChildren();
  for(const part of project.parts){
    const button=document.createElement('button');
    button.type='button';
    button.className='object-button'+(selected===part.id?' chosen':'');
    const name=document.createElement('span');
    name.textContent=part.label;
    const short=document.createElement('span');
    short.textContent=part.kind==='stand'?
      (part.rows+' rows'):(part.kind);
    button.append(name,short);
    button.onclick=()=>choose(part.id);
    target.append(button);
  }
}
function refresh(){
  $('projectName').value=project.name;
  $('activity').value=project.activity;
  renderObjectList();
  renderProperties();
  updateStats();
  paintSoon();
}
function setLayout(activity){
  if(history.length||project.parts.length){
    if(!window.confirm('Start a new '+activity+' layout? Export or save your current design first.'))return;
  }
  project=createProject(activity);history=[];future=[];selected=null;
  refresh();fitView();status('New '+activity+' layout created. Drag any component to reposition it.');
}
function installLibrary(){
  const root=$('library');
  for(const [kind,item] of Object.entries(PARTS)){
    const element=document.createElement('button');
    element.type='button';element.className='part';element.draggable=true;
    element.dataset.kind=kind;
    const symbol=document.createElement('span');
    symbol.className='part-symbol';symbol.textContent=icons[kind];
    const name=document.createElement('span');
    name.className='part-name';name.textContent=item.label;
    element.append(symbol,name);
    element.addEventListener('click',()=>addComponent(kind,0,0));
    element.addEventListener('dragstart',event=>{
      event.dataTransfer.effectAllowed='copy';
      event.dataTransfer.setData('text/plain',kind);
    });
    root.append(element);
  }
}
function addComponent(kind,x,z){
  try{
    const next=addPart(project,kind,{x:Math.round(x*2)/2,z:Math.round(z*2)/2});
    const before=new Set(project.parts.map(p=>p.id));
    const id=next.parts.find(p=>!before.has(p.id))?.id;
    commit(next);choose(id);
    status(PARTS[kind].label+' added. Drag it in the 3D viewport to place it.');
  }catch(error){status(error.message,true);}
}
function groundPosition(screenX,screenY){
  const ux=(screenX-size.w/2)/view.scale;
  const uz=(screenY-size.h/2)/(Math.sin(view.tilt)*view.scale);
  const c=Math.cos(view.yaw),s=Math.sin(view.yaw);
  return {x:c*ux+s*uz,z:-s*ux+c*uz};
}
function screenPoint(x,y,z){
  const c=Math.cos(view.yaw),s=Math.sin(view.yaw);
  const depth=x*s+z*c;
  return {x:size.w/2+(x*c-z*s)*view.scale,
    y:size.h/2+depth*Math.sin(view.tilt)*view.scale-y*Math.cos(view.tilt)*view.scale,
    depth};
}
function colorShade(hex,factor){
  const value=hex.slice(1);
  const channel=i=>clamp(Math.round(parseInt(value.slice(i,i+2),16)*factor),0,255);
  return 'rgb('+channel(0)+','+channel(2)+','+channel(4)+')';
}
function polygon(points,color,stroke=null,line=1){
  if(!points.length)return;
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(const p of points.slice(1))ctx.lineTo(p.x,p.y);
  ctx.closePath();
  if(color){ctx.fillStyle=color;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
}
function segment(a,b,stroke,width=1){
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
  ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
}
function hull(pts){
  const points=pts.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
  if(points.length<3)return points;
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const lower=[],upper=[];
  for(const p of points){
    while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();
    lower.push(p);
  }
  for(const p of points.slice().reverse()){
    while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();
    upper.push(p);
  }
  lower.pop();upper.pop();return [...lower,...upper];
}
function contains(points,x,y){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)
      inside=!inside;
  }
  return inside;
}
function corners(part,xMin=-part.width/2,xMax=part.width/2,
  zMin=-part.depth/2,zMax=part.depth/2,height=0){
  return [[xMin,zMin],[xMax,zMin],[xMax,zMax],[xMin,zMax]]
    .map(([x,z])=>rotatedPoint(part,x,z,height));
}
function worldToPixels(points){return points.map(p=>screenPoint(p.x,p.y,p.z));}
function addFace(primitives,vertices,color){
  const projected=worldToPixels(vertices);
  const depth=projected.reduce((sum,p)=>sum+p.depth,0)/projected.length;
  primitives.push({depth,draw:()=>polygon(projected,color,'#52657522',.5)});
}
function addBlock(primitives,part,xMin,xMax,zMin,zMax,height,base=0){
  const bottom=corners(part,xMin,xMax,zMin,zMax,base);
  const top=corners(part,xMin,xMax,zMin,zMax,height);
  addFace(primitives,[top[0],top[1],top[2],top[3]],colorShade(part.color,1.12));
  addFace(primitives,[bottom[0],bottom[1],top[1],top[0]],colorShade(part.color,.8));
  addFace(primitives,[bottom[1],bottom[2],top[2],top[1]],colorShade(part.color,.66));
  addFace(primitives,[bottom[2],bottom[3],top[3],top[2]],colorShade(part.color,.78));
  addFace(primitives,[bottom[3],bottom[0],top[0],top[3]],colorShade(part.color,.68));
}
function addSeat(primitives,seat,part){
  const projected=screenPoint(seat.x,seat.y+.08,seat.z);
  const radius=clamp(view.scale*.19,1.1,3.8);
  primitives.push({depth:projected.depth+.015,draw:()=>{
    ctx.beginPath();ctx.ellipse(projected.x,projected.y,radius,radius*.85,0,0,Math.PI*2);
    ctx.fillStyle=colorShade(part.color,1.36);ctx.fill();
  }});
}
function drawFloor(){
  const w=project.floor.width,l=project.floor.length;
  polygon(worldToPixels([{x:-w/2,y:-.11,z:-l/2},{x:w/2,y:-.11,z:-l/2},
    {x:w/2,y:-.11,z:l/2},{x:-w/2,y:-.11,z:l/2}]),
    project.floor.kind==='court'?'#dfc59e':'#e1e5e8','#adbbc3',1.2);
  if(project.floor.kind==='court'){
    const line='#fcfcf2',Y=-.08;
    const p=(x,z)=>screenPoint(x,Y,z);
    segment(p(-w/2,0),p(w/2,0),line,1.8);
    for(const z of [-l*.32,l*.32]){
      segment(p(-w*.24,z),p(w*.24,z),line,1.5);
    }
    ctx.beginPath();
    const points=[];
    for(let i=0;i<=50;i++){
      const t=2*Math.PI*i/50;
      points.push(p(Math.cos(t)*1.75,Math.sin(t)*1.75));
    }
    for(let i=1;i<points.length;i++)segment(points[i-1],points[i],line,1.1);
  }else{
    const y=-.08;
    for(let x=-w/2+5;x<w/2;x+=5)
      segment(screenPoint(x,y,-l/2),screenPoint(x,y,l/2),'#c3cbd1',.65);
    for(let z=-l/2+5;z<l/2;z+=5)
      segment(screenPoint(-w/2,y,z),screenPoint(w/2,y,z),'#c3cbd1',.65);
  }
}
function drawGrid(){
  const half=80,step=5;
  for(let n=-half;n<=half;n+=step){
    const stroke=n===0?'#c6d4dc':'#dce6e9';
    segment(screenPoint(-half,-.18,n),screenPoint(half,-.18,n),stroke,n===0?1:.65);
    segment(screenPoint(n,-.18,-half),screenPoint(n,-.18,half),stroke,n===0?1:.65);
  }
}
function drawScene(){
  if(!size.w||!size.h)return;
  ctx.clearRect(0,0,size.w,size.h);
  ctx.fillStyle='#edf2f4';ctx.fillRect(0,0,size.w,size.h);
  drawGrid();drawFloor();
  const primitives=[];
  hitRegions=[];
  for(const part of project.parts){
    const isStand=part.kind==='stand';
    const top=isStand?part.baseHeight+part.rows*part.rise:part.height;
    const base=isStand?0:0;
    const projected=worldToPixels([
      ...corners(part,-part.width/2,part.width/2,-part.depth/2,part.depth/2,base),
      ...corners(part,-part.width/2,part.width/2,-part.depth/2,part.depth/2,top)
    ]);
    const shape=hull(projected);
    const depth=projected.reduce((s,p)=>s+p.depth,0)/projected.length;
    hitRegions.push({id:part.id,points:shape,depth});
    if(isStand){
      for(let row=0;row<part.rows;row++){
        const z0=-part.depth/2+row*part.depth/part.rows;
        const z1=-part.depth/2+(row+1)*part.depth/part.rows;
        const height=part.baseHeight+(row+1)*part.rise;
        addBlock(primitives,part,-part.width/2,part.width/2,z0,z1,height);
      }
      for(const seat of seatsForStand(part))addSeat(primitives,seat,part);
    }else{
      addBlock(primitives,part,-part.width/2,part.width/2,
        -part.depth/2,part.depth/2,part.height);
    }
  }
  primitives.sort((a,b)=>a.depth-b.depth);
  for(const primitive of primitives)primitive.draw();
  for(const part of project.parts){
    if(part.id!==selected)continue;
    const region=hitRegions.find(item=>item.id===selected);
    if(!region)continue;
    ctx.setLineDash([6,4]);
    polygon(region.points,'#25a5ba11','#1595a6',2);
    ctx.setLineDash([]);
    const point=screenPoint(part.x,
      part.kind==='stand'?part.baseHeight+part.rows*part.rise:part.height,part.z);
    ctx.beginPath();ctx.arc(point.x,point.y,5.2,0,Math.PI*2);
    ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#0791a5';ctx.lineWidth=2;ctx.stroke();
    // Corner handles resize an entire component directly in the scene.
    const handles=worldToPixels(corners(part,-part.width/2,part.width/2,
      -part.depth/2,part.depth/2,
      part.kind==='stand'?part.baseHeight+part.rows*part.rise:part.height));
    for(const handle of handles){
      ctx.fillStyle='#fff';ctx.strokeStyle='#078b9b';ctx.lineWidth=1.5;
      ctx.fillRect(handle.x-4,handle.y-4,8,8);
      ctx.strokeRect(handle.x-4,handle.y-4,8,8);
    }
    const rotate={x:point.x+44,y:point.y};
    segment(point,rotate,'#078b9b',1.4);
    ctx.beginPath();ctx.arc(rotate.x,rotate.y,6,0,Math.PI*2);
    ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#078b9b';ctx.stroke();
    const label=part.label+' · '+part.id;
    ctx.font='600 12px system-ui';
    const width=ctx.measureText(label).width+16;
    ctx.fillStyle='#243b4a';ctx.fillRect(point.x-width/2,point.y-31,width,21);
    ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(label,point.x,point.y-16);
  }
}
function paintSoon(){
  if(redrawPending)return;
  redrawPending=true;
  requestAnimationFrame(()=>{redrawPending=false;drawScene();});
}
function resize(){
  const rect=canvas.getBoundingClientRect();
  if(rect.width===0||rect.height===0)return;
  const ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*ratio);
  canvas.height=Math.round(rect.height*ratio);
  size={w:rect.width,h:rect.height};
  ctx.setTransform(ratio,0,0,ratio,0,0);
  paintSoon();
}
function fitView(){
  const points=[];
  points.push({x:-project.floor.width/2,y:0,z:-project.floor.length/2});
  points.push({x:project.floor.width/2,y:0,z:project.floor.length/2});
  for(const part of project.parts){
    const h=part.kind==='stand'?part.baseHeight+part.rows*part.rise:part.height;
    points.push(...corners(part),...corners(part,-part.width/2,part.width/2,
      -part.depth/2,part.depth/2,h));
  }
  const transformed=points.map(p=>{
    const c=Math.cos(view.yaw),s=Math.sin(view.yaw);
    return {x:p.x*c-p.z*s,y:(p.x*s+p.z*c)*Math.sin(view.tilt)-p.y*Math.cos(view.tilt)};
  });
  const minX=Math.min(...transformed.map(p=>p.x)),maxX=Math.max(...transformed.map(p=>p.x));
  const minY=Math.min(...transformed.map(p=>p.y)),maxY=Math.max(...transformed.map(p=>p.y));
  view.scale=clamp(Math.min((size.w-85)/Math.max(1,maxX-minX),
    (size.h-130)/Math.max(1,maxY-minY)),3,24);
  paintSoon();
}
function hitTest(x,y){
  const candidates=hitRegions.filter(part=>contains(part.points,x,y));
  candidates.sort((a,b)=>b.depth-a.depth);
  return candidates[0]?.id??null;
}
function coords(event){
  const bounds=canvas.getBoundingClientRect();
  return {x:event.clientX-bounds.left,y:event.clientY-bounds.top};
}
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  canvas.focus({preventScroll:true});
  const point=coords(event);
  const active=project.parts.find(p=>p.id===selected);
  if(active){
    const height=active.kind==='stand'?active.baseHeight+active.rows*active.rise:active.height;
    const center=screenPoint(active.x,height,active.z);
    const rotate={x:center.x+44,y:center.y};
    const start={start:point,before:snapshot(),id:active.id,moved:false};
    if(Math.hypot(point.x-rotate.x,point.y-rotate.y)<12){
      pointer={...start,action:'rotate',yaw:active.yaw};
      canvas.setPointerCapture(event.pointerId);return;
    }
    const handles=worldToPixels(corners(active,-active.width/2,active.width/2,
      -active.depth/2,active.depth/2,height));
    const index=handles.findIndex(p=>Math.hypot(point.x-p.x,point.y-p.y)<11);
    if(index>=0){
      pointer={...start,action:'resize',index,
        width:active.width,depth:active.depth,yaw:active.yaw};
      canvas.setPointerCapture(event.pointerId);return;
    }
  }
  const id=hitTest(point.x,point.y);
  if(id){
    choose(id);
    const part=project.parts.find(p=>p.id===id);
    pointer={action:'move',id,start:point,x:part.x,z:part.z,
      before:snapshot(),moved:false};
  }else{
    pointer={action:'orbit',start:point,yaw:view.yaw,tilt:view.tilt,moved:false};
    choose(null);
  }
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!pointer)return;
  const point=coords(event),dx=point.x-pointer.start.x,dy=point.y-pointer.start.y;
  if(Math.hypot(dx,dy)<2&&!pointer.moved)return;
  pointer.moved=true;
  if(pointer.action==='move'||pointer.action==='resize'){
    const c=Math.cos(view.yaw),s=Math.sin(view.yaw);
    const ux=dx/view.scale,uz=dy/(Math.sin(view.tilt)*view.scale);
    const worldX=ux*c+uz*s,worldZ=-ux*s+uz*c;
    const part=project.parts.find(p=>p.id===pointer.id);
    if(part&&pointer.action==='move'){
      let x=clamp(pointer.x+worldX,-200,200);
      let z=clamp(pointer.z+worldZ,-200,200);
      if($('snap').checked){
        const step=Number($('gridStep').value);
        x=Math.round(x/step)*step;z=Math.round(z/step)*step;
      }
      part.x=x;part.z=z;
    }else if(part){
      const r=pointer.yaw*Math.PI/180;
      const localX=worldX*Math.cos(r)+worldZ*Math.sin(r);
      const localZ=-worldX*Math.sin(r)+worldZ*Math.cos(r);
      const signX=[-1,1,1,-1][pointer.index];
      const signZ=[-1,-1,1,1][pointer.index];
      part.width=clamp(pointer.width+2*localX*signX,1.2,150);
      part.depth=clamp(pointer.depth+2*localZ*signZ,.6,100);
      if($('snap').checked){
        const step=Number($('gridStep').value);
        part.width=Math.max(1.2,Math.round(part.width/step)*step);
        part.depth=Math.max(.6,Math.round(part.depth/step)*step);
      }
    }
  }else if(pointer.action==='rotate'){
    const part=project.parts.find(p=>p.id===pointer.id);
    if(part)part.yaw=pointer.yaw+dx*.65;
  }else{
    view.yaw=pointer.yaw+dx*.008;
    view.tilt=clamp(pointer.tilt+dy*.006,.3,Math.PI/2);
    view.mode=view.tilt>1.54?'top':'3d';
    syncViewButtons();
  }
  paintSoon();
});
function pointerFinish(event){
  if(!pointer)return;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(['move','resize','rotate'].includes(pointer.action)&&pointer.moved){
    try{
      validateProject(project);
      record(pointer.before);
      renderProperties();renderObjectList();
      status('Updated '+pointer.id+'. Changes saved in the undo history.');
    }catch(error){restore(pointer.before);status(error.message,true);}
  }
  pointer=null;paintSoon();
}
canvas.addEventListener('pointerup',pointerFinish);
canvas.addEventListener('pointercancel',pointerFinish);
canvas.addEventListener('wheel',event=>{
  event.preventDefault();
  view.scale=clamp(view.scale*Math.exp(-event.deltaY*.0012),2.5,40);
  paintSoon();
},{passive:false});
frame.addEventListener('dragover',event=>{
  if(!event.dataTransfer.types.includes('text/plain'))return;
  event.preventDefault();event.dataTransfer.dropEffect='copy';
  $('dropHelp').hidden=false;
});
frame.addEventListener('dragleave',event=>{
  if(!frame.contains(event.relatedTarget))$('dropHelp').hidden=true;
});
frame.addEventListener('drop',event=>{
  event.preventDefault();$('dropHelp').hidden=true;
  const kind=event.dataTransfer.getData('text/plain');
  if(!PARTS[kind])return;
  const p=coords(event),ground=groundPosition(p.x,p.y);
  addComponent(kind,clamp(ground.x,-200,200),clamp(ground.z,-200,200));
});
function syncViewButtons(){
  $('orbitView').classList.toggle('active',view.mode==='3d');
  $('topView').classList.toggle('active',view.mode==='top');
  $('viewName').textContent=view.mode==='top'?'Top-down layout':'Editable 3D layout';
}
function setView(mode){
  view.mode=mode;view.yaw=mode==='top'?0:-.64;
  view.tilt=mode==='top'?Math.PI/2:.82;
  syncViewButtons();fitView();
}
$('orbitView').onclick=()=>setView('3d');
$('topView').onclick=()=>setView('top');
$('fitView').onclick=()=>fitView();
$('zoomIn').onclick=()=>{view.scale=clamp(view.scale*1.2,2.5,40);paintSoon();};
$('zoomOut').onclick=()=>{view.scale=clamp(view.scale/1.2,2.5,40);paintSoon();};
$('newProject').onclick=()=>setLayout($('activity').value);
$('undo').onclick=undo;
$('redo').onclick=redo;
$('duplicate').onclick=()=>{
  if(!selected)return;
  const previous=new Set(project.parts.map(p=>p.id));
  transact(()=>duplicatePart(project,selected));
  const newPart=project.parts.find(p=>!previous.has(p.id));
  if(newPart)choose(newPart.id);
};
$('remove').onclick=()=>{
  if(!selected)return;
  const id=selected;
  transact(()=>removePart(project,id));
  if(!project.parts.some(p=>p.id===id))choose(null);
};
$('projectName').addEventListener('change',event=>{
  const before=snapshot();
  try{
    project.name=event.target.value.trim();
    validateProject(project);record(before);refresh();
  }catch(error){restore(before);status(error.message,true);}
});
$('save').onclick=()=>{
  try{
    window.localStorage.setItem('filedmaker-venue-builder',snapshot());
    status('Saved in this browser. Export JSON to keep a portable backup.');
  }catch(error){status('Browser storage unavailable. Use Export JSON.',true);}
};
$('open').onclick=()=>{
  try{
    const raw=window.localStorage.getItem('filedmaker-venue-builder');
    if(!raw){status('No locally saved design. Import JSON or create a layout.',true);return;}
    const next=importProject(raw);
    if(!window.confirm('Replace the current scene with the locally saved design?'))return;
    commit(next);selected=null;refresh();fitView();status('Opened the locally saved design.');
  }catch(error){status(error.message,true);}
};
$('export').onclick=()=>{
  try{
    const file=new Blob([snapshot()],{type:'application/json'});
    const url=URL.createObjectURL(file);
    const link=document.createElement('a');
    link.href=url;link.download=(project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')
      .replace(/^-|-$/g,'')||'venue')+'.filedmaker.json';
    link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('JSON export requested. The file preserves all editable components.');
  }catch(error){status(error.message,true);}
};
$('importFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    if(file.size>2_000_000)throw Error('Project JSON exceeds the 2 MB import limit');
    const next=importProject(await file.text());
    if(!window.confirm('Replace the current scene with '+next.name+'?'))return;
    commit(next);selected=null;refresh();fitView();status('Imported editable venue project.');
  }catch(error){status('Cannot import project: '+error.message,true);}
  finally{event.target.value='';}
});
window.addEventListener('keydown',event=>{
  const target=event.target;
  const typing=target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||
    target instanceof HTMLSelectElement||target.isContentEditable;
  if(typing)return;
  const key=event.key.toLowerCase(),modifier=event.ctrlKey||event.metaKey;
  if(modifier&&key==='z'){event.preventDefault();event.shiftKey?redo():undo();}
  else if(modifier&&key==='y'){event.preventDefault();redo();}
  else if(modifier&&key==='d'&&selected){
    event.preventDefault();
    const previous=new Set(project.parts.map(p=>p.id));
    transact(()=>duplicatePart(project,selected));
    const item=project.parts.find(p=>!previous.has(p.id));
    if(item)choose(item.id);
  }else if((key==='delete'||key==='backspace')&&selected){
    event.preventDefault();const id=selected;
    transact(()=>removePart(project,id));choose(null);
  }else if(key==='escape'){choose(null);}
  else if(selected&&['arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
    event.preventDefault();
    const part=project.parts.find(p=>p.id===selected);
    const step=$('snap').checked?Number($('gridStep').value):.25;
    const dx=key==='arrowleft'?-step:key==='arrowright'?step:0;
    const dz=key==='arrowup'?-step:key==='arrowdown'?step:0;
    transact(()=>updatePart(project,selected,{x:part.x+dx,z:part.z+dz}));
  }
});
installLibrary();
refresh();syncViewButtons();
new ResizeObserver(()=>resize()).observe(frame);
requestAnimationFrame(()=>{resize();fitView();});
