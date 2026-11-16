// Atomic multi-object editing for schematic venue components.
// Source seats and verified geometry are never inferred from these commands.
import {normalizeVenue} from './contract.mjs';
import {generateTracedVenue} from './generator.mjs';
import {nextStructureId,structureSeatInterference} from './structures.mjs';

const finite=(value,label,min,max)=>{
  if(value===''||value==null||!Number.isFinite(Number(value))||
      Number(value)<min||Number(value)>max)
    throw Error(label+' must be between '+min+' and '+max);
  return Number(value);
};
const axisOf=value=>{
  if(value!=='x'&&value!=='z')throw Error('Choose X or Z as the alignment axis');
  return value;
};

/**
 * Apply a selection transform as one validated transaction. An invalid shape,
 * over-capacity duplication or seat intersection rejects the whole selection.
 */
export function editVenueStructureBatch(input,command){
  const venue=normalizeVenue(input);
  if(!command||typeof command!=='object')throw Error('Batch command is required');
  const action=String(command.action||'');
  if(!Array.isArray(command.ids)||!command.ids.length||command.ids.length>200)
    throw Error('Select at least one existing component');
  const ids=command.ids.map(id=>String(id));
  if(new Set(ids).size!==ids.length)throw Error('Duplicate component selection');
  const selected=ids.map(id=>{
    const found=venue.structures.find(s=>s.id===id);
    if(!found)throw Error('Unknown selected component '+id);
    return found;
  });
  const axis=['align','distribute','mirror'].includes(action)?
    axisOf(command.axis):null;
  let affectedIds=[...ids];
  if(action==='translate'||action==='duplicate'){
    const dx=finite(command.dx??0,'Horizontal offset',-200,200);
    const dz=finite(command.dz??0,'Depth offset',-200,200);
    const dy=action==='translate'?
      finite(command.dy??0,'Elevation offset',-85,85):0;
    if(dx===0&&dz===0&&dy===0)throw Error('Enter a nonzero translation');
    if(action==='translate'){
      for(const s of selected){s.x+=dx;s.z+=dz;s.y+=dy;}
    }else{
      if(venue.structures.length+selected.length>200)
        throw Error('Maximum 200 operator structures');
      affectedIds=[];
      for(const s of selected){
        const copy={...s,id:nextStructureId(venue.structures,s.kind),
          label:(s.label+' copy').slice(0,80),x:s.x+dx,z:s.z+dz,
          provenance:'operator-estimated/unverified'};
        venue.structures.push(copy);
        affectedIds.push(copy.id);
      }
    }
  }else if(action==='align'){
    if(selected.length<2)throw Error('Select at least two components for alignment');
    const reference=selected[0][axis];
    for(const s of selected)s[axis]=reference;
  }else if(action==='distribute'){
    if(selected.length<3)throw Error('Select three or more components to distribute');
    const sorted=[...selected].sort((a,b)=>a[axis]-b[axis]||
      ids.indexOf(a.id)-ids.indexOf(b.id));
    const span=sorted.at(-1)[axis]-sorted[0][axis];
    if(span<.001)throw Error('Selected component centers need different positions');
    const start=sorted[0][axis];
    for(let i=1;i<sorted.length-1;i++)
      sorted[i][axis]=start+span*i/(sorted.length-1);
  }else if(action==='mirror'){
    if(selected.length<2)throw Error('Select at least two components for mirroring');
    const positions=selected.map(s=>s[axis]);
    const mid=(Math.min(...positions)+Math.max(...positions))/2;
    for(const s of selected){
      s[axis]=2*mid-s[axis];
      s.yaw=-s.yaw;
    }
  }else if(action==='remove'){
    const doomed=new Set(ids);
    venue.structures=venue.structures.filter(s=>!doomed.has(s.id));
    affectedIds=[];
  }else throw Error('Unsupported multi-component operation '+action);

  const normalized=normalizeVenue(venue);
  if(normalized.rows.length&&normalized.sections.length){
    const traced=generateTracedVenue(normalized);
    if(traced.quality.blockingCount){
      const issues=traced.quality.issues.filter(i=>i.severity==='blocking');
      throw Error('Batch rejected: '+issues.slice(0,2).map(i=>i.code).join(', '));
    }
    const collisions=structureSeatInterference(normalized.structures,traced.seats);
    if(collisions.length)throw Error('Batch intersects seat '+collisions[0].seat+
      ' at component '+collisions[0].structure+'. No official seats were changed.');
  }
  normalized.editLedger=[...(normalized.editLedger??[]),{
    operation:'batch-structure',section:'structures',row:'',
    beforeSeats:null,afterSeats:null,
    note:'Unverified '+action+' on '+ids.length+
      ' schematic components. Independent staff review required.'
  }].slice(-200);
  return {venue:normalizeVenue(normalized),action,ids:affectedIds,
    count:normalized.structures.length,affected:ids.length,
    seatDelta:0,publicationEligible:false};
}
