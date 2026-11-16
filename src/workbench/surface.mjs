// Editable playing-surface contract. These visual specifications do not claim
// surveyed geometry, legal field compliance or official school branding.
export const SURFACE_PRESETS=Object.freeze({
  maple:{label:'Warm maple court',floor:'#d7b781',apron:'#334b62',lines:'#f9f7f1',lane:'#557c9d'},
  pale:{label:'Light wood court',floor:'#ecd5ab',apron:'#7a8f9b',lines:'#fcfaf3',lane:'#b2c9d4'},
  charcoal:{label:'Graphite court',floor:'#53575b',apron:'#252b32',lines:'#e9e9e3',lane:'#717b83'},
  navy:{label:'Deep blue court',floor:'#8ba9bd',apron:'#183d5b',lines:'#ffffff',lane:'#315f83'},
  crimson:{label:'Red-accent court',floor:'#d0b28a',apron:'#963c48',lines:'#fffaf3',lane:'#ac6370'},
  green:{label:'Evergreen court',floor:'#bcac86',apron:'#2c6752',lines:'#faf8f1',lane:'#64917d'},
  turf:{label:'Classic turf field',floor:'#337747',apron:'#284b36',lines:'#f0f3e9',lane:'#255a33'},
  blueTurf:{label:'Blue turf field',floor:'#285b87',apron:'#1c3b62',lines:'#ffffff',lane:'#183e69'}
});
export const SURFACE_ZONE_KINDS=Object.freeze({
  rectangle:'Rectangular paint zone',
  circle:'Circular floor marking',
  stripe:'Custom floor stripe'
});
const num=(v,label,min,max)=>{
  if(v===''||v==null||!Number.isFinite(Number(v))||
     Number(v)<min||Number(v)>max)
    throw Error(label+' must be between '+min+' and '+max);
  return Number(v);
};
const color=(v,label)=>{
  if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))
    throw Error(label+' must be a six-digit hex color');
  return v.toLowerCase();
};
export const SURFACE_FIELD_NAMES=Object.freeze([
  'preset','floor','apron','lines','lane','apronWidth','centerX','centerZ',
  'rotation','showMarkings','showBoards'
]);
export function defaultSurfaceDesign(sport='nfhs-basketball'){
  const football=sport.includes('football'),preset=football?'turf':'maple';
  return {preset,...Object.fromEntries(['floor','apron','lines','lane']
    .map(key=>[key,SURFACE_PRESETS[preset][key]])),
    apronWidth:football?7:3.5,centerX:0,centerZ:0,rotation:0,
    showMarkings:true,showBoards:!football,zones:[],dimensionsEdited:false,
    provenance:'operator-estimated/unverified'};
}
export function normalizeSurfaceDesign(input,sport='nfhs-basketball'){
  const fallback=defaultSurfaceDesign(sport);
  if(input===undefined||input===null)return fallback;
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw Error('Invalid playing surface settings');
  const preset=String(input.preset??fallback.preset);
  if(!Object.hasOwn(SURFACE_PRESETS,preset))throw Error('Unsupported surface preset');
  const base={...fallback,...SURFACE_PRESETS[preset]};
  for(const prop of ['floor','apron','lines','lane'])
    base[prop]=color(input[prop]??base[prop],'Surface '+prop);
  base.preset=preset;
  base.apronWidth=num(input.apronWidth??fallback.apronWidth,'Apron width',.5,12);
  base.centerX=num(input.centerX??0,'Court X',-40,40);
  base.centerZ=num(input.centerZ??0,'Court Z',-40,40);
  base.rotation=num(input.rotation??0,'Court rotation',-180,180);
  base.showMarkings=input.showMarkings===undefined?true:
    input.showMarkings===true;
  base.showBoards=input.showBoards===undefined?!sport.includes('football'):
    input.showBoards===true;
  base.dimensionsEdited=input.dimensionsEdited===true;
  base.provenance='operator-estimated/unverified';
  const raw=input.zones??[];
  if(!Array.isArray(raw)||raw.length>48)throw Error('Maximum 48 painted zones');
  const ids=new Set();
  base.zones=raw.map(zone=>{
    if(!zone||!Object.hasOwn(SURFACE_ZONE_KINDS,zone.kind))
      throw Error('Unsupported painted zone');
    const id=String(zone.id??'').trim();
    if(!/^[a-z0-9][a-z0-9_-]{0,29}$/i.test(id)||
      ids.has(id.toLowerCase()))throw Error('Invalid or repeated zone ID');
    ids.add(id.toLowerCase());
    return {id,kind:zone.kind,
      x:num(zone.x,'Zone X',-200,200),z:num(zone.z,'Zone Z',-200,200),
      width:num(zone.width,'Zone width',.15,80),
      depth:num(zone.depth,'Zone depth',.15,80),
      rotation:num(zone.rotation??0,'Zone rotation',-180,180),
      color:color(zone.color,'Zone color'),label:String(zone.label??id).slice(0,80),
      provenance:'operator-estimated/unverified'};
  });
  return base;
}
export function nextZoneId(zones,kind){
  const used=new Set(zones.map(z=>z.id.toLowerCase()));let i=1;
  while(used.has(kind+'-'+i))i++;
  return kind+'-'+i;
}
export function surfaceToWorld(p,style){
  const a=style.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return {x:style.centerX+p.x*c+p.z*s,z:style.centerZ-p.x*s+p.z*c};
}
export function worldToSurface(p,style){
  const dx=p.x-style.centerX,dz=p.z-style.centerZ;
  const a=style.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return {x:dx*c-dz*s,z:dx*s+dz*c};
}
export function zoneFitsCourt(zone,court){
  const a=zone.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const halfWidth=(Math.abs(c)*zone.width+Math.abs(s)*zone.depth)/2;
  const halfDepth=(Math.abs(s)*zone.width+Math.abs(c)*zone.depth)/2;
  return Math.abs(zone.x)+halfWidth<=court.width/2+.00001&&
    Math.abs(zone.z)+halfDepth<=court.length/2+.00001;
}
export function buildZoneInstances(design){
  const add=[],to=(hex)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  for(const zone of design.zones){
    const p=surfaceToWorld(zone,design),yaw=(design.rotation+zone.rotation)*Math.PI/180;
    const w=zone.width,d=zone.depth,col=to(zone.color);
    const addPart=(x,z,width,depth,angle=yaw)=>{
      const cos=Math.cos(design.rotation*Math.PI/180),
        sin=Math.sin(design.rotation*Math.PI/180);
      const dx=x-zone.x,dz=z-zone.z;
      const world={x:p.x+cos*dx+sin*dz,z:p.z-sin*dx+cos*dz};
      add.push(world.x,.061,world.z,width,.006,depth,angle,...col,-1);
    };
    if(zone.kind==='circle'){
      const segments=32,rx=w/2,rz=d/2;
      const a=zone.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
      for(let i=0;i<segments;i++){
        const from=i*2*Math.PI/segments,to=(i+1)*2*Math.PI/segments;
        const point=t=>{
          const x=rx*Math.cos(t),z=rz*Math.sin(t);
          return {x:zone.x+x*c+z*s,z:zone.z-x*s+z*c};
        };
        const q=point(from),r=point(to);
        const mid={x:(q.x+r.x)/2,z:(q.z+r.z)/2};
        addPart(mid.x,mid.z,.08,Math.hypot(r.x-q.x,r.z-q.z),
          Math.atan2(r.x-q.x,r.z-q.z)+design.rotation*Math.PI/180);
      }
    }else{
      addPart(zone.x,zone.z,w,zone.kind==='stripe'?Math.min(d,.25):d);
    }
  }
  return new Float32Array(add);
}
