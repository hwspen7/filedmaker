// Independent, repeatable geometry/data checks. Gates prevent publishing a
// seemingly certified result from an unverified source-derived draft.
import {assessSources} from './sources.mjs';
const positiveArea=points=>{
  let area=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    area+=a.x*b.z-a.z*b.x;
  }
  return Math.abs(area)/2;
};
const orient=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const crossing=(a,b,c,d)=>{
  const v1=orient(a,b,c),v2=orient(a,b,d),v3=orient(c,d,a),v4=orient(c,d,b);
  return v1*v2<-.000001&&v3*v4<-.000001;
};
export function inspectSectionTopology(section){
  const poly=[section.front[0],section.front.at(-1),section.back.at(-1),section.back[0]];
  return {area:positiveArea(poly),
    crossed:crossing(poly[0],poly[1],poly[2],poly[3])||
       crossing(poly[1],poly[2],poly[3],poly[0])};
}
export function assessVenueGeometry(traced){
  const {venue,seats,rowRuns}=traced;
  const issues=[],add=(severity,code,detail,section=null)=>issues.push({severity,code,detail,section});
  const declared=venue.rows.reduce((sum,row)=>sum+row.seats,0);
  if(seats.length!==declared)add('blocking','SEAT_COUNT_MISMATCH','Generated count does not equal source row counts');
  if(!venue.sections.length||!venue.rows.length)add('blocking','INCOMPLETE_SOURCE','No traced seating layout or source rows');
  if(!venue.calibration.corners.length&&venue.plan.name)
    add('review','UNREGISTERED_DRAWING','Plan image has no four-point court registration');
  if(venue.calibration.corners.length&&venue.calibration.corners.length!==4)
    add('blocking','INVALID_CALIBRATION','Four reference corners are required');
  const sourceReview=assessSources(venue);
  for(const description of sourceReview.issues)add('review','SOURCE_PROVENANCE',description);
  for(const section of venue.sections){
    const topology=inspectSectionTopology(section);
    if(topology.area<.35)
      add('blocking','COLLAPSED_SECTION','Section footprint has negligible area',section.id);
    if(topology.crossed)
      add('blocking','CROSSED_SECTION','Section footprint is self-intersecting',section.id);
  }
  for(const row of rowRuns){
    if(row.seatPitch<.43)add('review','TIGHT_PITCH',row.row+' mean spacing '+row.seatPitch.toFixed(3)+' m',row.section);
    if(row.seatPitch>1.20)add('review','WIDE_PITCH',row.row+' mean spacing '+row.seatPitch.toFixed(3)+' m',row.section);
  }
  // Spatial buckets make close-position detection linear for typical venues.
  const cells=new Map(),side=.18;
  for(const seat of seats){
    if(![seat.x,seat.y,seat.z].every(Number.isFinite)){
      add('blocking','NONFINITE_SEAT','Generated coordinate is nonfinite',seat.section);continue;
    }
    const ix=Math.floor(seat.x/side),iz=Math.floor(seat.z/side),iy=Math.floor(seat.y/.18);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++){
      for(const other of cells.get([ix+dx,iz+dz,iy+dy].join(':'))??[]){
        if(Math.hypot(seat.x-other.x,seat.y-other.y,seat.z-other.z)<.16){
          add('blocking','OVERLAPPING_SEATS',seat.id+' overlaps '+other.id,seat.section);
          if(issues.length>300)break;
        }
      }
    }
    const key=[ix,iz,iy].join(':');
    if(!cells.has(key))cells.set(key,[]);
    cells.get(key).push(seat);
    if(issues.length>300)break;
  }
  if(venue.officialCapacity!==null&&seats.length!==venue.officialCapacity)
    add('review','CAPACITY_MISMATCH','Published capacity differs from imported row count');
  add('review','UNVERIFIED_ELEVATION','Operator-estimated elevations and sightlines require site verification');
  const blocking=issues.filter(i=>i.severity==='blocking');
  return {status:blocking.length?'blocked':issues.length?'review-required':'ready-for-review',
    issues,blockingCount:blocking.length,reviewCount:issues.length-blocking.length,
    sourceReview,declaredCount:declared,modeledCount:seats.length,
    publicationEligible:false,independentlyCertified:false};
}
