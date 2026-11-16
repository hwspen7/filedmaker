import test from 'node:test';
import assert from 'node:assert/strict';
import {createSchottensteinCenterProject} from '../src/venues.mjs';
import {generateSeats} from '../src/model.mjs';
import {schottensteinDeckHeight,schottensteinDeckPoint} from '../src/schottensteinSeating.mjs';
import {buildSchottensteinArchitecture} from '../src/next/schottensteinArchitecture.mjs';
import {NativeVenueRenderer} from '../src/next/webgl.js';

test('Ohio State preserves its source-mapped capacity and uses one shared lower-bowl tread mesh',()=>{
  const osu={...createSchottensteinCenterProject(),audienceLayout:'schottenstein-men'};
  const model=generateSeats(osu);
  assert.equal(model.seats.length,19049,
    'OSU seat allocation must not change during visual smoothing');
  assert.ok(model.sectionFootprints?.length>40,'OSU custom chart contours must remain intact');
  const shell=buildSchottensteinArchitecture(model);
  assert.ok(shell&&shell.decks?.length>0);
  let lower=0,upper=0,malformed=0;
  for(let i=0;i<shell.decks.length;i+=6){
    const x=shell.decks[i],y=shell.decks[i+1],z=shell.decks[i+2];
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))malformed++;
    if(y<6.45&&y>.1)lower++;
    if(y>=7)upper++;
  }
  assert.equal(malformed,0,'OSU step vertices must not contain nonfinite values');
  assert.ok(lower>1000,'OSU lower bowl must use individual fitted mesh treads');
  assert.ok(upper>1000,'OSU existing club/upper steps must be retained');
  const samples=model.seatingRows.filter(row=>row.tier===0&&row.width>2);
  assert.ok(samples.length>200);
  const diffs=samples.map(row=>{
    const x=(row.left.x+row.right.x)*.5,z=(row.left.z+row.right.z)*.5;
    return Math.abs(row.y-schottensteinDeckHeight(0,{x,z}));
  }).sort((a,b)=>a-b);
  assert.ok(diffs[Math.floor(diffs.length*.95)]<.55,
    'Most OSU lower tread heights must agree with the same analytic surface');
});

test('OSU shared lower-bowl surface has no sharp angular jumps at section boundaries',()=>{
  for(let k=0;k<256;k++){
    const angle=k*2*Math.PI/256,r=schottensteinDeckPoint(0,angle,.5);
    const nextAngle=angle+1e-4,n=schottensteinDeckPoint(0,nextAngle,.5);
    const a=schottensteinDeckHeight(0,r),b=schottensteinDeckHeight(0,n);
    assert.ok(Math.abs(a-b)<.08,'Lower-bowl surface jump at angle '+angle);
  }
});

test('unsurveyed outer arena facades are excluded from 3D interior, never from the explicit exterior view',()=>{
  const shell={arenaInterior:true,architectureGeometry:{facade:new Float32Array(18),decks:new Float32Array(18)},
    proceduralSpec:{interior:{outline:'rectangle'}}};
  assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(shell,'overview','facade'),false);
  for(const layer of ['concourse','soffit','roofDeck','backWall','pilasters','trim'])
    assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(shell,'overview',layer),false,
      'Do not show the gray exterior/gallery ring over any reconstructed seat bowl: '+layer);
  assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(shell,'overview','decks'),true);
  assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(shell,'exterior','facade'),true);
  assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(shell,'exterior','decks'),false);
  const osu={...shell,proceduralSpec:null};
  assert.equal(NativeVenueRenderer.architectureLayerVisibleInMode(osu,'overview','facade'),true,
    'Preserve the real OSU chart cutaway facade');
});
