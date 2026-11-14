// Pure scene-planning helpers; independent of WebGL.
import { SURFACES, modelPerimeterPoint, resolveTiers, resolveSectionTier } from './model.mjs';
import { OHIO_STADIUM, isOhioReference } from './venues.mjs';
const rad=d=>d*Math.PI/180;
export function aisleStairPlan(project,minSegmentLength=.4){
 const surface=SURFACES[project.surface],tiers=resolveTiers(project),angles=new Set();
 for(const s of project.sections)if(s.enabled)angles.add(s.start.toFixed(3));
 for(const a of project.aisles||[])angles.add(a.angle.toFixed(3));
 const result=[];
 for(const angleText of angles){
  const angle=Number(angleText);
  for(const tier of tiers){
   const sec=project.sections.find(s=>s.enabled&&angle>=s.start&&angle<=s.end)||project.sections.find(s=>s.enabled);
   if(!sec)continue;const p=resolveSectionTier(tier,sec.id,project);
   const width=Math.max(minSegmentLength,(project.aisles||[]).find(a=>Math.abs(a.angle-angle)<.005)?.width||project.aisleWidth);
   if(!p.rows||width<.5)continue;
   for(let row=0;row<p.rows;row++){
    if((project.portals||[]).some(v=>v.tierId===tier.id&&row+1>=v.firstRow&&row+1<=v.lastRow&&Math.abs(v.angle-angle)<5))continue;
    const distance=p.startOffset+(row+.5)*p.depth,point=modelPerimeterPoint(project,surface,rad(angle),distance);
    result.push({x:point.x,z:point.z,y:p.startHeight+row*p.rise-.10,angle,width:Math.min(2.8,width),depth:p.depth,rise:p.rise,tierId:tier.id});
   }
  }
 }
 return result;
}
export function facadeArcPlan(project,subdivisions=5){
 const surface=SURFACES[project.surface],tiers=resolveTiers(project),out=[];
 for(const sec of project.sections){
  if(!sec.enabled)continue;
  const active=tiers.map(t=>resolveSectionTier(t,sec.id,project)).filter(t=>t.rows>0);
  if(!active.length)continue;
  const far=active.reduce((a,b)=>a.startOffset+a.rows*a.depth>b.startOffset+b.rows*b.depth?a:b);
  const offset=far.startOffset+far.rows*far.depth+1.3,height=Math.max(5,far.startHeight+far.rows*far.rise);
  for(let i=0;i<subdivisions;i++){
   const a=rad(sec.start+(sec.end-sec.start)*i/subdivisions),b=rad(sec.start+(sec.end-sec.start)*(i+1)/subdivisions);
   out.push({a:modelPerimeterPoint(project,surface,a,offset),b:modelPerimeterPoint(project,surface,b,offset),height,sectionId:sec.id,centerAngle:(a+b)/2});
  }
 }
 return out;
}
export function stadiumEnvelope(project){
 const arcs=facadeArcPlan(project,8);
 if(!arcs.length)return{width:0,length:0,height:0};
 const xs=arcs.flatMap(v=>[v.a.x,v.b.x]),zs=arcs.flatMap(v=>[v.a.z,v.b.z]);
 return{width:Math.max(...xs)-Math.min(...xs),length:Math.max(...zs)-Math.min(...zs),height:Math.max(...arcs.map(v=>v.height))};
}
export function stadiumProvenance(project,generatedSeats){
 if(!isOhioReference(project))return null;
 return{stadium:'Ohio Stadium',documented:{buildingLengthM:OHIO_STADIUM.lengthM,buildingWidthM:OHIO_STADIUM.widthM,buildingHeightM:OHIO_STADIUM.heightM,pressBoxRoofM:OHIO_STADIUM.pressBoxRoofM,scoreboardWidthM:OHIO_STADIUM.scoreboardWidthM,scoreboardHeightM:OHIO_STADIUM.scoreboardHeightM,publishedCapacity:OHIO_STADIUM.publishedCapacity},generated:{...stadiumEnvelope(project),seatCount:generatedSeats},measurementStatus:'schematic shape and seat coordinates — no surveyed seat-level data'};
}
