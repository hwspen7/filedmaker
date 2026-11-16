// Data contract for the custom venue workbench. No renderer or DOM dependencies.
import {parseCSV} from '../survey.mjs';
export const SPORT_DEFAULTS=Object.freeze({
  'nfhs-basketball':{width:15.24,length:25.6032,profile:'high-basketball'},
  ncaa:{width:15.24,length:28.6512,profile:'college-basketball'},
  'nfhs-football':{width:48.768,length:109.728,profile:'high-football'},
  'ncaa-football':{width:48.768,length:109.728,profile:'college-football'}
});
const finite=(value,label,min,max)=>{
  const n=Number(value);
  if(value===''||value==null||!Number.isFinite(n)||n<min||n>max)
    throw Error(label+' must be between '+min+' and '+max);
  return n;
};
const name=(value,label,max=100)=>{
  const s=String(value??'').trim();
  if(!s||s.length>max)throw Error(label+' is missing or too long');
  return s;
};
const point=(p,label)=>{
  if(!p||typeof p!=='object')throw Error(label+' requires a point');
  return {x:finite(p.x,label+' X',-2000,2000),z:finite(p.z,label+' Z',-2000,2000)};
};
export function newVenue(sport='nfhs-basketball'){
  if(!SPORT_DEFAULTS[sport])throw Error('Unsupported school venue sport');
  const d=SPORT_DEFAULTS[sport];
  return {format:'filedmaker-venue-workbench',
    school:'Example school',venue:'Untitled school venue',sport,
    court:{width:d.width,length:d.length},officialCapacity:null,
    capacitySource:'',plan:{name:'',mime:'',width:0,height:0,imageData:''},
    calibration:{corners:[],checkpoints:[]},sections:[],rows:[],notes:[],
    sources:[],rowSourceId:null,planSourceId:null,changeLog:[],vectorCandidates:[]};
}
export function parseVenueRows(csv){
  const raw=parseCSV(csv,16000),seen=new Set();
  const rows=raw.map((r,i)=>{
    for(const k of ['section','row','seats'])if(!Object.hasOwn(r,k))
      throw Error('Row CSV requires '+k);
    const section=name(r.section,'Section',30),row=name(r.row,'Row',30);
    const seats=finite(r.seats,'Seats on line '+(i+2),1,300);
    if(!Number.isInteger(seats))throw Error('Row seat counts must be integers');
    const first=r.seat_start?.trim()?finite(r.seat_start,'First seat',1,100000):1;
    if(!Number.isInteger(first))throw Error('First seat must be an integer');
    const key=section.toLowerCase()+'|'+row.toLowerCase();
    if(seen.has(key))throw Error('Duplicate section and row: '+section+'/'+row);
    seen.add(key);
    const tier=name(r.tier||'T1','Tier',12);
    if(!/^T[1-4]$/.test(tier))throw Error('Unsupported seating tier: '+tier);
    const kind=String(r.seat_type||'chair').trim().toLowerCase();
    if(!['chair','bleacher'].includes(kind))throw Error('Unsupported seat type: '+kind);
    return {section,row,seats,first,tier,seatType:kind};
  });
  if(rows.reduce((n,r)=>n+r.seats,0)>40000)
    throw Error('Workbench preview is limited to 40,000 seats; use the survey import for larger projects');
  return rows;
}
export function normalizeVenue(input){
  if(!input||input.format!=='filedmaker-venue-workbench'||!SPORT_DEFAULTS[input.sport])
    throw Error('Not a FiledMaker venue workbench project');
  const v=structuredClone(input);
  v.school=name(v.school,'School',120);v.venue=name(v.venue,'Venue',120);
  v.court={width:finite(v.court?.width,'Playing surface width',8,160),
    length:finite(v.court?.length,'Playing surface length',15,200)};
  if(v.officialCapacity!=null){
    v.officialCapacity=finite(v.officialCapacity,'Published capacity',1,150000);
    if(!Number.isInteger(v.officialCapacity))throw Error('Published capacity must be an integer');
    if(!/^https:\/\//i.test(v.capacitySource||''))throw Error('Published capacity requires an HTTPS source');
  }
  v.capacitySource=String(v.capacitySource||'').slice(0,500);
  const plan=v.plan??{};
  v.plan={name:String(plan.name||'').slice(0,160),
    mime:String(plan.mime||'').slice(0,80),
    width:plan.width?finite(plan.width,'Image width',1,20000):0,
    height:plan.height?finite(plan.height,'Image height',1,20000):0,
    imageData:typeof plan.imageData==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(plan.imageData)&&plan.imageData.length<6000000?plan.imageData:''};
  const corners=v.calibration?.corners??[];
  if(!Array.isArray(corners)||![0,4].includes(corners.length))throw Error('Calibration needs exactly four playing-surface corners');
  v.calibration={corners:corners.map(p=>({x:finite(p.x,'Anchor pixel X',0,20000),y:finite(p.y,'Anchor pixel Y',0,20000)})),
    checkpoints:(v.calibration?.checkpoints??[]).map(p=>({
      pixelX:finite(p.pixelX,'Check pixel X',0,20000),
      pixelY:finite(p.pixelY,'Check pixel Y',0,20000),
      actualX:finite(p.actualX,'Check X metres',-2000,2000),
      actualZ:finite(p.actualZ,'Check Z metres',-2000,2000)
    }))};
  if(v.calibration.checkpoints.length>100)throw Error('Too many independent calibration checks');
  if(!Array.isArray(v.sections)||v.sections.length>160)throw Error('Maximum 160 traced sections');
  const names=new Set();
  v.sections=v.sections.map((s,i)=>{
    const id=name(s.id,'Section identifier',30);
    if(names.has(id.toLowerCase()))throw Error('Duplicate section identifier '+id);
    names.add(id.toLowerCase());
    const front=(s.front||[]).map(p=>point(p,'Front edge'));
    const back=(s.back||[]).map(p=>point(p,'Rear edge'));
    if(front.length<2||back.length<2||front.length>32||back.length>32)
      throw Error('Section '+id+' needs front and rear polylines');
    const length=path=>path.slice(1).reduce((sum,p,j)=>sum+Math.hypot(p.x-path[j].x,p.z-path[j].z),0);
    if(length(front)<.4||length(back)<.4)throw Error('Section '+id+' has a collapsed edge');
    const trace=Array.isArray(s.trace)&&s.trace.length===4?s.trace.map(p=>({
      x:finite(p.x,'Trace pixel X',0,20000),y:finite(p.y,'Trace pixel Y',0,20000)})):[];
    return {id,front,back,trace,baseHeight:finite(s.baseHeight??.45,'First row height',0,80),
      rowRise:finite(s.rowRise??.28,'Row rise',.05,1.5),
      provenance:String(s.provenance||'operator-traced/estimated').slice(0,100)};
  });
  if(!Array.isArray(v.rows)||v.rows.length>16000)throw Error('Invalid row inventory');
  const rowKeys=new Set();
  v.rows=v.rows.map(r=>{
    const section=name(r.section,'Row section',30),row=name(r.row,'Row label',30);
    const key=section.toLowerCase()+'|'+row.toLowerCase();
    if(rowKeys.has(key))throw Error('Duplicate section/row '+key);
    rowKeys.add(key);
    const seats=finite(r.seats,'Row seats',1,300),first=finite(r.first??1,'First seat',1,100000);
    if(!Number.isInteger(seats)||!Number.isInteger(first))throw Error('Row counts and seat numbers must be integers');
    const tier=name(r.tier||'T1','Tier',12);
    if(!/^T[1-4]$/.test(tier))throw Error('Unsupported seating tier: '+tier);
    const kind=String(r.seatType||'chair').trim().toLowerCase();
    if(!['chair','bleacher'].includes(kind))throw Error('Unsupported seat type: '+kind);
    return {section,row,seats,first,tier,seatType:kind};
  });
  if(v.rows.reduce((n,r)=>n+r.seats,0)>40000)throw Error('Seat count exceeds the 40,000-seat preview limit');
  v.notes=Array.isArray(v.notes)?v.notes.map(s=>String(s).slice(0,250)).slice(0,50):[];
  if(!Array.isArray(v.vectorCandidates||[])||(v.vectorCandidates||[]).length>500)
    throw Error('Invalid vector candidate collection');
  let totalVectorPoints=0;
  v.vectorCandidates=(v.vectorCandidates||[]).map(item=>{
    if(!item||!Array.isArray(item.points)||item.points.length<3||item.points.length>256)
      throw Error('Invalid vector candidate');
    totalVectorPoints+=item.points.length;
    if(totalVectorPoints>12000)throw Error('Too many vector drawing points');
    return {id:String(item.id||'').slice(0,50),
      kind:String(item.kind||'polygon').slice(0,30),
      points:item.points.map(p=>({x:finite(p.x,'Vector X',0,20000),y:finite(p.y,'Vector Y',0,20000)}))};
  });
  if(!Array.isArray(v.sources||[])||(v.sources||[]).length>100)throw Error('Too many source files');
  v.sources=(v.sources||[]).map(s=>{
    if(!s||typeof s!=='object'||!/^sha256:[0-9a-f]{64}$/.test(s.id||'')||
      s.sha256!==s.id.slice(7)||!Number.isInteger(s.size)||s.size<1||s.size>32000000)
      throw Error('Invalid source manifest record');
    return {id:s.id,sha256:s.sha256,name:String(s.name||'').slice(0,160),size:s.size,
      mime:String(s.mime||'').slice(0,80),role:String(s.role||'').slice(0,40),
      origin:String(s.origin||'operator').slice(0,40),url:String(s.url||'').slice(0,500),
      review:s.review==='verified'?'verified':'unverified',
      verifiedBy:s.review==='verified'?String(s.verifiedBy||'').slice(0,100):''};
  });
  v.rowSourceId=v.rowSourceId==null?null:String(v.rowSourceId).slice(0,72);
  v.planSourceId=v.planSourceId==null?null:String(v.planSourceId).slice(0,72);
  for(const id of [v.rowSourceId,v.planSourceId])
    if(id&&!v.sources.some(s=>s.id===id))throw Error('Active source does not appear in the source manifest');
  v.changeLog=Array.isArray(v.changeLog)?v.changeLog.slice(-200).map(a=>({
    event:String(a.event||'').slice(0,100),at:String(a.at||'').slice(0,40)
  })):[];
  return v;
}
