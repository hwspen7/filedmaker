// Four-point planar registration for a top-down, operator-supplied court diagram.
// This is a drawing alignment, not an architectural survey or a verified elevation.
function solve(matrix,vector){
  const n=vector.length,a=matrix.map((r,i)=>[...r,vector[i]]);
  for(let k=0;k<n;k++){
    let pivot=k;
    for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[pivot][k]))pivot=i;
    if(Math.abs(a[pivot][k])<1e-9)throw Error('Court calibration is degenerate. Choose four distinct corners.');
    [a[k],a[pivot]]=[a[pivot],a[k]];
    const div=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=div;
    for(let i=0;i<n;i++)if(i!==k){
      const m=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=m*a[k][j];
    }
  }
  return a.map(row=>row[n]);
}
const apply=(h,p)=>{
  const d=h[6]*p.x+h[7]*p.y+1;
  if(Math.abs(d)<1e-10)throw Error('Point is beyond the calibrated drawing plane');
  return {x:(h[0]*p.x+h[1]*p.y+h[2])/d,
    z:(h[3]*p.x+h[4]*p.y+h[5])/d};
};
function fit(src,dst){
  const a=[],b=[];
  for(let i=0;i<4;i++){
    const s=src[i],t=dst[i];
    a.push([s.x,s.y,1,0,0,0,-t.x*s.x,-t.x*s.y]);b.push(t.x);
    a.push([0,0,0,s.x,s.y,1,-t.z*s.x,-t.z*s.y]);b.push(t.z);
  }
  return solve(a,b);
}
export function registerCourt(corners,width,length){
  if(!Array.isArray(corners)||corners.length!==4)throw Error('Select all four playing-surface corners');
  if(!(Number.isFinite(width)&&width>0&&Number.isFinite(length)&&length>0))
    throw Error('Playing surface dimensions must be positive');
  for(const p of corners)if(!Number.isFinite(p.x)||!Number.isFinite(p.y))
    throw Error('Calibration points must be finite');
  // Ordered near-left, near-right, far-right, far-left on the source diagram.
  const target=[{x:-width/2,z:-length/2},{x:width/2,z:-length/2},
    {x:width/2,z:length/2},{x:-width/2,z:length/2}];
  const forward=fit(corners,target);
  const reverse=fit(target.map(p=>({x:p.x,y:p.z})),corners.map(p=>({x:p.x,z:p.y})));
  return {
    toWorld:point=>apply(forward,point),
    toImage:point=>{
      const p=apply(reverse,{x:point.x,y:point.z});
      return {x:p.x,y:p.z};
    },
    residual:Math.max(...corners.map((p,i)=>{
      const q=apply(forward,p);return Math.hypot(q.x-target[i].x,q.z-target[i].z);
    }))
  };
}
