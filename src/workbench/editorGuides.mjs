// Pure, deterministic grid and inference-guide helpers for plan and 3D tools.
// These calculations never alter any real or synthetic venue source data.
export const GRID_STEPS=Object.freeze([.1,.25,.5,1,2,5,10]);
const finite=(n)=>Number.isFinite(Number(n));
const rounded=n=>Math.round(n*10000)/10000;
export function quantize(value,step){
  if(!finite(value)||!finite(step)||Number(step)<=0)
    throw Error('A finite position and positive grid spacing are required');
  return rounded(Math.round(Number(value)/Number(step))*Number(step));
}
export function objectGuideTargets(structures=[],sections=[],surface=null,excluded=[]){
  const ignored=new Set(excluded),targets=[];
  for(const s of structures){
    if(ignored.has(s.id))continue;
    const a=(s.yaw??0)*Math.PI/180;
    const hx=(Math.abs(Math.cos(a))*s.width+Math.abs(Math.sin(a))*s.depth)/2;
    const hz=(Math.abs(Math.sin(a))*s.width+Math.abs(Math.cos(a))*s.depth)/2;
    for(const [axis,values] of [['x',[s.x,s.x-hx,s.x+hx]],
      ['z',[s.z,s.z-hz,s.z+hz]]])
      for(const value of values)targets.push({axis,value,
        source:s.id,label:s.label||s.id});
  }
  for(const s of sections){
    for(const p of [...(s.front??[]),...(s.back??[])])
      for(const axis of ['x','z'])targets.push({axis,value:p[axis],
        source:s.id,label:'Section '+s.id});
  }
  if(surface){
    targets.push({axis:'x',value:surface.centerX??0,
      source:'court',label:'Court center'});
    targets.push({axis:'z',value:surface.centerZ??0,
      source:'court',label:'Court center'});
  }
  return targets.filter(t=>Number.isFinite(t.value));
}
export function snapPosition(point,{grid=1,gridEnabled=true,magnetEnabled=true,
  tolerance=.25,targets=[]}={}){
  if(!finite(point.x)||!finite(point.z))throw Error('Cannot snap invalid coordinates');
  if(!GRID_STEPS.includes(Number(grid)))throw Error('Unsupported grid step');
  if(!finite(tolerance)||Number(tolerance)<0||Number(tolerance)>10)
    throw Error('Snap tolerance must be between zero and ten metres');
  const result={x:Number(point.x),z:Number(point.z),guides:[]};
  for(const axis of ['x','z']){
    const n=Number(point[axis]);
    let best=gridEnabled?{value:quantize(n,grid),source:'grid',
      label:'Grid '+grid+' m',distance:Math.abs(n-quantize(n,grid))}:null;
    if(magnetEnabled){
      for(const target of targets){
        if(target.axis!==axis)continue;
        const dist=Math.abs(target.value-n);
        if(dist<=tolerance&&(!best||dist<=best.distance+1e-9))
          best={...target,distance:dist};
      }
    }
    if(best){
      result[axis]=rounded(best.value);
      if(best.source!=='grid')result.guides.push({axis,value:best.value,
        source:best.source,label:best.label,distance:rounded(best.distance)});
    }
  }
  return result;
}
export function measuredOffset(from,to){
  const dx=to.x-from.x,dz=to.z-from.z;
  return {dx:rounded(dx),dz:rounded(dz),
    length:rounded(Math.hypot(dx,dz)),
    angle:rounded(Math.atan2(dz,dx)*180/Math.PI)};
}
