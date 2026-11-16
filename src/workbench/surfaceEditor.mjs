// Reversible surface editing. Court rendering and source geometry are separate;
// changing the surface never fabricates seats, survey data or ticket inventory.
import {normalizeVenue} from './contract.mjs';
import {generateTracedVenue} from './generator.mjs';
import {SURFACE_PRESETS,SURFACE_FIELD_NAMES,SURFACE_ZONE_KINDS,
  nextZoneId,zoneFitsCourt} from './surface.mjs';
const number=(v,label,min,max)=>{
  if(v===''||v==null||!Number.isFinite(Number(v))||
    Number(v)<min||Number(v)>max)throw Error(label+' must be between '+min+' and '+max);
  return Number(v);
};
const allowedZoneFields=new Set(['x','z','width','depth','rotation','color','label']);
export function editPlayingSurface(input,edit){
  const venue=normalizeVenue(input);
  if(!edit||typeof edit!=='object')throw Error('Surface edit is missing');
  const style=venue.surfaceDesign,action=String(edit.action||'');
  let id='',summary='';
  if(action==='preset'){
    const colors=SURFACE_PRESETS[edit.preset];
    if(!colors)throw Error('Choose a supported court palette');
    Object.assign(style,{preset:edit.preset,
      floor:colors.floor,apron:colors.apron,lines:colors.lines,lane:colors.lane});
    summary='Change court palette';
  }else if(action==='style'){
    const changes=edit.changes??{};
    if(!changes||typeof changes!=='object'||Array.isArray(changes)||
      !Object.keys(changes).length)throw Error('No court style changes supplied');
    for(const key of Object.keys(changes)){
      if(!SURFACE_FIELD_NAMES.includes(key)||key==='preset')
        throw Error('Unknown editable surface attribute '+key);
      style[key]=changes[key];
    }
    summary='Change court appearance and layout';
  }else if(action==='dimensions'){
    const width=number(edit.width,'Court width',8,160);
    const length=number(edit.length,'Court length',15,200);
    if(width===venue.court.width&&length===venue.court.length)
      throw Error('Enter a different width or length');
    venue.court={width,length};
    style.dimensionsEdited=true;
    summary='Change court dimensions; registration and safety dimensions need recheck';
  }else if(action==='zone-add'){
    if(!SURFACE_ZONE_KINDS[edit.kind])throw Error('Choose a floor-zone shape');
    const zone={kind:edit.kind,id:nextZoneId(style.zones,edit.kind),
      x:edit.x??0,z:edit.z??0,width:edit.width??2,depth:edit.depth??2,
      rotation:edit.rotation??0,color:edit.color??style.lane,
      label:edit.label??SURFACE_ZONE_KINDS[edit.kind]};
    style.zones.push(zone);id=zone.id;summary='Create painted floor zone';
  }else if(action==='zone-update'){
    const zone=style.zones.find(s=>s.id===edit.id);
    if(!zone)throw Error('Select an existing painted zone');
    const changes=edit.changes;
    if(!changes||typeof changes!=='object'||Array.isArray(changes)||
      !Object.keys(changes).length)throw Error('No floor-zone edits supplied');
    for(const key of Object.keys(changes)){
      if(!allowedZoneFields.has(key))throw Error('Unknown editable zone attribute '+key);
      zone[key]=changes[key];
    }
    id=zone.id;summary='Edit painted floor zone';
  }else if(action==='zone-duplicate'){
    const zone=style.zones.find(s=>s.id===edit.id);
    if(!zone)throw Error('Select an existing painted zone');
    const copy={...zone,id:nextZoneId(style.zones,zone.kind),
      x:zone.x+Math.max(.2,zone.width/3),
      z:zone.z+Math.max(.2,zone.depth/3),
      label:(zone.label+' copy').slice(0,80)};
    style.zones.push(copy);id=copy.id;summary='Duplicate painted zone';
  }else if(action==='zone-remove'){
    const index=style.zones.findIndex(s=>s.id===edit.id);
    if(index<0)throw Error('Select an existing painted zone');
    id=style.zones.splice(index,1)[0].id;summary='Remove painted floor zone';
  }else if(action==='reset'){
    const original=venue.surfaceDesign;
    const sport=venue.sport;
    delete venue.surfaceDesign;
    // Normalize at the end, using sport-specific defaults.
    if(!original)throw Error('No surface design to reset');
    summary='Reset the court appearance to sport defaults';
  }else throw Error('Unsupported surface edit '+action);
  const normalized=normalizeVenue(venue);
  for(const zone of normalized.surfaceDesign.zones)
    if(!zoneFitsCourt(zone,normalized.court))
      throw Error('Painted zone '+zone.id+' must fit inside the playing surface');
  if(normalized.rows.length&&normalized.sections.length){
    const traced=generateTracedVenue(normalized);
    if(traced.quality.blockingCount)
      throw Error('Playing surface rejected: '+traced.quality.issues
        .filter(s=>s.severity==='blocking').slice(0,2).map(s=>s.code).join(', '));
  }
  normalized.editLedger=[...(normalized.editLedger??[]),{
    operation:'edit-surface',section:'surface',row:id,
    beforeSeats:null,afterSeats:null,
    note:'Provisional '+summary+'. Recheck the drawing calibration and field markings.'
  }].slice(-200);
  return {venue:normalizeVenue(normalized),id,action,summary,
    seatDelta:0,publicationEligible:false};
}
