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
  const plan=buildVenuePlan(model,{detail:'compact',operatorSurface:v.surfaceDesign});
  // Fit the editing camera to actual staff-traced seats, not optional
  // oversized architectural or invisible reference mesh bounds.
  plan.operatorWorkspace=true;
  plan.operatorStructures=v.structures??[];
  const furniture=buildStructureInstances(plan.operatorStructures);
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
