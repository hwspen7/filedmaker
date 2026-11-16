// Capacity is a soft target. Never move authoritative imported seat coordinates.
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export const OptimizationEngine={
  fitCapacity(target,build,{minPitch=.43,maxPitch=.9,preferredPitch=.54,tolerance=.02}={}){
    if(typeof build!=='function')throw Error('A seating builder is required');
    if(target==null)return {...build(preferredPitch),pitch:preferredPitch,relativeError:null,withinTolerance:true};
    if(!Number.isInteger(target)||target<=0)throw Error('Invalid target capacity');
    const cache=new Map();
    const at=p=>{const v=Number(p.toFixed(6));if(!cache.has(v))cache.set(v,build(v));return {pitch:v,...cache.get(v)};};
    let lo=minPitch,hi=maxPitch, best=at(clamp(preferredPitch,lo,hi));
    const choose=next=>{
      if(Math.abs(next.seats.length-target)<Math.abs(best.seats.length-target)||
        (Math.abs(next.seats.length-target)===Math.abs(best.seats.length-target)
         &&Math.abs(next.pitch-preferredPitch)<Math.abs(best.pitch-preferredPitch)))best=next;
    };
    choose(at(lo));choose(at(hi));
    for(let i=0;i<19;i++){
      const mid=(lo+hi)/2,item=at(mid);choose(item);
      if(item.seats.length>target)lo=mid;else hi=mid;
    }
    const relativeError=Math.abs(best.seats.length-target)/target;
    return {...best,relativeError,withinTolerance:relativeError<=tolerance,
      capacityWarning:relativeError>tolerance?'Estimated capacity differs from target. Review geometry before publication.':null};
  },
  seatDiagnostics(seats,{minimumDistance=.30}={}){
    const seen=new Set(),collisions=[],bucket=new Map(),scale=minimumDistance;
    for(const s of seats){
      if(seen.has(s.uid))throw Error('Duplicate generated seat ID: '+s.uid);
      seen.add(s.uid);
      const bx=Math.floor(s.x/scale),bz=Math.floor(s.z/scale);
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
        const match=bucket.get((bx+dx)+','+(bz+dz)+','+s.tier)??[];
        for(const t of match)if(Math.hypot(s.x-t.x,s.z-t.z)<minimumDistance && Math.abs(s.y-t.y)<.40)
          collisions.push([s.uid,t.uid]);
      }
      const key=bx+','+bz+','+s.tier;
      if(!bucket.has(key))bucket.set(key,[]);
      bucket.get(key).push(s);
    }
    return {collisions:collisions.slice(0,25),collisionCount:collisions.length,uniqueSeats:seen.size};
  }
};
export default OptimizationEngine;
