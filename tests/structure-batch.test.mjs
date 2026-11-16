import test from 'node:test';
import assert from 'node:assert/strict';
import {newVenue,normalizeVenue} from '../src/workbench/contract.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {editVenueStructure} from '../src/workbench/structureEditor.mjs';
import {editVenueStructureBatch} from '../src/workbench/structureBatch.mjs';

function trio(){
  let venue=newVenue();
  for(const [x,z,yaw] of [[0,0,30],[5,2,-10],[20,6,0]]){
    venue=editVenueStructure(venue,{action:'add',kind:'rail',
      x,z,yaw,width:1,depth:.2,height:1.1}).venue;
  }
  return venue;
}
const ids=venue=>venue.structures.map(s=>s.id);
const batch=(venue,action,extra={})=>
  editVenueStructureBatch(venue,{action,ids:ids(venue),...extra});

test('atomic group translation preserves original objects and seat count',()=>{
  const source=trio(),before=structuredClone(source);
  const result=batch(source,'translate',{dx:2,dz:-1,dy:.4});
  assert.deepEqual(source,before);
  assert.deepEqual(result.venue.structures.map(s=>s.x),[2,7,22]);
  assert.deepEqual(result.venue.structures.map(s=>s.z),[-1,1,5]);
  assert.ok(result.venue.structures.every(s=>s.y===.4));
  assert.equal(result.seatDelta,0);
  assert.equal(result.publicationEligible,false);
  assert.equal(result.venue.editLedger.at(-1).operation,'batch-structure');
  assert.equal(normalizeVenue(JSON.parse(JSON.stringify(result.venue))).structures.length,3);
});
test('group center alignment and even spacing are distinct reversible edits',()=>{
  const source=trio(),original=source.structures.map(s=>s.x);
  const aligned=batch(source,'align',{axis:'z'});
  assert.deepEqual(aligned.venue.structures.map(s=>s.z),[0,0,0]);
  assert.deepEqual(aligned.venue.structures.map(s=>s.x),original);
  const spaced=batch(source,'distribute',{axis:'x'});
  assert.deepEqual(spaced.venue.structures.map(s=>s.x),[0,10,20]);
  assert.equal(spaced.venue.structures[1].z,2);
  assert.deepEqual(source.structures.map(s=>s.x),original);
});
test('mirror reflects a group about its own central axis and maintains orientation',()=>{
  const source=trio(),output=batch(source,'mirror',{axis:'x'});
  assert.deepEqual(output.venue.structures.map(s=>s.x),[20,15,0]);
  assert.deepEqual(output.venue.structures.map(s=>s.yaw),[-30,10,0]);
  assert.deepEqual(source.structures.map(s=>s.yaw),[30,-10,0]);
});
test('duplicating multiple objects keeps layout spacing and stable unique IDs',()=>{
  const source=trio(),count=source.structures.length;
  const out=batch(source,'duplicate',{dx:3,dz:4});
  assert.equal(out.venue.structures.length,2*count);
  assert.equal(new Set(ids(out.venue)).size,2*count);
  assert.deepEqual(out.venue.structures.slice(count).map(s=>s.x),[3,8,23]);
  assert.deepEqual(out.venue.structures.slice(count).map(s=>s.z),[4,6,10]);
  assert.deepEqual(out.ids,out.venue.structures.slice(count).map(s=>s.id));
  assert.equal(out.venue.editLedger.length,source.editLedger.length+1);
  const removed=editVenueStructureBatch(out.venue,{action:'remove',ids:out.ids});
  assert.deepEqual(removed.venue.structures,source.structures);
  assert.equal(removed.ids.length,0);
});
test('batch validation is atomic and cannot fabricate an extra source seat',()=>{
  const venue=trio(),before=structuredClone(venue),selection=ids(venue);
  for(const command of [
    {action:'align',ids:[selection[0]],axis:'x'},
    {action:'distribute',ids:selection.slice(0,2),axis:'x'},
    {action:'translate',ids:selection,dx:Infinity,dz:0},
    {action:'translate',ids:selection,dx:0,dz:0,dy:0},
    {action:'mirror',ids:selection,axis:'y'},
    {action:'duplicate',ids:selection,dx:0,dz:0},
    {action:'remove',ids:[selection[0],selection[0]]},
    {action:'remove',ids:['not-a-component']}
  ])assert.throws(()=>editVenueStructureBatch(venue,command),
    undefined,JSON.stringify(command));
  assert.deepEqual(venue,before);
});
test('batch seat collision rejects the entire selection, not just the first component',()=>{
  const source=fictionalGym();
  const seat=generateTracedVenue(source).seats[0];
  const placed=editVenueStructure(source,{action:'add',kind:'platform',
    x:0,z:0,y:seat.y,width:1.2,depth:1.2,height:.5}).venue;
  const first=placed.structures[0].id,snapshot=structuredClone(placed);
  assert.throws(()=>editVenueStructureBatch(placed,{
    action:'translate',ids:[first],dx:seat.x,dz:seat.z
  }),/intersects seat|Batch rejected/);
  assert.deepEqual(placed,snapshot);
  assert.equal(generateTracedVenue(placed).seats.length,1500);
});
