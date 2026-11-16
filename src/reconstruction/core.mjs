// Structured, manual-data venue reconstruction contract.
// Deliberately excludes image scanning, synthetic official ticket data and
// automatic capacity fitting. All dimensions use metres.
import { newVenue, normalizeVenue } from '../workbench/contract.mjs';
import { buildWorkbenchPreview } from '../workbench/adapter.mjs';
import { generateTracedVenue } from '../workbench/generator.mjs';

export const RECONSTRUCTION_FORMAT='filedmaker-reconstruction';
const VALID_SPORTS=new Set(['ncaa','nfhs-basketball','ncaa-football','nfhs-football']);
const INTEGER=(value,label,min,max)=>{
  const n=Number(value);
  if(value==null||value===''||!Number.isInteger(n)||n<min||n>max)
    throw Error(label+' must be an integer between '+min+' and '+max);
  return n;
};
const NUMBER=(value,label,min,max)=>{
  const n=Number(value);
  if(value==null||value===''||!Number.isFinite(n)||n<min||n>max)
    throw Error(label+' must be between '+min+' and '+max);
  return n;
};
const STRING=(value,label,max=120)=>{
  const s=String(value??'').trim();
  if(!s||s.length>max)throw Error(label+' is missing or too long');
  return s;
};
const optional=(value,max=500)=>String(value??'').trim().slice(0,max);
const point=(p,context)=>({
  x:NUMBER(p?.x,context+' X',-2000,2000),
  z:NUMBER(p?.z,context+' Z',-2000,2000),
});
const pathLength=path=>path.slice(1).reduce((sum,p,i)=>
  sum+Math.hypot(p.x-path[i].x,p.z-path[i].z),0);
const VALID_TYPES=new Set(['chair','bleacher']);

export function createReconstruction(sport='nfhs-basketball'){
  if(!VALID_SPORTS.has(sport))throw Error('Unsupported sport');
  const base=newVenue(sport);
  return {
    format:RECONSTRUCTION_FORMAT,
    school:'New school',
    venue:'Untitled venue',
    sport,
    court:{...base.court},
    officialCapacity:null,
    capacitySource:'',
    sections:[],
    notes:'',
    // This is a future plugin contract. No exterior meshes are generated.
    exterior:{enabled:false,provider:null,parameters:null},
  };
}
export function addRectangularBank(project,{id,side='west',tier='T1',rows=12,
  seatsPerRow=20,baseHeight=.48,rowRise=.29,seatType='chair'}={}){
  const p=structuredClone(project),c=p.court;
  const section=STRING(id,'Section ID',30);
  if(p.sections.some(s=>s.id.toLowerCase()===section.toLowerCase()))
    throw Error('Section already exists: '+section);
  if(!['west','east','north','south'].includes(side))throw Error('Unknown bank side');
  const n=INTEGER(rows,'Rows',1,100);
  const count=INTEGER(seatsPerRow,'Seats per row',1,300);
  const setback=3;
  const depth=n*.83;
  const length=c.length*.49;
  const width=c.width*.49;
  const front=side==='west'?
    [{x:-width-setback,z:-length},{x:-width-setback,z:length}]:
    side==='east'?
    [{x:width+setback,z:-length},{x:width+setback,z:length}]:
    side==='north'?
    [{x:-width,z:-c.length/2-setback},{x:width,z:-c.length/2-setback}]:
    [{x:-width,z:c.length/2+setback},{x:width,z:c.length/2+setback}];
  const back=front.map(v=>({
    x:v.x+ (side==='west'?-depth:side==='east'?depth:0),
    z:v.z+ (side==='north'?-depth:side==='south'?depth:0),
  }));
  p.sections.push({id:section,tier,baseHeight,rowRise,front,back,
    rows:Array.from({length:n},(_,i)=>({
      label:String(i+1),seats:count,first:1,seatType,
      seatDirection:'forward',gaps:[],elevation:null,
      insetStartM:0,insetEndM:0,depthOffsetM:0,seatNumbers:[],
    })),source:'illustrative-manual-entry'});
  return p;
}
export function fictionalReconstruction(){
  // Exactly 1,500 fictional seats. Intended for engine verification only.
  let p=createReconstruction('nfhs-basketball');
  p.school='Fictional High School';
  p.venue='1,500-seat geometry demonstration';
  p=addRectangularBank(p,{id:'WEST-1',side:'west',tier:'T1',rows:15,seatsPerRow:25,seatType:'bleacher'});
  p=addRectangularBank(p,{id:'EAST-1',side:'east',tier:'T1',rows:15,seatsPerRow:25,seatType:'bleacher'});
  // Split the long sides into two independent sections without changing counts.
  for(const section of [...p.sections]){
    const n=section.rows.length;
    const clone=structuredClone(section);
    section.id=section.id.replace('-1','-A');
    section.rows=section.rows.map(r=>({...r,seats:25}));
    clone.id=clone.id.replace('-1','-B');
    const left=section.front.map(v=>({...v}));
    const back=section.back.map(v=>({...v}));
    const midFront={x:(left[0].x+left[1].x)/2,z:(left[0].z+left[1].z)/2};
    const midBack={x:(back[0].x+back[1].x)/2,z:(back[0].z+back[1].z)/2};
    section.front=[left[0],midFront];section.back=[back[0],midBack];
    clone.front=[midFront,left[1]];clone.back=[midBack,back[1]];
    clone.rows=Array.from({length:n},(_,i)=>({...section.rows[i]}));
    p.sections.push(clone);
  }
  return p;
}
export function normalizeReconstruction(raw){
  if(!raw||raw.format!==RECONSTRUCTION_FORMAT)
    throw Error('Expected a FiledMaker reconstruction project');
  const sport=STRING(raw.sport,'Sport',30);
  if(!VALID_SPORTS.has(sport))throw Error('Unsupported sport');
  const court={
    width:NUMBER(raw.court?.width,'Playing surface width',8,160),
    length:NUMBER(raw.court?.length,'Playing surface length',15,200),
  };
  const officialCapacity=raw.officialCapacity==null||raw.officialCapacity===''?
    null:INTEGER(raw.officialCapacity,'Official capacity',1,150000);
  const capacitySource=optional(raw.capacitySource,500);
  if(officialCapacity!==null&&!/^https:\/\//i.test(capacitySource))
    throw Error('Official capacity requires an HTTPS source');
  const entries=raw.sections;
  if(!Array.isArray(entries)||entries.length>160)
    throw Error('Use up to 160 manually configured sections');
  const names=new Set(),sections=[];
  let totalSeats=0,totalRows=0;
  for(const s of entries){
    const id=STRING(s.id,'Section ID',30),key=id.toLowerCase();
    if(names.has(key))throw Error('Duplicate section: '+id);
    names.add(key);
    const tier=STRING(s.tier??'T1','Tier',12);
    if(!/^T[1-4]$/.test(tier))throw Error('Unsupported tier: '+tier);
    const front=(s.front??[]).map(p=>point(p,id+' front')),
      back=(s.back??[]).map(p=>point(p,id+' back'));
    if(front.length<2||back.length<2||front.length>32||back.length>32||
       pathLength(front)<.4||pathLength(back)<.4)
      throw Error('Section '+id+' needs valid front and rear curves');
    const baseHeight=NUMBER(s.baseHeight,'Section '+id+' base height',0,80);
    const rowRise=NUMBER(s.rowRise,'Section '+id+' row rise',.05,1.5);
    if(!Array.isArray(s.rows)||s.rows.length>120)
      throw Error('Section '+id+' has too many rows');
    const usedRows=new Set(),rows=[];
    for(const r of s.rows){
      const label=STRING(r.label,'Row label',30);
      if(usedRows.has(label.toLowerCase()))throw Error('Repeated row '+id+'/'+label);
      usedRows.add(label.toLowerCase());
      const seats=INTEGER(r.seats,'Seat count '+id+'/'+label,1,300);
      const first=INTEGER(r.first??1,'First seat '+id+'/'+label,1,100000);
      const seatType=STRING(r.seatType??'chair','Seat type',20);
      if(!VALID_TYPES.has(seatType))throw Error('Invalid seat type in '+id+'/'+label);
      const seatDirection=String(r.seatDirection??'forward').toLowerCase();
      if(!['forward','reverse'].includes(seatDirection))
        throw Error('Invalid seat direction');
      const gaps=(r.gaps??[]).map(g=>({
        after:INTEGER(g.after,'Aisle after seat',1,seats-1),
        width:NUMBER(g.width,'Aisle width',.5,5),
      }));
      if(gaps.length>10||new Set(gaps.map(g=>g.after)).size!==gaps.length)
        throw Error('Invalid or duplicate aisle gaps in '+id+'/'+label);
      const seatNumbers=r.seatNumbers??[];
      if(!Array.isArray(seatNumbers)||seatNumbers.length&&seatNumbers.length!==seats||
        new Set(seatNumbers).size!==seatNumbers.length||
        seatNumbers.some(x=>!String(x).trim()))
        throw Error('Explicit seat numbers must be unique and match the row count');
      const elevation=r.elevation==null||r.elevation===''?
        null:NUMBER(r.elevation,'Row elevation',0,100);
      rows.push({
        label,seats,first,seatType,seatDirection,gaps,
        seatNumbers:seatNumbers.map(v=>STRING(v,'Seat label',30)),
        elevation,
        insetStartM:NUMBER(r.insetStartM??0,'Row start inset',0,30),
        insetEndM:NUMBER(r.insetEndM??0,'Row end inset',0,30),
        depthOffsetM:NUMBER(r.depthOffsetM??0,'Row depth offset',-3,3),
      });
      totalSeats+=seats;totalRows++;
      if(totalSeats>40000||totalRows>16000)
        throw Error('Preview limit exceeded (40,000 seats / 16,000 rows)');
    }
    sections.push({id,tier,front,back,baseHeight,rowRise,rows,
      source:optional(s.source,240)||'operator-provided/unverified'});
  }
  const exterior=raw.exterior??{};
  if(exterior.enabled===true)throw Error('Exterior is a future extension, not supported by this engine');
  return {
    format:RECONSTRUCTION_FORMAT,
    school:STRING(raw.school,'School',120),
    venue:STRING(raw.venue,'Venue',120),
    sport,court,officialCapacity,capacitySource,
    sections,notes:optional(raw.notes,1000),
    exterior:{enabled:false,provider:null,parameters:null},
    totals:{sections:sections.length,rows:totalRows,seats:totalSeats},
  };
}
export function toWorkbenchVenue(project){
  const p=normalizeReconstruction(project);
  const v=newVenue(p.sport);
  v.school=p.school;v.venue=p.venue;v.court=p.court;
  v.officialCapacity=p.officialCapacity;v.capacitySource=p.capacitySource;
  v.sections=p.sections.map(s=>({
    id:s.id,front:s.front,back:s.back,baseHeight:s.baseHeight,
    rowRise:s.rowRise,trace:[],provenance:s.source,
  }));
  v.rows=p.sections.flatMap(s=>s.rows.map(r=>({
    section:s.id,row:r.label,seats:r.seats,first:r.first,tier:s.tier,
    seatType:r.seatType,seatDirection:r.seatDirection,
    gaps:r.gaps,seatNumbers:r.seatNumbers,
    elevation:r.elevation,insetStartM:r.insetStartM,
    insetEndM:r.insetEndM,depthOffsetM:r.depthOffsetM,
    sourceSeats:r.seats,operatorEdited:false,operatorAdded:false,
  })));
  return normalizeVenue(v);
}
export function generateReconstruction(project,{preview=true}={}){
  const normalized=normalizeReconstruction(project);
  if(!normalized.totals.seats)throw Error('Add section rows before generating a venue');
  const workbench=toWorkbenchVenue(normalized);
  const output=preview?buildWorkbenchPreview(workbench):generateTracedVenue(workbench);
  if(output.seats.length!==normalized.totals.seats)
    throw Error('Generated seat count does not match the supplied row inventory');
  // A count-exact preview can still have folded banks or seat collisions.
  // Block such geometry rather than publishing a misleading reconstruction.
  if(output.quality?.blockingCount){
    const first=output.quality.issues.find(issue=>issue.severity==='blocking');
    throw Error('Geometry validation failed: '+(first?.code??'UNKNOWN')+
      ' — '+(first?.detail??'Review section boundaries and seating rows'));
  }
  const warnings=[...output.warnings];
  if(!normalized.officialCapacity)
    warnings.push('No independently sourced capacity. Geometry is not an official ticket map.');
  warnings.push('External architecture is deliberately not generated.');
  return {...output,sourceProject:normalized,warnings,
    audit:{...output.audit,sourceDriven:true,capacityFitting:false,
      exteriorBuilt:false,sectionsConfigured:normalized.totals.sections}};
}
