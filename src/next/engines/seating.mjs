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
  const chartMultiplicity=new Map();
  for(const tier of spec.sectionMap??[])for(const group of tier)
    for(const id of group.sectionIds)
      chartMultiplicity.set(id,(chartMultiplicity.get(id)??0)+1);
  for(const row of seatingRows){
    // One official section may span multiple modeled row-depth bands
    // (for example Iowa A–NN and Maryland 101–126). Display the same
    // ticket section only once, without duplicating its polygon label.
    const key=chartMultiplicity.get(row.sectionId)>1
      ?row.sectionId:row.tier+':'+row.sectionId;
    if(!sections.has(key))sections.set(key,{id:row.sectionId,
      tier:row.tier,outlines:[],labelPoint:null,_sumX:0,_sumZ:0,_count:0,
      depthRows:spec.tiers[row.tier].rows});
    const section=sections.get(key);
    const tier=spec.tiers[row.tier],u=row.slot/tier.rows,
      v=(row.slot+1)/tier.rows;
    if(row.courtPatch){
      section.outlines.push(row.courtPatch);
      section._sumX+=(row.left.x+row.right.x)/2;
      section._sumZ+=(row.left.z+row.right.z)/2;
      section._count++;
      continue;
    }
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
            const physicalSlot=slot+(bank.physicalSlotStart??0);
            const fraction=(physicalSlot+.5)/tier.rows;
            const rowLabel=bank.rowLabels?.[slot]??String(rowStart+slot);
            let seatNumber=0;
            for(const [lo,hi] of rowIntervals(tier,bank,slot)){
              const divisions=24;
              const coords=Array.from({length:divisions+1},
                (_,i)=>point(tier.index,lo+(hi-lo)*i/divisions,fraction));
              const stations=[0];
              for(let i=1;i<coords.length;i++)
                stations.push(stations.at(-1)+hypot(coords[i],coords[i-1]));
              const length=stations.at(-1);
              // A capacity-fitting pitch must not erase a legitimate narrow
              // row that can still physically fit one minimum-pitch seat.
              // This preserves occupied chart banks during optimisation.
              const count=Math.max(Math.floor(length/pitch),length>=.43?1:0);
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
                y:center.y,tier:tier.index,sectionId,row:rowLabel,slot:physicalSlot,lo,hi});
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
      const floor=spec.interior?.courtside;
      if(floor){
        const blocks=floor.blocks,total=blocks.length;
        const half=spec.field.length*.475,segment=half*2/total;
        const sign=floor.side==='east'?1:-1;
        const start=sign*(spec.field.width/2+floor.margin);
        const spread=segment*.94;
        const depth=floor.seatDepth;
        blocks.forEach((block,index)=>{
          const zHigh=half-index*segment-(segment-spread)/2;
          const zLow=zHigh-spread;
          block.rows.forEach((label,slot)=>{
            const x=sign*(Math.abs(start)+(slot+.5)*depth);
            const y=floor.frontHeight+slot*floor.rowRise;
            const count=Math.max(1,Math.floor(spread/pitch));
            const first=seats.length;
            const center={x,y,z:(zLow+zHigh)/2};
            const innerX=sign*(Math.abs(start)+slot*depth);
            const outerX=sign*(Math.abs(start)+(slot+1)*depth);
            const courtPatch=[
              {x:innerX,y:y-.20,z:zLow},{x:innerX,y:y-.20,z:zHigh},
              {x:outerX,y:y-.20,z:zHigh},{x:outerX,y:y-.20,z:zLow}
            ];
            seatingRows.push({left:{x,y,z:zLow},right:{x,y,z:zHigh},
              width:spread,depth,y,tier:0,sectionId:block.id,row:label,slot,
              courtPatch});
            for(let n=0;n<count;n++){
              const z=zLow+(n+.5)*spread/count;
              const position={x,y,z};
              seats.push({...position,yaw:Math.atan2(-x,-z),tier:0,
                sectionId:block.id,sectionIndex:spec.sections+index,row:label,
                number:n+1,seatWidth:spread/count,seatType:'chair',
                uid:'EST-'+spec.id+'-COURT-'+block.id+'-'+label+'-'+(n+1)});
            }
            groups.push({tier:0,sectionIndex:spec.sections+index,
              row:label,from:first,count});
          });
        });
      }
      return {seats,seatingRows,groups};
    };
    const optimized=OptimizationEngine.fitCapacity(spec.targetCapacity,build,{
      minPitch:.43,maxPitch:.9,preferredPitch:spec.seatPitch,tolerance:spec.capacityTolerance
    });
    const {seats,seatingRows,groups,pitch,relativeError,withinTolerance,capacityWarning}=optimized;
    const renderedSections=new Set(seats.map(s=>s.tier+':'+s.sectionId));
    const expectedSections=new Set();
    const eligibleRowKeys=new Set(),actualRowKeys=new Set();
    for(const tier of spec.tiers)for(const bank of banksForTier(tier)){
      expectedSections.add(tier.index+':'+bank.sectionId);
      for(let slot=0;slot<bank.rowCount;slot++){
        if(rowIntervals(tier,bank,slot).some(([lo,hi])=>{
          const mid=(lo+hi)/2;
          const f=(slot+(bank.physicalSlotStart??0)+.5)/tier.rows;
          const pointMid=point(tier.index,mid,f);
          return (hi-lo)*Math.hypot(pointMid.x,pointMid.z)>=.43;
        }))eligibleRowKeys.add(tier.index+':'+bank.sectionId+':'+
          (slot+(bank.physicalSlotStart??0)));
      }
    }
    for(const block of spec.interior?.courtside?.blocks??[]){
      expectedSections.add('0:'+block.id);
      for(let slot=0;slot<block.rows.length;slot++)
        eligibleRowKeys.add('0:'+block.id+':'+slot);
    }
    for(const row of seatingRows)actualRowKeys.add(row.tier+':'+row.sectionId+':'+row.slot);
    const omittedEligibleRows=[...eligibleRowKeys].filter(key=>!actualRowKeys.has(key));
    const missingSections=[...expectedSections].filter(key=>!renderedSections.has(key));
    const coverage={documentedSectionCount:expectedSections.size,
      occupiedSectionCount:renderedSections.size,
      eligibleRowCount:eligibleRowKeys.size,renderedRowCount:actualRowKeys.size,
      omittedEligibleRows,missingSections,
      completeness:omittedEligibleRows.length===0&&missingSections.length===0};
    return {geometry,spec,seats,seatingRows,groups,capacity:seats.length,
      interiorSectionFootprints:interiorSectionFootprints(geometry,seatingRows),
      optimization:{pitch,relativeError,withinTolerance,capacityWarning},
      coverage,
      seatOrigin:'generated',verifiedSeatIDs:false};
  }
};
export default SeatingEngine;
