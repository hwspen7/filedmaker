// Parametric NBA fixture kit. Documented feature categories, approximate placement.
import * as THREE from 'three';
import {nbaArchitecturePlan} from './nbaGeometry.mjs';
import {SURFACES, modelPerimeterPoint} from './model.mjs';
const material=(hex,metalness=.05,roughness=.7)=>new THREE.MeshStandardMaterial({color:hex,metalness,roughness,side:THREE.DoubleSide});
const addBox=(parent,w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);parent.add(o);return o;};
function beam(parent,a,b,radius,mat){
 const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
 const o=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),7),mat);
 o.position.copy(start).add(end).multiplyScalar(.5);
 o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
 parent.add(o);return o;
}
function scoreboard(root,spec){
 const dark=material(0x161e2a,.25,.43),led=material(0x28475c,.08,.32),trim=material(0xb7bac1,.45,.45);
 if(spec.kind==='halo'){
  const y=spec.y,r=spec.radius,h=spec.height;
  // Two-sided continuous annular video display with a clear center.
  for(const [radius,inner] of [[r,false],[r-1.05,true]]){
   const panel=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,h,96,1,true),led);
   panel.position.y=y;panel.userData={quality:'reference feature, approximate dimensions',arenaFeature:'halo-board',side:inner?'inner':'outer'};
   root.add(panel);
   for(const up of [-1,1]){
     const rim=new THREE.Mesh(new THREE.TorusGeometry(radius,.15,7,96),trim);
     rim.rotation.x=Math.PI/2;rim.position.y=y+up*h/2;root.add(rim);
   }
  }
  for(let n=0;n<16;n++){
   const a=n*Math.PI/8,x=Math.cos(a)*r,z=Math.sin(a)*r;
   beam(root,[x,y+h/2,z],[x*.8,y+h/2+6,z*.8],.045,trim);
  }
 } else {
  const w=spec.width,h=spec.height,y=spec.y;
  addBox(root,w+.65,h+.55,w+.65,0,y,0,dark);
  for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
   const x=Math.sin(a)*(w+.69)/2,z=Math.cos(a)*(w+.69)/2;
   const f=addBox(root,w,h,.08,x,y,z,led);f.rotation.y=a;
  }
  for(const dx of [-w/3,w/3])beam(root,[dx,y+h/2,0],[dx,y+h/2+6,0],.07,trim);
 }
}
function premiumBand(root,project,height){
 const field=SURFACES[project.surface],shell=material(0x343d48,.24,.53),glass=material(0x537386,.32,.28);
 const radius=Math.max(19,height*1.36);
 const divisions=72;
 // A deliberately simplified continuous ribbon at the club level.
 for(let i=0;i<divisions;i++){
  const a=i*2*Math.PI/divisions,b=(i+1)*2*Math.PI/divisions;
  const p=modelPerimeterPoint(project,field,a,radius),q=modelPerimeterPoint(project,field,b,radius);
  const len=Math.hypot(q.x-p.x,q.z-p.z);
  const bar=addBox(root,len,1.15,.09,(p.x+q.x)/2,height,(p.z+q.z)/2,glass);
  bar.rotation.y=-Math.atan2(q.z-p.z,q.x-p.x);
  if(i%6===0){const cap=addBox(root,.15,1.25,.22,p.x,height,p.z,shell);cap.rotation.y=bar.rotation.y;}
 }
}
function bridge(root,spec){
 const surface=material(0x8e9da4,.42,.39),dark=material(0x344554,.25,.4),glass=material(0x5f8597,.32,.28);
 const {x,y,span}=spec;
 addBox(root,3.6,.46,span,x,y,0,surface);
 for(const sign of [-1,1]){
  addBox(root,.12,1.1,span,x+sign*1.76,y+.66,0,glass);
  addBox(root,.18,.13,span,x+sign*1.76,y+1.23,0,dark);
 }
}
export function addNBAArenaArchitecture(root,project){
 if(project.detailLevel==='draft')return;
 const plan=nbaArchitecturePlan(project);if(!plan)return;
 const g=new THREE.Group();g.name=`ArenaFeatures_${plan.id}`;
 scoreboard(g,plan.scoreboard);
 for(const level of plan.premiumBands)premiumBand(g,project,level);
 for(const data of plan.bridges)bridge(g,data);
 // Indoor framing is deliberately subdued to keep clear sightlines.
 const truss=material(0x5e6871,.46,.48);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,r=18;
  beam(g,[Math.cos(a)*r,plan.ceiling,Math.sin(a)*r],[-Math.cos(a)*r,plan.ceiling,-Math.sin(a)*r],.045,truss);
 }
 g.userData.referenceQuality='documented feature identity, unverified dimensions and positioning';
 root.add(g);
}
