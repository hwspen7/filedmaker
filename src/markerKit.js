// Lightweight, universal sports markers. No custom arena facades.
// These shapes convey the event layout; their geometry is NOT a venue survey.
import * as THREE from 'three';
const mat=(hex,emissive=0x000000)=>new THREE.MeshStandardMaterial({color:hex,roughness:.55,metalness:.12,emissive,emissiveIntensity:.2});
function block(parent,dim,pos,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...dim),material);
  mesh.position.set(...pos);mesh.userData.markerOnly=true;parent.add(mesh);return mesh;
}
function pole(parent,a,b,diameter=0.08){
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(diameter/2,diameter/2,v.length(),8),mat(0x788b96));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize());
  mesh.position.copy(A).add(B).multiplyScalar(.5);mesh.userData.markerOnly=true;parent.add(mesh);
}
import { markerPlan } from './markerPlan.mjs';
export function addUniversalMarkers(root,surface,project){
  if(project.showFixtures===false)return;
  const plan=markerPlan(surface), group=new THREE.Group();
  group.name='Universal sport markers · schematic';
  group.userData.markerOnly=true;
  const blue=mat(0x19578e),black=mat(0x1a2633),led=mat(0x235e93,0x174169),neutral=mat(0xb3c3cd);
  if(plan.sport==='basketball'){
    // Four-sided suspended video screen plus simple team benches.
    const h=13.8;
    block(group,[5.8,2.7,4.1],[0,h,0],black);
    for(const x of [-1,1])block(group,[.09,2.1,3.6],[x*2.96,h,0],led);
    for(const z of [-1,1])block(group,[5.2,2.1,.09],[0,h,z*2.11],led);
    for(const x of [-2,2])for(const z of [-1.6,1.6])pole(group,[x,h+1.35,z],[x*.35,h+6,z*.35],.09);
    block(group,[5.8,.18,4.1],[0,h+1.4,0],blue);
    for(const side of [-1,1]){
      block(group,[5,.25,.8],[side*(surface.width/2+2.2),.3,1.4],neutral);
      block(group,[2.8,.62,.8],[side*(surface.width/2+2.2),.55,-5.3],blue);
    }
    block(group,[3,.8,.55],[0,.45,surface.length/2+1.3],black);
  } else {
    const outside=surface.length/2+8;
    if(plan.sport==='football'){
      for(const side of [-1,1]){
        block(group,[14,5,.72],[0,8,side*outside],black);
        block(group,[13.4,4.2,.08],[0,8,side*(outside+side*.41)],led);
        block(group,[14.4,.4,1],[0,10.7,side*outside],blue);
        for(const x of [-5.2,5.2])pole(group,[x,0,side*outside],[x,5.4,side*outside],.4);
      }
      for(const side of [-1,1])block(group,[2.3,.65,9],[side*(surface.width/2+5.5),.45,0],neutral);
    } else {
      block(group,[10,3,.5],[surface.width/2+6,7,0],black);
      block(group,[9.5,2.6,.08],[surface.width/2+6.3,7,0],led);
      for(const side of [-1,1])block(group,[5.2,.6,1.1],[side*(surface.width/2+2.1),.4,0],neutral);
    }
  }
  root.add(group);
}
