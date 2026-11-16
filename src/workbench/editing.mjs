// Staff-operated geometry and row editing. All operations are immutable,
// deterministic, validated and explicitly provisional. No official ticket
// data or surveyed elevation is manufactured by these controls.
import {normalizeVenue} from './contract.mjs';
import {generateTracedVenue} from './generator.mjs';

const finite=(x,label,min,max)=>{
  if(x===''||x==null||!Number.isFinite(Number(x))||Number(x)<min||Number(x)>max)
    throw Error(label+' must be between '+min+' and '+max);
  return Number(x);
};
const integer=(x,label,min,max)=>{
  const n=finite(x,label,min,max);
  if(!Number.isInteger(n))throw Error(label+' must be a whole number');
  return n;
};
const text=(value,label)=>{
  const s=String(value??'').trim();
  if(!s||s.length>30)throw Error(label+' is missing or too long');
  return s;
};
const sectionFor=(v,id)=>{
  const s=v.sections.find(s=>s.id.toLowerCase()===String(id).toLowerCase());
  if(!s)throw Error('Choose an existing traced section');
  return s;
};
const rowFor=(v,section,row)=>{
  const i=v.rows.findIndex(r=>r.section.toLowerCase()===String(section).toLowerCase()&&
    r.row.toLowerCase()===String(row).toLowerCase());
  if(i<0)throw Error('Choose an existing row');
  return i;
};
const log=(v,operation,section,row,beforeSeats,afterSeats,note)=>{
  v.editLedger=[...(v.editLedger??[]),{operation,section,row,
    beforeSeats,afterSeats,note:String(note||'Staff-estimated, not source-verified')}].slice(-200);
};
export const rowKey=r=>r.section+' / '+r.row;
export function applyVenueEdit(input,edit){
  const v=normalizeVenue(input),oldCount=v.rows.reduce((a,r)=>a+r.seats,0);
  if(!edit||typeof edit!=='object')throw Error('Edit operation is required');
  const operation=String(edit.type||''),id=String(edit.section||'');
  let affected='',note='Operator estimate; source comparison required';
  if(operation==='translate-section'){
    const s=sectionFor(v,id);
    const dx=finite(edit.dx,'Horizontal shift (m)',-15,15);
    const dz=finite(edit.dz,'Longitudinal shift (m)',-15,15);
    if(!dx&&!dz)throw Error('Choose a nonzero section shift');
    for(const path of [s.front,s.back])for(const p of path){p.x+=dx;p.z+=dz;}
    s.trace=[];s.provenance='operator-adjusted/estimated';
    affected=s.id;log(v,operation,s.id,'',null,null,note);
  }else if(operation==='resize-section'){
    const s=sectionFor(v,id),factor=finite(edit.factor,'Section width factor',.5,1.5);
    if(Math.abs(factor-1)<1e-9)throw Error('Choose a changed section width');
    // Rescale the seat-row tangent on both edges, never the front/back depth.
    for(const path of [s.front,s.back]){
      const cx=path.reduce((a,p)=>a+p.x,0)/path.length;
      const cz=path.reduce((a,p)=>a+p.z,0)/path.length;
      for(const p of path){p.x=cx+(p.x-cx)*factor;p.z=cz+(p.z-cz)*factor;}
    }
    s.trace=[];s.provenance='operator-adjusted/estimated';
    affected=s.id;log(v,operation,s.id,'',null,null,note);
  }else if(operation==='set-section-elevation'){
    const s=sectionFor(v,id);
    s.baseHeight=finite(edit.baseHeight,'First-row elevation',0,80);
    s.rowRise=finite(edit.rowRise,'Rise per row',.05,1.5);
    s.provenance='operator-adjusted/estimated';
    affected=s.id;log(v,operation,s.id,'',null,null,note);
  }else if(operation==='update-row'){
    const i=rowFor(v,id,edit.row),r=v.rows[i],previous=r.seats;
    const changes=edit.changes;
    if(!changes||typeof changes!=='object'||Array.isArray(changes))
      throw Error('Row changes must be provided');
    const allowed=new Set(['seats','first','seatType','seatDirection','seatNumbers',
      'gaps','elevation','insetStartM','insetEndM','depthOffsetM']);
    for(const key of Object.keys(changes))
      if(!allowed.has(key))throw Error('Unsupported editable row field: '+key);
    if(Object.keys(changes).length===0)throw Error('Enter a row edit');
    const count=changes.seats===undefined?r.seats:integer(changes.seats,'Seat count',1,300);
    if(count!==r.seats&&r.seatNumbers.length&&changes.seatNumbers===undefined)
      throw Error('Explicit source seat identifiers must be revised with the changed seat count');
    const next={...r,...changes,seats:count,
      operatorEdited:true,operatorAdded:r.operatorAdded===true,
      sourceSeats:r.sourceSeats??(r.operatorAdded?null:previous)};
    v.rows[i]=next;
    affected=rowKey(r);log(v,operation,r.section,r.row,previous,count,note);
  }else if(operation==='add-row'){
    const s=sectionFor(v,id),r=edit.newRow;
    if(!r||typeof r!=='object')throw Error('Provide the new row');
    const label=text(r.row,'Row label');
    const count=integer(r.seats,'Seat count',1,300);
    if(v.rows.some(x=>x.section.toLowerCase()===s.id.toLowerCase()&&
      x.row.toLowerCase()===label.toLowerCase()))throw Error('Row label already exists');
    const newRow={section:s.id,row:label,seats:count,
      first:r.first??1,tier:r.tier??'T1',seatType:r.seatType??'chair',
      gaps:r.gaps??[],seatNumbers:r.seatNumbers??[],seatDirection:r.seatDirection??'forward',
      elevation:r.elevation??null,insetStartM:r.insetStartM??0,
      insetEndM:r.insetEndM??0,depthOffsetM:r.depthOffsetM??0,
      sourceSeats:null,operatorEdited:true,operatorAdded:true};
    const sectionRows=v.rows.map((x,i)=>({x,i})).filter(({x})=>
      x.section.toLowerCase()===s.id.toLowerCase());
    const after=edit.afterRow;
    const pos=after==null?(sectionRows.at(-1)?.i??-1):
      rowFor(v,s.id,after);
    v.rows.splice(pos+1,0,newRow);
    affected=rowKey(newRow);log(v,operation,s.id,label,0,count,note);
  }else if(operation==='remove-row'){
    const i=rowFor(v,id,edit.row),r=v.rows[i];
    v.rows.splice(i,1);affected=rowKey(r);
    log(v,operation,r.section,r.row,r.seats,0,
      'Staff deleted a source/listed row. Original source requires reconciliation.');
  }else if(operation==='move-row'){
    const i=rowFor(v,id,edit.row),r=v.rows[i],direction=edit.direction;
    if(!['up','down'].includes(direction))throw Error('Row direction must be up or down');
    const candidates=v.rows.map((x,j)=>({x,j})).filter(({x})=>
      x.section.toLowerCase()===r.section.toLowerCase());
    const at=candidates.findIndex(({j})=>j===i);
    const to=candidates[at+(direction==='up'?-1:1)]?.j;
    if(to==null)throw Error('Row is already at the section boundary');
    const item=v.rows.splice(i,1)[0];
    v.rows.splice(to,0,item);
    affected=rowKey(r);log(v,operation,r.section,r.row,r.seats,r.seats,
      'Staff adjusted row order; compare to source plan.');
  }else throw Error('Unsupported geometry edit: '+operation);
  const normalized=normalizeVenue(v);
  let audit=null;
  if(normalized.rows.length&&normalized.rows.every(r=>normalized.sections.some(s=>
    s.id.toLowerCase()===r.section.toLowerCase()))){
    const generated=generateTracedVenue(normalized);
    if(generated.quality.blockingCount)
      throw Error('Edit rejected: '+generated.quality.blockingCount+
        ' blocking geometry issues ('+generated.quality.issues
          .filter(x=>x.severity==='blocking').slice(0,2).map(x=>x.code).join(', ')+')');
    audit={seats:generated.seats.length,findings:generated.quality.issues.length,
      quality:generated.quality.status};
  }
  const count=normalized.rows.reduce((n,r)=>n+r.seats,0);
  return {venue:normalized,operation,affected,seatDelta:count-oldCount,audit,
    publicationEligible:false};
}
