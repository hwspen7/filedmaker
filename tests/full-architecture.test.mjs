import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchottensteinCenterProject, createOhioStadiumProject } from '../src/venues.mjs';
import { generateSeats } from '../src/model.mjs';
import { polygonSpans } from '../src/schottensteinSeating.mjs';
import { fitRearSeatEnvelope } from '../src/next/engines/geometry.mjs';
import { buildVenuePlan } from '../src/next/venuePlan.mjs';
import { NativeVenueRenderer } from '../src/next/webgl.js';

const build = () => buildVenuePlan(generateSeats({
  ...createSchottensteinCenterProject(), audienceLayout:'schottenstein-men',
}));

test('OSU arena has a full-depth structural gallery, inset windows and no invented exit signs or stairs',()=>{
  const plan=build(),g=plan.architectureGeometry;
  assert.deepEqual(Object.keys(g),['decks','fascias','upperBowl','concourse','facade','glazing','trim','aisles','stepEdges','backWall','galleryGlass','galleryGlow','windowFrames','pilasters','roofEdge','soffit','downlights','roofDeck','radialBeams','buildingRoof','entryMasonry','entryGlass','pressWalls','pressGlass','cutawayFacade','externalTrim','galleryFloorMesh','brickBase','brickPiers','towerFrames','towerCrown','towerRibs','entryBrick','entryCurtain','entryFrames','entryCanopy','entryDoors']);
  for(const [name,vertices] of Object.entries(g)){
    assert.ok(vertices instanceof Float32Array,name);
    assert.ok(vertices.length%18===0,name);
    if (!['aisles','stepEdges','buildingRoof'].includes(name)) assert.ok(vertices.length>0,name);
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
  assert.equal(g.buildingRoof.length,0,'Opaque central roof must not be generated');
  assert.ok(g.roofDeck.length>0,'Perimeter roof overhang remains');
  assert.ok(g.entryMasonry.length>1000);
  assert.ok(g.brickBase.length>2000,'Brick plinth must be physically modelled');
  assert.ok(g.brickPiers.length>100,'Entrance-level structural piers must exist');
  assert.ok(g.entryCurtain.length>300,'Glass vestibule doors must be present');
  assert.ok(g.entryCanopy.length>600,'Canopies project from the entrance bays');
  assert.ok(g.towerCrown.length>1000,'Real open-topped lantern cornices');
  assert.ok(g.towerFrames.length>0,'Round tower windows have frames');
  assert.ok(g.externalTrim.length>1000,'Panel seams replace the old uniform gray facade');
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

test('Press Box occupies a broad, tall gallery bay instead of a detached gray roof',()=>{
  const plan=build(),{pressWalls,pressGlass}=plan.architectureGeometry;
  const press=plan.features.find(feature=>feature.kind==='press');
  const vertexData=mesh=>Array.from({length:mesh.length/6},(_,i)=>({
    x:mesh[i*6],y:mesh[i*6+1],z:mesh[i*6+2],normalY:mesh[i*6+4]
  }));
  const windows=vertexData(pressGlass),wall=vertexData(pressWalls);
  assert.ok(windows.length>120,'Press gallery should be much wider than four small panes');
  const min=Math.min(...windows.map(p=>p.z)),max=Math.max(...windows.map(p=>p.z));
  assert.ok(max-min>46,'Press frontage should cover a broad curved gallery bay');
  const height=Math.max(...windows.map(p=>p.y))-Math.min(...windows.map(p=>p.y));
  assert.ok(height>4.1,'Press glazing must be taller than the original short box');
  assert.ok(windows.every(p=>Math.abs(p.normalY)<.001));
  assert.ok(wall.every(p=>Math.abs(p.normalY)<.001),
    'Press structure may contain walls, not a floating horizontal gray roof slab');
  assert.ok(wall.every(p=>p.y>=28.5&&p.y<36));
  // The source seating exclusion remains unchanged; only the visible Press
  // Box building volume and annotation are relocated behind the upper row.
  const edge=fitRearSeatEnvelope(plan.seats,{
    tier:2,segments:192,clearance:.38,spread:1
  });
  assert.ok(windows.every(p=>
    Math.hypot(p.x,p.z)>edge.radiusAt(Math.atan2(p.z,p.x))+.10),
    'Press windows must be behind the final occupied row');
  assert.ok(Math.hypot(press.x,press.z)>52,
    'Press label should attach to the rear gallery rather than the chair bank');
  assert.equal(plan.seats.length,19049);
});

test('Press Box lower gallery is structurally connected to the short rear seating banks',()=>{
  const plan=build(),g=plan.architectureGeometry;
  const press=plan.features.find(f=>f.kind==='press');
  const center=Math.atan2(press.z,press.x);
  const angularDiff=a=>Math.abs(Math.atan2(Math.sin(a-center),Math.cos(a-center)));
  const vertices=mesh=>Array.from({length:mesh.length/6},(_,i)=>({
    x:mesh[i*6],y:mesh[i*6+1],z:mesh[i*6+2]
  }));
  const local=p=>angularDiff(Math.atan2(p.z,p.x))<.52;
  const seatY=plan.seats.filter(s=>s.tier===2&&local(s));
  const bankRearHeights=['321','322','323','324','325','326'].map(id=>
    Math.max(...seatY.filter(s=>s.sectionId===id).map(s=>s.y)));
  const lowestBankRear=Math.min(...bankRearHeights);
  const infill=vertices(g.backWall).filter(p=>local(p)&&p.y<28.5);
  assert.ok(infill.length>75,'Continuous under-gallery masonry is missing');
  assert.ok(Math.min(...infill.map(p=>p.y))<=lowestBankRear+2,
    'Press masonry must extend down towards the occupied chair height');
  const lowDeck=vertices(g.galleryFloorMesh).filter(p=>local(p)&&p.y<28);
  assert.ok(lowDeck.length>60,
    'Rear terrace must connect the last seat row to the lower press wall');
  const other=vertices(g.galleryFloorMesh).filter(p=>!local(p));
  assert.ok(other.length>200,'Other arena sectors remain intact');
  assert.equal(plan.seats.length,19049,'Press infill must not change seat count');
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
  for(const name of ['facade','glazing','brickBase','entryMasonry','entryCanopy','upperBowl','decks']){
    assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(plan,'overview',name),true,name);
  }
  assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(plan,'overview','buildingRoof'),false);
  assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(plan,'overview','cutawayFacade'),false);
  assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(plan,'section','cutawayFacade'),true);
  assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(plan,'section','facade'),false);
  assert.equal(NativeVenueRenderer.architectureVisibleInMode(plan,'human'),false);
  assert.equal(NativeVenueRenderer.deckVisibleInMode(plan,'human'),false);
  assert.equal(buildVenuePlan(generateSeats(createOhioStadiumProject())).architectureGeometry,null);
});

test('exterior facade is grounded and stepped seat decks follow their assigned elevations',()=>{
  const g=build().architectureGeometry;
  let minWall=Infinity,minDeck=Infinity,maxDeck=-Infinity,maxWall=-Infinity;
  for(let i=1;i<g.facade.length;i+=6){minWall=Math.min(minWall,g.facade[i]);maxWall=Math.max(maxWall,g.facade[i]);}
  for(let i=1;i<g.decks.length;i+=6){minDeck=Math.min(minDeck,g.decks[i]);maxDeck=Math.max(maxDeck,g.decks[i]);}
  assert.ok(minWall>9 && minWall<11,'Metal cladding begins above the brick ground floor');
  const brickYs=Array.from({length:g.brickBase.length/6},(_,i)=>g.brickBase[i*6+1]);
  assert.ok(Math.min(...brickYs)>=-.01 && Math.min(...brickYs)<.1,'Ground-floor brick starts at grade');
  assert.ok(minDeck>.25 && maxDeck>26);
  assert.ok(maxWall>39.5 && maxWall<40.6,'Metal siding terminates just below the structural roof eave');
  let minRoof=Infinity,maxRoof=-Infinity;
  for(let i=1;i<g.roofEdge.length;i+=6){minRoof=Math.min(minRoof,g.roofEdge[i]);maxRoof=Math.max(maxRoof,g.roofEdge[i]);}
  assert.ok(minRoof>39.8 && maxRoof<41,'Roof is a level supported canopy, not a sawtooth crown');
  const deckMinX=Math.min(...Array.from({length:g.decks.length/6},(_,i)=>g.decks[i*6]));
  const facadeMaxX=Math.max(...Array.from({length:g.facade.length/6},(_,i)=>g.facade[i*6]));
  assert.ok(facadeMaxX-deckMinX>30,'The enclosed building has nonzero spatial depth');
  const shader=String(NativeVenueRenderer);
  assert.ok(shader.includes('architectureVisibleInMode'));
});

test('Schottenstein upper stand has a closed, continuously shaded structural bowl',()=>{
 const mesh=build().architectureGeometry.upperBowl;
 assert.ok(mesh.length>10000);
 const edges=new Map(), normals=new Map();
 const pointKey=vertex=>vertex.slice(0,3).join(',');
 let peak=-Infinity,pressPeak=-Infinity;
 for(let i=0;i<mesh.length;i+=18){
   const triangle=[0,6,12].map(offset=>mesh.slice(i+offset,i+offset+6));
   const points=triangle.map(pointKey);
   assert.equal(new Set(points).size,3,'Every triangle has three distinct vertices');
   for(const [j,v] of triangle.entries()){
     const key=points[j],next=points[(j+1)%3],edge=[key,next].sort().join('|');
     edges.set(edge,(edges.get(edge)??0)+1);
     const [x,y,z,nx,ny,nz]=v;
     assert.ok(Math.abs(Math.hypot(nx,ny,nz)-1)<1e-6);
     if(Math.abs(z)<.01&&x>0)pressPeak=Math.max(pressPeak,y);
     peak=Math.max(peak,y);
     const previous=normals.get(key);
     if(previous)assert.deepEqual(v.slice(3),previous);
     normals.set(key,v.slice(3));
   }
 }
 assert.ok([...edges.values()].every(count=>count===2),'No open section seams or disconnected caps');
 assert.ok(peak>29&&pressPeak<26&&peak-pressPeak>3,'The rear parapet rises behind the last chairs while the press stand stays lower');
});

test('rear architecture cannot cover upper seats with a continuous gray terrace',()=>{
  const plan=build(),vertices=plan.architectureGeometry.upperBowl;
  const edge=fitRearSeatEnvelope(plan.seats,{
    tier:2,segments:192,clearance:.38,spread:1
  });
  let minimum=Infinity,maximum=-Infinity;
  for(let i=0;i<vertices.length;i+=6){
    const x=vertices[i],z=vertices[i+2];
    const radius=Math.hypot(x,z);
    const delta=radius-edge.radiusAt(Math.atan2(z,x));
    minimum=Math.min(minimum,delta);
    maximum=Math.max(maximum,delta);
    assert.ok(delta>-.16&&delta<.29,
      'The narrow wall must stay at the last-chair envelope, delta '+delta);
  }
  assert.ok(minimum>-.16&&maximum<.29);
  assert.ok(vertices.length>5000);
  // The old 20-band analytic mesh extended 10–20 metres in front of the
  // last chairs and drew the huge gray patches shown in the user screenshot.
  assert.ok([...plan.seats.filter(s=>s.tier===2)].length>6000);
});

test('333 and 334 upper seats end close to the fitted rear parapet',()=>{
  const model=generateSeats({...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'});
  const plan=buildVenuePlan(model);
  const edge=fitRearSeatEnvelope(model.seats,{tier:2,segments:192,clearance:.38,spread:1});
  const last=new Map();
  for(const row of model.seatingRows){
    if(!['333','334'].includes(row.sectionId))continue;
    last.set(row.sectionId,Math.max(last.get(row.sectionId)??-1,row.slot));
  }
  let checked=0;
  const rears=new Set(model.seatingRows.filter(r=>
    r.tier===2&&r.slot===last.get(r.sectionId)&&last.has(r.sectionId))
    .map(r=>r.sectionId+':'+r.row));
  for(const seat of model.seats){
    if(!rears.has(seat.sectionId+':'+seat.row))continue;
    const clearance=edge.radiusAt(Math.atan2(seat.z,seat.x))-Math.hypot(seat.x,seat.z);
    assert.ok(clearance>=.30&&clearance<1.15,
      seat.uid+' must end within 1.15m of the integrated rear rim: '+clearance);
    checked++;
  }
  assert.ok(checked>16,'Both rear seat banks must be inspected');
  assert.equal(plan.seats.length,19049,'Seating inventory must not change');
  assert.ok(plan.architectureGeometry.upperBowl.length>10000);
});

test('334 rotates progressively between sections 333 and 301, with flat treads',()=>{
  const plan=build();
  const yaw=id=>plan.seats.find(s=>s.sectionId===id).yaw;
  assert.ok(yaw('333')>yaw('334')&&yaw('334')>yaw('301'),
    '333 -> 334 -> 301 must follow a continuous corner turn');
  const mesh=plan.architectureGeometry.decks;
  for(let i=0;i<mesh.length;i+=18){
    const heights=[mesh[i+1],mesh[i+7],mesh[i+13]];
    assert.ok(Math.max(...heights)-Math.min(...heights)<1e-4,
      'The tread must remain level across each section');
  }
});
