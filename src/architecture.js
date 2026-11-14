import * as THREE from 'three';
import {SURFACES,modelPerimeterPoint,resolveTiers,resolveSectionTier} from './model.mjs';
import {OHIO_STADIUM,isOhioReference} from './venues.mjs';
import {aisleStairPlan,facadeArcPlan} from './stadiumDetails.mjs';
const mat=(c,metalness=0,roughness=.8)=>new THREE.MeshStandardMaterial({color:c,metalness,roughness,side:THREE.DoubleSide});
function cube(parent,w,h,d,x,y,z,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);parent.add(o);return o;}
function wall(parent,a,b,h,base,material,depth=.65){
 const length=Math.hypot(b.x-a.x,b.z-a.z);
 const mesh=cube(parent,length,h,depth,(a.x+b.x)/2,base+h/2,(a.z+b.z)/2,material);
 mesh.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);return mesh;
}
function pole(parent,a,b,r,m){
 const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),dir=to.clone().sub(from);
 const obj=new THREE.Mesh(new THREE.CylinderGeometry(r,r,dir.length(),8),m);
 obj.position.copy(from).add(to).multiplyScalar(.5);obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());parent.add(obj);
}
function stairs(root,project){
 const data=aisleStairPlan(project);if(!data.length)return;
 const steps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat(0xd1ceca),data.length);
 const noses=project.detailLevel==='high'?new THREE.InstancedMesh(new THREE.BoxGeometry(1,.03,.08),mat(0xcbb573),data.length):null;
 const node=new THREE.Object3D();
 data.forEach((s,i)=>{
   node.rotation.set(0,Math.atan2(s.x,s.z),0);node.position.set(s.x,s.y,s.z);node.scale.set(s.width,.16,s.depth*.92);node.updateMatrix();steps.setMatrixAt(i,node.matrix);
   if(noses){node.position.y=s.y+.10;node.scale.set(s.width,1,1);node.updateMatrix();noses.setMatrixAt(i,node.matrix);}
 });
 steps.instanceMatrix.needsUpdate=true;root.add(steps);
 if(noses){noses.instanceMatrix.needsUpdate=true;root.add(noses);}
}
function facade(root,project){
 if(project.detailLevel==='draft'||!project.showExterior)return;
 const arcs=facadeArcPlan(project,project.detailLevel==='high'?6:4);
 const stone=mat(isOhioReference(project)?0xc5c0b7:0xc7cdd0),pier=mat(0xe3e0d8),inset=mat(0x626970);
 arcs.forEach((p,i)=>{
  const h=Math.max(5,p.height);
  if(project.detailLevel==='high'){
   wall(root,p.a,p.b,Math.min(7,h*.44),.3,inset);
   wall(root,p.a,p.b,1.55,Math.min(7,h*.44),stone);
   if(i%2===0)cube(root,.9,Math.min(8.5,h*.50),.85,p.a.x,Math.min(8.5,h*.50)/2,p.a.z,pier);
   if(i%3===0)wall(root,p.a,p.b,.35,h-.35,pier);
  }else wall(root,p.a,p.b,Math.min(12,h*.55),0,stone);
 });
}
function portalFrames(root,project){
 if(project.detailLevel!=='high')return;
 const field=SURFACES[project.surface],tiers=resolveTiers(project);
 const dark=mat(0x283039),stone=mat(0xc5c3ba);
 for(const portal of project.portals||[]){
  const tier=tiers.find(t=>t.id===portal.tierId);
  const sec=project.sections.find(s=>s.enabled&&portal.angle>=s.start&&portal.angle<s.end);
  if(!tier||!sec)continue;
  const t=resolveSectionTier(tier,sec.id,project),radius=t.startOffset+((portal.firstRow+portal.lastRow)/2)*t.depth;
  const v=modelPerimeterPoint(project,field,portal.angle*Math.PI/180,radius),y=t.startHeight+(portal.firstRow-1)*t.rise;
  const g=new THREE.Group();g.position.set(v.x,y,v.z);g.rotation.y=portal.angle*Math.PI/180;
  cube(g,portal.width,2.65,1.7,0,1.3,0,dark);
  cube(g,portal.width+.65,.50,1.9,0,2.85,0,stone);
  for(const x of [-portal.width/2-.2,portal.width/2+.2])cube(g,.4,2.8,1.9,x,1.4,0,stone);
  g.userData.referenceQuality='approximate portal, not a survey';root.add(g);
 }
}
function ribbonBoards(root,project){
 if(project.detailLevel!=='high')return;
 const field=SURFACES[project.surface],tiers=resolveTiers(project);
 const ribbon=mat(0x34424d),edge=mat(isOhioReference(project)?0xb42537:0x277a84);
 for(let k=0;k<tiers.length-1;k++)for(const sec of project.sections){
  if(!sec.enabled)continue;const t=resolveSectionTier(tiers[k],sec.id,project);if(!t.rows)continue;
  const r=t.startOffset+t.rows*t.depth+.25,y=t.startHeight+t.rows*t.rise;
  const n=Math.max(2,Math.ceil((sec.end-sec.start)/4));
  for(let i=0;i<n;i++){
   const a=(sec.start+(sec.end-sec.start)*i/n)*Math.PI/180,b=(sec.start+(sec.end-sec.start)*(i+1)/n)*Math.PI/180;
   const A=modelPerimeterPoint(project,field,a,r),B=modelPerimeterPoint(project,field,b,r);
   wall(root,A,B,.85,y-.4,ribbon,.15);wall(root,A,B,.12,y+.44,edge,.16);
  }
 }
}
function safetyRails(root,project){
 if(project.detailLevel!=='high')return;
 const field=SURFACES[project.surface],tiers=resolveTiers(project),lines=[];
 for(const tier of tiers)for(const sec of project.sections){
  if(!sec.enabled)continue;const t=resolveSectionTier(tier,sec.id,project);if(!t.rows)continue;
  const y=t.startHeight+.95,n=Math.max(2,Math.ceil((sec.end-sec.start)/1.8));
  for(let i=0;i<n;i++){
   const a=(sec.start+(sec.end-sec.start)*i/n)*Math.PI/180,b=(sec.start+(sec.end-sec.start)*(i+1)/n)*Math.PI/180;
   const A=modelPerimeterPoint(project,field,a,t.startOffset+.33),B=modelPerimeterPoint(project,field,b,t.startOffset+.33);
   lines.push(A.x,y,A.z,B.x,y,B.z);
   if(i%3===0)lines.push(A.x,y-.7,A.z,A.x,y,A.z);
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
 root.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x73828b})));
}
function ohioArchitecture(root,project){
 const concrete=mat(0xc6c2b9),trim=mat(0xe7e2d7),dark=mat(0x27313a),glass=mat(0x6b8994,.25,.30),steel=mat(0x869197,.4,.48);
 const field=SURFACES[project.surface],upper=resolveTiers(project).at(-1);
 const north=modelPerimeterPoint(project,field,3*Math.PI/2,upper.startOffset+upper.rows*upper.depth+2);
 const z=Math.min(-118,north.z-3);
 cube(root,39,23,9,0,11.5,z,concrete);
 // The three north-rotunda arches reflect the actual historic facade, not an exact architectural scan.
 for(const x of [-12.2,0,12.2]){
  cube(root,8.6,13,.8,x,7.1,z-4.8,dark);
  for(const d of [-4.9,4.9])cube(root,1.5,16,1.6,x+d,8,z-4.8,trim);
  const arch=new THREE.Mesh(new THREE.TorusGeometry(4.25,.46,8,28,Math.PI),trim);
  arch.position.set(x,13.2,z-5.3);root.add(arch);
 }
 cube(root,42,1.1,10,0,24,z,trim);
 // South terminal towers and permanently separated low South Stands.
 for(const x of [-80,80]){
  cube(root,11,31,11,x,15.5,103,concrete);
  cube(root,12,1.6,12,x,31.6,103,trim);
  for(const h of [9,14,20])cube(root,6,3,.35,x,h,97.3,dark);
 }
 // West press/suite/club structure, deliberately distinct from the horseshoe seating bowl.
 const x=-100.5;
 for(let level=0;level<3;level++){
  const h=32+level*6;
  cube(root,9,5.6,84,x,h,0,concrete);
  cube(root,.25,3.9,78,x+4.63,h+.25,0,glass);
  for(let j=0;j<17;j++)cube(root,.32,4.5,.16,x+4.82,h,-38+j*4.75,trim);
 }
 cube(root,11,.9,88,x,OHIO_STADIUM.pressBoxRoofM-.6,0,trim);
 const south=modelPerimeterPoint(project,field,Math.PI/2,upper.startOffset+upper.rows*upper.depth+3);
 const southZ=Math.max(124,south.z+4),w=OHIO_STADIUM.scoreboardWidthM,h=OHIO_STADIUM.scoreboardHeightM;
 cube(root,w+1.3,h+1.3,.85,0,42,southZ,steel);
 cube(root,w,h,.18,0,42,southZ-.55,mat(0x071927,.10,.3));
 cube(root,w+3,1.1,1,0,42+h/2+.9,southZ,trim);
 for(const end of [-w/2+3,w/2-3])cube(root,2.5,34,3,end,17,southZ+1,concrete);
 for(const x of [-91,91])for(const side of [-68,5,74]){
  pole(root,[x,30,side],[x,47,side],.28,steel);
  cube(root,7,1.6,1.2,x,47,side,steel);
  for(let j=-2;j<=2;j++)cube(root,1,.65,.5,x+j*1.23,47,side-.7,trim);
 }
}
function fieldEquipment(root,project){
 if(!project.showFixtures)return;
 const field=SURFACES[project.surface],white=mat(0xffffff),metal=mat(0x69777d),accent=mat(isOhioReference(project)?0xb5263c:0x25818b),orange=mat(0xe48530);
 if(field.sport==='football'){
  for(const x of [-field.width/2,field.width/2])for(const z of [-field.length/2,field.length/2])cube(root,.35,.46,.35,x,.23,z,orange);
  for(const sign of [-1,1]){
   const x=sign*(field.width/2+6);
   cube(root,4.5,.14,32,x,.15,0,metal);
   for(const z of [-14,14])cube(root,3,.52,7,x,.47,z,white);
   for(let n=-3;n<=3;n++)cube(root,.75,1.2,.55,x+sign*3.3,.64,n*4.1,accent);
  }
 }else if(field.sport==='soccer'){
  for(const x of [-field.width/2,field.width/2])for(const z of [-field.length/2,field.length/2]){
   pole(root,[x,0,z],[x,1.6,z],.03,white);cube(root,.55,.25,.05,x+.28,1.43,z,accent);
  }
  const x=field.width/2+4;
  cube(root,2.2,2,12,x,1.4,0,metal);
  for(const z of [-25,25])cube(root,1.8,1.1,8,x,1,z,accent);
 }else if(field.sport==='basketball'){
  cube(root,2.0,1.1,9,field.width/2+1.4,.6,0,metal);
  for(const z of [-9,9])cube(root,1.5,.5,6,field.width/2+1.5,.48,z,accent);
  cube(root,7,5,7,0,15,0,metal);
  for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
   const panel=cube(root,5.8,4.1,.15,0,15,0,accent);
   panel.rotation.y=a;panel.position.set(Math.sin(a)*3.65,15,Math.cos(a)*3.65);
  }
  pole(root,[0,18,0],[0,25,0],.25,metal);
 }
}
export function addDetailedVenue(root,model){
 const p=model.project;
 if(p.detailLevel!=='draft'){
  stairs(root,p);facade(root,p);
  if(p.detailLevel==='high'){ribbonBoards(root,p);safetyRails(root,p);portalFrames(root,p);}
  if(isOhioReference(p)&&p.showExterior)ohioArchitecture(root,p);
 }
 fieldEquipment(root,p);
}
