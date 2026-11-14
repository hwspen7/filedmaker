import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProject,validateProject,generateSeats,eligiblePortal,SURFACES,modelPerimeterPath,seatingIntervals} from '../src/model.mjs';
import {createOhioStadiumProject} from '../src/venues.mjs';
import {entranceFramePlan,seatAssetPlan} from '../src/detailKit.mjs';
import {aisleStairPlan} from '../src/stadiumDetails.mjs';
import {entranceIntegrity,treadEdgeCap} from '../src/geometryIntegrity.mjs';
import {eyePosition,seatViewAnchors,resolveEyeClearance} from '../src/view.mjs';

const portal={id:'measured-test-entry',tierId:'T1',angle:22,width:4,firstRow:4,lastRow:12};
const make=()=>createProject('nfl');

test('Ohio reference does not create unverified fake rectangles by default',()=>{
  const p=createOhioStadiumProject();
  assert.deepEqual(p.portals,[]);
  assert.equal(entranceFramePlan(p).length,0);
  assert.equal(entranceIntegrity(p).blockedCutouts,0);
});
test('legacy Ohio cutouts are removed only when completely unchanged',()=>{
  const p=createOhioStadiumProject();
  p.portals=[
    {id:'illustrative-east-lower',tierId:'T2',angle:9,width:5,firstRow:11,lastRow:17},
    {id:'illustrative-east-upper',tierId:'T4',angle:345,width:5,firstRow:9,lastRow:14},
    {id:'custom-measured',tierId:'T2',angle:12,width:4,firstRow:11,lastRow:17},
  ];
  const migrated=validateProject(p);
  assert.deepEqual(migrated.portals.map(x=>x.id),['custom-measured']);
});
test('edited legacy opening remains user-authored and is not discarded',()=>{
  const p=createOhioStadiumProject();
  p.portals=[{id:'illustrative-east-lower',tierId:'T2',angle:9,width:4.6,firstRow:11,lastRow:17}];
  assert.equal(validateProject(p).portals.length,1);
});
test('under-height portal is not allowed to remove seats or terrace strips',()=>{
  const p=make(),base=generateSeats(p).capacity;
  p.portals=[{...portal,firstRow:4,lastRow:5}];
  assert.equal(eligiblePortal(p,p.portals[0]),null);
  assert.equal(entranceFramePlan(p).length,0);
  assert.equal(entranceIntegrity(p).blockedCutouts,1);
  assert.equal(generateSeats(p).capacity,base);
});
test('a validated portal cuts the same seat band used by the entrance frame',()=>{
  const p=make(),base=generateSeats(p).capacity;
  p.portals=[{...portal}];
  const e=eligiblePortal(p,p.portals[0]);
  const f=entranceFramePlan(p);
  assert.ok(e&&e.clearRise>=1.85);
  assert.equal(f.length,1);
  assert.equal(f[0].firstRow,e.firstRow);
  assert.equal(f[0].lastRow,e.lastRow);
  assert.ok(generateSeats(p).capacity<base);
  const path=modelPerimeterPath(p,SURFACES[p.surface],e.profile.startOffset+e.profile.depth*6);
  const without=make();
  const normal=seatingIntervals(path,e.section,without,e.tier.id,7);
  const actual=seatingIntervals(path,e.section,p,e.tier.id,7);
  const measure=a=>a.reduce((sum,[start,end])=>sum+end-start,0);
  assert.ok(measure(actual)<measure(normal));
});
test('no fake entrance may emerge from an absent Ohio south upper tier',()=>{
  const p=createOhioStadiumProject();
  p.portals=[{...portal,tierId:'T4',angle:90}];
  assert.equal(entranceIntegrity(p).valid.length,0);
  assert.equal(entranceFramePlan(p).length,0);
});
test('stair-tread omission respects portal headroom validation',()=>{
  const p=make();
  const original=aisleStairPlan(p).length;
  p.portals=[{...portal,angle:p.sections[0].start,firstRow:4,lastRow:5}];
  assert.equal(aisleStairPlan(p).length,original);
});
test('portal transform points inward/outward along one corridor axis',()=>{
  const p=make();p.portals=[{...portal}];
  const f=entranceFramePlan(p)[0];
  const dx=f.far.x-f.near.x,dz=f.far.z-f.near.z;
  assert.ok(Math.abs(f.openingDepth-Math.hypot(dx,dz))<1e-8);
  assert.ok(Math.abs(dx/f.openingDepth-Math.sin(f.yaw))<1e-8);
  assert.ok(Math.abs(dz/f.openingDepth-Math.cos(f.yaw))<1e-8);
});
test('exposed tread caps have finite, continuous upper and lower edges',()=>{
  const p=make(),surface=SURFACES[p.surface],r=12.2,depth=.83,y=3.5;
  const path=modelPerimeterPath(p,surface,r+.42);
  const strip=treadEdgeCap(p,surface,path,r,depth,y,6.5);
  assert.equal(strip.length,4);
  assert.ok(strip.every(q=>[q.x,q.y,q.z].every(Number.isFinite)));
  assert.equal(strip[0].x,strip[2].x);
  assert.equal(strip[1].z,strip[3].z);
  assert.ok(Math.abs(strip[2].y-strip[0].y-.16)<1e-8);
});
test('tread cap is tied to the actual custom outline instead of a generic ellipse',()=>{
  const p=make(),surface=SURFACES[p.surface],path=modelPerimeterPath(p,surface,5);
  const first=treadEdgeCap(p,surface,path,5,.8,2,0);
  const second=treadEdgeCap(p,surface,path,5,.8,2,path.length/4);
  assert.notDeepEqual(first,second);
});
test('seat, hip, eye and look anchor remain distinct and deterministic',()=>{
  const seat={uid:'test',x:10,y:4,z:12,yaw:Math.PI/2};
  const anchor=seatViewAnchors(seat,'seated');
  assert.deepEqual(anchor.seat,{x:10,y:4,z:12});
  assert.ok(anchor.eye.y>anchor.hip.y);
  assert.ok(anchor.lookAnchor.x>anchor.eye.x);
  assert.deepEqual(anchor.eye,eyePosition(seat,'seated'));
});
test('eye collision recovery has a bounded shift and never moves the modeled seat',()=>{
  const seat={uid:'self',x:0,y:0,z:0,yaw:0};
  const eye=eyePosition(seat,'seated');
  const neighbor={uid:'other',x:0,y:.30,z:eye.z};
  const original={...seat};
  const result=resolveEyeClearance(seat,eye,[neighbor]);
  assert.ok(result.shift>0&&result.shift<=.24);
  assert.deepEqual(seat,original);
  assert.ok(Number.isFinite(result.origin.z));
});
test('eye clearance keeps its original position when no nearby chair intersects',()=>{
  const seat={uid:'one',x:0,y:0,z:0,yaw:0},origin=eyePosition(seat);
  const safe=resolveEyeClearance(seat,origin,[{uid:'far',x:5,z:5,y:0}]);
  assert.equal(safe.shift,0);assert.deepEqual(safe.origin,origin);
});
test('chair shell dimensions are thinner than the previous block model',()=>{
  const dims=seatAssetPlan(make());
  assert.ok(dims.backThickness<=.05);
  assert.ok(dims.seatThickness<=.05);
});
test('renderer uses capped terrace sides and recessed portal lining',()=>{
  const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
  const architecture=readFileSync(new URL('../src/architecture.js',import.meta.url),'utf8');
  assert.match(scene,/treadEdgeCap\(/);
  assert.match(scene,/RoundedBoxGeometry/);
  assert.match(scene,/resolveEyeClearance/);
  assert.match(architecture,/recessedPortalBackdrop/);
  assert.match(architecture,/side cheek walls/);
});
