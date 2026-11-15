// Shared, renderer-independent seating presentation rules.
// Do not interpret a named venue reference as an official seat manifest.
const HEX = /^#[0-9a-fA-F]{6}$/;
export const COLOR_SCHEMES = Object.freeze({
  neutral: ['#7e878c','#929ba0','#adb6bb','#c1c9cd'],
  ohio: ['#8b9499','#aab2b6','#bdc4c6','#d0d5d6'],
  schott: ['#444b54','#5a626b','#777f86','#959da4'],
  school: ['#164c80','#2875ae','#5597c6','#88b9d6'],
});
const validHex = x => typeof x === 'string' && HEX.test(x);
export function seatPalette(project) {
  const id = project?.venueReference?.id;
  if (id === 'ohio-stadium') return COLOR_SCHEMES.ohio;
  if (id === 'schottenstein-center') return COLOR_SCHEMES.schott;
  const supplied = project?.school?.primaryColor || project?.seatingColors?.primary;
  if (validHex(supplied)) {
    const r=parseInt(supplied.slice(1,3),16),g=parseInt(supplied.slice(3,5),16),b=parseInt(supplied.slice(5,7),16);
    const toHex = n => Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0');
    // Preserve school brand hue but use perceptually clearer tiers of the same family.
    return [0,0.22,0.45,0.63].map(t=>'#'+[r,g,b].map(c=>toHex(c*(1-t)+238*t)).join(''));
  }
  if(project?.seatFirst) return COLOR_SCHEMES.school;
  return null;
}
export function seatColor(project, tier=0, sectionIndex=0) {
  const palette=seatPalette(project);
  if(palette) return palette[Math.max(0,Math.min(3,Math.trunc(tier)||0))];
  const colors=project?.sections;
  return colors?.[sectionIndex]?.color || '#829096';
}
export function seatKind(project, seat={}) {
  const stored=project?.school?.seatTypes?.[seat.uid];
  const explicit=seat.seatStyle||stored;
  if (['chair','folding','premium'].includes(explicit))return 'chair';
  if (['bleacher','bench','metal-bleacher'].includes(explicit))return 'bleacher';
  // For unknown seating, visualise a simple seat-free bleacher rather than
  // inventing rows of folding chairs in outdoor campus football stadiums.
  if(project?.venueReference?.id==='ohio-stadium')return 'bleacher';
  if(['ncaa-football','nfhs-football','nfl','cfl','cfl27'].includes(project?.surface))return 'bleacher';
  if(/gym|middle-basketball|high-basketball/i.test(project?.school?.profile||''))return 'bleacher';
  return 'chair';
}
export function facingYaw(x,z,previous=null,next=null) {
  const backup=Math.atan2(-x,-z);
  if(!previous||!next)return backup;
  const tx=next.x-previous.x,tz=next.z-previous.z;
  const mag=Math.hypot(tx,tz);
  if(mag<1e-8)return backup;
  let nx=-tz/mag,nz=tx/mag;
  if(nx*(-x)+nz*(-z)<0){nx=-nx;nz=-nz;}
  return Math.atan2(nx,nz);
}
export function canSelectOfficialSeat(project, origin) {
  // A published capacity / venue name does not establish a selectable seat ID.
  return origin==='imported' && project?.ticketing?.inventoryMode==='file-import';
}
