import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Script } from 'node:vm';
import { seatingSupportPlan,supportFootprint,schematicAisleSteps } from '../src/seatingSupport.mjs';
import { importTicketRoster,demoTicketRosterCSV } from '../src/seatFirst.mjs';
import { createSchoolProject } from '../src/schoolPipeline.mjs';
import { generateSeats, modelPerimeterPoint, SURFACES, resolveTiers } from '../src/model.mjs';
import { buildSchoolViewerHTML } from '../src/schoolPublisher.mjs';

const make=()=>createSchoolProject('college-gym',{school:'Test University',venue:'Test Gym'});
const seat=(n,x,z=0,sectionId='A',row='1',y=1)=>({number:String(n),x,z,y,yaw:0,sectionId,row,tier:0});

test('imported seat rows create visible, closed support cells for every seat',()=>{
  const plan=seatingSupportPlan([seat(1,0),seat(2,.53),seat(3,1.06)]);
  assert.equal(plan.seatCount,3);
  assert.equal(plan.runCount,1);
  assert.ok(plan.cells.every(c=>c.thickness>=.28&&c.depth>=.8));
  assert.equal(plan.cells[0].endLeft,true);
  assert.equal(plan.cells[1].endLeft,false);
  assert.equal(plan.cells[2].endRight,true);
});
test('support geometry cannot jump a real aisle, section boundary or row',()=>{
  const plan=seatingSupportPlan([seat(1,0),seat(2,.53),seat(3,3.4),seat(1,3.93,0,'B'),seat(1,4.5,0,'A','2')]);
  assert.equal(plan.seatCount,5);
  assert.equal(plan.runCount,4);
  const width=plan.cells.map(c=>c.width);
  assert.ok(width.every(w=>w<=.9));
});
test('support footprint is bounded and uses the camera-facing seat normal',()=>{
  const cell=seatingSupportPlan([seat(1,0)]).cells[0];
  const p=supportFootprint(cell);
  assert.ok(p.frontLeft.z>p.rearLeft.z);
  assert.ok(p.frontRight.x>p.frontLeft.x);
  assert.ok(p.frontRight.x-p.frontLeft.x<=.88);
});
test('long school ticket inventory produces a support cell per imported seat without changing coordinates',()=>{
  const {project}=importTicketRoster(make(),demoTicketRosterCSV());
  const seats=generateSeats(project).seats;
  const before=seats.map(s=>[s.uid,s.x,s.y,s.z]);
  const plan=seatingSupportPlan(seats);
  assert.equal(plan.seatCount,192);
  assert.equal(plan.cells.length,192);
  assert.deepEqual(seats.map(s=>[s.uid,s.x,s.y,s.z]),before);
  assert.equal(generateSeats(project).elevationCount,0);
  assert.ok(plan.runCount>=16); // four sections × four rows, no aisle bridging
});
test('author-provided XYZ rows are not altered by support generation',()=>{
  const p=seatingSupportPlan([seat(1,-4.2,3.7,'West','A',2.73)]);
  assert.equal(p.cells[0].x,-4.2);
  assert.equal(p.cells[0].z,3.7);
  assert.ok(p.cells[0].y<2.73);
});
test('schematic aisle steps are generated only for enabled adjoining sections',()=>{
  const p=make(),tiers=resolveTiers(p);
  const all=schematicAisleSteps(p,SURFACES[p.surface],tiers,modelPerimeterPoint);
  assert.ok(all.length===0||all.every(s=>s.schematic));
  p.sections.forEach(s=>s.enabled=false);
  const none=schematicAisleSteps(p,SURFACES[p.surface],tiers,modelPerimeterPoint);
  assert.equal(none.length,0);
});
test('seat-first aisle steps follow the resolved tier and correct section override',()=>{
  const p=make();p.sections.forEach(s=>s.enabled=true);
  p.sectionProfiles=[{sectionId:p.sections[0].id,tierId:'T1',rows:3,depth:.8,rise:.3,frontShift:.5,heightShift:1}];
  const stairs=schematicAisleSteps(p,SURFACES[p.surface],resolveTiers(p),modelPerimeterPoint);
  assert.ok(stairs.length>0);
  assert.ok(stairs.every(s=>s.width>=0.4));
});
test('seat-first renderer contains complete imported treads and solid support legs',()=>{
  const scene=fs.readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
  assert.match(scene,/supportFootprint\(cell\)/);
  assert.match(scene,/Schematic contiguous seat row treads and risers/);
  assert.match(scene,/addSeatFirstAisles\(this\.root/);
  assert.match(scene,/\.52,\.035/);
});
test('support plan rejects physically invalid construction dimensions',()=>{
  assert.throws(()=>seatingSupportPlan([seat(1,0)],{depth:-1}),/Invalid/);
  assert.throws(()=>seatingSupportPlan([seat(1,0)],{thickness:0}),/Invalid/);
});

test('exported school 3D preview includes seat supports rather than floating cushions',()=>{
 const exported=buildSchoolViewerHTML(make());
 assert.match(exported,/const support=new THREE\.InstancedMesh/);
 assert.match(exported,/world\.add\(support,leg,leg2,seatMesh,backMesh\)/);
});

test('exported standalone browser module parses as JavaScript',()=>{
  const html=buildSchoolViewerHTML(make());
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script);
  assert.doesNotThrow(()=>new Script(script[1]));
});
