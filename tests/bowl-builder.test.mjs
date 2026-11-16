import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSyntheticBowl,BOWL_STARTERS} from '../src/workbench/bowlBuilder.mjs';
import {normalizeVenue} from '../src/workbench/contract.mjs';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {buildWorkbenchPreview} from '../src/workbench/adapter.mjs';

test('six clearly fictional bowl starters have distinctive sections and valid row inventory',()=>{
  assert.equal(Object.keys(BOWL_STARTERS).length,6);
  const footprints=new Set();
  for(const template of Object.keys(BOWL_STARTERS)){
    const venue=buildSyntheticBowl({template});
    assert.equal(venue.officialCapacity,null);
    assert.equal(venue.capacitySource,'');
    assert.ok(venue.notes.some(n=>n.includes('SYNTHETIC')));
    assert.ok(venue.sections.length>=4);
    assert.ok(venue.rows.length>=20);
    assert.ok(venue.rows.every(r=>r.sourceSeats===null&&r.operatorAdded===true));
    assert.equal(venue.calibration.corners.length,0);
    assert.equal(venue.sources.length,0);
    assert.deepEqual(normalizeVenue(JSON.parse(JSON.stringify(venue))),venue);
    footprints.add(venue.sections.length+'|'+venue.rows.length+'|'+venue.court.length);
  }
  assert.equal(footprints.size,6);
});
test('parametric settings change actual section topology without fake source certification',()=>{
  const compact=buildSyntheticBowl({template:'college-two-tier',
    sectors:12,levels:2,rowsPerTier:8,rowDepth:.7,seatWidth:.6,rowRise:.28});
  const denser=buildSyntheticBowl({template:'college-two-tier',
    sectors:16,levels:2,rowsPerTier:12,rowDepth:.8,seatWidth:.5,rowRise:.36});
  assert.equal(compact.sections.length,24);
  assert.equal(denser.sections.length,32);
  assert.equal(compact.rows.length,192);
  assert.equal(denser.rows.length,384);
  assert.ok(denser.rows.reduce((n,r)=>n+r.seats,0)>
    compact.rows.reduce((n,r)=>n+r.seats,0));
  assert.equal(compact.sections[0].rowRise,.28);
  assert.equal(denser.sections[0].rowRise,.36);
});
test('a generated two-tier arena produces 3D seat coordinates, retaining every modeled seat',()=>{
  const v=buildSyntheticBowl({template:'college-two-tier',sectors:16,
    rowsPerTier:10});
  const generated=generateTracedVenue(v);
  assert.equal(generated.seats.length,v.rows.reduce((n,r)=>n+r.seats,0));
  assert.ok(generated.seats.length>2000);
  assert.ok(generated.seats.every(s=>Number.isFinite(s.x+s.y+s.z)));
  assert.equal(new Set(generated.seats.map(s=>s.id)).size,generated.seats.length);
  const scene=buildWorkbenchPreview(v);
  assert.equal(scene.plan.seats.length,generated.seats.length);
  assert.equal(scene.venue.officialCapacity,null);
  assert.equal(scene.quality.publicationEligible,false);
});
test('starter edits fail closed on invalid dimensions and impossible capacities',()=>{
  const invalid=[
    {template:'non-existent'}, {template:'college-two-tier',sectors:2},
    {template:'college-two-tier',sectors:20.5},
    {template:'college-two-tier',rowDepth:.1},
    {template:'college-two-tier',seatWidth:2.5},
    {template:'college-two-tier',levels:4},
    {template:'college-two-tier',rowsPerTier:0},
    {template:'college-two-tier',rowRise:0},
    {template:'college-two-tier',sectors:32,levels:3,
      rowsPerTier:34,rowDepth:1.35,seatWidth:.43}
  ];
  for(const args of invalid)assert.throws(()=>buildSyntheticBowl(args),undefined,
    JSON.stringify(args));
});
