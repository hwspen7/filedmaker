import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSchottensteinCenterProject,createOhioStadiumProject } from '../src/venues.mjs';
import { createSchoolProject } from '../src/schoolPipeline.mjs';
import { importTicketRoster } from '../src/seatFirst.mjs';
import { generateSeats } from '../src/model.mjs';
import { seatViewAnchors } from '../src/view.mjs';
import { buildVenuePlan } from '../src/next/venuePlan.mjs';
import { schottensteinDeckHeight, schottensteinDeckPoint, allocateSeats } from '../src/schottensteinSeating.mjs';
import { buildSchottensteinDecks } from '../src/next/schottensteinInterior.mjs';
import { NativeVenueRenderer } from '../src/next/webgl.js';
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
  const regular = ['301','302','303','305','306','308','319','320','334'].map(sectionRows);
  assert.ok(regular.every(rows => rows[0].y > 14.9 && rows[0].y < 16
    && rows.at(-1).y > 27.9 && rows.at(-1).y < 29.1));
  const restored = ['321','322','323','324','325','326'].map(sectionRows);
  assert.ok(restored.every(rows => rows.length===21 && rows[0].row==='A'
    && rows.at(-1).row==='U' && Math.abs(rows.at(-1).y-28.55)<.05),
    'Restored media-side banks must reach the same U-row elevation');
  const treadHeight = new Map(model.seatingRows.map(row=>[row.sectionId+':'+row.row,row.y]));
  for(const seat of model.seats){
    assert.equal(seat.y,treadHeight.get(seat.sectionId+':'+seat.row),'Each chair sits on its level tread');
  }
  for(let slot=0;slot<=20;slot++){
    const elevations=regular.map(rows=>rows.find(row=>row.slot===slot).y);
    assert.equal(new Set(elevations).size,1,'Regular upper banks share row elevations');
  }
  for(const tier of [1,2]){
    const radii=Array.from({length:256},(_,i)=>{
      const p=schottensteinDeckPoint(tier,i*Math.PI/128,.8);
      return {r:Math.hypot(p.x,p.z),y:schottensteinDeckHeight(tier,p)};
    });
    assert.ok(Math.max(...radii.map(p=>p.y))-Math.min(...radii.map(p=>p.y))<.18,
      'Terrace rake stays even around the building');
  }
  const violations=[];
  for(const section of model.sectionFootprints){
    const rows=new Map();
    for(const seat of model.seats.filter(s=>s.sectionId===section.id)){
      const k=String(seat.row);
      if(!rows.has(k))rows.set(k,[]);
      rows.get(k).push(seat);
    }
    for(const [row,members] of rows){
      const sorted=members.sort((a,b)=>Number(a.number)-Number(b.number));
      for(let i=1;i<sorted.length;i++){
        const a=sorted[i-1],b=sorted[i],d=Math.hypot(a.x-b.x,a.z-b.z);
        if(d<(model.project.seatPitch||.53)*1.7&&Math.abs(a.y-b.y)>.13)
          violations.push({section:section.id,row,first:a.uid,second:b.uid,d,dy:a.y-b.y});
      }
    }
  }
  assert.equal(plan.invalidRows, 0, JSON.stringify(violations.slice(0,12)));
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

test('basketball preview keeps documented club rows while filling former Press Box seating gap',()=>{
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
 assert.ok(inRow('322','N').length>0);
 assert.ok(inRow('114','P').length>0);
 const upperCorner=inRow('302','D');
 assert.ok(upperCorner.length>0);
 assert.ok(upperCorner.every(s=>s.z>0&&s.x<0));
 for(const row of ['C','E','N','U'])assert.ok(inRow('323',row).length>0,
   'Restored section 323 contains the previously omitted row '+row);
 for(const id of ['321','322','323','324','325','326'])
   assert.ok(inRow(id,'U').length>0,id+' reaches the full-height upper rim');
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
 assert.ok(plan.deckGeometry?.length > 200_000);
 assert.ok(plan.deckGeometry.every(Number.isFinite));
 for (let i = 0; i < plan.deckGeometry.length; i += 18) {
   const [ax,ay,az,nx,ny,nz,bx,by,bz,,,,cx,cy,cz] = plan.deckGeometry.subarray(i,i+18);
   const x = (by-ay)*(cz-az) - (bz-az)*(cy-ay);
   const y = (bz-az)*(cx-ax) - (bx-ax)*(cz-az);
   const z = (bx-ax)*(cy-ay) - (by-ay)*(cx-ax);
   assert.ok(x*nx + y*ny + z*nz > 0, 'Deck triangle faces the rendered side');
 }
 const rims=[new Map(),new Map()];
 for(let i=0;i<plan.deckGeometry.length;i+=6){
   const [x,y,z,,ny]=plan.deckGeometry.subarray(i,i+6);
   if(y<0||ny!==0)continue;
   const edge=rims[y<13?0:1];
   const angle=(Math.round(Math.atan2(z,x)*128/Math.PI)+256)%256;
   const radius=Math.hypot(x,z);
   const [inner,outer]=edge.get(angle)??[radius,radius];
   edge.set(angle,[Math.min(inner,radius),Math.max(outer,radius)]);
 }
 for(const rim of rims){
   const radii=[...rim].sort(([a],[b])=>a-b).map(([,pair])=>pair);
   assert.equal(radii.length,256);
   for(let i=0;i<radii.length;i++){
     const a=radii[(i+radii.length-1)%radii.length],b=radii[i],c=radii[(i+1)%radii.length];
     assert.ok(b.every((r,side)=>Math.abs(a[side]+c[side]-2*r)<.55),'The deck lip avoids radial spikes');
   }
 }
 assert.equal(plan.arenaInterior,true);
 assert.equal(plan.scoreboardHeight,16.3);
 assert.deepEqual(plan.features.map(feature=>feature.label),
   ['Band Area','Accessible Platform']);
 const boxes=decode(plan);
 assert.ok(!boxes.some(box=>box.id===-4), 'The gray elliptical floor plate must not exist in any view');
 assert.ok(!plan.deckGeometry.some((number,i)=>i%6===1&&number===-1), 'The decorative plinth must not reappear');
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
 const trusses=boxes.filter(box=>box.id===-2&&box.size[0]>40&&box.size[2]<1);
 assert.ok(trusses.length>10);
 const lowestTruss=Math.min(...trusses.map(box=>box.pos[1]-box.size[1]/2));
 const highestSeat=Math.max(...model.seats.map(seat=>seat.y));
 assert.ok(lowestTruss-highestSeat>8.5, 'Raised roof leaves headroom above the last row');
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

test('manual terrace refinements remove isolated slits and retain wide rear rows',()=>{
 const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
 const spans=(id,label)=>model.seatingRows.filter(row=>row.sectionId===id&&row.row===label);
 for(const id of ['313','315','320'])assert.equal(spans(id,'O').length,1);
 for(const id of ['312','313','315','316','318','319','320']){
   const [secondLast]=spans(id,'T'),[last]=spans(id,'U');
   assert.ok(last.width>=secondLast.width*.88,id+' keeps a broad final tread');
 }
 const rows=label=>spans('314',label);
 assert.equal(rows('B').length,0,'The mapped accessible gap remains open');
 assert.ok(spans('323','C').length>0,'The artificial Press Box row gap is closed');
 assert.ok(rows('U')[0].y-rows('T')[0].y>rows('I')[0].y-rows('H')[0].y,
   'The terrace rises progressively towards the back');
});

test('manual bowl fitting also fills clipped lower and club banks',()=>{
 const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
 const count=(id,row)=>model.seats.filter(seat=>seat.sectionId===id&&seat.row===row).length;
 for(const [id,last,previous] of [['117','U','T'],['201','J','I'],['210','J','I'],
   ['228','J','I'],['303','U','T'],['310','U','T'],['327','U','T'],['334','U','T']]){
   assert.ok(count(id,last)>=Math.floor(count(id,previous)*.85),id+' keeps a continuous rear bank');
 }
 const row=(id,label)=>model.seatingRows.find(item=>item.sectionId===id&&item.row===label);
 const rake=id=>(row(id,'U').y-row(id,'T').y)/row(id,'U').depth;
 assert.ok(Math.abs(rake('313')-rake('314'))<.10);
 assert.ok(Math.abs(rake('314')-rake('315'))<.10);
 assert.equal(count('314','B'),0);
 assert.equal(count('206','A'),14);
 assert.equal(count('206','J'),18);
});

test('manual front banks use three contiguous rows without occupying the access landing',()=>{
 const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
 const rows=id=>model.seatingRows.filter(row=>row.sectionId===id);
 for(const id of ['304','307','314','331']){
   const section=model.sectionFootprints.find(block=>block.id===id);
   const bank=rows(id);
   assert.deepEqual(bank.slice(0,3).map(row=>row.row),['A','A2','A3']);
   const depth=row=>-section.nx*(row.left.x+row.right.x)*.5-section.nz*(row.left.z+row.right.z)*.5;
   const front=bank[2],rear=bank[3];
   assert.equal(rear.row,'H');
   assert.ok(depth(rear)-depth(front)-(front.depth+rear.depth)*.5>=1.05);
 }
 const restored=rows('323');
 assert.deepEqual(restored.slice(0,4).map(row=>row.row),['A','B','C','D']);
 for(const id of ['321','322','323','324','325']){
   const bank=rows(id);
   assert.ok(bank.at(-1).width>=bank.at(-2).width*.85,id+' keeps a full final row');
 }
});

test('Schottenstein overview hides the gray backing while preserving seat-view geometry',()=>{
 const p={...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'};
 const model=generateSeats(p),plan=buildVenuePlan(model);
 assert.ok(plan.deckGeometry.length>200000);
 for(let i=1;i<plan.deckGeometry.length;i+=6)
   assert.ok(plan.deckGeometry[i]>1,'Only elevated seating decks belong to the native mesh');
 assert.equal(buildSchottensteinDecks([],model.sectionFootprints,false).length,0);
 assert.equal(plan.chairCount,19049);
 assert.equal(plan.official.officialCapacity,19049);
 assert.equal(new Set(plan.seats.map(seat=>seat.uid)).size,19049);
 assert.ok(plan.pedestalGeometry.length > 8000, 'Thin display base has its own geometry');
 assert.ok(plan.pedestalTrimGeometry.length > 5000);
 assert.ok(plan.pedestalGeometry.every(Number.isFinite));
 assert.ok(plan.pedestalTrimGeometry.every(Number.isFinite));
 const pedestalYs=[];
 for(let i=1;i<plan.pedestalGeometry.length;i+=6){
   const y=plan.pedestalGeometry[i];pedestalYs.push(y);
   assert.ok(y<=-.20,'Pedestal cannot rise above the basketball court');
 }
 assert.ok(Math.min(...pedestalYs)<-2.2,'Architectural foundation must be a substantial modeled plinth');
 for(const mode of ['overview','top','section']) {
   assert.equal(NativeVenueRenderer.deckVisibleInMode(plan,mode),false,mode);
   assert.equal(NativeVenueRenderer.pedestalVisibleInMode(plan,mode),true,mode);
 }
 assert.equal(NativeVenueRenderer.pedestalVisibleInMode(plan,'human'),false);
 assert.equal(NativeVenueRenderer.deckVisibleInMode(plan,'human'),false);
 assert.equal(NativeVenueRenderer.deckVisibleInMode({deckGeometry:new Float32Array(0)},'human'),false);
 assert.ok(!decode(plan).some(box=>box.id===-4));
 const webgl=read('../src/next/webgl.js');
 assert.match(webgl,/alpha:true/);
 assert.match(webgl,/clearColor\(0,0,0,0\)/);
});
test('bulk seat allocation preserves eligible row runs without adding inventory',()=>{
 const spans=[{width:4,count:1},{width:.75,count:0}];
 allocateSeats(spans,2);
 assert.deepEqual(spans.map(s=>s.count),[2,1]);
});

test('Schottenstein native viewport has no near-white backdrop or beige deck shading',()=>{
 const css=read('../studio.css'),shader=read('../src/next/webgl.js');
 assert.match(css,/background:radial-gradient\(ellipse at 50% 34%,#faf8f5 0%,#f0eae3 58%,#dfd8d0 100%\)/);
 assert.doesNotMatch(css,/\.viewport\{[^}]*background:#e8eef0/);
 assert.doesNotMatch(shader,/vec3\(\.55,\.60,\.62\)/);
 assert.match(shader,/uDeck>12\.5/);
 assert.match(shader,/\['backWall',13\]/);
 assert.match(shader,/\['galleryGlass',15\]/);
 assert.match(shader,/\['pilasters',18\]/);
 assert.match(shader,/\['soffit',20\]/);
 assert.match(shader,/\['roofDeck',22\]/);
 assert.match(shader,/\['radialBeams',23\]/);
 assert.doesNotMatch(shader,/\['exitGlyphs',16\]/);
 assert.match(shader,/uDeck>2\.5/);
 assert.match(shader,/uDeck>1\.5/);
});

test('Schottenstein elevated deck trims its outside edge to modeled seats',()=>{
 const source=read('../src/next/schottensteinInterior.mjs');
 assert.match(source,/occupiedFar/);
 assert.match(source,/outer\+\.22/);
 const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
 const deck=buildVenuePlan(model).deckGeometry;
 assert.ok(deck.length>200000);
 assert.ok(deck.every(Number.isFinite));
});
