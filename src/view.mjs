// Viewpoint calculations are deterministic and independent of the 3D renderer.
// Distances are meters; angles are degrees in the controls and radians in Three.js.
export const VIEW_DEFAULTS = Object.freeze({ posture: 'seated', optic: 'human', zoom: 1, yaw: 0, pitch: 0, target: 'center', crowd: 'empty', labels: true });
export const POSTURE_HEIGHT = Object.freeze({ seated: 1.17, standing: 1.60, leaning: 1.23 });
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Number(x)));
export function validateViewOptions(value = {}) {
  const o = { ...VIEW_DEFAULTS, ...(value || {}) };
  if (!Object.hasOwn(POSTURE_HEIGHT, o.posture)) o.posture = 'seated';
  if (!['human', 'phone'].includes(o.optic)) o.optic = 'human';
  if (!['center', 'near', 'far', 'left', 'right', 'near-rim','far-rim','scoreboard'].includes(o.target)) o.target = 'center';
  if (!['empty', 'seated', 'standing'].includes(o.crowd)) o.crowd = 'empty';
  o.zoom = Number.isFinite(Number(o.zoom)) ? clamp(o.zoom, 0.5, 8) : 1;
  o.yaw = Number.isFinite(Number(o.yaw)) ? clamp(o.yaw, -175, 175) : 0;
  o.pitch = Number.isFinite(Number(o.pitch)) ? clamp(o.pitch, -75, 75) : 0;
  o.labels = Boolean(o.labels);
  return o;
}
export function viewingTarget(surface, target = 'center', seat = null) {
  const x = surface.width / 2, z = surface.length / 2;
  switch(target) {
    case 'near-rim': return { x:0, y:3.05, z: surface.length/2-1.6 };
    case 'far-rim': return { x:0, y:3.05, z:-surface.length/2+1.6 };
    case 'scoreboard': return { x:0, y:15.5, z:0 };
    case 'near': return { x: 0, y: surface.sport === 'basketball' ? 3 : 1.2, z: z * .65 * (seat && seat.z < 0 ? -1 : 1) };
    case 'far': return { x: 0, y: surface.sport === 'basketball' ? 3 : 1.2, z: -z * .65 * (seat && seat.z < 0 ? -1 : 1) };
    case 'left': return { x: -x * .72, y: 1.25, z: 0 };
    case 'right': return { x: x * .72, y: 1.25, z: 0 };
    default: return { x: 0, y: surface.sport === 'basketball' ? 2.4 : 1.35, z: 0 };
  }
}
// Seat coordinates are row/seat references, NOT eye anchors. The spectator's
// eyes are slightly forward of the chair centre, away from the backrest.
// A viewer-only local clearance also prevents intersecting their own seat mesh.
export function eyePosition(seat, posture = 'seated') {
  const eye = POSTURE_HEIGHT[posture] || POSTURE_HEIGHT.seated;
  const forward = posture === 'leaning' ? 0.38 : posture === 'standing' ? .20 : .23;
  const yaw = Number.isFinite(seat.yaw) ? seat.yaw : Math.atan2(-seat.x,-seat.z);
  return {
    x: seat.x + Math.sin(yaw)*forward,
    y: seat.y + eye,
    z: seat.z + Math.cos(yaw)*forward,
  };
}
export function spectatorSeatClearance(seat, eye, width=.48) {
  // Pure geometry sanity check for the chair's own volume in local coordinates.
  const yaw=Number.isFinite(seat.yaw)?seat.yaw:Math.atan2(-seat.x,-seat.z);
  const dx=eye.x-seat.x,dz=eye.z-seat.z;
  const forward=dx*Math.sin(yaw)+dz*Math.cos(yaw);
  const lateral=dx*Math.cos(yaw)-dz*Math.sin(yaw);
  const height=eye.y-seat.y;
  return {forward,lateral,height,insideBackrest:Math.abs(lateral)<width/2 && forward<-.10 && height<1.05};
}
export function viewpoint(seat, surface, options = {}) {
  const o = validateViewOptions(options);
  const origin = eyePosition(seat, o.posture);
  const target = viewingTarget(surface, o.target, seat);
  const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
  const horizontal = Math.hypot(dx, dz);
  const azimuth = Math.atan2(dx, dz) + o.yaw * Math.PI / 180;
  const elevation = Math.atan2(dy, horizontal) + o.pitch * Math.PI / 180;
  const unit = { x: Math.sin(azimuth) * Math.cos(elevation), y: Math.sin(elevation), z: Math.cos(azimuth) * Math.cos(elevation) };
  // PerspectiveCamera.fov is vertical. 1× phone is an approximation, not a manufacturer camera model.
  const fov = clamp((o.optic === 'phone' ? 67 : 65) / o.zoom, 11, 100);
  return { origin, target, direction: unit, fov, distance: Math.hypot(dx, dy, dz), options: o };
}
export function nearbySeat(model, seat, direction) {
  if (!model || !seat) return null;
  const seats = model.seats;
  if (direction === 'left' || direction === 'right') {
    return seats.find(s => s.tier === seat.tier && s.sectionId === seat.sectionId && s.row === seat.row && Number(s.number) === Number(seat.number) + (direction === 'right' ? 1 : -1)) || null;
  }
  if (direction === 'front' || direction === 'back') {
    const wantedRow = Number(seat.row) + (direction === 'back' ? 1 : -1);
    const choices = seats.filter(s => s.tier === seat.tier && s.sectionId === seat.sectionId && Number(s.row) === wantedRow);
    if (!choices.length) return null;
    return choices.reduce((best, cur) => Math.hypot(cur.x - seat.x, cur.z - seat.z) < Math.hypot(best.x - seat.x, best.z - seat.z) ? cur : best);
  }
  return null;
}
export function crowdCandidates(model, selected, count = 65) {
  if (!selected || !model) return [];
  // Only show the neighborhood around the current seat. Never simulate the entire crowd.
  return model.seats.filter(s => s.uid !== selected.uid && s.tier === selected.tier && Math.abs(s.row - selected.row) <= 5 && Math.hypot(s.x - selected.x, s.z - selected.z) <= 6.2).sort((a,b)=>Math.hypot(a.x-selected.x,a.z-selected.z)-Math.hypot(b.x-selected.x,b.z-selected.z)).slice(0, count);
}
export function seatDescriptor(seat) {
  return seat ? `${seat.sectionId} · T${seat.tier + 1} · Row ${seat.row} · Seat ${seat.number}` : 'No seat selected';
}
export function apparentAngleMeters(objectWidth, distance) {
  if (!(distance > 0) || !(objectWidth >= 0)) return 0;
  return 2 * Math.atan2(objectWidth / 2, distance) * 180 / Math.PI;
}
export function sightlineNote(seat, surface, posture = 'seated') {
  // Qualitative geometric preview only; true C-value calculations require surveyed tread and obstruction positions.
  const v = viewpoint(seat, surface, { posture });
  const degreesDown = Math.atan2(v.origin.y - v.target.y, Math.hypot(v.target.x-v.origin.x, v.target.z-v.origin.z)) * 180 / Math.PI;
  return { distance: Math.round(v.distance * 10) / 10, downwardAngle: Math.round(degreesDown * 10) / 10, status: 'Illustrative only — rails, heads and true sightline clearance require surveyed geometry.' };
}
