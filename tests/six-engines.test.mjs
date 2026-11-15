import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject,generateSeats } from '../src/model.mjs';
import { buildVenuePlan } from '../src/next/venuePlan.mjs';
import {
  GeometryEngine,SeatingEngine,ArchitectureEngine,OptimizationEngine,ReferenceEngine,ValidationEngine,ExteriorEngine,
  PROCEDURAL_DEMOS,createProceduralProject,generateVenuePackage
} from '../src/next/engines/factory.mjs';

test('geometry engine supports independent arena/stadium dimensions, tiers and reserved regions',()=>{
  const a=GeometryEngine.create(PROCEDURAL_DEMOS.arena);
  const b=GeometryEngine.create(PROCEDURAL_DEMOS.stadium);
  assert.notDeepEqual(a.spec.field,b.spec.field);
  assert.equal(a.spec.tiers.length,2);
  assert.equal(a.voidAt(0,3,2),true);
  assert.equal(a.voidAt(0,3,5),false);
  for(const g of [a,b]){
    for(let tier=0;tier<g.spec.tiers.length;tier++){
      const before=g.point(tier,.72,0),after=g.point(tier,.72,1);
      assert.ok(after.y>before.y);
      assert.ok(Math.hypot(after.x,after.z)>Math.hypot(before.x,before.z));
    }
  }
  assert.throws(()=>GeometryEngine.create({...PROCEDURAL_DEMOS.arena,sections:900}));
  assert.throws(()=>GeometryEngine.create({...PROCEDURAL_DEMOS.arena,voids:[{section:1,tier:5}]}));
});

test('seating engine is deterministic, respects voids and never invents verified seat IDs',()=>{
  const geometry=GeometryEngine.create(PROCEDURAL_DEMOS.arena);
  const first=SeatingEngine.generate(geometry);
  const second=SeatingEngine.generate(geometry);
  assert.equal(first.seats.length,second.seats.length);
  assert.deepEqual(first.seats.slice(0,4),second.seats.slice(0,4));
  assert.equal(first.verifiedSeatIDs,false);
  assert.ok(!first.seats.some(s=>s.sectionId==='3'&&s.tier===0&&Number(s.row)<=3));
  assert.equal(new Set(first.seats.map(s=>s.uid)).size,first.seats.length);
  assert.ok(first.seats.every(s=>s.uid.startsWith('EST-')&&Number.isFinite(s.yaw)));
  assert.ok(first.optimization.relativeError<.04,'Arena demo stays within stated reference tolerance');
});

test('architecture engine reuses the same geometry for an indoor arena and outdoor stadium',()=>{
  for(const demo of [PROCEDURAL_DEMOS.arena,PROCEDURAL_DEMOS.stadium]){
    const geo=GeometryEngine.create(demo),layers=ArchitectureEngine.build(geo,{segments:64,bands:5});
    assert.deepEqual(Object.keys(layers),['decks','fascias','concourse','facade','glazing','trim','aisles','stepEdges','backWall','pilasters','soffit','roofDeck','buildingRoof','brickBase','brickPiers','entryMasonry','entryGlass','towerFrames','towerCrown','towerRibs','entryBrick','entryCurtain','entryFrames','entryCanopy','entryDoors','externalTrim']);
    assert.ok(layers.decks.length>4000);
    assert.ok(layers.facade.length>1000);
    assert.ok(layers.aisles.length>0);
    assert.ok(layers.soffit.length>0 && layers.pilasters.length>0);
    assert.equal(layers.buildingRoof.length>0,demo.template==='indoor-arena');
    assert.equal(layers.roofDeck.length>0,demo.template==='indoor-arena');
    assert.ok(layers.decks.every(Number.isFinite));
    assert.equal(layers.entryMasonry.length>0,Boolean(demo.exterior?.entrances?.length));
    assert.ok(layers.brickBase.length>0===Boolean(demo.exterior));
    assert.ok(layers.facade.every(Number.isFinite));
    const audit=ValidationEngine.validate({seats:SeatingEngine.generate(geo).seats,architectureGeometry:layers,spec:geo.spec});
    assert.deepEqual(audit.errors,[],audit.errors.join('\n'));
  }
  assert.equal(ArchitectureEngine.build(PROCEDURAL_DEMOS.stadium).glazing.length,0);
});

test('shared exterior engine builds validated 3D masonry and glass for distinct perimeter sizes',()=>{
  for(const width of [32,68]){
    const result=ExteriorEngine.build({
      footprint:a=>({x:width*Math.cos(a),z:width*1.22*Math.sin(a)}),
      height:30,segments:96,
      entrances:[{angle:Math.PI/4,role:'primary'},{angle:5*Math.PI/4,role:'secondary'}]
    });
    for(const [layer,mesh] of Object.entries(result)){
      assert.ok(mesh instanceof Float32Array,layer);
      assert.equal(mesh.length%18,0,layer);
      assert.ok(mesh.every(Number.isFinite),layer);
    }
    for(const name of ['metalPanels','metalSeams','brickBase','brickPiers',
      'towerBrick','towerWindows','towerCrown','towerRibs','entryBrick',
      'entryCurtain','entryCanopy','entryFrames']){
      assert.ok(result[name].length>0,name);
    }
    const audit=ValidationEngine.validate({seats:[{uid:'test',x:0,y:0,z:0,yaw:0}],
      architectureGeometry:result});
    assert.deepEqual(audit.errors,[],audit.errors.join('\n'));
  }
  const samePerimeter=a=>({x:31*Math.cos(a),z:39*Math.sin(a)});
  const metal=ExteriorEngine.build({footprint:samePerimeter,height:29,segments:64,profile:'metal-and-brick'});
  const masonry=ExteriorEngine.build({footprint:samePerimeter,height:29,segments:64,profile:'masonry'});
  const glass=ExteriorEngine.build({footprint:samePerimeter,height:29,segments:64,profile:'modern-glass'});
  assert.ok(metal.metalPanels.length>0);
  assert.ok(metal.metalSeams.length>0);
  assert.equal(masonry.metalPanels.length,0,'Masonry profile contains no silver siding');
  assert.equal(masonry.metalSeams.length,0,'Masonry cannot have metal seams');
  assert.ok(masonry.brickBase.length>metal.brickBase.length);
  assert.ok(glass.baseWindows.length>metal.baseWindows.length);
  assert.throws(()=>ExteriorEngine.build({footprint:a=>({x:20*Math.cos(a),z:20*Math.sin(a)}),height:2}));
  assert.throws(()=>GeometryEngine.normalize({...PROCEDURAL_DEMOS.arena,exterior:{profile:'unknown'}}));
});

test('optimization engine reports an impossible target instead of falsifying inventory',()=>{
  const request={...PROCEDURAL_DEMOS.arena,targetCapacity:150000,capacityTolerance:.01};
  const generated=SeatingEngine.generate(request);
  assert.equal(generated.optimization.withinTolerance,false);
  assert.ok(generated.optimization.capacityWarning);
  assert.ok(generated.seats.length<150000);
  assert.equal(OptimizationEngine.seatDiagnostics(generated.seats).collisionCount,0);
});

test('reference engine validates provenance and solves a measured landmark similarity',()=>{
  const pack=ReferenceEngine.pack({venueId:'demo',level:'estimated',
    sources:[{url:'https://example.org/arena-chart',title:'Illustrative chart'}],
    facts:{capacity:1000}});
  assert.equal(pack.coordinatesCertified,false);
  assert.match(pack.notice,/does not verify/);
  assert.throws(()=>ReferenceEngine.pack({sources:[{url:'http://example.org/map'}]}));
  const controls=[[0,0],[1,0],[0,1],[3,2]].map(([x,z])=>({
    source:{x,z},target:{x:10+2*x-z,z:20+x+2*z}
  }));
  const result=ReferenceEngine.calibrate(controls);
  assert.ok(Math.abs(result.scale-Math.sqrt(5))<1e-10);
  assert.ok(result.rmsMetres<1e-10);
  assert.equal(result.independentlyCheckable,true);
  assert.equal(ReferenceEngine.calibrate(controls.slice(0,2)).independentlyCheckable,false);
});

test('new venue package connects all six engines to actual WebGL2 plan without OSU coupling',()=>{
  for(const demo of [PROCEDURAL_DEMOS.arena,PROCEDURAL_DEMOS.stadium]){
    const {project,model,plan,reference,audit}=generateVenuePackage(demo,{detail:'compact'});
    assert.ok(project.proceduralVenue);
    assert.equal(model.seatOrigin,'generated');
    assert.equal(model.seats.length,plan.seats.length);
    assert.equal(plan.arenaInterior,true);
    assert.ok(plan.architectureGeometry.decks.length>1000);
    assert.equal(plan.engineAudit.passed,true,JSON.stringify(plan.engineAudit.errors));
    assert.equal(audit.passed,true);
    assert.equal(reference.coordinatesCertified,false);
    assert.equal(new Set(plan.seats.map(x=>x.uid)).size,plan.seats.length);
    assert.ok(!plan.hasRoster);
  }
  assert.equal(buildVenuePlan(generateSeats(createProject('ncaa'))).architectureGeometry,null);
  const synthetic=createProceduralProject(PROCEDURAL_DEMOS.arena);
  assert.equal(generateSeats(synthetic).seats.length,SeatingEngine.generate(PROCEDURAL_DEMOS.arena).seats.length);
});
