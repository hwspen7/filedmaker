import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTS,createProject,validateProject,makePart,addPart,
  updatePart,removePart,duplicatePart,countSeats,seatsForStand,
  rotatedPoint,exportProject,importProject} from '../src/builder/model.mjs';

test('all event presets start without external documents',()=>{
  for(const activity of ['basketball','concert','community']){
    const project=createProject(activity);
    assert.equal(project.activity,activity);
    assert.ok(project.parts.length>=3);
    assert.ok(countSeats(project)>0);
    assert.equal(validateProject(project),project);
    assert.deepEqual(importProject(exportProject(project)),project);
  }
});

test('basketball creates a four-stand school venue around a court',()=>{
  const project=createProject();
  assert.equal(project.floor.kind,'court');
  assert.equal(project.parts.filter(p=>p.kind==='stand').length,4);
  assert.ok(countSeats(project)>1300);
  assert.ok(countSeats(project)<1700);
});

test('concert has a stage and lights, community events have tables',()=>{
  const concert=createProject('concert');
  assert.ok(concert.parts.some(p=>p.kind==='stage'));
  assert.equal(concert.parts.filter(p=>p.kind==='tower').length,2);
  const event=createProject('community');
  assert.ok(event.parts.some(p=>p.kind==='table'));
  assert.ok(event.parts.some(p=>p.kind==='platform'));
});

test('resizing stand and changing rows regenerates seat placements',()=>{
  const original=createProject(),first=original.parts[0];
  const bigger=updatePart(original,first.id,{rows:first.rows+3,width:first.width+4});
  assert.ok(countSeats(bigger)>countSeats(original));
  assert.equal(original.parts[0].rows,13);
  const positions=seatsForStand(bigger.parts[0]);
  assert.equal(positions.length,bigger.parts[0].rows*
    Math.floor(bigger.parts[0].width/bigger.parts[0].seatWidth));
  assert.ok(positions.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&
    Number.isFinite(s.z)));
});

test('add, duplicate, move and remove components maintain unique IDs',()=>{
  const original=createProject();
  const added=addPart(original,'stage',{x:10,z:7,width:19});
  const stage=added.parts.find(p=>p.kind==='stage');
  assert.equal(original.parts.some(p=>p.kind==='stage'),false);
  const shifted=updatePart(added,stage.id,{x:12,z:8,yaw:45});
  assert.equal(shifted.parts.find(p=>p.id===stage.id).x,12);
  const doubled=duplicatePart(shifted,stage.id);
  assert.equal(doubled.parts.filter(p=>p.kind==='stage').length,2);
  assert.equal(new Set(doubled.parts.map(p=>p.id)).size,doubled.parts.length);
  assert.equal(removePart(doubled,stage.id).parts.filter(p=>p.kind==='stage').length,1);
});

test('component rotation uses a consistent local coordinate system',()=>{
  const part=makePart('stage',{x:5,z:10,yaw:90},'stage-12');
  const point=rotatedPoint(part,2,0,1);
  assert.ok(Math.abs(point.x-5)<1e-8);
  assert.ok(Math.abs(point.z-12)<1e-8);
  assert.equal(point.y,1);
});

test('invalid dimensions and duplicate identifiers are rejected',()=>{
  const model=createProject();
  assert.throws(()=>updatePart(model,'stand-1',{width:-1}),/Width/);
  assert.throws(()=>updatePart(model,'stand-1',{rows:0}),/Rows/);
  assert.throws(()=>updatePart(model,'stand-1',{seatWidth:.1}),/Seat width/);
  assert.throws(()=>addPart(model,'unsupported'),/Unknown/);
  assert.throws(()=>removePart(model,'missing'),/existing/);
  assert.throws(()=>updatePart(model,'stand-1',{unverifiedFlag:true}),/Unsupported/);
  const bad=importProject(exportProject(model));
  bad.parts[1].id=bad.parts[0].id;
  assert.throws(()=>validateProject(bad),/Duplicate/);
});

test('JSON export restores editable project and rejects unknown versions',()=>{
  const model=createProject('community');
  assert.deepEqual(importProject(exportProject(model)),model);
  assert.throws(()=>importProject(JSON.stringify({...model,version:99})),/Unsupported/);
});

test('browser-scale geometry is bounded to avoid unmanageable seats',()=>{
  const model=createProject('basketball');
  const high=updatePart(model,'stand-1',{rows:65,width:75,seatWidth:.4});
  assert.ok(countSeats(high)<24000);
  assert.throws(()=>updatePart(high,'stand-2',{rows:65,width:75,seatWidth:.4}),
    /exceeds 24,000/);
});

test('library includes reusable seating and event components',()=>{
  assert.deepEqual(Object.keys(PARTS),[
    'stand','stage','platform','table','barrier','tower','booth','entrance'
  ]);
});
