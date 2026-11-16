// Geometry/seat/capacity audit, independent of the renderer and venue identity.
import { OptimizationEngine } from './optimization.mjs';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const ValidationEngine={
  validate({seats=[],architectureGeometry=null,spec=null,optimization=null}={}){
    const errors=[],warnings=[];
    if(!Array.isArray(seats))throw Error('Seats must be an array');
    if(!seats.length)errors.push('No seating generated');
    for(const seat of seats){
      if(![seat.x,seat.y,seat.z,seat.yaw].every(Number.isFinite)){errors.push('Nonfinite seat position');break;}
    }
    let collisions={collisionCount:0,uniqueSeats:0};
    try{collisions=OptimizationEngine.seatDiagnostics(seats);}
    catch(e){errors.push(e.message);}
    if(collisions.collisionCount){
      const samples=collisions.collisions.slice(0,3).map(([a,b])=>a+' ↔ '+b).join(' | ');
      errors.push('Seat collisions: '+collisions.collisionCount+(samples?' ('+samples+')':''));
    }
    let triangles=0;
    for(const [name,mesh] of Object.entries(architectureGeometry??{})){
      if(!(mesh instanceof Float32Array)||mesh.length%18){errors.push('Invalid mesh layer: '+name);continue;}
      for(let i=0;i<mesh.length;i+=18){
        if(!mesh.subarray(i,i+18).every(Number.isFinite)){errors.push('Nonfinite mesh: '+name);break;}
        const a=mesh.subarray(i,i+3),b=mesh.subarray(i+6,i+9),c=mesh.subarray(i+12,i+15),n=mesh.subarray(i+3,i+6);
        const ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]);
        const area=cross(ab,ac),facing=dot(area,n);
        if(!(facing>1e-9)){errors.push('Invalid triangle winding: '+name);break;}
        triangles++;
      }
    }
    const target=spec?.targetCapacity??null;
    const relativeError=target?Math.abs(seats.length-target)/target:null;
    if(target&&relativeError>(spec.capacityTolerance??.02))warnings.push('Capacity differs from reference by '+(100*relativeError).toFixed(2)+'%');
    if(optimization?.capacityWarning&&!warnings.includes(optimization.capacityWarning))warnings.push(optimization.capacityWarning);
    return {passed:errors.length===0,errors,warnings,stats:{
      seats:seats.length,uniqueSeats:collisions.uniqueSeats,collisionCount:collisions.collisionCount,
      targetCapacity:target,capacityError:relativeError,meshTriangles:triangles},
      geometryProvenance:'estimated',seatIDsVerified:false};
  }
};
export default ValidationEngine;
