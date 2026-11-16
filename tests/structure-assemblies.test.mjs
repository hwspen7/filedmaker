import test from 'node:test';
import assert from 'node:assert/strict';
import {newVenue,normalizeVenue} from '../src/workbench/contract.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {buildStructureInstances,structureSeatInterference} from '../src/workbench/structures.mjs';
import {VENUE_ASSEMBLIES,addVenueAssembly} from '../src/workbench/structureAssemblies.mjs';

test('six assemblies produce real editable primitives with unique IDs and one ledger record',()=>{
  assert.equal(Object.keys(VENUE_ASSEMBLIES).length,6);
  for(const [preset,spec] of Object.entries(VENUE_ASSEMBLIES)){
    const v=newVenue(),snapshot=structuredClone(v);
    const result=addVenueAssembly(v,{preset,x:0,z:0,scale:1});
    assert.deepEqual(v,snapshot);
    assert.equal(result.venue.structures.length,spec.parts.length,preset);
    assert.deepEqual(result.ids,result.venue.structures.map(s=>s.id));
    assert.equal(new Set(result.ids).size,result.ids.length);
    assert.equal(result.venue.editLedger.length,1);
    assert.equal(result.venue.editLedger[0].operation,'batch-structure');
    assert.equal(result.seatDelta,0);
    assert.equal(result.publicationEligible,false);
    assert.ok(result.venue.structures.every(s=>
      s.provenance==='operator-estimated/unverified'));
    assert.ok(buildStructureInstances(result.venue.structures).length>0);
    assert.deepEqual(normalizeVenue(JSON.parse(JSON.stringify(result.venue))),result.venue);
  }
});
test('reusable assembly rotation and uniform scale follow the same coordinate frame',()=>{
  const p=VENUE_ASSEMBLIES.player_tunnel.parts;
  const result=addVenueAssembly(newVenue(),{
    preset:'player_tunnel',x:10,z:20,y:2,yaw:90,scale:1.25});
  const s=result.venue.structures;
  assert.equal(s.length,p.length);
  assert.equal(s[0].x,10);
  assert.equal(s[0].z,20);
  assert.ok(Math.abs(s[1].x-(10+p[1].z*1.25))<1e-9);
  assert.ok(Math.abs(s[1].z-(20-p[1].x*1.25))<1e-9);
  assert.equal(s[0].width,p[0].width*1.25);
  assert.equal(s[0].yaw,90);
  assert.equal(s[0].y,2);
});
test('assembly edits retain source seat counts and reject dangerous placement',()=>{
  const source=fictionalGym(),before=structuredClone(source);
  const installed=addVenueAssembly(source,{preset:'press_station',x:0,z:0});
  assert.equal(generateTracedVenue(installed.venue).seats.length,1500);
  assert.equal(structureSeatInterference(installed.venue.structures,
    generateTracedVenue(installed.venue).seats).length,0);
  const seat=generateTracedVenue(source).seats[0];
  assert.throws(()=>addVenueAssembly(source,{
    preset:'press_station',x:seat.x,z:seat.z,y:seat.y
  }),/intersects seat|geometry rejected/);
  assert.deepEqual(source,before);
});
test('bad assembly parameters reject atomically without changing original file',()=>{
  const source=newVenue(),before=structuredClone(source);
  for(const command of [
    {preset:'invalid'},
    {preset:'entrance',scale:0},
    {preset:'entrance',scale:3},
    {preset:'entrance',x:Infinity},
    {preset:'entrance',yaw:999},
    {preset:'entrance',y:-1}
  ])assert.throws(()=>addVenueAssembly(source,command));
  assert.deepEqual(source,before);
});
test('assembly capacity is enforced before any primitives are committed',()=>{
  const source=newVenue();
  const specimen=addVenueAssembly(source,{preset:'entrance'}).venue.structures[0];
  const max=structuredClone(source);
  max.structures=Array.from({length:199},(_,i)=>({
    ...specimen,id:'placeholder-'+i,x:100+i
  }));
  const before=structuredClone(max);
  assert.throws(()=>addVenueAssembly(max,{preset:'bleacher_bay'}),/Maximum 200/);
  assert.deepEqual(max,before);
});
