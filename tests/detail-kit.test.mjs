import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject, generateSeats, resolveTiers, resolveSectionTier } from '../src/model.mjs';
import { createOhioStadiumProject } from '../src/venues.mjs';
import { entranceFramePlan, seatAssetPlan, fieldEquipmentPlan, guardrailPlan, detailPlanSummary } from '../src/detailKit.mjs';

const ohio = createOhioStadiumProject();

test('every Ohio entrance is open, supported by an enabled tier, and meets its removed row band', () => {
  const frames=entranceFramePlan(ohio);
  assert.equal(frames.length,ohio.portals.length);
  assert.ok(frames.every(x=>x.kind==='open-jamb-and-lintel' && x.provenance==='schematic'));
  const tierMap=new Map(resolveTiers(ohio).map(t=>[t.id,t]));
  for(const f of frames){
    assert.ok(f.openingDepth>0 && f.width>=.8 && f.lastRow>=f.firstRow);
    assert.ok(f.topOfStands>=f.entranceFloor);
    assert.ok([f.yaw,f.near.x,f.near.z,f.far.x,f.far.z].every(Number.isFinite));
    const p=resolveSectionTier(tierMap.get(f.tierId),f.sectionId,ohio);
    assert.ok(f.lastRow<=p.rows);
    assert.ok(Math.hypot(f.near.x-f.far.x,f.near.z-f.far.z) >= f.openingDepth*.9);
  }
});

test('entrances in missing Ohio south upper tier do not create floating facade boxes', () => {
  const p=createOhioStadiumProject();
  p.portals.push({id:'void-upper',tierId:'T4',angle:90,width:4,firstRow:5,lastRow:9});
  assert.ok(!entranceFramePlan(p).some(f=>f.id==='void-upper'));
});

test('entrances are clipped to the actual number of rows for an existing active tier', () => {
  const p=createProject('nfl');
  p.portals=[{id:'cut',tierId:'T1',angle:20,width:3,firstRow:4,lastRow:75}];
  const frames=entranceFramePlan(p);
  assert.equal(frames.length,1);
  assert.equal(frames[0].lastRow,p.tiers[0].rows);
  assert.ok(frames[0].clearHeight>0);
});

test('guardrails follow actual seat-bearing segments instead of sealing aisle openings', () => {
  const p=createOhioStadiumProject();
  const {rails,posts}=guardrailPlan(p);
  assert.ok(rails.length>500 && rails.length<10000);
  assert.ok(posts.length>200 && posts.length<5000);
  for(const r of rails){
    const length=Math.hypot(r.a.x-r.b.x,r.a.z-r.b.z);
    assert.ok(length>0 && length<2.6);
    assert.ok(Math.abs(r.a.y-r.b.y)<1e-9);
  }
  assert.ok(posts.every(x=>x.height>0.9 && [x.x,x.y,x.z].every(Number.isFinite)));
});

test('guardrail is absent where a tier has been disabled, including the south upper bowl',()=>{
  const p=createOhioStadiumProject();
  const {rails}=guardrailPlan(p);
  // Physical front guardrail across the missing T4 south sector is prohibited.
  assert.ok(!rails.some(r=>r.tier==='T4' && Math.atan2((r.a.z+r.b.z)/2,(r.a.x+r.b.x)/2) >.85 && Math.atan2((r.a.z+r.b.z)/2,(r.a.x+r.b.x)/2)<2.25));
});

test('seat dimensions fit within pitch, use thin shells and bounded draw calls',()=>{
  for(const sport of ['nfl','soccer','nba']){
    const p=createProject(sport),s=seatAssetPlan(p);
    assert.ok(s.seatWidth<p.seatPitch);
    assert.ok(s.seatThickness<.075);
    assert.ok(s.legThickness<.05);
    assert.ok(s.maxMeshes<=7);
    assert.equal(s.styleForTier(2),'chair');
  }
  assert.equal(seatAssetPlan(ohio).styleForTier(0),'chair');
  assert.equal(seatAssetPlan(ohio).styleForTier(3),'bleacher');
});

test('sport kits contain sport-specific facilities without using oversized solid placeholder blocks',()=>{
  for(const preset of ['nfl','soccer','nba']){
    const p=createProject(preset),assets=fieldEquipmentPlan(p);
    assert.ok(assets.length>=3 && assets.length<100);
    assert.ok(assets.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.z)));
  }
  const football=fieldEquipmentPlan(ohio);
  assert.ok(football.some(x=>x.kind==='bench'));
  assert.ok(football.some(x=>x.kind==='camera-platform'));
  assert.ok(football.some(x=>x.kind==='chain-marker'));
  assert.ok(fieldEquipmentPlan(createProject('soccer')).some(x=>x.kind==='dugout'));
  assert.ok(fieldEquipmentPlan(createProject('nba')).some(x=>x.kind==='scorer-table'));
});

test('details are not mistaken for surveyed geometry or a certified capacity',()=>{
  const count=generateSeats(ohio).capacity;
  const summary=detailPlanSummary(ohio);
  assert.equal(summary.entrances,ohio.portals.length);
  assert.ok(summary.fieldAssets>=10);
  assert.equal(ohio.venueReference.seatNumbering,'synthetic');
  assert.notEqual(count,102041);
});

test('3D seat picking, geometric stair gaps and open entrances stay wired to scene code',()=>{
  const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
  const architecture=readFileSync(new URL('../src/architecture.js',import.meta.url),'utf8');
  assert.match(scene,/userData\.isSeat=true/);
  assert.match(scene,/seatingIntervals\(path,section,project,tier\.id,e\.row\)/);
  assert.match(scene,/new THREE\.InstancedMesh\(geometry,m,seats\.length\)/);
  assert.match(architecture,/entranceFramePlan\(project\)/);
  assert.doesNotMatch(architecture,/addBox\(tunnel,portal\.width,2\.65,1\.7/);
  assert.match(architecture,/guardrailPlan\(project\)/);
});
