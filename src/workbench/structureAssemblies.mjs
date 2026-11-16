// Reusable schematic venue assemblies made from existing reviewed primitives.
// An assembly is generated atomically and is not an architectural certification.
import {normalizeVenue} from './contract.mjs';
import {STRUCTURE_CATALOG,nextStructureId,structureSeatInterference} from './structures.mjs';
import {generateTracedVenue} from './generator.mjs';

const part=(kind,x,z,options={})=>Object.freeze({kind,x,z,...options});
export const VENUE_ASSEMBLIES=Object.freeze({
  entrance:{
    label:'Main entry and gates',
    parts:[part('portal',0,-.6,{width:4.8,height:3.6}),
      part('gate',0,.2,{width:3.5,height:2.8}),
      part('rail',-3,.65,{width:2.6}),part('rail',3,.65,{width:2.6}),
      part('sign',0,-.65,{y:3.8,width:3})]
  },
  spectator_access:{
    label:'Accessible spectator access',
    parts:[part('platform',0,0,{width:4,depth:3.6,height:.45}),
      part('ramp',0,4.1,{width:1.5,depth:5.0,height:.45}),
      part('rail',-1.9,0,{width:3.4,y:.45}),
      part('rail',1.9,0,{width:3.4,y:.45})]
  },
  player_tunnel:{
    label:'Player tunnel and staging',
    parts:[part('tunnel',0,0,{width:3.6,depth:5.6}),
      part('gate',0,3,{width:3.4,height:3.0}),
      part('fence',-3.8,2.8,{width:4.4,yaw:90}),
      part('fence',3.8,2.8,{width:4.4,yaw:90})]
  },
  bleacher_bay:{
    label:'Terraced stand and aisle',
    parts:[part('bleacher',-2.9,0,{width:4.7,depth:4,height:1.8}),
      part('bleacher',2.9,0,{width:4.7,depth:4,height:1.8}),
      part('stairs',0,0,{width:1.0,depth:4,height:1.8}),
      part('rail',0,-2.1,{width:1.2,height:1.2})]
  },
  press_station:{
    label:'Press and scorer station',
    parts:[part('table',-1.5,0,{width:2.5}),
      part('table',1.5,0,{width:2.5}),
      part('wall',0,-1.3,{width:6.2,height:2.0}),
      part('sign',0,-1.45,{y:2.1,width:2.6})]
  },
  covered_concourse:{
    label:'Covered concourse bay',
    parts:[part('column',-3,-1.7,{height:4.6}),
      part('column',3,-1.7,{height:4.6}),
      part('column',-3,1.7,{height:4.6}),
      part('column',3,1.7,{height:4.6}),
      part('roof',0,0,{width:7.6,depth:4.6,y:4.6}),
      part('lighting',0,0,{height:4,y:0})]
  }
});

const value=(raw,label,min,max)=>{
  if(raw==null||raw===''||!Number.isFinite(Number(raw))||
    Number(raw)<min||Number(raw)>max)
    throw Error(label+' must be between '+min+' and '+max);
  return Number(raw);
};

/**
 * Insert all parts or none, validate against exact generated seat positions,
 * and record one staff-owned undoable project edit.
 */
export function addVenueAssembly(input,command){
  const venue=normalizeVenue(input);
  if(!command||typeof command!=='object')throw Error('Select a venue assembly');
  const key=String(command.preset||'');
  const kit=VENUE_ASSEMBLIES[key];
  if(!kit)throw Error('Unsupported venue assembly');
  const x=value(command.x??0,'Assembly X',-2000,2000);
  const z=value(command.z??0,'Assembly Z',-2000,2000);
  const y=value(command.y??0,'Assembly base elevation',0,65);
  const yaw=value(command.yaw??0,'Assembly orientation',-180,180);
  const scale=value(command.scale??1,'Assembly scale',.5,2);
  if(venue.structures.length+kit.parts.length>200)
    throw Error('Maximum 200 operator structures');
  const theta=yaw*Math.PI/180,cos=Math.cos(theta),sin=Math.sin(theta);
  const ids=[];
  for(const piece of kit.parts){
    const spec=STRUCTURE_CATALOG[piece.kind];
    const px=(piece.x??0)*scale,pz=(piece.z??0)*scale;
    const dims=Object.fromEntries(['width','depth','height'].map(key=>{
      const min=key==='width'?.4:.08;
      return [key,Math.max(min,(piece[key]??spec[key])*scale)];
    }));
    const partYaw=((yaw+(piece.yaw??0)+180+360)%360)-180;
    const obj={
      id:nextStructureId(venue.structures,piece.kind),kind:piece.kind,
      x:x+cos*px+sin*pz,z:z-sin*px+cos*pz,
      y:y+(piece.y??0)*scale,yaw:partYaw,...dims,
      label:(kit.label+' / '+spec.label).slice(0,80),
      provenance:'operator-estimated/unverified',
      note:'Schematic assembly '+kit.label+'. Verify dimensions and clearances.'
    };
    venue.structures.push(obj);
    ids.push(obj.id);
  }
  const normalized=normalizeVenue(venue);
  if(normalized.rows.length&&normalized.sections.length){
    const generated=generateTracedVenue(normalized);
    if(generated.quality.blockingCount)
      throw Error('Assembly geometry rejected: '+generated.quality.issues
        .filter(i=>i.severity==='blocking').slice(0,2).map(i=>i.code).join(', '));
    const collisions=structureSeatInterference(normalized.structures,generated.seats);
    if(collisions.length)throw Error('Assembly intersects seat '+collisions[0].seat+
      '. The source seating layout has not been modified.');
  }
  normalized.editLedger=[...(normalized.editLedger??[]),{
    operation:'batch-structure',section:'structures',row:'',
    beforeSeats:null,afterSeats:null,
    note:'Added unverified '+kit.label+' assembly, '+kit.parts.length+
      ' schematic components. Independent review required.'
  }].slice(-200);
  return {venue:normalizeVenue(normalized),ids,assembly:key,
    count:normalized.structures.length,seatDelta:0,publicationEligible:false};
}
