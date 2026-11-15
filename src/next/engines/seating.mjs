// Independent schematic seat allocator: clips real declared voids before capacity fitting.
import { GeometryEngine } from './geometry.mjs';
import { OptimizationEngine } from './optimization.mjs';
const TAU=Math.PI*2;
const hypot=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);
export const SeatingEngine={
  generate(input){
    const geometry=input?.spec&&typeof input.point==='function'?input:GeometryEngine.create(input);
    const {spec,point,voidAt,sectorAngle}=geometry;
    const build=pitch=>{
      const seats=[],seatingRows=[],groups=[];
      for(const tier of spec.tiers)for(let section=1;section<=spec.sections;section++){
        const start=sectorAngle*(section-1),end=start+sectorAngle;
        for(let row=1;row<=tier.rows;row++){
          if(voidAt(tier.index,section,row))continue;
          const fraction=(row-.5)/tier.rows,center=point(tier.index,(start+end)/2,fraction);
          const radius=Math.hypot(center.x,center.z);
          const margin=spec.aisleWidth/Math.max(1,radius)*.5;
          const lo=start+margin,hi=end-margin;
          if(hi<=lo)continue;
          const divisions=24,coords=Array.from({length:divisions+1},(_,i)=>point(tier.index,lo+(hi-lo)*i/divisions,fraction));
          const stations=[0];for(let i=1;i<coords.length;i++)stations.push(stations.at(-1)+Math.hypot(coords[i].x-coords[i-1].x,coords[i].z-coords[i-1].z));
          const length=stations.at(-1),count=Math.floor(length/pitch);
          if(count<1)continue;
          const from=seats.length,seatWidth=length/count;
          const locate=distance=>{
            let k=1;while(k<stations.length-1&&stations[k]<distance)k++;
            const f=(distance-stations[k-1])/(stations[k]-stations[k-1]||1);
            const angle=lo+(hi-lo)*(k-1+f)/divisions;
            return {position:point(tier.index,angle,fraction),angle};
          };
          const first=locate(0).position,last=locate(length).position;
          seatingRows.push({left:first,right:last,width:length,depth:tier.depth,y:center.y,
            tier:tier.index,sectionId:String(section),row:String(row),slot:row-1});
          for(let i=0;i<count;i++){
            const {position,angle}=locate((i+.5)*seatWidth);
            const number=i+1;
            seats.push({...position,yaw:Math.atan2(-position.x,-position.z),tier:tier.index,
              sectionId:String(section),sectionIndex:section-1,row:String(row),number,
              seatWidth,uid:'EST-'+spec.id+'-'+tier.id+'-'+section+'-'+row+'-'+number});
          }
          groups.push({tier:tier.index,sectionIndex:section-1,row:String(row),from,count});
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
