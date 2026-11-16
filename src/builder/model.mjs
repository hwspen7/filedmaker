// Venue Builder source-of-truth. Conceptual sports/event design, not survey data.
// Components carry parametric geometry. External OBJ meshes carry provenance.
export const FORMAT='filedmaker-builder';
export const VERSION=1;

export const PARTS=Object.freeze({
  stand:{label:'Seating stand',group:'Seating',width:18,depth:7,height:2,color:'#377fba'},
  stage:{label:'Concert stage',group:'Events',width:16,depth:7,height:2,color:'#3c4658'},
  platform:{label:'Event platform',group:'Events',width:8,depth:5,height:.8,color:'#9d8b77'},
  table:{label:'Event table',group:'Events',width:2,depth:1,height:.8,color:'#ba9670'},
  barrier:{label:'Safety barrier',group:'Events',width:5,depth:.3,height:1.2,color:'#7c8796'},
  tower:{label:'Lighting tower',group:'Events',width:1.3,depth:1.3,height:7,color:'#56606e'},
  booth:{label:'Control booth',group:'Events',width:4,depth:3,height:2.6,color:'#7f9dab'},
  entrance:{label:'Entrance',group:'Structures',width:5,depth:2,height:3,color:'#7c9f90'},
  basketball_court:{label:'Basketball court',group:'Playing surfaces',width:15.24,depth:28.65,height:.12,color:'#dcb989'},
  volleyball_court:{label:'Volleyball court',group:'Playing surfaces',width:9,depth:18,height:.12,color:'#e9b780'},
  badminton_court:{label:'Badminton court',group:'Playing surfaces',width:6.1,depth:13.4,height:.12,color:'#81bba6'},
  pickleball_court:{label:'Pickleball court',group:'Playing surfaces',width:6.1,depth:13.41,height:.12,color:'#6bafbd'},
  futsal_court:{label:'Indoor futsal court',group:'Playing surfaces',width:20,depth:40,height:.12,color:'#83a5bb'},
  hoop:{label:'Basketball hoop',group:'Sports equipment',width:1.8,depth:1.3,height:3.05,color:'#56677b'},
  net:{label:'Volleyball net',group:'Sports equipment',width:9,depth:.25,height:2.43,color:'#c7d7d9'},
  goal:{label:'Training goal',group:'Sports equipment',width:3,depth:1.7,height:2,color:'#d8e3e5'},
  ball_rack:{label:'Ball storage rack',group:'Training equipment',width:2,depth:.7,height:1.4,color:'#778ba2'},
  training_bench:{label:'Training bench',group:'Training equipment',width:2,depth:.65,height:.58,color:'#8e9dad'},
  squat_rack:{label:'Squat rack',group:'Training equipment',width:1.9,depth:1.5,height:2.4,color:'#59636e'},
  treadmill:{label:'Treadmill',group:'Training equipment',width:.9,depth:2,height:1.6,color:'#737f8a'},
  bike:{label:'Exercise bike',group:'Training equipment',width:.7,depth:1.3,height:1.3,color:'#8f9caa'},
  mat:{label:'Exercise mat',group:'Training equipment',width:1,depth:2,height:.12,color:'#7294a7'},
  cone:{label:'Training cone',group:'Training equipment',width:.35,depth:.35,height:.5,color:'#ec9652'},
  divider:{label:'Retractable divider',group:'Structures',width:12,depth:.3,height:3.2,color:'#b0bac4'},
  bleacher:{label:'Portable bleacher',group:'Seating',width:8,depth:2.8,height:1.5,color:'#819db0'},
  scoreboard:{label:'Scoreboard',group:'Sports equipment',width:4,depth:.45,height:2.1,color:'#3d4758'},
  speaker:{label:'PA speaker',group:'Events',width:1,depth:.7,height:1.7,color:'#444a54'},
  tent:{label:'Event tent',group:'Events',width:6,depth:6,height:3.4,color:'#e5e8de'},
  custom_model:{label:'Imported OBJ model',group:'Imported assets',width:3,depth:3,height:3,color:'#8498a8'}
});

export const ASSEMBLIES=Object.freeze({
  basketball_zone:{label:'Basketball court + hoops',group:'Sports layouts',items:[
    {kind:'basketball_court',dx:0,dz:0},
    {kind:'hoop',dx:0,dz:-12.2},
    {kind:'hoop',dx:0,dz:12.2,yaw:180}]},
  volleyball_zone:{label:'Volleyball court + net',group:'Sports layouts',items:[
    {kind:'volleyball_court',dx:0,dz:0},{kind:'net',dx:0,dz:0}]},
  badminton_zone:{label:'Badminton court + net',group:'Sports layouts',items:[
    {kind:'badminton_court',dx:0,dz:0},{kind:'net',dx:0,dz:0,width:6.1,height:1.55}]},
  fitness_zone:{label:'Strength training zone',group:'Training layouts',items:[
    {kind:'squat_rack',dx:-3,dz:-2},{kind:'squat_rack',dx:0,dz:-2},
    {kind:'training_bench',dx:-3,dz:2},{kind:'training_bench',dx:0,dz:2},
    {kind:'ball_rack',dx:3,dz:-2},{kind:'mat',dx:3,dz:2}]},
  cardio_zone:{label:'Cardio training zone',group:'Training layouts',items:[
    {kind:'treadmill',dx:-3,dz:0},{kind:'treadmill',dx:0,dz:0},
    {kind:'treadmill',dx:3,dz:0},{kind:'bike',dx:-3,dz:3},{kind:'bike',dx:0,dz:3},{kind:'bike',dx:3,dz:3}]},
  concert_zone:{label:'Concert stage + production',group:'Event layouts',items:[
    {kind:'stage',dx:0,dz:0,width:20,depth:8},
    {kind:'tower',dx:-11,dz:0},{kind:'tower',dx:11,dz:0},
    {kind:'speaker',dx:-9,dz:3},{kind:'speaker',dx:9,dz:3},
    {kind:'barrier',dx:0,dz:6,width:20}]},
  event_tables:{label:'Community gathering zone',group:'Event layouts',items:[
    {kind:'table',dx:-3,dz:-3},{kind:'table',dx:3,dz:-3},
    {kind:'table',dx:-3,dz:3},{kind:'table',dx:3,dz:3},
    {kind:'entrance',dx:0,dz:9}]}
});
export const SURFACES=Object.freeze(Object.keys(PARTS).filter(k=>k.endsWith('_court')));

const finite=(n,min,max,label)=>{
  if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)
    throw Error(label+' must be between '+min+' and '+max);
  return n;
};
const whole=(n,min,max,label)=>{
  finite(n,min,max,label);
  if(!Number.isInteger(n))throw Error(label+' must be an integer');
  return n;
};
const clone=v=>structuredClone(v);
const idFor=(model,kind)=>{
  const used=new Set(model.parts.map(part=>part.id));
  let n=1;
  while(used.has(kind+'-'+n))n++;
  return kind+'-'+n;
};
const angleFor=stand=>(stand.arcAngle??90)*Math.PI/180;
const normalizedShape=stand=>stand.shape??'straight';

export function makePart(kind,options={},id=kind+'-1'){
  const preset=PARTS[kind];
  if(!preset)throw Error('Unknown component '+kind);
  const part={id,kind,label:preset.label,x:0,z:0,yaw:0,
    width:preset.width,depth:preset.depth,height:preset.height,color:preset.color,...options};
  if(kind==='stand'){
    Object.assign(part,{rows:12,rise:.3,seatWidth:.55,
      baseHeight:.4,shape:'straight',arcAngle:90,...options});
  }
  return validatePart(part);
}

function validateMesh(mesh){
  if(!mesh||typeof mesh!=='object'||!Array.isArray(mesh.vertices)||
      !Array.isArray(mesh.faces)||mesh.vertices.length<3||
      mesh.vertices.length>2500||mesh.faces.length<1||mesh.faces.length>2800)
    throw Error('OBJ model must contain 3-2500 vertices and 1-2800 triangles');
  for(const vertex of mesh.vertices){
    if(!Array.isArray(vertex)||vertex.length!==3)throw Error('Invalid OBJ vertex');
    vertex.forEach(n=>finite(n,-.51,1.01,'OBJ coordinate'));
  }
  for(const face of mesh.faces){
    if(!Array.isArray(face)||face.length!==3)throw Error('Invalid OBJ triangle');
    face.forEach(i=>whole(i,0,mesh.vertices.length-1,'OBJ vertex index'));
  }
}

export function validatePart(part){
  if(!part||typeof part!=='object'||!PARTS[part.kind])throw Error('Unsupported part');
  if(!/^[a-z][a-z0-9_-]{0,59}$/.test(part.id))throw Error('Invalid component ID');
  if(typeof part.label!=='string'||!part.label.trim()||part.label.length>80)
    throw Error('Invalid component label');
  finite(part.x,-200,200,'X');finite(part.z,-200,200,'Z');
  finite(part.yaw,-3600,3600,'Rotation');
  finite(part.width,.3,150,'Width');finite(part.depth,.2,100,'Depth');
  finite(part.height,.1,50,'Height');
  if(!/^#[0-9a-fA-F]{6}$/.test(part.color))throw Error('Invalid component color');
  if(part.kind==='stand'){
    whole(part.rows,1,65,'Rows');
    finite(part.rise,.05,1.2,'Row rise');
    finite(part.seatWidth,.4,1.2,'Seat width');
    finite(part.baseHeight,0,10,'First-row height');
    if(!['straight','arc'].includes(normalizedShape(part)))
      throw Error('Stand shape must be straight or arc');
    finite(part.arcAngle??90,15,220,'Arc angle');
    if(normalizedShape(part)==='arc'&&part.width/angleFor(part)<=part.depth/2+.25)
      throw Error('Curved stand radius is too small for the stand depth');
    if(part.width/part.seatWidth<2)throw Error('Stand needs room for two seats');
  }
  if(part.kind==='custom_model'){
    validateMesh(part.mesh);
    if(typeof part.sourceName!=='string'||part.sourceName.length>150||
       !['Unverified','CC0','CC-BY','Authorized'].includes(part.sourceLicense)||
       typeof (part.sourceAuthor??'')!=='string'||(part.sourceAuthor??'').length>120||
       typeof (part.sourceUrl??'')!=='string'||(part.sourceUrl??'').length>500)
      throw Error('Invalid imported asset provenance');
    if(part.sourceUrl&&
       !/^https:\/\/[^\s]+$/i.test(part.sourceUrl))
      throw Error('Asset source URL must use HTTPS');
    if(part.sourceLicense==='CC-BY'&&
       (!(part.sourceAuthor??'').trim()||!(part.sourceUrl??'').trim()))
      throw Error('CC-BY asset requires creator and source URL');
  }
  return part;
}

export function validateProject(project){
  if(!project||project.format!==FORMAT||project.version!==VERSION)
    throw Error('Unsupported venue-builder project');
  if(typeof project.name!=='string'||!project.name.trim()||project.name.length>120)
    throw Error('Invalid project name');
  if(!['basketball','concert','community','training','complex'].includes(project.activity))
    throw Error('Unsupported event configuration');
  const floor=project.floor;
  if(!floor||!['court','event-floor'].includes(floor.kind))throw Error('Invalid floor');
  finite(floor.width,8,150,'Floor width');finite(floor.length,12,160,'Floor length');
  if(!Array.isArray(project.parts)||project.parts.length>170)
    throw Error('Maximum 170 components');
  const ids=new Set();
  for(const part of project.parts){
    validatePart(part);
    if(ids.has(part.id))throw Error('Duplicate component '+part.id);
    ids.add(part.id);
  }
  if(countSeats(project)>24000)throw Error('Design exceeds 24,000 modeled seats');
  return project;
}

function starterStand(id,x,z,yaw,width,depth,rows,extras={}){
  return makePart('stand',{x,z,yaw,width,depth,rows,height:2.4,...extras},id);
}

export function createProject(activity='basketball'){
  if(!['basketball','concert','community','training','complex'].includes(activity))
    throw Error('Unknown starter');
  const names={
    basketball:'School basketball venue',concert:'Concert layout',
    community:'Community event layout',training:'Three-court training hall',
    complex:'Multi-sport training complex'
  };
  const floors={
    basketball:{kind:'court',width:15.24,length:28.65},
    concert:{kind:'event-floor',width:48,length:48},
    community:{kind:'event-floor',width:48,length:44},
    training:{kind:'event-floor',width:82,length:48},
    complex:{kind:'event-floor',width:115,length:105}
  };
  const project={format:FORMAT,version:VERSION,
    name:names[activity],activity,floor:clone(floors[activity]),parts:[]};
  if(activity==='basketball'){
    project.parts=[
      starterStand('stand-1',-15,0,90,24,7.8,13),
      starterStand('stand-2',15,0,-90,24,7.8,13),
      starterStand('stand-3',0,-20,180,14,4.2,7),
      starterStand('stand-4',0,20,0,14,4.2,7)
    ];
  }else if(activity==='concert'){
    project.parts=[
      starterStand('stand-1',-21,2,90,23,9,15),
      starterStand('stand-2',21,2,-90,23,9,15),
      makePart('stage',{x:0,z:-17,width:22,depth:8,height:2},'stage-1'),
      makePart('tower',{x:-12,z:-17},'tower-1'),
      makePart('tower',{x:12,z:-17},'tower-2'),
      makePart('barrier',{x:0,z:-11,width:22},'barrier-1')
    ];
  }else if(activity==='community'){
    project.parts=[
      starterStand('stand-1',-21,0,90,20,7,10),
      starterStand('stand-2',21,0,-90,20,7,10),
      makePart('platform',{x:0,z:-12,width:10,depth:6},'platform-1'),
      makePart('table',{x:-5,z:3},'table-1'),
      makePart('table',{x:0,z:3},'table-2'),
      makePart('table',{x:5,z:3},'table-3'),
      makePart('booth',{x:0,z:15},'booth-1')
    ];
  }else if(activity==='training'){
    for(const x of [-27,0,27]){
      project.parts=placeAssembly(project,'basketball_zone',x,0).parts;
    }
    project.parts=placeAssembly(project,'fitness_zone',0,-19).parts;
    project.parts.push(makePart('divider',{x:-13.5,z:0,depth:.2,width:34,yaw:90},'divider-1'));
    project.parts.push(makePart('divider',{x:13.5,z:0,depth:.2,width:34,yaw:90},'divider-2'));
  }else{
    for(const [kind,x,z] of [
      ['basketball_zone',-31,-25],['volleyball_zone',30,-25],
      ['badminton_zone',-31,25],['fitness_zone',12,20],
      ['cardio_zone',32,25]]){
      project.parts=placeAssembly(project,kind,x,z).parts;
    }
    project.parts.push(makePart('pickleball_court',{x:0,z:42},'pickleball_court-1'));
    project.parts.push(makePart('futsal_court',{x:0,z:-24,width:20,depth:36},'futsal_court-1'));
  }
  return validateProject(project);
}

export function updatePart(project,id,changes){
  const result=clone(validateProject(project));
  const part=result.parts.find(p=>p.id===id);
  if(!part)throw Error('Select an existing component');
  const allowed=new Set(['label','x','z','yaw','width','depth','height','color',
    'rows','rise','seatWidth','baseHeight','shape','arcAngle']);
  for(const [key,value] of Object.entries(changes)){
    if(!allowed.has(key)||!(key in part)&&
       !(part.kind==='stand'&&['shape','arcAngle'].includes(key)))
      throw Error('Unsupported change '+key);
    part[key]=value;
  }
  return validateProject(result);
}

export function addPart(project,kind,options={}){
  const result=clone(validateProject(project));
  result.parts.push(makePart(kind,options,idFor(result,kind)));
  return validateProject(result);
}

export function placeAssembly(project,key,x=0,z=0){
  const assembly=ASSEMBLIES[key];
  if(!assembly)throw Error('Unsupported assembly');
  finite(x,-140,140,'Assembly X');finite(z,-140,140,'Assembly Z');
  const result=clone(validateProject(project));
  for(const item of assembly.items){
    result.parts.push(makePart(item.kind,{
      x:x+item.dx,z:z+item.dz,
      ...Object.fromEntries(Object.entries(item).filter(([k])=>
        !['kind','dx','dz'].includes(k)))
    },idFor(result,item.kind)));
  }
  return validateProject(result);
}

export function removePart(project,id){
  const result=clone(validateProject(project));
  const before=result.parts.length;
  result.parts=result.parts.filter(p=>p.id!==id);
  if(result.parts.length===before)throw Error('Select an existing component');
  return validateProject(result);
}

export function duplicatePart(project,id){
  const source=validateProject(project).parts.find(p=>p.id===id);
  if(!source)throw Error('Select an existing component');
  const result=clone(project),part=clone(source);
  part.id=idFor(result,part.kind);part.x+=2;part.z+=2;
  part.label=source.label.slice(0,75)+' copy';
  result.parts.push(part);
  return validateProject(result);
}

export function movePart(project,id,x,z){return updatePart(project,id,{x,z});}

export function standRowColumns(stand,rowIndex){
  if(normalizedShape(stand)!=='arc')return Math.floor(stand.width/stand.seatWidth);
  const rowZ=-stand.depth/2+(rowIndex+.5)*stand.depth/stand.rows;
  const radius=stand.width/angleFor(stand)+rowZ;
  return Math.max(2,Math.floor(radius*angleFor(stand)/stand.seatWidth));
}

export function countSeats(project){
  return project.parts.filter(p=>p.kind==='stand').reduce((total,p)=>{
    for(let row=0;row<p.rows;row++)total+=standRowColumns(p,row);
    return total;
  },0);
}

export function curvedLocalPoint(stand,localX,localZ){
  if(normalizedShape(stand)!=='arc')return {x:localX,z:localZ};
  const radians=angleFor(stand),radius=stand.width/radians;
  const theta=(localX/stand.width)*radians;
  return {x:(radius+localZ)*Math.sin(theta),
    z:(radius+localZ)*Math.cos(theta)-radius};
}

export function rotatedPoint(part,localX,localZ,y=0){
  const r=part.yaw*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  return {x:part.x+localX*c-localZ*s,y,z:part.z+localX*s+localZ*c};
}

export function seatsForStand(stand){
  if(stand.kind!=='stand')return [];
  const seats=[];
  for(let row=0;row<stand.rows;row++){
    const columns=standRowColumns(stand,row);
    const localZ=-stand.depth/2+(row+.5)*stand.depth/stand.rows;
    const y=stand.baseHeight+(row+1)*stand.rise;
    for(let column=0;column<columns;column++){
      const localX=-stand.width/2+(column+.5)*stand.width/columns;
      const p=curvedLocalPoint(stand,localX,localZ);
      seats.push({...rotatedPoint(stand,p.x,p.z,y),
        row:row+1,seat:column+1,stand:stand.id});
    }
  }
  return seats;
}

export function parseOBJ(text){
  if(typeof text!=='string'||text.length>1_000_000)throw Error('OBJ file exceeds 1 MB');
  const vertices=[],faces=[];
  for(const line of text.split(/\r?\n/)){
    const trimmed=line.trim();
    if(trimmed.startsWith('v ')){
      if(vertices.length>=2500)throw Error('OBJ has more than 2500 vertices');
      const values=trimmed.split(/\s+/).slice(1,4).map(Number);
      if(values.length!==3||values.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6))
        throw Error('OBJ vertex is malformed');
      vertices.push(values);
    }else if(trimmed.startsWith('f ')){
      const tokens=trimmed.split(/\s+/).slice(1);
      if(tokens.length<3||tokens.length>10)throw Error('Unsupported OBJ polygon');
      const indices=tokens.map(token=>{
        const raw=Number(token.split('/')[0]);
        if(!Number.isInteger(raw)||raw===0)throw Error('Invalid OBJ index');
        const index=raw>0?raw-1:vertices.length+raw;
        if(index<0||index>=vertices.length)throw Error('OBJ face index out of range');
        return index;
      });
      for(let i=1;i<indices.length-1;i++){
        if(faces.length>=2800)throw Error('OBJ has more than 2800 triangles');
        faces.push([indices[0],indices[i],indices[i+1]]);
      }
    }
  }
  if(vertices.length<3||!faces.length)throw Error('OBJ requires vertices and faces');
  const min=[0,1,2].map(k=>Math.min(...vertices.map(v=>v[k])));
  const max=[0,1,2].map(k=>Math.max(...vertices.map(v=>v[k])));
  const normalized=vertices.map(v=>v.map((n,k)=>{
    const span=Math.max(1e-6,max[k]-min[k]);
    return Math.round(((n-min[k])/span-(k===1?0:.5))*100000)/100000;
  }));
  const mesh={vertices:normalized,faces};
  validateMesh(mesh);
  return mesh;
}

export function importOBJAsset(project,text,options={}){
  const mesh=parseOBJ(text);
  const result=clone(validateProject(project));
  const sourceName=String(options.sourceName??'Imported OBJ').slice(0,150);
  const sourceLicense=String(options.sourceLicense??'Unverified').slice(0,80);
  const sourceAuthor=String(options.sourceAuthor??'').trim().slice(0,120);
  const sourceUrl=String(options.sourceUrl??'').trim().slice(0,500);
  result.parts.push(makePart('custom_model',{
    x:options.x??0,z:options.z??0,
    label:String(options.label??sourceName).slice(0,80),
    sourceName,sourceLicense,sourceAuthor,sourceUrl,mesh
  },idFor(result,'custom_model')));
  return validateProject(result);
}


export function resizeFloor(project,width,length){
  const result=clone(validateProject(project));
  result.floor.width=finite(width,8,150,'Floor width');
  result.floor.length=finite(length,12,160,'Floor length');
  return validateProject(result);
}

export function arrayPart(project,id,options={}){
  const result=clone(validateProject(project));
  const source=result.parts.find(p=>p.id===id);
  if(!source)throw Error('Select a component to repeat');
  const columns=whole(options.columns??2,1,10,'Array columns');
  const rows=whole(options.rows??1,1,10,'Array rows');
  const stepX=finite(options.stepX??24,-100,100,'Array horizontal spacing');
  const stepZ=finite(options.stepZ??30,-100,100,'Array longitudinal spacing');
  if(columns*rows<=1)throw Error('Array needs more than one position');
  if(columns>1&&Math.abs(stepX)<.3)throw Error('Column spacing is too small');
  if(rows>1&&Math.abs(stepZ)<.3)throw Error('Row spacing is too small');
  for(let row=0;row<rows;row++){
    for(let column=0;column<columns;column++){
      if(!row&&!column)continue;
      const part=clone(source);
      part.id=idFor(result,part.kind);
      part.label=source.label.slice(0,68)+' '+(row+1)+'-'+(column+1);
      part.x=Math.round((source.x+column*stepX)*10000)/10000;
      part.z=Math.round((source.z+row*stepZ)*10000)/10000;
      result.parts.push(part);
    }
  }
  return validateProject(result);
}

export function exportProject(project){return JSON.stringify(validateProject(project),null,2)+'\n';}
export function importProject(json){
  const data=typeof json==='string'?JSON.parse(json):json;
  if(!data||!data.floor||!Array.isArray(data.parts))
    throw Error('Invalid venue-builder file structure');
  const p={format:data.format,version:data.version,name:data.name,activity:data.activity,
    floor:clone(data.floor),parts:data.parts.map(part=>clone(part))};
  return validateProject(p);
}
