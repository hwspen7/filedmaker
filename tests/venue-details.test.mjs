import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject, generateSeats, validateProject, SURFACES, resolveTiers, resolveSectionTier } from '../src/model.mjs';
import { OHIO_STADIUM, createOhioStadiumProject, ohioFactReport, ohioSectionRegion, ohioTierRowCount, isOhioReference } from '../src/venues.mjs';
import { aisleStairPlan, facadeArcPlan, stadiumEnvelope, stadiumProvenance } from '../src/stadiumDetails.mjs';

test('Ohio Stadium published dimensions use physically exact imperial conversions',()=>{
  assert.ok(Math.abs(OHIO_STADIUM.lengthM - 280.1112)<1e-6);
  assert.ok(Math.abs(OHIO_STADIUM.widthM - 206.9592)<1e-6);
  assert.ok(Math.abs(OHIO_STADIUM.scoreboardWidthM - 38.1)<1e-6);
  assert.ok(Math.abs(OHIO_STADIUM.scoreboardHeightM - 12.8016)<1e-6);
  assert.equal(OHIO_STADIUM.publishedCapacity,102041);
  assert.ok(OHIO_STADIUM.sources.every(x=>x.startsWith('https://')));
});

test('Ohio reference generates a distinct horseshoe and detached upper south end',()=>{
  const project=createOhioStadiumProject();
  const model=generateSeats(project);
  assert.equal(project.surface,'ncaa-football');
  assert.equal(project.tiers.length,4);
  assert.equal(project.sections.length,32);
  assert.equal(project.outline.points.length,48);
  assert.ok(isOhioReference(project));
  assert.ok(model.capacity>35000);
  assert.ok(model.capacity<OHIO_STADIUM.publishedCapacity);
  assert.equal(model.seatOrigin,'generated');
  assert.ok(project.sectionProfiles.some(x=>x.tierId==='T4'&&x.rows===0));
  const north=project.sections.find(s=>ohioSectionRegion((s.start+s.end)/2)==='north');
  const south=project.sections.find(s=>ohioSectionRegion((s.start+s.end)/2)==='south');
  const tiers=resolveTiers(project),upper=tiers[3];
  assert.ok(resolveSectionTier(upper,north.id,project).rows>0);
  assert.equal(resolveSectionTier(upper,south.id,project).rows,0);
  assert.ok(model.seats.some(s=>s.tier===3&&s.sectionId===north.id));
  assert.ok(!model.seats.some(s=>s.tier===3&&s.sectionId===south.id));
});

test('Ohio reference never pretends synthetic seats are the official venue seating plan',()=>{
  const p=createOhioStadiumProject();const m=generateSeats(p);
  const report=ohioFactReport(p,m.capacity);
  assert.equal(report.officialSeatCoordinatesAvailable,false);
  assert.notEqual(report.generatedReferenceSeats,report.publishedCapacity);
  assert.match(report.reconstructionStatus,/not surveyed/);
  assert.equal(p.venueReference.seatNumbering,'synthetic');
  assert.equal(stadiumProvenance(p,m.capacity).measurementStatus,'schematic shape and seat coordinates — no surveyed seat-level data');
});

test('stair plan is finite and rests on a real tier',()=>{
  const p=createOhioStadiumProject();const plan=aisleStairPlan(p);
  assert.ok(plan.length>700);
  assert.ok(plan.length<9000);
  assert.ok(plan.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z)&&v.depth>=.65&&v.width>=.4));
  const noStair=p.sectionProfiles.filter(x=>x.tierId==='T4'&&x.rows===0);
  assert.ok(noStair.length>=3);
});

test('stadium facade segments follow resolved tier boundary, not the field playing surface',()=>{
  const p=createOhioStadiumProject();const segments=facadeArcPlan(p,3),env=stadiumEnvelope(p);
  assert.ok(segments.length>80);
  assert.ok(env.width>170&&env.width<240);
  assert.ok(env.length>230&&env.length<320);
  assert.ok(env.height>20&&env.height<48);
  const field=SURFACES[p.surface];
  for(const segment of segments){
    for(const pt of [segment.a,segment.b]) {
      assert.ok(Math.abs(pt.x)>field.width/2||Math.abs(pt.z)>field.length/2);
    }
  }
});

test('generic stadiums keep their own geometry and no Ohio provenance',()=>{
  for(const template of ['nfl','soccer','nba']){
    const p=validateProject(createProject(template));
    assert.equal(isOhioReference(p),false);
    assert.equal(stadiumProvenance(p,10000),null);
    assert.ok(aisleStairPlan(p).length>0);
    assert.ok(facadeArcPlan(p).length>0);
  }
});

test('invalid detail settings and unknown venue identities are rejected',()=>{
  const p=createOhioStadiumProject();
  p.detailLevel='cinematic-super-ultra';
  assert.throws(()=>validateProject(p),/detail level/);
  p.detailLevel='high';p.venueReference.id='invented-arena';
  assert.throws(()=>validateProject(p),/Unknown venue reference/);
});

test('old 2026 projects migrate to new detail defaults safely',()=>{
  const p=createProject();p.schemaVersion=4;
  delete p.detailLevel;delete p.showExterior;delete p.showFixtures;delete p.venueReference;
  const newProject=validateProject(p);
  assert.equal(newProject.schemaVersion,5);
  assert.equal(newProject.showExterior,true);
  assert.equal(newProject.showFixtures,true);
  assert.equal(newProject.detailLevel,'standard');
});

test('three dimensional scene actually invokes the new architecture pipeline',()=>{
  const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
  const arch=readFileSync(new URL('../src/architecture.js',import.meta.url),'utf8');
  assert.match(scene,/addDetailedVenue\(this\.root,model\)/);
  assert.match(scene,/Flat tread followed by a concrete riser/);
  assert.match(arch,/function ohioSpecific/);
  assert.match(arch,/function stairways/);
  assert.match(arch,/function sportFurniture/);
  assert.match(arch,/pressBoxRoofM/);
  assert.match(arch,/scoreboardWidthM/);
});

test('real venue UI provides user controls and source/disclaimer without replacing the generic workflow',()=>{
  const html=readFileSync(new URL('../legacy/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(html,/ohioVenueShortcut/);
  assert.match(app,/data-build-ohio-stadium/);
  assert.match(app,/showFixtures/);
  assert.match(app,/detailLevel/);
  assert.match(app,/NOT official/);
  assert.match(html,/data-preset="soccer"/);
  assert.match(html,/data-preset="nba"/);
});
