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
 assert.equal(plan.seats.length,62240);
 assert.equal(plan.hasRoster,false);
 assert.equal(plan.chairCount,0);
 assert.equal(plan.benchCount,62240);
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
 assert.match(html,/Modeled positions/);
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

test('Ohio State chart profile never generates individual seats from a capacity or diagram',()=>{
 const project={...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'};
 const model=generateSeats(project),plan=buildVenuePlan(model);
 assert.equal(model.sectionFootprints.length,78);
 assert.equal(new Set(model.sectionFootprints.map(section=>section.id)).size,78);
 assert.equal(model.seatOrigin,'chart');
 assert.equal(model.capacity,0);
 assert.equal(model.seats.length,0);
 assert.equal(plan.official.officialCapacity,19500);
 assert.equal(plan.official.inventoryCount,null);
 assert.equal(plan.chairCount,0);
 assert.equal(plan.hasRoster,false);
 assert.ok(plan.framingPoints.length>100);
 assert.equal(generateSeats(project,{audienceLayout:false}).sectionFootprints,undefined);
});

test('Ohio State requires measured XYZ and renders only distinct supplied seats',()=>{
 const project={...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'};
 assert.throws(()=>importTicketRoster(project,'section,row,seat\n105,L,1'),/complete x_m/);
 const header='seat_id,section,row,seat,x_m,y_m,z_m\n';
 assert.throws(()=>importTicketRoster(project,header+'A,105,L,1,-14,,8'),/complete x_m/);
 assert.throws(()=>importTicketRoster(project,header+'A,105,L,1,-14,2,8\nB,105,L,2,-14,2,8'),/unique, complete/);
 const result=importTicketRoster(project,header+'A,105,L,1,-14,2,8\nB,323,A,2,34,15,7');
 const model=generateSeats(result.project),plan=buildVenuePlan(model);
 assert.equal(model.seats.length,2);
 assert.deepEqual(model.seats.map(s=>[s.uid,s.x,s.y,s.z,s.tier]),[
   ['A',-14,2,8,0],['B',34,15,7,2],
 ]);
 assert.equal(plan.chairCount,2);
 assert.equal(plan.official.officialCapacity,19500);
 assert.equal(plan.official.inventoryCount,2);
 assert.equal(plan.official.status,'COUNT_MISMATCH');
 assert.equal(plan.arenaInterior,true);
 const cached=structuredClone(result.project);
 cached.ticketing.coordinates='estimated';
 assert.equal(generateSeats(cached).seats.length,0);
});

test('Ohio State keeps documented access rows and chart features in the native model',async()=>{
 const {schottensteinSectionView}=await import('../src/schottensteinSeating.mjs');
 const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
 assert.deepEqual(model.features.filter(f=>f.kind==='entrance').map(f=>[f.sectionId,f.row]),[
  ['105','U'],['114','S'],['206','A'],['302','A'],['323','A'],
 ]);
 assert.deepEqual(model.features.filter(f=>f.kind!=='entrance').map(f=>f.label),
  ['Band Area','Press Box','Accessible Platform']);
 const upper=schottensteinSectionView(model.seatingRows,'302','D');
 assert.equal(upper.reference,true);
 assert.equal(upper.number,undefined);
 assert.equal(upper.uid,undefined);
 assert.ok(upper.z>0&&upper.x<0);
 assert.equal(schottensteinSectionView(model.seatingRows,'323','C'),null);
 const a=schottensteinSectionView(model.seatingRows,'323','B');
 const b=schottensteinSectionView(model.seatingRows,'323','F');
 assert.ok(a&&b&&b.y-a.y>1.5);
});

test('phase-one native geometry includes a cutaway-aware interior and current board',()=>{
 const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
 const plan=buildVenuePlan(model);
 assert.equal(plan.arenaInterior,true);
 assert.equal(plan.scoreboardHeight,16.3);
 const boxes=decode(plan);
 const ceiling=boxes.filter(box=>box.id===-2);
 assert.ok(ceiling.some(box=>box.pos[1]>29));
 assert.ok(boxes.some(box=>box.id===-3&&Math.abs(box.size[1]-.9144)<.0001));
 assert.ok(boxes.some(box=>box.id===-1&&box.pos[1]>15&&box.size[1]>3.8&&box.size[2]<.4));
 assert.ok(boxes.some(box=>box.id===-1&&box.pos[0]===0&&box.pos[2]===0
   &&Math.abs(box.pos[1]-.051)<1e-5&&Math.abs(box.size[0]-model.surface.width)<1e-5));
 assert.ok(!boxes.some(box=>Math.abs(box.pos[0])<4&&Math.abs(box.pos[2])<4
   &&box.pos[1]>.064&&box.pos[1]<.08));
 assert.ok(plan.instanceData.every(Number.isFinite));
 assert.equal(buildVenuePlan(generateSeats(createOhioStadiumProject())).arenaInterior,false);
});

test('the seating chart clips rendered rows and preserves marked circulation openings',async()=>{
 const {polygonSpans,schottensteinDiagramEdge}=await import('../src/schottensteinSeating.mjs');
 const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
 const footprints=new Map(model.sectionFootprints.map(block=>[block.id,block]));
 assert.equal(footprints.size,78);
 assert.equal(footprints.get('101').outlines.length,2);
 assert.equal(footprints.get('110').outlines.length,2);
 assert.ok(footprints.get('114').outlines[0].length>4);
 assert.ok(schottensteinDiagramEdge.length>8);
 const outside=model.seatingRows.filter(row=>{
  const x=(row.left.x+row.right.x)/2,z=(row.left.z+row.right.z)/2;
  return !polygonSpans(footprints.get(row.sectionId).outlines,x).some(([low,high])=>low-1e-6<=z&&z<=high+1e-6);
 });
 assert.equal(outside.length,0,JSON.stringify(outside.slice(0,4)));
});
