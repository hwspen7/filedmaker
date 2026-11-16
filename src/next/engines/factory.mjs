// Public six-engine entry point. All presets below are fictional examples.
import { createProject,makeSections,generateSeats } from '../../model.mjs';
import { buildVenuePlan } from '../venuePlan.mjs';
import { GeometryEngine } from './geometry.mjs';
import { SeatingEngine } from './seating.mjs';
import { ArchitectureEngine } from './architecture.mjs';
import { OptimizationEngine } from './optimization.mjs';
import { ReferenceEngine } from './reference.mjs';
import { ValidationEngine } from './validation.mjs';
import { ExteriorEngine } from './exterior.mjs';
export { GeometryEngine,SeatingEngine,ArchitectureEngine,OptimizationEngine,ReferenceEngine,ValidationEngine,ExteriorEngine };
export const PROCEDURAL_DEMOS=Object.freeze({
  arena:{
    id:'demo-arena',name:'Example Indoor Arena',surface:'ncaa',
    exterior:{profile:'metal-and-brick',entrances:[{angle:Math.PI/4,role:'primary'},{angle:5*Math.PI/4,role:'secondary'}]},
    template:'indoor-arena',sections:20,clearance:4,roundness:4.25,
    seatPitch:.54,aisleWidth:1.2,targetCapacity:10500,capacityTolerance:.04,
    tiers:[{rows:19,depth:.83,rise:.31,gap:3.1,elevationGap:2.3},
      {rows:22,depth:.83,rise:.40,gap:0,elevationGap:0}],
    voids:[{section:3,tier:0,firstRow:1,lastRow:3,reason:'Accessible landing'}]
  },
  stadium:{
    id:'demo-stadium',name:'Example Outdoor Stadium',surface:'ncaa-football',
    template:'open-stadium',sections:24,clearance:8,roundness:4.6,
    seatPitch:.54,aisleWidth:1.45,targetCapacity:42000,capacityTolerance:.04,
    tiers:[{rows:24,depth:.87,rise:.35,gap:4.4,elevationGap:3.1},
      {rows:21,depth:.89,rise:.43,gap:0,elevationGap:0}],
    voids:[{section:12,tier:1,firstRow:19,lastRow:21,reason:'Press enclosure'}]
  }
});
export function createProceduralProject(input){
  const profile=GeometryEngine.normalize(input),project=createProject(profile.surface);
  project.title=profile.name;
  if(input.provenance?.school){
    project.school={school:input.provenance.school,venue:profile.name};
    // Published capacity belongs to metadata, NOT to an imported ticket list.
    project.ticketing={
      officialCapacity:input.provenance.publishedCapacity,
      inventoryCount:null,
      capacitySource:input.sources?.[0]?.url??null,
      capacityScope:'men-basketball',
      inventoryMode:'none',
      coordinates:'estimated'
    };
  }
  project.roof=profile.template==='indoor-arena';
  project.seatPitch=profile.seatPitch;
  project.aisleWidth=profile.aisleWidth;
  project.sections=makeSections(profile.sections);
  project.tiers=profile.tiers.map((tier,i)=>({
    id:tier.id,label:'Generated level '+(i+1),rows:tier.rows,depth:tier.depth,rise:tier.rise,
    offset:tier.frontRadiusOffset,height:tier.baseY,gap:tier.gap,heightGap:tier.elevationGap
  }));
  project.proceduralVenue=structuredClone(input);
  project.survey.venue=profile.name;
  project.survey.source='Parametric demonstration. No verified inventory or measured architecture.';
  return project;
}
export function generateVenuePackage(input,options={}){
  const project=createProceduralProject(input);
  const model=generateSeats(project);
  const plan=buildVenuePlan(model,options);
  const reference=ReferenceEngine.pack({
    venueId:model.proceduralSpec.id,level:'estimated',
    sources:input.sources??[],facts:{surface:model.surface.sport,
      requestedCapacity:model.proceduralSpec.targetCapacity}
  });
  const audit=plan.engineAudit??ValidationEngine.validate({
    seats:model.seats,architectureGeometry:plan.architectureGeometry,spec:model.proceduralSpec,
    optimization:model.optimization
  });
  return {project,model,plan,reference,audit};
}
