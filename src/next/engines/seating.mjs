// Independent schematic seat allocator: clips real declared voids before capacity fitting.
import { GeometryEngine } from './geometry.mjs';
import { OptimizationEngine } from './optimization.mjs';
const TAU=Math.PI*2;
const hypot=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);
export const SeatingEngine={
  generate(input){
    const geometry=input?.spec&&typeof input.point==='function'?input:GeometryEngine.create(input);
    const {spec,point,voidAt,sectorAngle}=geometry;
    // A mapped chart supplies REAL section IDs and row-label ranges, while
    // the geometry engine still computes estimated coordinates. Some arenas
    // have two separated side stands: leave their real gaps uncovered.
    const mappedBanks=tier=>{
      const groups=spec.sectionMap?.[tier.index];
      if(!groups)return Array.from({length:spec.sections},(_,i)=>({
        sectionId:String(i+1),sectionIndex:i,lo:i*sectorAngle,hi:(i+1)*sectorAngle,
        rowStart:1,rowCount:tier.rows
      }));
      const banks=[];
      for(const group of groups){
        const weightSum=group.weights.reduce((sum,w)=>sum+w,0);
        let covered=0;
        for(let k=0;k<group.sectionIds.length;k++){
          const lo=group.startAngle+group.spanAngle*covered/weightSum;
          covered+=group.weights[k];
          const hi=group.startAngle+group.spanAngle*covered/weightSum;
          banks.push({
            sectionId:group.sectionIds[k],
            sectionIndex:banks.length,
            lo,hi,rowStart:group.rowStart,rowCount:group.rowCount
          });
        }
      }
      return banks;
    };
    const build=pitch=>{
      const seats=[],seatingRows=[],groups=[];
      for(const tier of spec.tiers)for(const bank of mappedBanks(tier)){
        const {sectionId,sectionIndex,lo:start,hi:end,rowStart,rowCount}=bank;
        const mapped=Boolean(spec.sectionMap);
        for(let slot=0;slot<rowCount;slot++){
          if(!mapped&&voidAt(tier.index,sectionIndex+1,slot+1))continue;
          const fraction=(slot+.5)/tier.rows;
          const rowLabel=String(rowStart+slot);
          const center=point(tier.index,(start+end)/2,fraction);
          const radius=Math.hypot(center.x,center.z);
          const margin=spec.aisleWidth/Math.max(1,radius)*.5;
          const lo=start+margin,hi=end-margin;
          if(hi<=lo)continue;
          const divisions=24;
          const coords=Array.from({length:divisions+1},
            (_,i)=>point(tier.index,lo+(hi-lo)*i/divisions,fraction));
          const stations=[0];
          for(let i=1;i<coords.length;i++)
            stations.push(stations.at(-1)+Math.hypot(coords[i].x-coords[i-1].x,
              coords[i].z-coords[i-1].z));
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
          seatingRows.push({left:first,right:last,width:length,depth:tier.depth,y:center.y,
            tier:tier.index,sectionId,row:rowLabel,slot});
          for(let i=0;i<count;i++){
            const {position}=locate((i+.5)*seatWidth);
            const number=i+1;
            seats.push({...position,yaw:Math.atan2(-position.x,-position.z),
              tier:tier.index,sectionId,sectionIndex,row:rowLabel,number,seatWidth,
              uid:'EST-'+spec.id+'-'+tier.id+'-'+sectionId+'-'+rowLabel+'-'+number});
          }
          groups.push({tier:tier.index,sectionIndex,row:rowLabel,from,count});
        }
      }
      return {seats,seatingRows,groups};
    };
    const optimized=OptimizationEngine.fitCapacity(spec.targetCapacity,build,{
      minPitch:.43,maxPitch:.9,preferredPitch:spec.seatPitch,tolerance:spec.capacityTolerance
    });
    const {seats,seatingRows,groups,pitch,relativeError,withinTolerance,capacityWarning}=optimized;
    return {geometry,spec,seats,seatingRows,groups,capacity:seats.length,
      optimization:{pitch,relativeError,withinTolerance,capacityWarning},
      seatOrigin:'generated',verifiedSeatIDs:false};
  }
};
export default SeatingEngine;
