// Deterministic, privacy-preserving project delta for renovation and
// annual seating-map updates. No patron records or raw document bytes.
import {normalizeVenue} from './contract.mjs';
const map=(rows,key)=>new Map(rows.map(x=>[key(x),x]));
const changed=(a,b)=>JSON.stringify(a)!==JSON.stringify(b);
export function compareVenueProjects(previous,current){
  const before=normalizeVenue(previous),after=normalizeVenue(current);
  const diff={venueChanged:before.venue!==after.venue||before.school!==after.school,
    sportChanged:before.sport!==after.sport,
    sourceChanges:[],sectionChanges:[],rowChanges:[],
    seatDelta:after.rows.reduce((n,r)=>n+r.seats,0)-before.rows.reduce((n,r)=>n+r.seats,0)};
  const sourceIds=new Set(before.sources.map(s=>s.id));
  diff.sourceChanges=after.sources.filter(s=>!sourceIds.has(s.id)).map(s=>({
    action:'added',role:s.role,name:s.name,sha256:s.sha256
  }));
  const sectionBefore=map(before.sections,s=>s.id.toLowerCase());
  const sectionAfter=map(after.sections,s=>s.id.toLowerCase());
  const rowsBefore=map(before.rows,r=>r.section.toLowerCase()+'|'+r.row.toLowerCase());
  const rowsAfter=map(after.rows,r=>r.section.toLowerCase()+'|'+r.row.toLowerCase());
  function differences(a,b,field,output){
    for(const [key,left] of a)if(!b.has(key))output.push({action:'removed',[field]:key,previous:left});
    for(const [key,right] of b){
      if(!a.has(key))output.push({action:'added',[field]:key,current:right});
      else if(changed(a.get(key),right))output.push({action:'modified',[field]:key,
        previous:a.get(key),current:right});
    }
  }
  differences(sectionBefore,sectionAfter,'section',diff.sectionChanges);
  differences(rowsBefore,rowsAfter,'row',diff.rowChanges);
  diff.hasChanges=diff.venueChanged||diff.sportChanged||diff.seatDelta!==0||
    diff.sourceChanges.length>0||diff.sectionChanges.length>0||diff.rowChanges.length>0;
  return diff;
}
