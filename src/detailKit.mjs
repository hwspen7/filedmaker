// Reusable, survey-agnostic stadium detail plans. All values are in meters.
// This module deliberately has no Three.js dependency so topology and placement
// can be checked in Node before any visual render or GPU allocation.
import { SURFACES, modelPerimeterPoint, modelPerimeterPath, pointAtDistance, seatingIntervals, resolveTiers, resolveSectionTier, eligiblePortal } from './model.mjs';
import { isOhioReference } from './venues.mjs';

const rad = degrees => degrees * Math.PI / 180;
const within = (angle, section) => angle >= section.start && (angle < section.end || (angle === 360 && section.end === 360));

export function entranceFramePlan(project) {
  const surface = SURFACES[project.surface];
  const results = [];
  for (const portal of project.portals || []) {
    const valid = eligiblePortal(project, portal);
    if (!valid) continue;
    const {section, tier, profile, firstRow, lastRow, clearRise} = valid;
    const startR = profile.startOffset + (firstRow - 1) * profile.depth;
    const endR = profile.startOffset + lastRow * profile.depth;
    const entranceFloor = profile.startHeight + (firstRow - 1) * profile.rise - .15;
    const topOfStands = profile.startHeight + lastRow * profile.rise - .15;
    const near = modelPerimeterPoint(project, surface, rad(portal.angle), startR);
    const far = modelPerimeterPoint(project, surface, rad(portal.angle), endR);
    const depth = Math.hypot(far.x - near.x, far.z - near.z);
    if (depth < .75) continue;
    results.push({
      id:portal.id,sectionId:section.id,tierId:tier.id,firstRow,lastRow,
      angle:portal.angle,width:portal.width,near,far,openingDepth:depth,
      entranceFloor,topOfStands,
      yaw:Math.atan2(far.x-near.x,far.z-near.z),
      // The portal shell and seat cutout reference this same validation.
      clearHeight:clearRise,kind:'open-jamb-and-lintel',liner:'recessed-walk-through',provenance:'schematic',
    });
  }
  return results;
}

export function seatAssetPlan(project) {
  const pitch = project.seatPitch;
  const ohio = isOhioReference(project);
  return {
    // For Ohio, bench/bleacher representation is interpretive: actual seating
    // styles must ultimately be read from a seat-level source.
    type: ohio ? 'mixed-bleacher' : 'folding-chair',
    seatWidth: Math.min(.46, Math.max(.35, pitch - .10)),
    seatDepth: .38,
    seatThickness: .048,
    backHeight: .40,
    backThickness: .048,
    legThickness: .027,
    seatHeight: .45,
    armThickness: .035,
    maxMeshes: 7,
    styleForTier(tierIndex) { return ohio && tierIndex >= 1 ? 'bleacher' : 'chair'; },
  };
}

export function fieldEquipmentPlan(project) {
  const field = SURFACES[project.surface];
  const equipment = [];
  if (field.sport === 'football') {
    const x = field.width / 2 + 5.3;
    for (const side of [-1, 1]) {
      for (const z of [-17, -8.5, 0, 8.5, 17]) {
        equipment.push({kind:'bench', x: side * x, z, width:3.2, facing:-side});
      }
      for (const z of [-29, 29]) equipment.push({kind:'equipment-cart',x:side*(x+2.6),z});
      equipment.push({kind:'camera-platform',x:side*(x+7.3),z:0});
    }
    for (const z of [-field.length/2+.32, field.length/2-.32]) {
      for (const x1 of [-field.width/2+.32,field.width/2-.32]) equipment.push({kind:'pylon',x:x1,z});
    }
    equipment.push({kind:'chain-marker',x:field.width/2+1.9,z:-21});
    equipment.push({kind:'chain-marker',x:field.width/2+1.9,z:-12});
  } else if(field.sport === 'soccer') {
    equipment.push({kind:'dugout',x:field.width/2+4.5,z:-20});
    equipment.push({kind:'dugout',x:field.width/2+4.5,z:20});
    for(const z of [-field.length/2,field.length/2]) for(const x of [-field.width/2,field.width/2]){
      equipment.push({kind:'corner-flag',x,z});
    }
  } else if(field.sport === 'basketball') {
    equipment.push({kind:'scorer-table',x:field.width/2+1.5,z:0});
    for(const z of [-8,8]) equipment.push({kind:'team-bench',x:field.width/2+1.8,z});
  }
  return equipment;
}

export function detailPlanSummary(project) {
  const entrances=entranceFramePlan(project);
  const furniture=fieldEquipmentPlan(project);
  return {entrances:entrances.length,fieldAssets:furniture.length,seatAsset:seatAssetPlan(project).type};
}

// Rails are clipped to real seat-bearing intervals, so stair aisles and
// first-row entrance openings remain free instead of being sealed by a bar.
export function guardrailPlan(project) {
  const surface = SURFACES[project.surface], tiers=resolveTiers(project);
  const rails=[],posts=[];
  for(let ti=1;ti<tiers.length;ti++) {
    const tier=tiers[ti];
    for(const section of project.sections){
      if(!section.enabled)continue;
      const p=resolveSectionTier(tier,section.id,project);
      if(!p.rows)continue;
      const path=modelPerimeterPath(project,surface,p.startOffset+.25,320);
      const intervals=seatingIntervals(path,section,project,tier.id,1);
      const base=p.startHeight+.12;
      for(const [a,b] of intervals){
        const n=Math.max(1,Math.ceil((b-a)/1.85));
        for(let i=0;i<=n;i++) {
          const q=pointAtDistance(path,a+(b-a)*i/n);
          if(i<n) {
            const q2=pointAtDistance(path,a+(b-a)*(i+1)/n);
            rails.push({a:{x:q.x,y:base+1.01,z:q.z},b:{x:q2.x,y:base+1.01,z:q2.z},tier:tier.id});
            rails.push({a:{x:q.x,y:base+.64,z:q.z},b:{x:q2.x,y:base+.64,z:q2.z},tier:tier.id});
          }
          posts.push({x:q.x,y:base+.51,z:q.z,height:1.04,tier:tier.id});
        }
      }
    }
  }
  return {rails,posts};
}
