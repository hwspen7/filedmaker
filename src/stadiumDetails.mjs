// Pure scene-planning helpers: stable, testable, no WebGL dependency.
import { SURFACES, modelPerimeterPoint, resolveTiers, resolveSectionTier } from './model.mjs';
import { OHIO_STADIUM, isOhioReference } from './venues.mjs';

const rad = degrees => degrees*Math.PI/180;
const midpoint = section => (section.start+section.end)/2;
export function aisleStairPlan(project, minSegmentLength = .4) {
  const surface = SURFACES[project.surface];
  const tiers = resolveTiers(project);
  const positions = new Set();
  for(const section of project.sections) if(section.enabled) positions.add(section.start.toFixed(3));
  for(const aisle of project.aisles||[]) positions.add(aisle.angle.toFixed(3));
  const result = [];
  for(const a of positions){
    const angle=Number(a);
    for(const tier of tiers){
      const section=project.sections.find(s=>s.enabled && angle>=s.start && angle<=s.end) ||
        project.sections.find(s=>s.enabled && midpoint(s) >= angle);
      if(!section) continue;
      const p=resolveSectionTier(tier,section.id,project);
      const width= Math.max(minSegmentLength, (project.aisles||[]).find(v=>Math.abs(v.angle-angle)<.005)?.width||project.aisleWidth);
      if(!p.rows||width<.5)continue;
      for(let row=0;row<p.rows;row++) {
        if((project.portals||[]).some(v=>v.tierId===tier.id && row+1>=v.firstRow && row+1<=v.lastRow && Math.abs(v.angle-angle)<5)) continue;
        const distance=p.startOffset+(row+.5)*p.depth;
        const coord=modelPerimeterPoint(project,surface,rad(angle),distance);
        result.push({x:coord.x,z:coord.z,y:p.startHeight+row*p.rise-.10,angle,width:Math.min(2.8,width),depth:p.depth,rise:p.rise,tierId:tier.id});
      }
    }
  }
  return result;
}

export function facadeArcPlan(project, subdivisions = 5) {
  const surface = SURFACES[project.surface];const tiers=resolveTiers(project);
  const out=[];
  for(const sec of project.sections){
    if(!sec.enabled)continue;
    const active=tiers.map(t=>resolveSectionTier(t,sec.id,project)).filter(t=>t.rows>0);
    if(!active.length) continue;
    const far=active.reduce((a,b)=>(a.startOffset+a.rows*a.depth>b.startOffset+b.rows*b.depth)?a:b);
    const offset=far.startOffset+far.rows*far.depth + 1.3;
    const height=Math.max(5,far.startHeight+far.rows*far.rise);
    for(let i=0;i<subdivisions;i++){
      const a=rad(sec.start+(sec.end-sec.start)*i/subdivisions);
      const b=rad(sec.start+(sec.end-sec.start)*(i+1)/subdivisions);
      const p=modelPerimeterPoint(project,surface,a,offset);
      const q=modelPerimeterPoint(project,surface,b,offset);
      out.push({a:p,b:q,height,sectionId:sec.id,material:'concrete',centerAngle:(a+b)/2});
    }
  }
  return out;
}

export function stadiumEnvelope(project) {
  const arcs=facadeArcPlan(project,8);
  if(!arcs.length) return {width:0,length:0,height:0};
  const xs=arcs.flatMap(v=>[v.a.x,v.b.x]);const zs=arcs.flatMap(v=>[v.a.z,v.b.z]);
  return {width:Math.max(...xs)-Math.min(...xs),length:Math.max(...zs)-Math.min(...zs),height:Math.max(...arcs.map(v=>v.height))};
}

export function stadiumProvenance(project, generatedSeats) {
  if(!isOhioReference(project))return null;
  return {
    stadium:'Ohio Stadium',
    documented:{buildingLengthM:OHIO_STADIUM.lengthM,buildingWidthM:OHIO_STADIUM.widthM,
      buildingHeightM:OHIO_STADIUM.heightM,pressBoxRoofM:OHIO_STADIUM.pressBoxRoofM,
      scoreboardWidthM:OHIO_STADIUM.scoreboardWidthM,scoreboardHeightM:OHIO_STADIUM.scoreboardHeightM,
      publishedCapacity:OHIO_STADIUM.publishedCapacity},
    generated:{...stadiumEnvelope(project),seatCount:generatedSeats},
    measurementStatus:'schematic shape and seat coordinates — no surveyed seat-level data',
  };
}
