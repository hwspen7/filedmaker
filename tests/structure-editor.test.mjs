import test from 'node:test';
import assert from 'node:assert/strict';
import {newVenue,normalizeVenue} from '../src/workbench/contract.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {buildWorkbenchPreview} from '../src/workbench/adapter.mjs';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {STRUCTURE_CATALOG,buildStructureInstances,
  structureSeatInterference,structureFootprintContains} from '../src/workbench/structures.mjs';
import {editVenueStructure} from '../src/workbench/structureEditor.mjs';

const change=(venue,action,rest={})=>editVenueStructure(venue,{action,...rest});
test('project contract keeps the operator structure collection optional for legacy files',()=>{
  const p=newVenue();
  assert.deepEqual(p.structures,[]);
  delete p.structures;
  assert.deepEqual(normalizeVenue(p).structures,[]);
  assert.equal(Object.keys(STRUCTURE_CATALOG).length,7);
});
test('all seven structural primitives generate bounded WebGL2 instances',()=>{
  for(const kind of Object.keys(STRUCTURE_CATALOG)){
    const initial=newVenue(),after=change(initial,'add',{kind});
    const structures=after.venue.structures;
    assert.equal(structures.length,1,kind);
    assert.equal(structures[0].kind,kind);
    assert.equal(after.seatDelta,0);
    assert.equal(after.publicationEligible,false);
    assert.equal(after.venue.editLedger[0].operation,'add-structure');
    const instances=buildStructureInstances(structures);
    assert.ok(instances.length>0&&instances.length%11===0,kind);
    assert.ok([...instances].every(Number.isFinite),kind);
    assert.deepEqual(initial.structures,[]);
  }
});
test('a manually placed platform renders without changing a single source seat',()=>{
  const v=fictionalGym(),before=buildWorkbenchPreview(v);
  const changed=change(v,'add',{kind:'platform',x:0,z:0,y:0});
  const after=buildWorkbenchPreview(changed.venue);
  assert.equal(after.seats.length,1500);
  assert.equal(after.plan.seats.length,1500);
  assert.equal(after.quality.publicationEligible,false);
  assert.equal(after.quality.issues.some(i=>i.code==='OPERATOR_STRUCTURES_UNVERIFIED'),true);
  assert.ok(after.plan.instanceCount>before.plan.instanceCount);
  assert.equal(after.plan.operatorStructures.length,1);
  assert.ok(after.plan.instanceData.length>before.plan.instanceData.length);
  assert.equal(after.venue.structures[0].provenance,'operator-estimated/unverified');
});
test('component transforms, rotation, duplication and deletion are reversible data operations',()=>{
  let v=fictionalGym();
  v=change(v,'add',{kind:'wall',x:0,z:0,label:'Draft partition'}).venue;
  const first=v.structures[0].id;
  const moved=change(v,'update',{id:first,changes:{x:2.5,y:.1,width:3.4,yaw:90}});
  assert.equal(moved.venue.structures[0].x,2.5);
  assert.equal(moved.venue.structures[0].yaw,90);
  assert.equal(v.structures[0].x,0);
  const copy=change(moved.venue,'duplicate',{id:first});
  assert.equal(copy.venue.structures.length,2);
  assert.notEqual(copy.id,first);
  assert.notEqual(copy.venue.structures[0].x,copy.venue.structures[1].x);
  assert.equal(copy.venue.rows.reduce((n,r)=>n+r.seats,0),1500);
  assert.equal(copy.venue.editLedger.at(-1).operation,'duplicate-structure');
  const removed=change(copy.venue,'remove',{id:copy.id});
  assert.equal(removed.venue.structures.length,1);
  assert.equal(removed.venue.structures[0].id,first);
  const round=normalizeVenue(JSON.parse(JSON.stringify(removed.venue)));
  assert.equal(round.structures[0].yaw,90);
});
test('component footprint uses the same yaw direction as the renderer',()=>{
  const s={x:0,z:0,yaw:90,width:6,depth:1,height:1};
  assert.equal(structureFootprintContains(s,0,2),true);
  assert.equal(structureFootprintContains(s,2,0),false);
  assert.equal(structureFootprintContains(s,0,2.99),true);
});
test('structure placement must reject intersections with actual modeled seats',()=>{
  const v=fictionalGym(),seat=generateTracedVenue(v).seats[0];
  const snapshot=structuredClone(v);
  assert.throws(()=>change(v,'add',{kind:'platform',x:seat.x,z:seat.z,
    y:seat.y,width:1.2,depth:1.2,height:.5}),
    /STRUCTURE_INTERSECTS_SEATING|intersects seat/);
  assert.deepEqual(v,snapshot);
});
test('invalid structure dimensions and unrecognized kinds fail without modifying project',()=>{
  const v=fictionalGym(),before=structuredClone(v);
  for(const command of [
    {action:'add',kind:'elevator'},
    {action:'add',kind:'platform',width:-2},
    {action:'add',kind:'platform',height:NaN},
    {action:'add',kind:'platform',x:Infinity},
    {action:'add',kind:'platform',yaw:999},
    {action:'update',id:'non-existent',changes:{x:5}},
    {action:'remove',id:'non-existent'}
  ])assert.throws(()=>editVenueStructure(v,command),undefined,JSON.stringify(command));
  assert.deepEqual(v,before);
});
test('document serialization retains component IDs, geometry and provisional status',()=>{
  let v=fictionalGym();
  v=change(v,'add',{kind:'rail',x:1,z:0,y:3.4}).venue;
  const result=normalizeVenue(JSON.parse(JSON.stringify(v)));
  assert.equal(result.structures.length,1);
  assert.equal(result.structures[0].kind,'rail');
  assert.equal(result.structures[0].x,1);
  assert.equal(result.structures[0].provenance,'operator-estimated/unverified');
  assert.equal(result.editLedger.length,1);
  assert.equal(buildWorkbenchPreview(result).plan.operatorStructures.length,1);
});
test('independent staff structure placement does not certify imported capacity',()=>{
  const v=fictionalGym();v.officialCapacity=1500;
  v.capacitySource='https://school.example.edu/venue';
  const after=change(v,'add',{kind:'portal',x:0,z:0,y:0});
  const generated=buildWorkbenchPreview(after.venue);
  assert.equal(generated.quality.publicationEligible,false);
  assert.equal(generated.venue.officialCapacity,1500);
  assert.equal(generated.quality.declaredCount,1500);
  assert.equal(structureSeatInterference(after.venue.structures,generated.seats).length,0);
});
