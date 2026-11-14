// Photo-to-view registration using field landmarks, a fixed seat eye point and a pinhole camera.
// This estimates camera orientation and FOV, never the seat's original surveyed 3D position.
import { viewpoint } from './view.mjs';
export function fieldLandmarks(surface) {
  const x=surface.width/2,z=surface.length/2,y=0.12;
  return [
    {id:'nw',name:'Far-left field corner',x:-x,y,z:-z},
    {id:'ne',name:'Far-right field corner',x:x,y,z:-z},
    {id:'sw',name:'Near-left field corner',x:-x,y,z:z},
    {id:'se',name:'Near-right field corner',x:x,y,z:z},
    {id:'center',name:'Field center',x:0,y,z:0},
    {id:'w-mid',name:'Left sideline midpoint',x:-x,y,z:0},
    {id:'e-mid',name:'Right sideline midpoint',x:x,y,z:0},
    {id:'n-mid',name:'Far endline midpoint',x:0,y,z:-z},
    {id:'s-mid',name:'Near endline midpoint',x:0,y,z:z},
  ];
}

export function photoProject(eye,direction,fov,aspect,point) {
  const len=Math.hypot(direction.x,direction.y,direction.z);
  if(!len || !Number.isFinite(fov) || fov<=0 || fov>=180 || aspect<=0) return null;
  const f={x:direction.x/len,y:direction.y/len,z:direction.z/len};
  const az=Math.atan2(f.x,f.z), el=Math.asin(Math.max(-1,Math.min(1,f.y)));
  const right={x:Math.cos(az),y:0,z:-Math.sin(az)};
  const up={x:-Math.sin(az)*Math.sin(el),y:Math.cos(el),z:-Math.cos(az)*Math.sin(el)};
  const v={x:point.x-eye.x,y:point.y-eye.y,z:point.z-eye.z};
  const forward=v.x*f.x+v.y*f.y+v.z*f.z;
  if(forward<=0.0001)return null;
  const horizontal=v.x*right.x+v.z*right.z;
  const vertical=v.x*up.x+v.y*up.y+v.z*up.z;
  const t=Math.tan(fov*Math.PI/360);
  return {x:0.5+horizontal/(2*forward*t*aspect),y:0.5-vertical/(2*forward*t)};
}

export function photoResidual(points,seat,surface,params,aspect,posture='seated',target='center') {
  const landmarks=fieldLandmarks(surface);
  const opts={optic:'phone',posture,target,yaw:params.yaw,pitch:params.pitch,zoom:67/params.fov};
  const v=viewpoint(seat,surface,opts);
  let sum=0,max=0;
  for(const item of points){
    const field=landmarks.find(p=>p.id===item.id);
    if(!field||item.x<0||item.x>1||item.y<0||item.y>1||!Number.isFinite(item.x)||!Number.isFinite(item.y)) throw new Error('Photo landmark is invalid.');
    const projected=photoProject(v.origin,v.direction,params.fov,aspect,field);
    if(!projected)return {meanSquare:1e5,max:Infinity};
    const dx=(projected.x-item.x)*aspect,dy=projected.y-item.y;
    const d=dx*dx+dy*dy;sum+=d;max=Math.max(max,Math.sqrt(d));
  }
  return {meanSquare:sum/points.length,max};
}

export function fitPhotoView({points,width,height,seat,surface,posture='seated',target='center',initial={yaw:0,pitch:0,fov:67}}) {
  if(!Array.isArray(points)||points.length<3||points.length>12)throw new Error('Mark at least 3 and at most 12 distinct field landmarks in the photograph.');
  if(new Set(points.map(p=>p.id)).size!==points.length)throw new Error('Duplicate photographed landmark.');
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<100||height<100||width>20000||height>20000)throw new Error('Invalid reference photo dimensions.');
  if(!seat||!surface)throw new Error('Choose a seat and playing surface first.');
  const aspect=width/height;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const bounds={yaw:[-175,175],pitch:[-75,75],fov:[11,100]};
  let best={yaw:clamp(initial.yaw??0,...bounds.yaw),pitch:clamp(initial.pitch??0,...bounds.pitch),fov:clamp(initial.fov??67,...bounds.fov)};
  let error=photoResidual(points,seat,surface,best,aspect,posture,target).meanSquare;
  // Bounded multi-resolution search. For the fixed seat, field geometry and selected correspondences,
  // only camera orientation and field-of-view are adjusted.
  for(let restart=0;restart<2;restart++){
    let current=restart?{yaw:0,pitch:0,fov:67}:best;
    let e=photoResidual(points,seat,surface,current,aspect,posture,target).meanSquare;
    const steps={yaw:restart?40:24,pitch:restart?26:16,fov:restart?28:18};
    for(let scale=0;scale<11;scale++){
      for(let loop=0;loop<6;loop++){
        let improvement=false;
        for(const key of ['yaw','pitch','fov'])for(const sign of [-1,1]){
          const trial={...current,[key]:clamp(current[key]+steps[key]*sign,...bounds[key])};
          const score=photoResidual(points,seat,surface,trial,aspect,posture,target).meanSquare;
          if(score+1e-14<e){current=trial;e=score;improvement=true;}
        }
        if(!improvement)break;
      }
      for(const key of Object.keys(steps))steps[key]/=2;
    }
    if(e<error){best=current;error=e;}
  }
  const rms=Math.sqrt(error)*height;
  const report=photoResidual(points,seat,surface,best,aspect,posture,target);
  return {yaw:best.yaw,pitch:best.pitch,fov:best.fov,zoom:67/best.fov,rmsPx:rms,maxErrorPx:report.max*height,marks:points.length,
    status:points.length>=4?'camera-angle estimate, not a positional survey':'minimally constrained camera estimate'};
}
