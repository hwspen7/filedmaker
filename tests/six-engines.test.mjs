import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject,generateSeats } from '../src/model.mjs';
import { buildVenuePlan } from '../src/next/venuePlan.mjs';
import {
  GeometryEngine,SeatingEngine,ArchitectureEngine,OptimizationEngine,ReferenceEngine,ValidationEngine,
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
    assert.deepEqual(Object.keys(layers),['decks','fascias','concourse','facade','glazing','trim','aisles','stepEdges','backWall','pilasters','soffit','roofDeck','buildingRoof']);
    assert.ok(layers.decks.length>4000);
    assert.ok(layers.facade.length>1000);
    assert.ok(layers.aisles.length>0);
    assert.ok(layers.soffit.length>0 && layers.pilasters.length>0);
    assert.equal(layers.buildingRoof.length>0,demo.template==='indoor-arena');
    assert.equal(layers.roofDeck.length>0,demo.template==='indoor-arena');
    assert.ok(layers.decks.every(Number.isFinite));
    const audit=ValidationEngine.validate({seats:SeatingEngine.generate(geo).seats,architectureGeometry:layers,spec:geo.spec});
    assert.deepEqual(audit.errors,[],audit.errors.join('\n'));
  }
  assert.equal(ArchitectureEngine.build(PROCEDURAL_DEMOS.stadium).glazing.length,0);
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
