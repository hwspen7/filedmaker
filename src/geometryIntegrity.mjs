// Mesh-independent geometry checks and exposed tread edge plans.
// This module is reused by the 3D scene and by automated topology tests.
import {modelPerimeterPoint, pointAtDistance} from './model.mjs';
import {eligiblePortal} from './model.mjs';

export function treadEdgeCap(project,surface,path,radial,depth,y,distance,thickness=.16) {
  const angle=pointAtDistance(path,distance).angle;
  const near=modelPerimeterPoint(project,surface,angle,radial);
  const far=modelPerimeterPoint(project,surface,angle,radial+depth);
  const corners=[
    {x:near.x,y:y-thickness,z:near.z},
    {x:far.x,y:y-thickness,z:far.z},
    {x:near.x,y,z:near.z},
    {x:far.x,y,z:far.z},
  ];
  return corners;
}

export function entranceIntegrity(project) {
  const valid=[],ignored=[];
  for(const portal of project.portals||[]) {
    const result=eligiblePortal(project,portal);
    if(result)valid.push({id:portal.id,tierId:result.tier.id,sectionId:result.section.id,
      firstRow:result.firstRow,lastRow:result.lastRow,headroomM:Number(result.clearRise.toFixed(3))});
    else ignored.push({id:portal.id,reason:'No enabled tier/section or less than 1.85 m of riser clearance'});
  }
  return {requested:(project.portals||[]).length,valid,ignored,blockedCutouts:ignored.length};
}
