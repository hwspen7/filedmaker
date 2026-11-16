// Section-contour seat allocator shared by Big Ten previews and custom venues.
// All sectional intervals use GeometryEngine so seats and decks share voids.
import { GeometryEngine } from './geometry.mjs';
import { OptimizationEngine } from './optimization.mjs';
const hypot=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);
const seatMaterial=(spec,tier,id,row)=>{
  let material='chair';
  for(const rule of spec.interior?.seatTypes??[]){
    if(rule.tier===tier&&row>=rule.fromRow&&row<=rule.toRow&&
      (!rule.sections||rule.sections.includes(id)))material=rule.kind;
  }
  return material;
};
function interiorSectionFootprints(geometry,seatingRows){
  if(!geometry.spec.interior)return null;
  const {spec,point}=geometry,sections=new Map();
  for(const row of seatingRows){
    const key=row.tier+':'+row.sectionId;
    if(!sections.has(key))sections.set(key,{id:row.sectionId,
      tier:row.tier,outlines:[],labelPoint:null,_sumX:0,_sumZ:0,_count:0,
      depthRows:spec.tiers[row.tier].rows});
    const section=sections.get(key);
    const tier=spec.tiers[row.tier],u=row.slot/tier.rows,
      v=(row.slot+1)/tier.rows;
    // Curved banks are tessellated into narrow quadrilateral patches to
    // preserve their true per-row outline and entrance-notch boundaries.
    const divisions=3;
    const points=[];
    for(let i=0;i<=divisions;i++)
      points.push(point(row.tier,row.lo+(row.hi-row.lo)*i/divisions,u));
    for(let i=divisions;i>=0;i--)
      points.push(point(row.tier,row.lo+(row.hi-row.lo)*i/divisions,v));
    section.outlines.push(points);
    if(row.slot>=Math.floor(tier.rows*.36)&&row.slot<=Math.ceil(tier.rows*.60)){
      const mid=point(row.tier,(row.lo+row.hi)/2,(row.slot+.5)/tier.rows);
      section._sumX+=mid.x;section._sumZ+=mid.z;section._count++;
    }
  }
  return [...sections.values()].map(section=>{
    const { _sumX,_sumZ,_count,...result}=section;
    const mid=result.outlines[Math.floor(result.outlines.length*.48)]?.[0];
    result.labelPoint=_count?{x:_sumX/_count,y:0,z:_sumZ/_count}:mid;
    return result;
  });
}
export const SeatingEngine={
  generate(input){
    const geometry=input?.spec&&typeof input.point==='function'?input:GeometryEngine.create(input);
    const {spec,point,voidAt,banksForTier,rowIntervals}=geometry;
    const build=pitch=>{
      const seats=[],seatingRows=[],groups=[];
      for(const tier of spec.tiers){
        for(const bank of banksForTier(tier)){
          const {sectionId,sectionIndex,rowStart,rowCount}=bank;
          const mapped=Boolean(spec.sectionMap);
          for(let slot=0;slot<rowCount;slot++){
            if(!mapped&&voidAt(tier.index,sectionIndex+1,slot+1))continue;
            const fraction=(slot+.5)/tier.rows,rowLabel=String(rowStart+slot);
            let seatNumber=0;
            for(const [lo,hi] of rowIntervals(tier,bank,slot)){
              const divisions=24;
              const coords=Array.from({length:divisions+1},
                (_,i)=>point(tier.index,lo+(hi-lo)*i/divisions,fraction));
              const stations=[0];
              for(let i=1;i<coords.length;i++)
                stations.push(stations.at(-1)+hypot(coords[i],coords[i-1]));
              const length=stations.at(-1),count=Math.floor(length/pitch);
              if(count<1)continue;
              const from=seats.length,seatWidth=length/count;
              const locate=distance=>{
                let k=1;
                while(k<stations.length-1&&stations[k]<distance)k++;
                const f=(distance-stations[k-1])/(stations[k]-stations[k-1]||1);
                const angle=lo+(hi-lo)*(k-1+f)/divisions;
                return {position:point(tier.index,angle,fraction),angle};
              };
              const first=locate(0).position,last=locate(length).position;
              const center=point(tier.index,(lo+hi)/2,fraction);
              seatingRows.push({left:first,right:last,width:length,depth:tier.depth,
                y:center.y,tier:tier.index,sectionId,row:rowLabel,slot,lo,hi});
              for(let i=0;i<count;i++){
                const {position}=locate((i+.5)*seatWidth),number=++seatNumber;
                seats.push({...position,yaw:Math.atan2(-position.x,-position.z),
                  tier:tier.index,sectionId,sectionIndex,row:rowLabel,number,
                  seatWidth,seatType:seatMaterial(spec,tier.index,sectionId,rowStart+slot),
                  uid:'EST-'+spec.id+'-'+tier.id+'-'+sectionId+'-'+rowLabel+'-'+number});
              }
              groups.push({tier:tier.index,sectionIndex,row:rowLabel,from,count});
            }
          }
        }
      }
      return {seats,seatingRows,groups};
    };
    const optimized=OptimizationEngine.fitCapacity(spec.targetCapacity,build,{
      minPitch:.43,maxPitch:.9,preferredPitch:spec.seatPitch,tolerance:spec.capacityTolerance
    });
    const {seats,seatingRows,groups,pitch,relativeError,withinTolerance,capacityWarning}=optimized;
    return {geometry,spec,seats,seatingRows,groups,capacity:seats.length,
      interiorSectionFootprints:interiorSectionFootprints(geometry,seatingRows),
      optimization:{pitch,relativeError,withinTolerance,capacityWarning},
      seatOrigin:'generated',verifiedSeatIDs:false};
  }
};
export default SeatingEngine;
