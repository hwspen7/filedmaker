import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTS,ASSEMBLIES,SURFACES,createProject,validateProject,makePart,addPart,
  updatePart,removePart,duplicatePart,placeAssembly,countSeats,seatsForStand,
  curvedLocalPoint,parseOBJ,importOBJAsset,rotatedPoint,exportProject,
  importProject} from '../src/builder/model.mjs';

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

test('component library includes sports, training gear and event assemblies',()=>{
  assert.ok(Object.keys(PARTS).length>=25);
  for(const kind of ['basketball_court','volleyball_court','badminton_court',
    'treadmill','squat_rack','hoop','net','custom_model']){
    assert.ok(PARTS[kind],kind);
  }
  assert.ok(Object.keys(ASSEMBLIES).length>=5);
  assert.ok(SURFACES.includes('basketball_court'));
});

test('three-court gym generates three independently editable courts and six hoops',()=>{
  const gym=createProject('training');
  const courts=gym.parts.filter(p=>p.kind==='basketball_court');
  assert.equal(courts.length,3);
  assert.deepEqual(courts.map(p=>p.x).sort((a,b)=>a-b),[-27,0,27]);
  assert.equal(gym.parts.filter(p=>p.kind==='hoop').length,6);
  assert.ok(gym.parts.some(p=>p.kind==='squat_rack'));
  assert.deepEqual(importProject(exportProject(gym)),gym);
});

test('multi-sport complex combines distinct court types and fitness equipment',()=>{
  const complex=createProject('complex');
  for(const kind of ['basketball_court','volleyball_court',
    'badminton_court','pickleball_court','futsal_court','treadmill','bike']){
    assert.ok(complex.parts.some(p=>p.kind===kind),kind);
  }
  assert.ok(complex.floor.width>=100);
  assert.deepEqual(importProject(exportProject(complex)),complex);
});

test('curved stands recalculate every row along a real circular arc',()=>{
  const baseline=createProject();
  const stand=baseline.parts[0];
  const changed=updatePart(baseline,stand.id,{shape:'arc',arcAngle:110});
  const arc=changed.parts[0];
  const positions=seatsForStand(arc);
  const front=positions.filter(p=>p.row===1);
  const back=positions.filter(p=>p.row===arc.rows);
  assert.ok(back.length>front.length,'rear rows follow the longer circular arc');
  assert.ok(front.some(p=>p.x!==front[0].x&&p.z!==front[0].z));
  assert.notEqual(countSeats(changed),countSeats(baseline));
  assert.equal(positions.length,countSeats(changed)-countSeats(baseline)+
    seatsForStand(stand).length);
  assert.deepEqual(importProject(exportProject(changed)),changed);
  const center=curvedLocalPoint(arc,0,0);
  assert.equal(center.x,0);
  assert.equal(center.z,0);
});

test('arc radius and unsupported shapes are validated',()=>{
  const gym=createProject();
  assert.throws(()=>updatePart(gym,'stand-1',
    {shape:'arc',arcAngle:221}),/Arc angle/);
  assert.throws(()=>updatePart(gym,'stand-1',
    {shape:'spiral'}),/Stand shape/);
  assert.throws(()=>updatePart(gym,'stand-1',
    {shape:'arc',arcAngle:220,width:4,depth:7.8}),/radius/);
});

test('ready-made basketball and fitness zones are additive and atomic',()=>{
  const initial=createProject('community');
  const withCourt=placeAssembly(initial,'basketball_zone',12,4);
  assert.equal(withCourt.parts.length,initial.parts.length+
    ASSEMBLIES.basketball_zone.items.length);
  assert.equal(withCourt.parts.filter(p=>p.kind==='hoop').length,2);
  const withFitness=placeAssembly(withCourt,'fitness_zone',-15,8);
  assert.ok(withFitness.parts.some(p=>p.kind==='training_bench'));
  assert.equal(initial.parts.length,7,'prior scene remains unchanged');
  assert.throws(()=>placeAssembly(initial,'invalid-assembly'),/Unsupported assembly/);
});

test('external OBJ importer handles negative-index faces and preserves license metadata',()=>{
  const quad=[
    'o crate','v 0 0 0','v 2 0 0','v 2 1 2','v 0 1 2','f -4 -3 -2 -1'
  ].join('\n');
  const mesh=parseOBJ(quad);
  assert.equal(mesh.vertices.length,4);
  assert.equal(mesh.faces.length,2);
  const original=createProject();
  const imported=importOBJAsset(original,quad,{
    sourceName:'CC0-crate.obj',sourceLicense:'CC0'
  });
  const asset=imported.parts.at(-1);
  assert.equal(asset.kind,'custom_model');
  assert.equal(asset.sourceLicense,'CC0');
  assert.equal(asset.mesh.faces.length,2);
  assert.deepEqual(importProject(exportProject(imported)),imported);
  assert.equal(original.parts.length,4);
});

test('OBJ rejects malformed indices, oversized geometry and non-mesh text',()=>{
  assert.throws(()=>parseOBJ('f 1 2 3'),/out of range/);
  assert.throws(()=>parseOBJ('v 0 0 0\nv 1 0 0'),/vertices and faces/);
  assert.throws(()=>parseOBJ('v 0 0 NaN\nf 1 2 3'),/malformed/);
  const oversized=Array.from({length:2501},(_,i)=>'v '+i+' 0 0').join('\n');
  assert.throws(()=>parseOBJ(oversized),/2500/);
  assert.throws(()=>importOBJAsset(createProject(),'not an obj'),/vertices and faces/);
});
