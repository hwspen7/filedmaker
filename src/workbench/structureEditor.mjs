// Immutable operator structure transactions. No source measurements are
// generated or certified by an interactive component placement.
import {normalizeVenue} from './contract.mjs';
import {generateTracedVenue} from './generator.mjs';
import {STRUCTURE_CATALOG,nextStructureId,structureSeatInterference} from './structures.mjs';
const number=(value,label,min,max)=>{
  if(value===''||value==null||!Number.isFinite(Number(value))||
    Number(value)<min||Number(value)>max)
    throw Error(label+' must be between '+min+' and '+max);
  return Number(value);
};
const text=(value,label,max)=>{
  const s=String(value??'').trim();
  if(!s||s.length>max)throw Error(label+' must be 1–'+max+' characters');
  return s;
};
const keys=['x','y','z','yaw','width','depth','height','label','note'];
export function editVenueStructure(input,command){
  const venue=normalizeVenue(input);
  if(!command||typeof command!=='object')throw Error('Structure command is required');
  const op=String(command.action||'');
  const pick=()=>venue.structures.find(s=>s.id===command.id);
  let object=null;
  if(op==='add'){
    const kind=String(command.kind||'');
    const preset=STRUCTURE_CATALOG[kind];
    if(!preset)throw Error('Choose a supported structure type');
    object={kind,id:nextStructureId(venue.structures,kind),
      x:0,y:0,z:0,yaw:0,width:preset.width,
      depth:preset.depth,height:preset.height,
      label:preset.label,note:'',provenance:'operator-estimated/unverified',
      ...Object.fromEntries(keys.filter(k=>command[k]!==undefined)
        .map(k=>[k,command[k]]))};
    venue.structures.push(object);
  }else if(op==='update'){
    const target=pick();if(!target)throw Error('Select a structure');
    const changes=command.changes;
    if(!changes||typeof changes!=='object'||Array.isArray(changes))
      throw Error('Structure edits are missing');
    for(const key of Object.keys(changes))
      if(!keys.includes(key))throw Error('Unsupported structure field '+key);
    if(!Object.keys(changes).length)throw Error('No changes to apply');
    Object.assign(target,changes);
    object=target;
  }else if(op==='remove'){
    const index=venue.structures.findIndex(s=>s.id===command.id);
    if(index<0)throw Error('Select a structure');
    object=venue.structures.splice(index,1)[0];
  }else if(op==='duplicate'){
    const target=pick();if(!target)throw Error('Select a structure');
    object={...target,id:nextStructureId(venue.structures,target.kind),
      x:target.x+target.width+1,z:target.z,
      label:(target.label+' copy').slice(0,80),
      provenance:'operator-estimated/unverified'};
    venue.structures.push(object);
  }else throw Error('Unsupported structure operation');
  const normalized=normalizeVenue(venue);
  const generated=normalized.rows.length&&normalized.sections.length?
    generateTracedVenue(normalized):null;
  if(generated?.quality.blockingCount){
    const violations=generated.quality.issues.filter(i=>i.severity==='blocking');
    throw Error('Structure rejected: '+violations.slice(0,2).map(i=>i.code).join(', '));
  }
  if(generated){
    const collisions=structureSeatInterference(normalized.structures,generated.seats);
    if(collisions.length)throw Error('Structure '+collisions[0].structure+
      ' intersects seat '+collisions[0].seat+'. Move the structure, not the official seats.');
  }
  const auditOperation={add:'add-structure',update:'edit-structure',
    remove:'remove-structure',duplicate:'duplicate-structure'}[op];
  const entity=normalized.structures.find(s=>s.id===object.id)??object;
  normalized.editLedger=[...(normalized.editLedger??[]),{
    operation:auditOperation,section:text(object.id,'Structure ID',30),
    row:'',beforeSeats:null,afterSeats:null,
    note:'Staff-placed '+object.kind+'; independent measurement and accessibility review needed'
  }].slice(-200);
  return {venue:normalizeVenue(normalized),id:entity.id,
    action:op,count:normalized.structures.length,
    seatDelta:0,publicationEligible:false};
}
