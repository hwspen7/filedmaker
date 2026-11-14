// Arena-specific evidence and non-survey 3D reconstruction assumptions.
// Do not claim the resulting row heights or seat coordinates are real.
import {createProject,makeSections,validateProject} from './model.mjs';
import {getNBAArena,NBA_CATALOG} from './nbaCatalog.mjs';

const official = (url,claim)=>({url,claim,quality:'official-public'});
export const NBA_REFERENCE_PACK = Object.freeze({
 knicks:{shape:4.6,seatColor:'#31405d',seatPitch:.54, tiers:[
  ['100-level lower bowl',21,.83,.34,3.6,1.05,2.0,2.2],
  ['200-level seating',18,.82,.39,0,0,3.0,3.4],
  ['300-level / bridge representation',9,.85,.37,0,0,2.3,2.6],
  ['400-level upper representation',10,.78,.45,0,0,0,0]],
  feature:'bridge',facts:['100s and 200s seats','300s/Hyundai Bridge','400s seating'],
  sources:[official('https://www.msg.com/madison-square-garden/seating/msg-knicks','Public seat-map lists 100s, 200s, 300s/Hyundai Bridge and 400s.')]},
 warriors:{shape:4.0,seatColor:'#26466a',seatPitch:.55,tiers:[
  ['100-level / lower bowl',23,.85,.35,3.8,.95,3.5,3.3],
  ['200-level / upper bowl',27,.82,.44,0,0,0,0]],feature:'compact',
  facts:['100-level seating','200-level seating','Premium club areas'],
  sources:[official('https://www.nba.com/warriors/tickets/season','Warriors publish interactive Chase Center 3D seat map.'),official('https://www.nba.com/news/all-30-nba-arenas-by-team','Chase Center is the home of the Golden State Warriors.')]},
 lakers:{shape:4.3,seatColor:'#565064',seatPitch:.55,tiers:[
  ['100-level / lower bowl',22,.85,.33,4.0,.95,2.1,2.8],
  ['200-level / premier',12,.86,.36,0,0,2.3,3.0],
  ['Suites / club interpretation',6,.89,.34,0,0,2.8,3.7],
  ['300-level upper bowl',23,.83,.45,0,0,0,0]],feature:'suites',
  facts:['Five concourses including three private','Suite levels A, B and C','Main 100/200 seating and upper 300 seating'],
  sources:[official('https://www.cryptoarena.com/arena-information/a-z-guide','Arena publishes event/main/suite A, B, C/upper concourse levels.'),official('https://www.cryptoarena.com/arena-info/vital-stats','Arena publishes premium and suite counts.')]},
 bulls:{shape:4.4,seatColor:'#a23643',seatPitch:.55,tiers:[
  ['100-level lower bowl',24,.84,.35,3.9,1.15,2.3,3.0],
  ['200-level club ring',10,.86,.37,0,0,2.7,3.5],
  ['300-level upper bowl',29,.83,.45,0,0,0,0]],feature:'classic',
  facts:['100-level lower seating','200-level club seating','300-level upper seating'],
  sources:[official('https://www.unitedcenter.com','United Center is home of Chicago Bulls.'),official('https://www.nba.com/news/all-30-nba-arenas-by-team','NBA identifies United Center as Bulls home and publishes capacity.')]},
 clippers:{shape:3.8,seatColor:'#34434e',seatPitch:.59,tiers:[
  ['Lower bowl',23,.88,.36,3.7,.95,2.7,3.0],
  ['Terrace',24,.88,.45,0,0,1.4,1.6],
  ['Upper bowl',15,.88,.47,0,0,0,0]],feature:'halo-wall',
  facts:['The Wall has 51 uninterrupted rows','Double-sided Halo Board','Terrace concourse and premium seating'],
  sources:[official('https://intuitdome.com/press','Intuit Dome describes 51-row Wall, Halo Board and terrace level.'),official('https://www.intuitdome.com/events/seating-charts','Official Clippers basketball seating chart.')]},
});

export function createNBAArenaProject(id){
 const meta=getNBAArena(id);
 if(!meta)throw new Error(`Unknown NBA arena: ${id}`);
 const ref=NBA_REFERENCE_PACK[id];
 const p=createProject('nba');
 p.title=`${meta.arena} — ${ref?'documented features':'identity-only draft'}`;
 p.city=meta.city;p.country=meta.country==='CA'?'Canada':'United States';
 p.roof=true;p.detailLevel='high';p.showFixtures=true;
 p.venueReference={id:`nba:${id}`,dataLevel:ref?'official-identified-features/estimated-seating':'official-venue-identity-only',
  seatNumbering:'synthetic',measurementNotice:'Modeled sections, rows, elevations and sightlines are illustrative until venue drawings or seat survey are imported.'};
 if(ref){
  p.shape=ref.shape;p.seatPitch=ref.seatPitch;
  p.sections=makeSections(20).map((s,index)=>({...s,color:index%5===0?'#586a78':ref.seatColor}));
  p.tiers=ref.tiers.map(([label,rows,depth,rise,offset,height,gap,heightGap],index)=>({id:`T${index+1}`,label,rows,depth,rise,offset,height,gap,heightGap}));
  p.aisles=Array.from({length:12},(_,i)=>({id:`arena-aisle-${i+1}`,angle:360*(i+.5)/12,width:1.08,tier:'all'}));
  if(ref.feature==='halo-wall'){
   // This is deliberately a visual sector, not claimed ticket-section geometry.
   // Integrate the real, documented 51-row uninterrupted wall as one illustrative tier profile.
   const sec=p.sections.filter(s=>s.start>=135&&s.end<=225);
   for(const section of sec){
     p.sectionProfiles.push({sectionId:section.id,tierId:'T1',rows:51,
       frontShift:0,heightShift:0,rise:.30,depth:.82});
     p.sectionProfiles.push({sectionId:section.id,tierId:'T2',rows:0,
       frontShift:0,heightShift:0,rise:.45,depth:.88});
     p.sectionProfiles.push({sectionId:section.id,tierId:'T3',rows:0,
       frontShift:0,heightShift:0,rise:.47,depth:.88});
   }
  }
 }
 p.survey.venue=meta.arena;
 p.survey.source=ref ? `Official public venue features; all seat geometry inferred: ${ref.sources.map(s=>s.url).join(', ')}` : `NBA 2026-27 directory; no venue geometry data: ${meta.identitySource}`;
 p.survey.sourceUrl=ref?.sources[0]?.url||meta.identitySource;
 p.survey.mode='generated';
 return validateProject(p);
}
export function nbaArenaReport(id,seatCount=0){
 const arena=getNBAArena(id);if(!arena)throw new Error('Unknown NBA arena');
 const reference=NBA_REFERENCE_PACK[id]||null;
 return {
  name:arena.arena,team:arena.team,season:arena.season,
  modelStatus:arena.modelStatus,measuredSeatCoordinates:0,generatedSeatCount:seatCount,
  claims:reference?.facts||[],sources:reference?.sources||[official(arena.identitySource,'Verified venue identity')],
  limitations:['Actual structural footprint, section polygons, elevations, row counts and ticket seat mapping are not provided by these sources.',
   'Simulated seat counts are NOT official attendance capacities.',
   'No location-specific view is validated until measured drawings and photo controls have been supplied.'],
 };
}
export {NBA_CATALOG};
