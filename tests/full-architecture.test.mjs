import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchottensteinCenterProject, createOhioStadiumProject } from '../src/venues.mjs';
import { generateSeats } from '../src/model.mjs';
import { polygonSpans } from '../src/schottensteinSeating.mjs';
import { buildVenuePlan } from '../src/next/venuePlan.mjs';
import { NativeVenueRenderer } from '../src/next/webgl.js';

const build = () => buildVenuePlan(generateSeats({
  ...createSchottensteinCenterProject(), audienceLayout:'schottenstein-men',
}));

test('OSU arena has a full-depth structural gallery, inset windows and no invented exit signs or stairs',()=>{
  const plan=build(),g=plan.architectureGeometry;
  assert.deepEqual(Object.keys(g),['decks','fascias','concourse','facade','glazing','trim','aisles','stepEdges','backWall','galleryGlass','galleryGlow','windowFrames','pilasters','roofEdge','soffit','downlights','roofDeck','radialBeams','buildingRoof','entryMasonry','entryGlass','pressWalls','pressGlass','cutawayFacade','externalTrim','galleryFloorMesh']);
  for(const [name,vertices] of Object.entries(g)){
    assert.ok(vertices instanceof Float32Array,name);
    assert.ok(vertices.length%18===0,name);
    if (!['aisles','stepEdges'].includes(name)) assert.ok(vertices.length>0,name);
    assert.ok(vertices.every(Number.isFinite),name);
  }
  assert.ok(g.decks.length/18>8000);
  assert.ok(g.facade.length/18>1500);
  assert.equal(g.aisles.length,0,'No fabricated aisle geometry');
  assert.equal(g.stepEdges.length,0,'No fabricated stair/riser geometry');
  assert.equal(plan.exitMarkers,undefined,'Fabricated exit markers are permanently removed');
  assert.ok(g.galleryGlass.length/18>200,'Recessed viewing gallery is modeled');
  assert.ok(g.galleryGlow.length/18>80,'Some gallery windows are softly lit');
  assert.ok(g.pilasters.length/18>300,'Upper gallery has real structural columns');
  assert.ok(g.windowFrames.length/18>400,'Window apertures have modeled frames');
  assert.ok(g.soffit.length/18>300,'Roof underside must span the gallery');
  assert.ok(g.roofEdge.length/18>300,'The open-air bowl has a framed outer roof edge');
  assert.ok(g.downlights.length/18>10);
  assert.ok(g.roofDeck.length/18>200,'Roof has its own deck surface and material');
  assert.ok(g.buildingRoof.length>g.roofDeck.length);
  assert.ok(g.entryMasonry.length>1000);
  assert.ok(g.pressGlass.length>0);
  const press=plan.features.find(feature=>feature.kind==='press');
  assert.ok(!plan.seats.some(seat=>polygonSpans([press.outline],seat.x)
    .some(([a,b])=>seat.z>a&&seat.z<b)),'Press enclosure does not replace any seat');

  const galleryHeights=new Set();
  for(let i=1;i<g.galleryGlass.length;i+=6)galleryHeights.add(g.galleryGlass[i]);
  assert.equal(galleryHeights.size,4,'Both glazing bands stay level across the press side');
  assert.ok(g.radialBeams.length/18>100,'Gallery canopy is supported by modeled radial beams');
  const roofRadii=Array.from({length:g.roofDeck.length/6},(_,i)=>
    Math.hypot(g.roofDeck[i*6],g.roofDeck[i*6+2]));
  const firstTriangle=roofRadii.slice(0,3);
  assert.ok(Math.max(...firstTriangle)-Math.min(...firstTriangle)>4.5,
    'Roof spans a genuine multi-metre concourse, not a floating thin ribbon');
  const roofHeights=Array.from({length:g.roofDeck.length/6},(_,i)=>g.roofDeck[i*6+1]);
  assert.ok(Math.max(...roofHeights)-Math.min(...roofHeights)<.001,
    'Building roof has one datum independently of the varying seat elevations');
  assert.equal(g.aisles.length+g.stepEdges.length,0,'No fabricated stair geometry');
});

test('the main roof perimeter is convex and independent of the media seating cutout',()=>{
  const {seats,architectureGeometry:g}=build();
  const edge=new Map();
  for(let i=0;i<g.roofDeck.length;i+=6){
    const [x,,z]=g.roofDeck.subarray(i,i+3),radius=Math.hypot(x,z);
    const index=(Math.round(Math.atan2(z,x)*96/Math.PI)+192)%192;
    if(!edge.has(index)||radius>edge.get(index).radius)edge.set(index,{x,z,radius});
  }
  const perimeter=[...edge].sort(([a],[b])=>a-b).map(([,point])=>point);
  assert.equal(perimeter.length,192);
  for(let i=0;i<perimeter.length;i++){
    const a=perimeter[i],b=perimeter[(i+1)%192],c=perimeter[(i+2)%192];
    assert.ok((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x)>0,'Perimeter must not turn inward');
  }
  for(const seat of seats.filter(seat=>seat.tier===2)){
    const index=(Math.round(Math.atan2(seat.z,seat.x)*96/Math.PI)+192)%192;
    assert.ok(perimeter[index].radius>Math.hypot(seat.x,seat.z)+2);
  }
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
  assert.equal(NativeVenueRenderer.deckVisibleInMode(plan,'human'),false);
  assert.equal(buildVenuePlan(generateSeats(createOhioStadiumProject())).architectureGeometry,null);
});

test('exterior facade is grounded and stepped seat decks follow their assigned elevations',()=>{
  const g=build().architectureGeometry;
  let minWall=Infinity,minDeck=Infinity,maxDeck=-Infinity,maxWall=-Infinity;
  for(let i=1;i<g.facade.length;i+=6){minWall=Math.min(minWall,g.facade[i]);maxWall=Math.max(maxWall,g.facade[i]);}
  for(let i=1;i<g.decks.length;i+=6){minDeck=Math.min(minDeck,g.decks[i]);maxDeck=Math.max(maxDeck,g.decks[i]);}
  assert.ok(minWall>=-.01 && minWall<.1);
  assert.ok(minDeck>.25 && maxDeck>26);
  assert.ok(maxWall>40 && maxWall<41,'Facade reaches a uniform structural top');
  let minRoof=Infinity,maxRoof=-Infinity;
  for(let i=1;i<g.roofEdge.length;i+=6){minRoof=Math.min(minRoof,g.roofEdge[i]);maxRoof=Math.max(maxRoof,g.roofEdge[i]);}
  assert.ok(minRoof>39.8 && maxRoof<41,'Roof is a level supported canopy, not a sawtooth crown');
  const deckMinX=Math.min(...Array.from({length:g.decks.length/6},(_,i)=>g.decks[i*6]));
  const facadeMaxX=Math.max(...Array.from({length:g.facade.length/6},(_,i)=>g.facade[i*6]));
  assert.ok(facadeMaxX-deckMinX>30,'The enclosed building has nonzero spatial depth');
  const shader=String(NativeVenueRenderer);
  assert.ok(shader.includes('architectureVisibleInMode'));
});
