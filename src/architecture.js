// Stadium architecture renderer. Every non-survey element is illustrative.
// Geometry is created using bounded mesh counts and seat/step instancing.
import * as THREE from 'three';
import { SURFACES, modelPerimeterPoint, resolveTiers, resolveSectionTier } from './model.mjs';
import { OHIO_STADIUM, isOhioReference, isSchottensteinReference } from './venues.mjs';
import { schottensteinFeaturePlan } from './schottensteinKit.mjs';
import { aisleStairPlan, facadeArcPlan } from './stadiumDetails.mjs';
import { entranceFramePlan, fieldEquipmentPlan, guardrailPlan } from './detailKit.mjs';
import { nbaArenaId } from './nbaGeometry.mjs';
import { addNBAArenaArchitecture } from './nbaArchitecture.js';

const material=(color,metalness=0,roughness=.82)=>new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide});
function addBox(parent,w,h,d,x,y,z,m){const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);obj.position.set(x,y,z);parent.add(obj);return obj;}
function segment(parent,a,b,thick,height,base,m){
  const len=Math.hypot(b.x-a.x,b.z-a.z);
  const obj=addBox(parent,len,height,thick,(a.x+b.x)/2,base+height/2,(a.z+b.z)/2,m);
  obj.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
  return obj;
}
function beam(parent,a,b,radius,m,segments=7){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.clone().sub(from);
  const obj=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,d.length(),segments),m);
  obj.position.copy(from).add(to).multiplyScalar(.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(obj);
  return obj;
}
function stairways(root,project){
  const plans=aisleStairPlan(project);if(!plans.length)return;
  const steps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.15,1),material(0xd5d2c9),plans.length);
  const nosings=project.detailLevel==='high'?new THREE.InstancedMesh(new THREE.BoxGeometry(1,.025,.07),material(0x999f9b),plans.length):null;
  const dummy=new THREE.Object3D();
  plans.forEach((s,i)=>{
    dummy.position.set(s.x,s.y,s.z);
    dummy.rotation.set(0,Math.atan2(s.x,s.z),0);
    dummy.scale.set(s.width,.18,s.depth*.92);dummy.updateMatrix();steps.setMatrixAt(i,dummy.matrix);
    if(nosings){dummy.position.set(s.x,s.y+.102,s.z);dummy.scale.set(s.width,.025,.07);dummy.updateMatrix();nosings.setMatrixAt(i,dummy.matrix);}
  });
  steps.instanceMatrix.needsUpdate=true;root.add(steps);
  if(nosings){nosings.instanceMatrix.needsUpdate=true;root.add(nosings);}
}
function facade(root,project){
  if(!project.showExterior || project.detailLevel==='draft')return;
  const arcs=facadeArcPlan(project,project.detailLevel==='high'?7:4);
  const wall=material(isOhioReference(project)?0xbdbdb7:0xc8cdd1);
  const plaster=material(isOhioReference(project)?0xe4e0d5:0xdfe2e3);
  const dark=material(0x586169);
  const pillars=[];
  for(let i=0;i<arcs.length;i++){
    const entry=arcs[i];const height=Math.max(6,entry.height);
    // Use transparent-looking arcade bay made from two piers and a recessed dark opening.
    if(project.detailLevel==='high'){
      const len=Math.hypot(entry.a.x-entry.b.x,entry.a.z-entry.b.z);
      const arch=segment(root,entry.a,entry.b,.65,Math.min(7.6,height*.46),.35,dark);
      const header=segment(root,entry.a,entry.b,.90,Math.min(1.8,height*.15),Math.min(7.6,height*.46),plaster);
      const p=entry.a;const pier=addBox(root,.74,Math.min(8.8,height*.5),.74,p.x,Math.min(8.8,height*.5)/2,p.z,wall);
      pier.userData.referenceQuality='approximate';
      // Subtle ring along the arcade roof.
      if(i%3===0) segment(root,entry.a,entry.b,.8,.4,height-.45,plaster);
    }else segment(root,entry.a,entry.b,.7,Math.min(height*.65,14),0,wall);
    // No full-height opaque wall across upper tiers: maintain exterior visibility and sightlines.
  }
}
function ribbons(root,project){
  if(project.detailLevel==='draft')return;
  const field=SURFACES[project.surface];const tiers=resolveTiers(project);
  const dark=material(0x303a42,.06,.48),accent=material(isOhioReference(project)?0xba2033:0x1e859a,.11,.46);
  for(let ti=0;ti<tiers.length-1;ti++){
    const tier=tiers[ti];
    for(const sec of project.sections){
      if(!sec.enabled)continue;
      const p=resolveSectionTier(tier,sec.id,project);if(!p.rows)continue;
      const radial=p.startOffset+p.rows*p.depth+.25;
      const height=p.startHeight+p.rows*p.rise;
      const count=Math.max(2,Math.ceil((sec.end-sec.start)/3));
      for(let i=0;i<count;i++){
        const a=(sec.start+(sec.end-sec.start)*i/count)*Math.PI/180;
        const b=(sec.start+(sec.end-sec.start)*(i+1)/count)*Math.PI/180;
        const q1=modelPerimeterPoint(project,field,a,radial),q2=modelPerimeterPoint(project,field,b,radial);
        segment(root,q1,q2,.13,.95,height-.45,dark);
        if(project.detailLevel==='high')segment(root,q1,q2,.17,.13,height+.48,accent);
      }
    }
  }
}
function entryPortals(root,project){
  // A vomitory is a walk-through *volume*, not a floating dark cuboid. Keep its
  // tread, side cheek walls and far lintel in the identical local frame that
  // produced the row cutout. Inactive/under-height cuts are never emitted.
  const concrete=material(0xc5c8c5), wall=material(0xd4d6d4);
  const nosing=material(0x969f9f,.12,.7), interior=material(0x46535a,.02,.91);
  for(const portal of entranceFramePlan(project)){
    const {near,far,width,clearHeight,entranceFloor,yaw,openingDepth}=portal;
    const group=new THREE.Group();
    group.position.set((near.x+far.x)/2,0,(near.z+far.z)/2);
    group.rotation.y=yaw;
    const depth=openingDepth, floor=entranceFloor, h=clearHeight;
    // Visible circulation floor aligns with the first removed riser.
    addBox(group,width+.12,.13,depth+.12,0,floor-.065,0,concrete);
    addBox(group,width+.12,.025,.10,0,floor+.013,-depth/2-.04,nosing);
    // Trapezoidal cheek walls gradually follow the rising stand surface;
    // extruding full-height walls along the whole run made tall floating blocks.
    for(const side of [-1,1]) {
      const x=side*(width/2+.07);
      const p=[x,floor,-depth/2-.1,x,floor,depth/2+.10,
        x,floor+h+.05,depth/2+.10,x,floor+.30,-depth/2-.10];
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
      g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
      group.add(new THREE.Mesh(g,wall));
      addBox(group,.14,h,.24,x,floor+h/2,depth/2-.10,concrete);
    }
    addBox(group,width+.48,.27,.45,0,floor+h+.12,depth/2-.12,concrete);
    // A recessed dark surface models the unlit concourse interior, rather
    // than a black *solid in the aperture* in front of the spectators.
    const back=addBox(group,width-.12,h-.20,.05,0,floor+h/2,depth/2+.46,interior);
    back.userData={recessedPortalBackdrop:true,referenceQuality:'visual inference only'};
    group.userData={portalId:portal.id,referenceQuality:'illustrative lined portal',solidInAperture:false};
    root.add(group);
  }
}

function railings(root,project){
  if(project.detailLevel!=='high')return;
  const {rails,posts}=guardrailPlan(project);
  const handrailMat=material(0x85949b,.55,.33), postMat=material(0x69777d,.48,.4);
  const cylinder=new THREE.CylinderGeometry(.022,.022,1,6);
  const handrails=new THREE.InstancedMesh(cylinder,handrailMat,rails.length);
  const postMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.019,.019,1,6),postMat,posts.length);
  const o=new THREE.Object3D();const up=new THREE.Vector3(0,1,0);
  rails.forEach(({a,b},i)=>{
    const delta=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z);
    o.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
    o.quaternion.setFromUnitVectors(up,delta.clone().normalize());o.scale.set(1,delta.length(),1);
    o.updateMatrix();handrails.setMatrixAt(i,o.matrix);
  });
  posts.forEach((p,i)=>{
    o.position.set(p.x,p.y,p.z);o.quaternion.identity();o.scale.set(1,p.height,1);
    o.updateMatrix();postMesh.setMatrixAt(i,o.matrix);
  });
  handrails.instanceMatrix.needsUpdate=true;postMesh.instanceMatrix.needsUpdate=true;
  handrails.userData.referenceQuality='schematic metal safety guardrail';
  root.add(handrails,postMesh);
}
function videoPlane(root,w,h,x,y,z,rotateY=0){
  const display=new THREE.Group();display.position.set(x,y,z);display.rotation.y=rotateY;
  const trim=material(0x3e4247,.35,.42),panel=material(0x142431,.14,.40);
  addBox(display,w+.85,h+.85,.55,0,0,0,trim);
  const screen=addBox(display,w,h,.05,0,0,-.32,panel);
  screen.userData.content='illustrative scoreboard — no licensed imagery';
  root.add(display);
  return screen;
}
function ohioSpecific(root,project){
  const field=SURFACES[project.surface];
  const concrete=material(0xc5c1b9),pale=material(0xe3dfd6),dark=material(0x333943),glass=material(0x6a8794,.32,.22);
  const tiers=resolveTiers(project), north=modelPerimeterPoint(project,field,3*Math.PI/2,tiers.at(-1).startOffset+tiers.at(-1).rows*tiers.at(-1).depth+2);
  // North rotunda: three large dark arches framed by pale masonry. Interpretation, not a survey mesh.
  const northZ=Math.min(-118,north.z-3);
  addBox(root,39,23,9,0,11.5,northZ,concrete);
  for(const x of [-12.2,0,12.2]){
    addBox(root,8.5,13,.75,x,7.2,northZ-4.7,dark);
    const arch=new THREE.Mesh(new THREE.CylinderGeometry(4.25,4.25,.85,28,1,false,0,Math.PI),dark);
    arch.rotation.x=Math.PI/2;arch.position.set(x,13.4,northZ-4.75);root.add(arch);
    addBox(root,1.6,16,1.6,x-4.9,8,northZ-4.7,pale);
    addBox(root,1.6,16,1.6,x+4.9,8,northZ-4.7,pale);
  }
  addBox(root,42,1.2,10,0,24,northZ,pale);
  // Two south-end towers are a defining feature of the original horseshoe terminal.
  for(const x of [-80,80]){
    const tower=addBox(root,11,31,11,x,15.5,103,concrete);
    tower.userData.referenceQuality='approximate tower position';
    for(let h of [9,14,20])addBox(root,6,3,.35,x,h,97.3,dark);
    addBox(root,12,1.6,12,x,31.5,103,pale);
  }
  // West-sided stacked club, suite and press structures with repeated glazed bays.
  const westX=-100.5;
  for(let level=0;level<3;level++){
    const y=32+level*6;
    addBox(root,9,5.6,84,westX,y,0,concrete);
    const ribbon=addBox(root,.25,3.9,78,westX+4.63,y+.25,0,glass);
    ribbon.userData.referenceQuality='illustrative suites';
    for(let n=0;n<17;n++) addBox(root,.35,4.5,.16,westX+4.81,y, -38+n*4.75,pale);
  }
  addBox(root,11,.9,88,westX,OHIO_STADIUM.pressBoxRoofM-.6,0,pale);
  // The 2012 scoreboard dimensions are taken from the athletics department's official fact page.
  const outer=resolveTiers(project).at(-1);
  const south=modelPerimeterPoint(project,field,Math.PI/2,outer.startOffset+outer.rows*outer.depth+3);
  const z=Math.max(124,south.z+4);
  const height=OHIO_STADIUM.scoreboardHeightM,width=OHIO_STADIUM.scoreboardWidthM;
  videoPlane(root,width,height,0,42,z);
  addBox(root,width+3,1.2,1,0,42+height/2+.95,z,pale);
  for(const x of [-width/2+3,width/2-3]){
    addBox(root,2.5,33,3.4,x,16.5,z+1,concrete);
  }
  // Lighting masts and stadium-side service platforms, with bounded geometry.
  const steel=material(0x929da1,.42,.38);
  for(const x of [-91,91])for(const zPos of [-68,5,74]){
    beam(root,[x,30,zPos],[x,47,zPos],.30,steel);
    addBox(root,7,1.7,1.1,x,47,zPos,steel);
    for(let n=-2;n<=2;n++) addBox(root,1,.65,.6,x+n*1.23,47,zPos-.55,material(0xf3f2e7,.1,.25));
  }
}
// The central display is based on OSU's 2026 feature announcement. No public
// drawing substantiates dimensions, screen curvature radius or mounting height.
function schottensteinSpecific(root,project){
  const spec=schottensteinFeaturePlan(project);
  if(!spec)return;
  const rootGroup=new THREE.Group();
  rootGroup.name='SchottensteinCenter_2026_IllustrativeScreenKit';
  const led=new THREE.MeshStandardMaterial({color:0x30475a,emissive:0x1c3854,emissiveIntensity:.25,roughness:.42,metalness:.08});
  const frame=material(0x333841,.42,.42),trim=material(0x8c9199,.38,.52);
  const pale=material(0xc4c6c9,.13,.67);
  const {board,ribbon}=spec;
  const boardGroup=new THREE.Group();boardGroup.position.y=board.y;
  const radius=board.widthM*.52;
  // Three facets per nominal face give a subtly convex four-sided silhouette.
  for(let face=0;face<board.faceCount;face++){
    const f=new THREE.Group();f.rotation.y=face*Math.PI/2;
    for(let facet=0;facet<board.facetsPerFace;facet++){
      const span=board.widthM/board.facetsPerFace;
      const dx=(facet-1)*span;
      const p=addBox(f,span+.025,board.heightM,.11,dx,0,radius-.14*Math.abs(facet-1),led);
      p.rotation.y=(facet-1)*-.085;
      p.userData.referenceQuality='screen faces documented; screen curvature and dimensions are estimated';
    }
    addBox(f,board.widthM+.28,.21,.28,0,board.heightM/2+.12,radius,trim);
    addBox(f,board.widthM+.28,.21,.28,0,-board.heightM/2-.12,radius,trim);
    const bottom=addBox(f,board.widthM*.75,.55,.12,0,-board.heightM/2-.58,radius*.60,led);
    bottom.rotation.x=.25;
    rootGroup.add(f);
  }
  addBox(boardGroup,board.widthM+1,.52,board.widthM+1,0,board.heightM/2+.21,0,frame);
  addBox(boardGroup,board.widthM*.75,.28,board.widthM*.75,0,-board.heightM/2-.62,0,frame);
  for(const x of [-2.4,2.4])for(const z of [-2.4,2.4])beam(boardGroup,[x,board.heightM/2+.30,z],[x,board.heightM/2+5,z],.045,trim);
  // Add face groups to boardGroup (not root) so the central suspension height applies.
  for(const item of [...rootGroup.children])boardGroup.add(item);
  rootGroup.add(boardGroup);

  const surface=SURFACES[project.surface],divisions=96;
  for(let i=0;i<divisions;i++){
    const a=(i/divisions)*Math.PI*2,b=((i+1)/divisions)*Math.PI*2;
    // Ribbon follows a derived arena facade radius. Exact OSU curve is unknown.
    const radial=resolveTiers(project)[1]?.startOffset || 25;
    const q1=modelPerimeterPoint(project,surface,a,radial),q2=modelPerimeterPoint(project,surface,b,radial);
    segment(rootGroup,q1,q2,.11,ribbon.widthM,ribbon.y,led);
  }
  for(const signX of [-1,1])for(const signZ of [-1,1]){
    const w=3.8,h=1.7,x=signX*22,z=signZ*30;
    const panel=addBox(rootGroup,w,h,.14,x,board.y+9,z,led);
    panel.rotation.y=signZ*Math.PI/4;panel.userData.referenceQuality='upper-corner board feature documented, individual locations are estimated';
    addBox(rootGroup,w+.18,.16,.24,x,board.y+9+h/2,z,pale);
  }
  rootGroup.userData={referenceQuality:spec.modelStatus,documentedVomitoryDisplays:spec.documentedVomitoryDisplayCount,
    surveyedVomitoryDisplayPositions:spec.positionedVomitoryDisplays};
  root.add(rootGroup);
}

function sportFurniture(root,project){
  const assets=fieldEquipmentPlan(project);
  const shell=material(0xc7ccd0,.28,.55), dark=material(0x30383d,.25,.68);
  const red=material(isOhioReference(project)?0xa62239:0x1b6377,.05,.85);
  const yellow=material(0xeaa937,.08,.7), white=material(0xf1f4ef);
  const vertical=(a,b,r,m)=>beam(root,a,b,r,m);
  for(const asset of assets){
    const {x,z,kind}=asset;
    if(kind==='bench' || kind==='team-bench') {
      const long=asset.width||4.4;
      addBox(root,.64,.075,long,x,.50,z,red);
      addBox(root,.07,.40,long,x+.20,.79,z,red);
      for(const dz of [-long*.39,long*.39]){
        addBox(root,.06,.49,.08,x-.18,.23,z+dz,shell);
        addBox(root,.06,.49,.08,x+.18,.23,z+dz,shell);
      }
    } else if(kind==='equipment-cart') {
      addBox(root,1.24,.62,1.0,x,.65,z,red);
      addBox(root,1.4,.09,1.22,x,1.02,z,shell);
      for(const dx of [-.54,.54])for(const dz of [-.39,.39]){
        const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.08,10),dark);
        wheel.rotation.z=Math.PI/2;wheel.position.set(x+dx,.20,z+dz);root.add(wheel);
      }
    } else if(kind==='camera-platform') {
      addBox(root,2.45,.16,2.3,x,.90,z,dark);
      for(const dx of [-.9,.9])for(const dz of [-.88,.88])addBox(root,.07,.83,.07,x+dx,.44,z+dz,shell);
      vertical([x,1.0,z],[x,2.0,z],.06,dark);
      addBox(root,.62,.4,.72,x,2.2,z, dark);
      vertical([x,2.18,z],[x-.9,2.2,z],.07,dark);
    } else if(kind==='pylon'){
      addBox(root,.29,.43,.29,x,.215,z,yellow);
    } else if(kind==='chain-marker') {
      vertical([x,0,z],[x,2.1,z],.032,dark);
      addBox(root,.52,.72,.06,x,1.76,z,yellow);
    } else if(kind==='dugout') {
      addBox(root,1.9,.10,8,x,2.14,z, shell);
      addBox(root,.06,1.85,8,x+.90,1.18,z,shell);
      for(const dz of [-3.6,3.6]){
        addBox(root,1.85,2.0,.07,x,1.05,z+dz,shell);
      }
      addBox(root,.65,.10,6.7,x, .52,z, red);
    } else if(kind==='corner-flag') {
      vertical([x,0,z],[x,1.75,z],.027,shell);
      addBox(root,.04,.31,.51,x,1.58,z+.22,red);
    } else if(kind==='scorer-table') {
      addBox(root,1.7,.88,8.5,x,.46,z,dark);
      addBox(root,.10,.62,7.9,x-.86,.52,z,red);
    }
  }
  if(SURFACES[project.surface].sport==='basketball' && !nbaArenaId(project) && !isSchottensteinReference(project)) {
    // Suspended four-way board, with shallow inset LED faces and mounting mast.
    addBox(root,5.9,3.85,5.9,0,15,0,dark);
    const LED=material(0x334d58,.14,.42);
    for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
      const face=addBox(root,5.20,3.1,.12,0,15,3.03,LED);
      face.position.set(Math.sin(a)*3.03,15,Math.cos(a)*3.03);face.rotation.y=a;
    }
    vertical([0,17,0],[0,25,0],.22,shell);
  }
}

export function addDetailedVenue(root,model){
  const project=model.project;
  if(project.detailLevel!=='draft'){
    stairways(root,project);
    if(project.detailLevel==='high'){
      ribbons(root,project);
      railings(root,project);
      entryPortals(root,project);
    }
    facade(root,project);
    if(isOhioReference(project) && project.showExterior)ohioSpecific(root,project);
  }
  if(project.showFixtures){sportFurniture(root,project);addNBAArenaArchitecture(root,project);schottensteinSpecific(root,project);}
}
