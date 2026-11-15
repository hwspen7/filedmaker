import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchottensteinCenterProject, createOhioStadiumProject } from '../src/venues.mjs';
import { generateSeats } from '../src/model.mjs';
import { buildVenuePlan } from '../src/next/venuePlan.mjs';
import { NativeVenueRenderer } from '../src/next/webgl.js';

const build = () => buildVenuePlan(generateSeats({
  ...createSchottensteinCenterProject(), audienceLayout:'schottenstein-men',
}));

test('full building model contains six independent architectural layers',()=>{
  const plan=build(),g=plan.architectureGeometry;
  assert.deepEqual(Object.keys(g),['decks','fascias','concourse','facade','glazing','trim','aisles','stepEdges']);
  for(const [name,vertices] of Object.entries(g)){
    assert.ok(vertices instanceof Float32Array,name);
    assert.ok(vertices.length>1000 && vertices.length%18===0,name);
    assert.ok(vertices.every(Number.isFinite),name);
  }
  assert.ok(g.decks.length/18>10000);
  assert.ok(g.facade.length/18>1500);
  assert.ok(g.aisles.length/18>900);
  assert.equal(g.aisles.length,g.stepEdges.length);
  assert.ok(g.glazing.length/18>600);
});

test('architectural triangle winding agrees with outward normals',()=>{
  for(const [layer,vertices] of Object.entries(build().architectureGeometry)){
    for(let i=0;i<vertices.length;i+=18){
      const a=vertices.subarray(i,i+3),b=vertices.subarray(i+6,i+9);
      const c=vertices.subarray(i+12,i+15),n=vertices.subarray(i+3,i+6);
      const ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]);
      const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      const facing=cross.reduce((s,v,j)=>s+v*n[j],0);
      assert.ok(facing>1e-5,layer+' facet '+i/18);
    }
  }
});

test('full building is limited to the estimated OSU basketball configuration',()=>{
  const plan=build();
  assert.equal(plan.chairCount,19049);
  assert.equal(plan.seats.length,19049);
  assert.equal(new Set(plan.seats.map(s=>s.uid)).size,19049);
  for(const mode of ['overview','top','section']){
    assert.equal(NativeVenueRenderer.architectureVisibleInMode(plan,mode),true);
    assert.equal(NativeVenueRenderer.deckVisibleInMode(plan,mode),false);
  }
  assert.equal(NativeVenueRenderer.architectureVisibleInMode(plan,'human'),false);
  assert.equal(NativeVenueRenderer.deckVisibleInMode(plan,'human'),true);
  assert.equal(buildVenuePlan(generateSeats(createOhioStadiumProject())).architectureGeometry,null);
});

test('exterior facade is grounded and seating terraces climb through three tiers',()=>{
  const g=build().architectureGeometry;
  let minWall=Infinity,minDeck=Infinity,maxDeck=-Infinity,maxWall=-Infinity;
  for(let i=1;i<g.facade.length;i+=6){minWall=Math.min(minWall,g.facade[i]);maxWall=Math.max(maxWall,g.facade[i]);}
  for(let i=1;i<g.decks.length;i+=6){minDeck=Math.min(minDeck,g.decks[i]);maxDeck=Math.max(maxDeck,g.decks[i]);}
  assert.ok(minWall>=-.01 && minWall<.1);
  assert.ok(minDeck>.25 && maxDeck>26);
  assert.ok(maxWall>26 && maxWall<31);
});
