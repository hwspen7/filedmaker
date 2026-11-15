// Camera framing for variable-size school venues. Uses the data actually
// supplied for seat locations rather than a guessed stadium diameter.
export function venueBounds(seats, surface, opts={}) {
  if(!surface || !Number.isFinite(surface.width) || !Number.isFinite(surface.length))throw new Error('Invalid playing surface.');
  const maxSeats=opts.maxSeats??160000;
  if(!Array.isArray(seats)||seats.length>maxSeats)throw new Error('Invalid seat set.');
  let minX=-surface.width/2,maxX=surface.width/2;
  let minZ=-surface.length/2,maxZ=surface.length/2;
  let minY=0,maxY=0;
  for(const seat of seats){
    if(!Number.isFinite(seat.x)||!Number.isFinite(seat.y)||!Number.isFinite(seat.z))continue;
    minX=Math.min(minX,seat.x);maxX=Math.max(maxX,seat.x);
    minY=Math.min(minY,seat.y);maxY=Math.max(maxY,seat.y);
    minZ=Math.min(minZ,seat.z);maxZ=Math.max(maxZ,seat.z);
  }
  return {minX,maxX,minY,maxY,minZ,maxZ,
    width:maxX-minX,height:maxY-minY,depth:maxZ-minZ,
    center:{x:(minX+maxX)/2,y:(minY+maxY)/2,z:(minZ+maxZ)/2}};
}
export function overviewCamera(bounds, opts={}) {
  const fov=opts.fov??52;
  const aspect=opts.aspect??16/9;
  if(!Number.isFinite(fov)||fov<20||fov>90||!Number.isFinite(aspect)||aspect<=0)throw new Error('Invalid camera field of view.');
  const verticalAngle=fov*Math.PI/360;
  const radiusV=Math.max(bounds.depth*.50,bounds.width/(2*aspect),bounds.height*1.1,10);
  const d=Math.max(28,radiusV/Math.tan(verticalAngle)*1.22);
  const target={x:bounds.center.x,y:Math.max(1,bounds.center.y*.65),z:bounds.center.z};
  return {position:{x:target.x+d*.58,y:target.y+d*.65,z:target.z+d*.78},target,fov};
}
