// Lightweight venue-builder scene model. All positions are conceptual design data.
// No generated seat is represented as an official ticket or surveyed coordinate.
export const FORMAT = 'filedmaker-builder';
export const VERSION = 1;

export const PARTS = Object.freeze({
  stand: {label:'Seating stand',width:18,depth:7,height:2,color:'#377fba'},
  stage: {label:'Concert stage',width:16,depth:7,height:2,color:'#3c4658'},
  platform: {label:'Event platform',width:8,depth:5,height:0.8,color:'#9d8b77'},
  table: {label:'Event table',width:2,depth:1,height:0.8,color:'#ba9670'},
  barrier: {label:'Safety barrier',width:5,depth:0.3,height:1.2,color:'#7c8796'},
  tower: {label:'Lighting tower',width:1.3,depth:1.3,height:7,color:'#56606e'},
  booth: {label:'Control booth',width:4,depth:3,height:2.6,color:'#7f9dab'},
  entrance: {label:'Entrance',width:5,depth:2,height:3,color:'#7c9f90'}
});

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
const copy=object=>structuredClone(object);
const idFor=(model,kind)=>{
  const used=new Set(model.parts.map(part=>part.id));
  let n=1;
  while(used.has(kind+'-'+n))n++;
  return kind+'-'+n;
};

export function makePart(kind,options={},id=kind+'-1'){
  const preset=PARTS[kind];
  if(!preset)throw Error('Unknown component '+kind);
  const part={id,kind,label:preset.label,x:0,z:0,yaw:0,
    width:preset.width,depth:preset.depth,height:preset.height,color:preset.color,
    ...options};
  if(kind==='stand')Object.assign(part,{rows:12,rise:0.3,seatWidth:0.55,
    baseHeight:0.4,...options});
  return validatePart(part);
}

export function validatePart(part){
  if(!part||typeof part!=='object'||!PARTS[part.kind])throw Error('Unsupported part');
  if(!/^[a-z][a-z0-9-]{0,59}$/.test(part.id))throw Error('Invalid component ID');
  if(typeof part.label!=='string'||!part.label.trim()||part.label.length>80)
    throw Error('Invalid component label');
  finite(part.x,-200,200,'X');finite(part.z,-200,200,'Z');
  finite(part.yaw,-3600,3600,'Rotation');
  finite(part.width,0.3,150,'Width');finite(part.depth,0.2,100,'Depth');
  finite(part.height,0.1,50,'Height');
  if(!/^#[0-9a-fA-F]{6}$/.test(part.color))throw Error('Invalid component color');
  if(part.kind==='stand'){
    whole(part.rows,1,65,'Rows');
    finite(part.rise,0.05,1.2,'Row rise');
    finite(part.seatWidth,0.4,1.2,'Seat width');
    finite(part.baseHeight,0,10,'First-row height');
    if(part.width/part.seatWidth<2)throw Error('Stand needs room for at least two seats');
  }
  return part;
}

export function validateProject(project){
  if(!project||project.format!==FORMAT||project.version!==VERSION)
    throw Error('Unsupported venue-builder project');
  if(typeof project.name!=='string'||!project.name.trim()||project.name.length>120)
    throw Error('Invalid project name');
  if(!['basketball','concert','community'].includes(project.activity))
    throw Error('Unsupported event configuration');
  const f=project.floor;
  if(!f||!['court','event-floor'].includes(f.kind))throw Error('Invalid floor');
  finite(f.width,8,130,'Floor width');finite(f.length,12,160,'Floor length');
  if(!Array.isArray(project.parts)||project.parts.length>100)
    throw Error('Maximum 100 components');
  const ids=new Set();
  for(const part of project.parts){
    validatePart(part);
    if(ids.has(part.id))throw Error('Duplicate component '+part.id);
    ids.add(part.id);
  }
  if(countSeats(project)>24000)throw Error('Design exceeds 24,000 modeled seats');
  return project;
}

function starterStand(id,x,z,yaw,width,depth,rows){
  return makePart('stand',{x,z,yaw,width,depth,rows,height:2.4},id);
}

export function createProject(activity='basketball'){
  if(!['basketball','concert','community'].includes(activity))
    throw Error('Unknown starter');
  const project={format:FORMAT,version:VERSION,
    name:activity==='basketball'?'School basketball venue':activity==='concert'?
      'Concert layout':'Community event layout',activity,
    floor:activity==='basketball'?
      {kind:'court',width:15.24,length:28.65}:
      {kind:'event-floor',width:30,length:34},
    parts:[]};
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
  }else{
    project.parts=[
      starterStand('stand-1',-21,0,90,20,7,10),
      starterStand('stand-2',21,0,-90,20,7,10),
      makePart('platform',{x:0,z:-12,width:10,depth:6},'platform-1'),
      makePart('table',{x:-5,z:3},'table-1'),
      makePart('table',{x:0,z:3},'table-2'),
      makePart('table',{x:5,z:3},'table-3'),
      makePart('booth',{x:0,z:15},'booth-1')
    ];
  }
  return validateProject(project);
}

export function updatePart(project,id,changes){
  const result=copy(validateProject(project));
  const part=result.parts.find(p=>p.id===id);
  if(!part)throw Error('Select an existing component');
  const allowed=new Set(['label','x','z','yaw','width','depth','height','color',
    'rows','rise','seatWidth','baseHeight']);
  for(const [key,value] of Object.entries(changes)){
    if(!allowed.has(key)||(key in part)===false)throw Error('Unsupported change '+key);
    part[key]=value;
  }
  return validateProject(result);
}

export function addPart(project,kind,options={}){
  const result=copy(validateProject(project));
  const id=idFor(result,kind);
  result.parts.push(makePart(kind,options,id));
  return validateProject(result);
}

export function removePart(project,id){
  const result=copy(validateProject(project));
  const before=result.parts.length;
  result.parts=result.parts.filter(p=>p.id!==id);
  if(result.parts.length===before)throw Error('Select an existing component');
  return validateProject(result);
}

export function duplicatePart(project,id){
  const source=validateProject(project).parts.find(p=>p.id===id);
  if(!source)throw Error('Select an existing component');
  const result=copy(project);
  const next=copy(source);
  next.id=idFor(result,next.kind);next.x+=2;next.z+=2;
  next.label=source.label+' copy';
  result.parts.push(next);
  return validateProject(result);
}

export function movePart(project,id,x,z){
  return updatePart(project,id,{x,z});
}

export function countSeats(project){
  return project.parts.filter(p=>p.kind==='stand')
    .reduce((total,p)=>total+p.rows*Math.floor(p.width/p.seatWidth),0);
}

export function seatsForStand(stand){
  if(stand.kind!=='stand')return [];
  const seats=[];
  const columns=Math.floor(stand.width/stand.seatWidth);
  const angle=stand.yaw*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const spacing=stand.width/columns;
  for(let row=0;row<stand.rows;row++){
    const localZ=-stand.depth/2+(row+0.5)*stand.depth/stand.rows;
    const y=stand.baseHeight+(row+1)*stand.rise;
    for(let column=0;column<columns;column++){
      const localX=-stand.width/2+(column+0.5)*spacing;
      seats.push({x:stand.x+localX*c-localZ*s,y,
        z:stand.z+localX*s+localZ*c,row:row+1,seat:column+1,stand:stand.id});
    }
  }
  return seats;
}

export function rotatedPoint(part,localX,localZ,y=0){
  const r=part.yaw*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  return {x:part.x+localX*c-localZ*s,y,z:part.z+localX*s+localZ*c};
}

export function exportProject(project){
  return JSON.stringify(validateProject(project),null,2)+'\n';
}
export function importProject(json){
  const data=typeof json==='string'?JSON.parse(json):json;
  // Strip non-schema attributes rather than allowing arbitrary imported metadata.
  const p={format:data.format,version:data.version,name:data.name,
    activity:data.activity,floor:copy(data.floor),
    parts:data.parts.map(part=>({...part}))};
  return validateProject(p);
}
