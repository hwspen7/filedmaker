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

test('Ohio State basketball diagram keeps source section numbers and illustrative coordinates distinct', () => {
  const project = {...createSchottensteinCenterProject(), audienceLayout:'schottenstein-men'};
  const model = generateSeats(project);
  const plan = buildVenuePlan(model);
  assert.equal(model.sectionFootprints.length, 78);
  assert.equal(new Set(model.sectionFootprints.map(section => section.id)).size, 78);
  assert.ok(model.seats.every(s => s.uid.startsWith('DEMO-')));
  assert.ok(model.seats.some(s => s.sectionId === '105' && s.tier === 0 && s.x < 0));
  assert.ok(model.seats.some(s => s.sectionId === '114' && s.tier === 0 && s.z < 0));
  assert.ok(model.seats.some(s => s.sectionId === '323' && s.tier === 2 && s.x > 0));
  assert.ok(model.seats.every(s => Math.sin(s.yaw)*s.x + Math.cos(s.yaw)*s.z < 0));
  for(const id of ['111','117','128','134']){
    const {yaw}=model.seats.find(s=>s.sectionId===id);
    assert.ok(Math.abs(Math.cos(yaw))>2*Math.abs(Math.sin(yaw)),`Section ${id} faces the near end of the court`);
  }
  const sectionRows = id => model.seatingRows.filter(row => row.sectionId === id);
  for (const section of model.sectionFootprints) {
    const rows = sectionRows(section.id);
    const bySlot = new Map();
    for (const row of rows) {
      if (bySlot.has(row.slot)) assert.equal(row.y, bySlot.get(row.slot));
      bySlot.set(row.slot, row.y);
    }
    const heights = [...bySlot.values()];
    assert.ok(heights.every((height, i) => i === 0 || height > heights[i - 1]), `Section ${section.id}`);
  }
  const regular = ['301','302','303','305','306','308'].map(sectionRows);
  assert.ok(regular.every(rows => Math.abs(rows[0].y - 14.65) < .0001
    && Math.abs(rows.at(-1).y - 24.05) < .0001));
  const pressSide = ['321','322','323','324','325','326'].map(sectionRows);
  assert.ok(pressSide.every(rows => rows.at(-1).y < 21));
  assert.ok(sectionRows('304')[0].y > regular[3][0].y);
  assert.ok(model.seats.every(s =>
    Math.abs(s.x) > model.surface.width/2 || Math.abs(s.z) > model.surface.length/2));
  assert.equal(plan.hasRoster, false);
  assert.equal(plan.official.officialCapacity,19049);
  assert.equal(plan.official.capacityWithStudents,18809);
  assert.equal(plan.chairCount,19049);
  assert.ok(model.seats.every(seat=>seat.seatWidth>=.48));
  assert.equal(plan.positionCollisions, 0);
  assert.ok(plan.roundedCount > 0);
  assert.equal(buildVenuePlan(model, {detail:'compact'}).roundedCount, 0);
  assert.equal(generateSeats(project, {audienceLayout:false}).sectionFootprints, undefined);
});

test('chart-backed roster locations are independent of CSV order and keep supplied IDs', () => {
  const project = {...createSchottensteinCenterProject(), audienceLayout:'schottenstein-men'};
  const header='seat_id,section,row,seat\n';
  const lines=['A,105,L,1','B,105,L,2','C,114,M,8','D,323,B,9','E,323,A,10'];
  const load = rows => generateSeats(importTicketRoster(project, header+rows.join('\n')).project);
  const a=load(lines),b=load([...lines].reverse());
  assert.equal(a.project.ticketing.coordinates,'estimated');
  assert.equal(a.capacity,lines.length);
  for(const seat of a.seats){
    const match=b.seats.find(s=>s.uid===seat.uid);
    assert.deepEqual([seat.x,seat.y,seat.z],[match.x,match.y,match.z]);
  }
  const one=a.seats.find(s=>s.uid==='A'),two=a.seats.find(s=>s.uid==='B');
  assert.ok(one.z>two.z);
  assert.ok(a.seats.some(s=>s.uid==='D'&&s.tier===2&&s.x>0));
  assert.throws(()=>load(['U,UNKNOWN,1,1']),/Supply XYZ/);
});

test('phase-one basketball preview models documented club rows and the upper aisle gap',()=>{
 const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
 const inRow=(section,row)=>model.seats.filter(s=>s.sectionId===section&&s.row===row);
 assert.equal(inRow('206','A').length,14);
 assert.equal(inRow('206','E').length,14);
 assert.equal(inRow('206','F').length,18);
 assert.equal(inRow('206','J').length,18);
 assert.ok(inRow('105','D').length>0);
 assert.ok(inRow('104','AA').length>0);
 assert.equal(inRow('106','AA').length,0);
 assert.ok(inRow('106','U').length>0);
 assert.ok(inRow('122','AA').length>0);
 for(const section of model.sectionFootprints){
   const rows=new Map();
   for(const seat of model.seats){
     if(seat.sectionId===section.id)rows.set(seat.row,(rows.get(seat.row)??0)+1);
   }
   assert.equal(rows.size,section.rows,`Section ${section.id} row coverage`);
   if(section.publishedRowCounts)assert.deepEqual([...rows.values()],[14,14,14,14,14,18,18,18,18,18]);
 }
 assert.ok(inRow('305','U').length>0);
 assert.ok(inRow('304','H').length>0);
 assert.equal(inRow('304','B').length,0);
 assert.equal(inRow('322','N').length,0);
 assert.ok(inRow('114','P').length>0);
 const upperCorner=inRow('302','D');
 assert.ok(upperCorner.length>0);
 assert.ok(upperCorner.every(s=>s.z>0&&s.x<0));
 assert.equal(inRow('323','C').length,0);
 assert.equal(inRow('323','E').length,0);
 const a=inRow('323','B')[0],b=inRow('323','F')[0],c=inRow('323','G')[0];
 assert.ok(a&&b&&c&&b.y-a.y>3.9*(c.y-b.y));
 assert.equal(new Set(model.seats.map(s=>s.uid)).size,model.seats.length);
});

test('surveyed Ohio State import keeps supplied positions and the native section map',()=>{
 const project={...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'};
 const header='seat_id,section,row,seat,x_m,y_m,z_m\n';
 const load=csv=>importTicketRoster(project,csv,'Survey fixture',{requireCoordinates:true});
 assert.throws(()=>load('section,row,seat\n105,D,1'),/requires x_m, y_m and z_m/);
 assert.throws(()=>load(header+'A,105,D,1,-13,,5'),/requires x_m, y_m and z_m/);
 assert.throws(()=>load(header+'A,105,D,1,-13,1,5\nB,105,D,2,-13,1,5'),/distinct XYZ/);
 const {project:imported}=load(header+'A,105,D,1,-13,1,5\nB,323,M,2,34,16,-7');
 const model=generateSeats(imported),plan=buildVenuePlan(model);
 assert.equal(model.sectionFootprints.length,78);
 assert.equal(plan.arenaInterior,true);
 assert.equal(plan.hasRoster,true);
 assert.deepEqual(plan.seats.map(({uid,tier,x,y,z})=>[uid,tier,x,y,z]),[
   ['A',0,-13,1,5],['B',2,34,16,-7],
 ]);
 assert.equal(plan.chairCount,2);
 assert.equal(plan.official.officialCapacity,19049);
 assert.equal(plan.official.capacityWithStudents,18809);
 assert.equal(plan.official.inventoryVsOfficial,2-19049);
 assert.equal(generateSeats(project).seats.length,19049);
});

test('phase-one native geometry includes a cutaway-aware interior and current board',()=>{
 const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
 const plan=buildVenuePlan(model);
 assert.equal(plan.arenaInterior,true);
 assert.equal(plan.scoreboardHeight,16.3);
 assert.deepEqual(plan.features.map(feature=>feature.label),
   ['Band Area','Press Box','Accessible Platform']);
 const boxes=decode(plan);
 const courtside=boxes.filter(box=>box.id===-1&&Math.abs(box.size[0]-.456)<1e-5&&Math.abs(box.size[2]-.42)<1e-5);
 assert.ok(courtside.length>100);
 assert.ok(courtside.every(box=>Math.abs(box.pos[0])>model.surface.width/2
   ||Math.abs(box.pos[2])>model.surface.length/2));
 assert.ok(!boxes.some(box=>box.id===-1&&Math.abs(box.size[0]-.038)<1e-5
   &&Math.abs(box.size[1]-.72)<1e-5));
 assert.ok(!boxes.some(box=>box.id===-1&&box.pos[1]<.6&&box.size[0]>.8
   &&Math.abs(box.size[2]-.23)<1e-5));
 assert.ok(!boxes.some(box=>box.id===-1&&box.pos[1]>.3&&box.size[0]>.4
   &&Math.abs(box.size[1]-.19)<1e-5), 'No synthetic stair treads in the bowl');
 const widthByRow = new Map();
 const rowKey = ({sectionId, row}) => sectionId + '/' + row;
 for (const seat of model.seats) {
   const key = rowKey(seat);
   widthByRow.set(key, (widthByRow.get(key) ?? 0) + seat.seatWidth);
 }
 for (const row of model.seatingRows) {
   const key = rowKey(row);
   widthByRow.set(key, widthByRow.get(key) - row.width);
 }
 assert.ok([...widthByRow.values()].every(width => Math.abs(width) < 1e-8),
   'Row supports end at the occupied seat span');
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
 const outside=model.seats.filter(seat=>{
  const spans=polygonSpans(footprints.get(seat.sectionId).outlines,seat.x);
  return !spans.some(([low,high])=>low-1e-6<=seat.z&&seat.z<=high+1e-6);
 });
 assert.equal(outside.length,0,JSON.stringify(outside.slice(0,4)));
 for(const feature of model.features.filter(item=>item.outline)){
   const inside=model.seats.filter(seat=>seat.sectionId===feature.sectionId&&
     polygonSpans([feature.outline],seat.x).some(([low,high])=>seat.z>low&&seat.z<high));
   assert.equal(inside.length,0,feature.label);
 }
});
