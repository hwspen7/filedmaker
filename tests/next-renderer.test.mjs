import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSchottensteinCenterProject,createOhioStadiumProject } from '../src/venues.mjs';
import { createSchoolProject } from '../src/schoolPipeline.mjs';
import { importTicketRoster } from '../src/seatFirst.mjs';
import { generateSeats } from '../src/model.mjs';
import { seatViewAnchors } from '../src/view.mjs';
import { buildVenuePlan } from '../src/next/venuePlan.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const decode=plan=>{const a=plan.instanceData,result=[];for(let i=0;i<a.length;i+=11)result.push({pos:[a[i],a[i+1],a[i+2]],size:[a[i+3],a[i+4],a[i+5]],yaw:a[i+6],id:a[i+10]});return result;};
test('Ohio Stadium always distinguishes official capacity from synthetic model',()=>{
 const p=createOhioStadiumProject(),m=generateSeats(p),plan=buildVenuePlan(m);
 assert.equal(plan.official.officialCapacity,102041);
 assert.ok(plan.seats.length>60000 && plan.seats.length<plan.official.officialCapacity);
 assert.equal(p.aisles.length,0);
 assert.equal(plan.hasRoster,false);
 assert.equal(plan.chairCount,0);
 assert.equal(plan.benchCount,m.seats.length);
 assert.ok(plan.instanceCount>m.seats.length);
});
test('Schottenstein generated seats get compact furniture without oversized backrests',()=>{
 const p=createSchottensteinCenterProject(),m=generateSeats(p),plan=buildVenuePlan(m);
 assert.equal(plan.chairCount,m.seats.length);
 assert.equal(plan.official.officialCapacity,19500);
 const boxes=decode(plan).filter(a=>a.id>=0);
 const max=boxes.reduce((n,b)=>Math.max(n,...b.size),0);
 assert.ok(max<.6,`Seat components must stay below 0.6m, got ${max}`);
 const near=boxes.filter(b=>b.id===0);
 assert.ok(near.length>=4);
 const a=seatViewAnchors(m.seats[0]).eye;
 assert.ok(a.y-m.seats[0].y>1);
});
test('new model has no invalid geometry or non-finite GPU attributes',()=>{
 for(const fn of [createOhioStadiumProject,createSchottensteinCenterProject]){
  const model=generateSeats(fn()),p=buildVenuePlan(model);
  assert.equal(p.invalidRows,0);
  assert.ok(p.rowRuns>100);
  assert.ok(p.instanceData.every(Number.isFinite));
  assert.equal(p.instanceData.length,p.instanceCount*11);
 }
});
test('scene plan keeps actual ticket identities and never fills to official capacity',()=>{
 const p=createSchoolProject('college-gym',{school:'Fixture School',venue:'Gym'});
 const text='section,row,seat,seat_id,tier\nHOME,A,1,HOME-A-1,T1\nHOME,A,2,HOME-A-2,T1\nAWAY,A,1,AWAY-A-1,T1';
 const imported=importTicketRoster(p,text),m=generateSeats(imported.project),plan=buildVenuePlan(m);
 assert.equal(plan.hasRoster,true);assert.equal(plan.seats.length,3);
 assert.deepEqual(plan.seats.map(s=>s.uid),['HOME-A-1','HOME-A-2','AWAY-A-1']);
 assert.equal(plan.official.inventoryCount,3);
 assert.ok(plan.instanceData.every(Number.isFinite));
});
test('changes of palette affect materials but not seat IDs or positions',()=>{
 const m=generateSeats(createSchottensteinCenterProject());
 const a=buildVenuePlan(m,{palette:['#334455','#556677','#778899','#99aabb']});
 const b=buildVenuePlan(m,{palette:['#ca485a','#b06071','#b57882','#cb8c94']});
 assert.equal(a.instanceCount,b.instanceCount);
 assert.equal(a.seats[0].uid,b.seats[0].uid);
 assert.equal(a.seats[0].x,b.seats[0].x);
 assert.notEqual(a.instanceData[7],b.instanceData[7]);
});
test('webgl shader handles camera-relative removal of current seat parts',()=>{
 const webgl=read('../src/next/webgl.js');
 assert.match(webgl,/aSeatId>=0\./);
 assert.match(webgl,/uHuman/);
 assert.match(webgl,/drawArraysInstanced/);
 assert.match(webgl,/getContext\('webgl2'/);
 assert.doesNotMatch(webgl,/cdn\.jsdelivr|three\/addons/);
});
test('new default homepage includes source and mismatch disclosure and requires no CDN',()=>{
 const html=read('../index.html');
 assert.match(html,/Published capacity/);
 assert.match(html,/Visual seat positions/);
 assert.match(html,/Imported ticket IDs/);
 assert.match(html,/Not a live ticket inventory/);
 assert.doesNotMatch(html,/cdn\.jsdelivr/);
 assert.match(html,/src\/next\/studio\.js/);
 assert.match(html,/legacy\//);
});
test('school editor and viewer share native rendering adapter',()=>{
 const school=read('../school/studio.js'),viewer=read('../viewer/viewer.js');
 assert.match(school,/next\/compatScene\.js/);
 assert.match(viewer,/next\/compatScene\.js/);
 assert.doesNotMatch(school,/from '\.\.\/src\/scene\.js'/);
});
test('legacy editor remains an explicit optional workflow',()=>{
 const old=read('../legacy/index.html');assert.match(old,/photoCalibrationDialog/);
 assert.match(old,/src\/app\.js/);
});
