// Deterministic source-row placement into operator-traced front/rear contours.
// Seat identities are preserved. Missing precision is never filled with invented ticket IDs.
import {normalizeVenue} from './contract.mjs';
import {assessVenueGeometry} from './quality.mjs';
const length=path=>path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.z-path[i].z),0);
function sample(path,t){
  let remain=length(path)*t;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],d=Math.hypot(b.x-a.x,b.z-a.z);
    if(i===path.length-1||remain<=d){
      const f=d?Math.max(0,Math.min(1,remain/d)):0;
      return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f};
    }
    remain-=d;
  }
  return {...path.at(-1)};
}
export function generateTracedVenue(input){
  const venue=normalizeVenue(input),seats=[],rowRuns=[],warnings=[];
  const sections=new Map(venue.sections.map(s=>[s.id.toLowerCase(),s]));
  const rowsBySection=new Map();
  for(const row of venue.rows){
    const id=row.section.toLowerCase();
    if(!sections.has(id))throw Error('Row '+row.section+'/'+row.row+' has no traced section');
    if(!rowsBySection.has(id))rowsBySection.set(id,[]);
    rowsBySection.get(id).push(row);
  }
  const ids=new Set();
  for(const s of venue.sections){
    const rows=rowsBySection.get(s.id.toLowerCase())??[];
    if(!rows.length){warnings.push('Section '+s.id+' has no imported rows');continue;}
    for(let i=0;i<rows.length;i++){
      const row=rows[i],t=(i+.5)/rows.length;
      const along=steps=>Array.from({length:steps+1},(_,j)=>{
        const f=j/steps,a=sample(s.front,f),b=sample(s.back,f);
        return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
      });
      const samples=along(48);
      const segments=samples.slice(1).map((p,j)=>Math.hypot(p.x-samples[j].x,p.z-samples[j].z));
      const width=segments.reduce((a,b)=>a+b,0),pitch=width/row.seats;
      if(width<.4)throw Error('Section '+s.id+' row '+row.row+' has no usable width');
      if(pitch<.43)warnings.push(s.id+' row '+row.row+' has '+pitch.toFixed(2)+' m average seat pitch: verify layout');
      const heights=s.baseHeight+i*s.rowRise;
      const seatPositions=[],start=seats.length;
      for(let n=0;n<row.seats;n++){
        let target=(n+.5)*width/row.seats,at=samples[0];
        for(let j=0;j<segments.length;j++){
          if(target<=segments[j]||j===segments.length-1){
            const f=segments[j]?Math.max(0,Math.min(1,target/segments[j])):0;
            at={x:samples[j].x+(samples[j+1].x-samples[j].x)*f,
              z:samples[j].z+(samples[j+1].z-samples[j].z)*f};
            break;
          }
          target-=segments[j];
        }
        const number=String(row.first+n),id=s.id+'-'+row.row+'-'+number;
        if(ids.has(id))throw Error('Duplicate seat identity '+id);
        ids.add(id);
        const seat={id,section:s.id,row:row.row,number,tier:row.tier,x:at.x,y:heights,z:at.z,
          seatType:row.seatType,provenance:'plan-trace/estimated-elevation'};
        seats.push(seat);seatPositions.push(seat);
      }
      rowRuns.push({section:s.id,row:row.row,count:row.seats,width,seatPitch:pitch,
        height:heights,seatType:row.seatType,start});
    }
  }
  const declared=venue.rows.reduce((a,r)=>a+r.seats,0);
  if(seats.length!==declared)throw Error('Seat count reconciliation failed');
  if(venue.officialCapacity!=null&&seats.length!==venue.officialCapacity)
    warnings.push('Published capacity differs by '+(seats.length-venue.officialCapacity)+' seats; no seats were added or removed');
  if(!venue.calibration.corners.length)
    warnings.push('No image calibration; all traced positions are provisional');
  warnings.push('Section bounds, row elevations and sightlines require school review');
  const output={venue,seats,rowRuns,warnings,
    audit:{mappedSeats:seats.length,declaredSeats:declared,publishedCapacity:venue.officialCapacity,
      sourceRows:venue.rows.length,modeledSections:venue.sections.length,
      independentSurvey:false,coordinateStatus:'operator-traced/estimated'}};
  return {...output,quality:assessVenueGeometry(output)};
}
