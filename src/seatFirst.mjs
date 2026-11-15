// Seat-first geometry and ticket-inventory integrity. No Three.js dependency.
// Ticket identifiers are authoritative only as supplied by the school.
// Geometry inferred from a section/row/seat list is NEVER a measured sightline.
import { SURFACES, validateProject, resolveTiers, modelPerimeterPath,
  distanceAtAngle, pointAtDistance } from './model.mjs';
import { parseCSV, MAX_IMPORT_SEATS } from './survey.mjs';
import { venueFacts } from './osuFacts.mjs';
import { estimateSchottensteinRoster, usesSchottensteinChart } from './schottensteinSeating.mjs';

export const BLUE_TIERS = Object.freeze(['#164c80', '#2875ae', '#5597c6', '#88b9d6']);
export const BLUE_VARIANTS = Object.freeze(['#123f71', '#1d5b92', '#357eaf', '#67a3cb']);
const HEX=/^#[\da-fA-F]{6}$/;
const https = str => !str || /^https:\/\//i.test(str);
const short = (v,max=100) => String(v??'').trim().slice(0,max);
const safeNumber = (v,min,max,label) => {
  const n=Number(v);
  if(v===''||v===undefined||v===null||!Number.isFinite(n)||n<min||n>max)throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
};
export function tierBlue(tier=0,section=0){
  const index=Math.max(0,Math.min(3,Math.trunc(tier)||0));
  return (Math.abs(section)%5===0 ? BLUE_VARIANTS : BLUE_TIERS)[index];
}
export function enableSeatFirst(input,opts={}) {
  const p=structuredClone(input);
  p.seatFirst=true;
  // Blue is a fallback for unsourced schools, not a universal venue color.
  p.blueTheme=!['ohio-stadium','schottenstein-center'].includes(p.venueReference?.id);
  p.showExterior=false;
  p.roof=false;
  p.showFixtures=true;
  p.detailLevel='standard';
  if(p.blueTheme) p.sections.forEach((s,i)=>{s.color=tierBlue(0,i);});
  const facts=venueFacts(p.venueReference?.id);
  const original=p.ticketing||{};
  p.ticketing={
    officialCapacity:opts.officialCapacity??original.officialCapacity??facts?.capacity?.value??null,
    capacitySource:opts.capacitySource??original.capacitySource??facts?.capacity?.source??'',
    capacityScope:opts.capacityScope??original.capacityScope??facts?.capacity?.scope??'',
    inventorySource:original.inventorySource||'',
    inventoryCount:original.inventoryCount??null,
    inventoryMode:original.inventoryMode||'none',
    coordinates:original.coordinates||'none',
  };
  return validateProject(p);
}
export function validateTicketing(meta) {
  if(meta===undefined||meta===null)return null;
  if(!meta||typeof meta!=='object'||Array.isArray(meta))throw new Error('Invalid ticket metadata.');
  const official=meta.officialCapacity==null||meta.officialCapacity===''?null:safeNumber(meta.officialCapacity,0,300000,'Official capacity');
  if(official!==null&&!Number.isInteger(official))throw new Error('Official capacity must be a whole number.');
  const count=meta.inventoryCount==null?null:safeNumber(meta.inventoryCount,0,MAX_IMPORT_SEATS,'Imported inventory count');
  if(count!==null&&!Number.isInteger(count))throw new Error('Imported inventory count must be a whole number.');
  const source=short(meta.capacitySource,500);
  if(!https(source))throw new Error('Capacity source must be an HTTPS URL.');
  const mode=meta.inventoryMode||'none';
  if(!['none','file-import'].includes(mode))throw new Error('Invalid inventory origin.');
  const coords=meta.coordinates||'none';
  if(!['none','estimated','supplied-unverified'].includes(coords))throw new Error('Invalid coordinate provenance.');
  return {officialCapacity:official,capacitySource:source,capacityScope:short(meta.capacityScope,180),inventorySource:short(meta.inventorySource,240),inventoryCount:count,inventoryMode:mode,coordinates:coords};
}
export function parseTicketRosterCSV(csv) {
  const rows=parseCSV(csv,MAX_IMPORT_SEATS);
  const required=['section','row','seat'];
  for(const col of required)if(!Object.hasOwn(rows[0],col))throw new Error(`Ticket inventory requires ${col} column.`);
  const ids=new Set(),keys=new Set();
  const coordinateHeaders=['x_m','y_m','z_m'];
  const coordinateColumns=coordinateHeaders.map(k=>Object.hasOwn(rows[0],k));
  if(coordinateColumns.some(Boolean)&&!coordinateColumns.every(Boolean))throw new Error('Coordinates require all three columns x_m, y_m and z_m.');
  const hasCoordinates=coordinateColumns.every(Boolean);
  const seats=rows.map((r,i)=>{
    const section=short(r.section,60),row=short(r.row,40),number=short(r.seat,40);
    if(!section||!row||!number)throw new Error(`Missing ticket section/row/seat at CSV line ${i+2}.`);
    const key=JSON.stringify([section.toLowerCase(),row.toLowerCase(),number.toLowerCase()]);
    if(keys.has(key))throw new Error(`Duplicate ticket seat ${section} / ${row} / ${number}.`);keys.add(key);
    // Encoded tuple prevents collisions between section names containing separators.
    const id=short(r.seat_id,100)||JSON.stringify([section,row,number]);
    if(ids.has(id))throw new Error(`Duplicate seat_id ${id}.`);ids.add(id);
    const tier=short(r.tier||'T1',20);
    if(!/^T[1-4]$/.test(tier))throw new Error(`Unrecognized tier '${tier}'. Use T1–T4.`);
    const entry={id,section,row,number,tier};
    if(hasCoordinates){
      entry.x=safeNumber(r.x_m,-100000,100000,'Seat X');
      entry.y=r.y_m===''?null:safeNumber(r.y_m,-1000,2000,'Seat Y');
      entry.z=safeNumber(r.z_m,-100000,100000,'Seat Z');
    }
    return entry;
  });
  return {seats,hasCoordinates,count:seats.length,sections:new Set(seats.map(s=>s.section)).size};
}

function sectionAssignment(project, roster) {
  const labels=[...new Set(roster.map(s=>s.section))];
  const active=project.sections.map((s,i)=>s.enabled?i:-1).filter(i=>i>=0);
  const max=active.length||project.sections.length;
  // Match known section IDs and labels first. Unknown labels receive explicitly
  // schematic sectors in CSV encounter order. No false claim of real orientation.
  const matched=new Map();
  const used=new Set();
  for(const label of labels){
    const index=project.sections.findIndex(s=>s.id.toLowerCase()===label.toLowerCase()||s.label.toLowerCase()===label.toLowerCase());
    if(index>=0){matched.set(label,index);used.add(index);}
  }
  let cursor=0;
  for(let j=0;j<labels.length;j++){
    const label=labels[j];if(matched.has(label))continue;
    // Unknown identifiers are distributed around the whole venue, explicitly
    // as a schematic orientation rather than an invented official section map.
    const preferred=active[Math.floor(j*max/labels.length)%max]??0;
    let index=preferred;
    if(used.size<max){let cursorIndex=Math.max(0,active.indexOf(index));while(used.has(index)){cursorIndex=(cursorIndex+1)%max;index=active[cursorIndex]??cursorIndex;}}
    else index=active[cursor++%max]??(cursor%project.sections.length);
    matched.set(label,index);used.add(index);
  }
  const groups=new Map(),slices=new Map();
  for(const label of labels){const index=matched.get(label);if(!groups.has(index))groups.set(index,[]);groups.get(index).push(label);}
  for(const [index,names] of groups)names.forEach((label,part)=>slices.set(label,{index,part,total:names.length}));
  return {matched,slices,unmatched:labels.filter(s=> !project.sections.some(p=>p.id.toLowerCase()===s.toLowerCase()||p.label.toLowerCase()===s.toLowerCase()))};
}

// Build XYZ solely for preview; coordinates are NOT surveyed.
// Grouped rows use their supplied seat identifiers and counts exactly.
export function estimateRosterCoordinates(input,roster) {
  const project=validateProject(input),surface=SURFACES[project.surface];
  if (usesSchottensteinChart(project)) return estimateSchottensteinRoster(roster);
  const tiers=resolveTiers(project),assignment=sectionAssignment(project,roster);
  const straightSides=['college-gym','high-basketball','high-football','middle-basketball'].includes(project.school?.profile);
  const orderedLabels=[...new Set(roster.map(s=>s.section))];
  const grouped=new Map();
  for(const seat of roster){
    const key=JSON.stringify([seat.section,seat.tier,seat.row]);
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(seat);
  }
  const rowOrder=new Map(),out=[];
  for(const members of grouped.values()){
    const first=members[0],key=JSON.stringify([first.section,first.tier]);
    const rowIndex=rowOrder.get(key)||0;rowOrder.set(key,rowIndex+1);
    const tier=tiers.find(t=>t.id===first.tier);
    if(!tier)throw new Error(`Ticket inventory references missing tier ${first.tier}.`);
    if(rowIndex>=tier.rows)throw new Error(`Section ${first.section} tier ${first.tier} has more ticket rows than the generated tier. Increase tier rows before importing.`);
    const slice=assignment.slices.get(first.section);
    const radial=tier.startOffset+(rowIndex+.5)*tier.depth;
    let width,left=0,right=0,path=null,side=0,segmentMid=0;
    if(straightSides){
      const order=orderedLabels.indexOf(first.section);
      side=order%2===0?-1:1;
      const onSide=Math.ceil((orderedLabels.length-(order%2))/2);
      const segment=surface.length+12;
      const span=segment/onSide;
      const slot=Math.floor(order/2);
      segmentMid=-segment/2+(slot+.5)*span;
      width=span-project.aisleWidth;
    }else{
      const sector=project.sections[slice.index];
      const sectorStart=sector.start+(sector.end-sector.start)*slice.part/slice.total;
      const sectorEnd=sector.start+(sector.end-sector.start)*(slice.part+1)/slice.total;
      path=modelPerimeterPath(project,surface,radial,256);
      left=distanceAtAngle(path,sectorStart*Math.PI/180)+project.aisleWidth/(2*slice.total);
      right=distanceAtAngle(path,sectorEnd*Math.PI/180)-project.aisleWidth/(2*slice.total);
      width=right-left;
    }
    const actualPitch=width/members.length;
    if(!(actualPitch>=.32))throw new Error(`Section ${first.section} row ${first.row} has ${members.length} seats in ${width.toFixed(1)}m. Geometry would be implausibly dense; adjust sections or tier footprint.`);
    const y=tier.startHeight+rowIndex*tier.rise+.08;
    members.forEach((s,i)=>{
      const p=straightSides?{x:side*(surface.width/2+2.4+rowIndex*tier.depth),z:segmentMid-width/2+(i+.5)*actualPitch}:pointAtDistance(path,left+(i+.5)*actualPitch);
      out.push({...s,x:Number(p.x.toFixed(4)),y:Number(y.toFixed(4)),z:Number(p.z.toFixed(4))});
    });
  }
  return {seats:out,unmatchedSections:assignment.unmatched,coordinateMethod:'estimated'};
}
export function importTicketRoster(input,csv,source='School-supplied ticket inventory CSV') {
  const project=enableSeatFirst(input);
  const parsed=parseTicketRosterCSV(csv);
  const inferred=parsed.hasCoordinates?null:estimateRosterCoordinates(project,parsed.seats);
  const seats=inferred?.seats??parsed.seats;
  // validateProject only mutates a cloned project. All-or-nothing import.
  project.survey={...project.survey,mode:'imported',inputUnit:'m',yUnit:'m',heightOffset:0,
    anchors:[],seats,source:short(source,160)};
  project.ticketing={...project.ticketing,inventoryMode:'file-import',inventorySource:short(source,240),
    inventoryCount:seats.length,coordinates:parsed.hasCoordinates?'supplied-unverified':'estimated'};
  if(project.school){project.school.seatCoordinateMethod=parsed.hasCoordinates?'supplied-coordinates/unverified':'estimated-from-ticket-roster';project.school.status='ticket-inventory-imported';}
  const p=validateProject(project);
  return {project:p,report:ticketReconciliation(p,seats.length),unmatchedSections:inferred?.unmatchedSections??[]};
}
export function ticketReconciliation(project,modeledCount=null){
  const meta=validateTicketing(project?.ticketing);
  const official=meta?.officialCapacity??venueFacts(project?.venueReference?.id)?.capacity?.value??null;
  const modeled=modeledCount===null?null:Math.max(0,Math.trunc(modeledCount));
  const inventory=meta?.inventoryCount??(project?.survey?.mode==='imported' ? project.survey.seats.length : null);
  const reconciled=official!==null&&inventory!==null&&official===inventory;
  return {officialCapacity:official,officialSource:meta?.capacitySource||venueFacts(project?.venueReference?.id)?.capacity?.source||'',
    inventoryCount:inventory,modelSeatCount:modeled,
    inventoryVsOfficial:official===null||inventory===null?null:inventory-official,
    modelVsInventory:inventory===null||modeled===null?null:modeled-inventory,
    inventoryMatchesPublished:reconciled,verifiedGeometry:false,liveTicketAvailability:false,
    status:inventory===null?'NO_TICKET_INVENTORY':official===null?'OFFICIAL_CAPACITY_UNKNOWN':reconciled?'COUNTS_MATCH_UNVERIFIED':'COUNT_MISMATCH',
    note:'Matching published capacity does not validate section counts, ticket permissions, coordinate accuracy or availability.'};
}
export function ticketMappingCSV(project) {
  if(project?.survey?.mode!=='imported')throw new Error('Import a school ticket inventory before exporting a seat mapping.');
  const q=x=>{const t=String(x??'');const guarded=/^[=+@-]/.test(t)&&!/^-?\d+(?:\.\d+)?$/.test(t)?'\''+t:t;return '"'+guarded.replace(/"/g,'""')+'"';};
  const header='seat_id,section,row,seat,tier,x_m,y_m,z_m,coordinate_confidence';
  const rows=project.survey.seats.map(s=>[s.id,s.section,s.row,s.number,s.tier,s.x,s.y??'',s.z,project.ticketing?.coordinates||'unknown'].map(q).join(','));
  return [header,...rows].join('\r\n');
}
export function demoTicketRosterCSV(){return 'seat_id,section,row,seat,tier\n'+
  ['A','B','C','D'].flatMap((section,si)=>['1','2','3','4'].flatMap(row=>Array.from({length:12},(_,k)=>`DEMO-${section}-${row}-${k+1},${section},${row},${k+1},T1`))).join('\n')+'\n';}

// Only build shallow treads between consecutive seats from the same known row.
// Never bridge gaps or infer complete building walls from an imported inventory.
export function importedTreadPairs(seats,limit=150000) {
  const groups=new Map(),pairs=[];
  for(const s of seats) {
    const key=JSON.stringify([s.sectionId,s.tier,s.row]);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(s);
  }
  for(const seatsInRow of groups.values()){
    seatsInRow.sort((a,b)=>{
      const an=Number(a.number),bn=Number(b.number);
      return Number.isFinite(an)&&Number.isFinite(bn)?an-bn:String(a.number).localeCompare(String(b.number),undefined,{numeric:true});
    });
    for(let i=1;i<seatsInRow.length;i++){
      const a=seatsInRow[i-1],b=seatsInRow[i],distance=Math.hypot(a.x-b.x,a.z-b.z);
      if(distance>=.2&&distance<=1.4&&Math.abs(a.y-b.y)<.18){
        pairs.push([a,b]);
        if(pairs.length>=limit)return pairs;
      }
    }
  }
  return pairs;
}
