// Translate a traced venue into the existing validated FiledMaker seat-first renderer.
// Imported row counts are NOT an authoritative full ticket inventory.
import {createSchoolProject} from '../schoolPipeline.mjs';
import {generateSeats,validateProject} from '../model.mjs';
import {buildVenuePlan} from '../next/venuePlan.mjs';
import {SPORT_DEFAULTS} from './contract.mjs';
import {generateTracedVenue} from './generator.mjs';
import {buildStructureInstances} from './structures.mjs';
import {buildZoneInstances} from './surface.mjs';
export function buildWorkbenchPreview(input){
  const traced=generateTracedVenue(input),v=traced.venue;
  if(!traced.seats.length)throw Error('Import rows and trace sections before generating the 3D preview');
  const project=createSchoolProject(SPORT_DEFAULTS[v.sport].profile,{
    school:v.school,venue:v.venue
  });
  project.surface=v.sport;
  project.title=v.venue;
  // Imported sections may include mezzanine and upper decks even when the
  // school's baseline profile is single-tier. Preserve tier identities so
  // T2/T3/T4 positions do not silently collapse into T1 in the WebGL model.
  const highestTier=Math.max(1,...traced.seats.map(s=>Number(s.tier.slice(1))||1));
  const existing=new Map(project.tiers.map(t=>[t.id,t]));
  project.tiers=Array.from({length:highestTier},(_,i)=>{
    const id='T'+(i+1);
    return existing.get(id)??{
      id,label:'Imported level '+(i+1),rows:1,depth:.8,rise:.3,
      offset:0,height:0,gap:0,heightGap:0,
    };
  });
  project.school={...project.school,status:'operator-review',
    seatCoordinateMethod:'plan-trace/estimated',
    notice:'Section contours traced by operator. Seat pitch and elevations are estimates, not surveyed coordinates.'};
  project.survey={...project.survey,mode:'imported',inputUnit:'m',yUnit:'m',
    source:'Operator-traced section polygons and source row counts; coordinates are estimates',
    seats:traced.seats.map(s=>({id:s.id,section:s.section,tier:s.tier,
      row:s.row,number:s.number,x:s.x,y:s.y,z:s.z}))};
  project.ticketing={officialCapacity:v.officialCapacity,
    capacitySource:v.capacitySource,capacityScope:'School-provided configuration',
    inventoryMode:'none',inventoryCount:null,coordinates:'estimated'};
  const validated=validateProject(project);
  const model=generateSeats(validated);
  // The project schema keeps its sport profile; staff-edited surface geometry
  // is passed separately to the rendering plan, never mistaken for surveyed seats.
  model.surface={...model.surface,width:v.court.width,length:v.court.length};
  if(model.seats.length!==traced.seats.length)throw Error('Renderer dropped source seats');
  // Preserve staff-specified chair versus bleacher furniture. Imported-seat
  // normalization keeps seat identities but otherwise omits row furniture;
  // without this mapping school gyms render as generic venue seat types.
  const furnitureById=new Map(traced.seats.map(seat=>[seat.id,seat.seatType]));
  for(const seat of model.seats){
    const style=furnitureById.get(seat.uid);
    if(style)seat.seatType=style;
  }
  const plan=buildVenuePlan(model,{detail:'compact',operatorSurface:v.surfaceDesign});
  // Fit the editing camera to actual staff-traced seats, not optional
  // oversized architectural or invisible reference mesh bounds.
  plan.operatorWorkspace=true;
  plan.operatorStructures=v.structures??[];
  const furniture=buildStructureInstances(plan.operatorStructures);
  // Keep a stable location for live editing in the WebGL instance buffer.
  // Moving an existing object leaves the instance count and seat data intact.
  plan.operatorStructureOffsetFloats=plan.instanceData.length;
  plan.operatorStructureLengthFloats=furniture.length;
  const painted=buildZoneInstances(v.surfaceDesign);
  const extra=furniture.length+painted.length;
  if(extra){
    const merged=new Float32Array(plan.instanceData.length+extra);
    merged.set(plan.instanceData,0);
    merged.set(furniture,plan.instanceData.length);
    merged.set(painted,plan.instanceData.length+furniture.length);
    plan.instanceData=merged;
    plan.instanceCount=merged.length/11;
  }
  plan.operatorSurface=v.surfaceDesign;
  return {...traced,project:validated,model,plan};
}
