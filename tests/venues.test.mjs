import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProject,generateSeats,validateProject,resolveTiers,resolveSectionTier,SURFACES} from '../src/model.mjs';
import {OHIO_STADIUM,createOhioStadiumProject,ohioSectionRegion,isOhioReference,ohioFactReport} from '../src/venues.mjs';
import {aisleStairPlan,facadeArcPlan,stadiumEnvelope,stadiumProvenance} from '../src/stadiumDetails.mjs';
test('Ohio Stadium dimensional facts use exact foot-to-meter conversion',()=>{
 assert.ok(Math.abs(OHIO_STADIUM.lengthM-280.1112)<1e-6);
 assert.ok(Math.abs(OHIO_STADIUM.widthM-206.9592)<1e-6);
 assert.ok(Math.abs(OHIO_STADIUM.scoreboardWidthM-38.1)<1e-6);
 assert.equal(OHIO_STADIUM.publishedCapacity,102041);
});
test('Ohio template has distinguishable north horseshoe and detached south upper deck',()=>{
 const p=createOhioStadiumProject(),m=generateSeats(p);
 assert.ok(isOhioReference(p));assert.equal(p.tiers.length,4);
 assert.equal(p.sections.length,32);assert.equal(p.outline.points.length,48);
 assert.ok(m.capacity>30000&&m.capacity<100000);
 const upper=resolveTiers(p)[3],south=p.sections.find(s=>ohioSectionRegion((s.start+s.end)/2)==='south');
 const north=p.sections.find(s=>ohioSectionRegion((s.start+s.end)/2)==='north');
 assert.equal(resolveSectionTier(upper,south.id,p).rows,0);
 assert.ok(resolveSectionTier(upper,north.id,p).rows>0);
 assert.ok(m.seats.some(s=>s.tier===3&&s.sectionId===north.id));
 assert.ok(!m.seats.some(s=>s.tier===3&&s.sectionId===south.id));
});
test('Venue source report clearly distinguishes documented facts from synthetic seats',()=>{
 const p=createOhioStadiumProject(),m=generateSeats(p);
 const report=ohioFactReport(p,m.capacity);
 assert.equal(report.officialSeatCoordinatesAvailable,false);
 assert.notEqual(report.generatedReferenceSeats,report.publishedCapacity);
 assert.match(report.reconstructionStatus,/not surveyed/);
 assert.match(stadiumProvenance(p,m.capacity).measurementStatus,/no surveyed/);
});
test('High detail steps and facade segments are bounded, finite, outside the playing surface',()=>{
 const p=createOhioStadiumProject(),steps=aisleStairPlan(p),segments=facadeArcPlan(p),env=stadiumEnvelope(p);
 assert.ok(steps.length>600&&steps.length<9000);
 assert.ok(steps.every(s=>Number.isFinite(s.y)&&Number.isFinite(s.x)&&Number.isFinite(s.z)));
 assert.ok(segments.length>80);
 assert.ok(env.width>170&&env.width<240&&env.length>220&&env.length<320);
 const f=SURFACES[p.surface];
 assert.ok(segments.every(s=>[s.a,s.b].every(v=>Math.abs(v.x)>f.width/2||Math.abs(v.z)>f.length/2)));
});
test('Generic soccer basketball and football templates remain independent',()=>{
 for(const name of ['nfl','soccer','nba']){
  const p=validateProject(createProject(name));
  assert.equal(isOhioReference(p),false);assert.equal(stadiumProvenance(p,0),null);
  assert.ok(aisleStairPlan(p).length>0);
 }
});
test('New schema preserves old projects, rejects unknown reference identities',()=>{
 const p=createProject();p.schemaVersion=4;delete p.venueReference;delete p.detailLevel;
 const upgraded=validateProject(p);assert.equal(upgraded.schemaVersion,5);assert.equal(upgraded.detailLevel,'standard');
 upgraded.detailLevel='ultra';assert.throws(()=>validateProject(upgraded),/detail level/);
 upgraded.detailLevel='high';upgraded.venueReference={id:'fictional'};
 assert.throws(()=>validateProject(upgraded),/Unknown venue/);
});
test('3D scene includes new architecture, human seat view and sport equipment',()=>{
 const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
 const arch=readFileSync(new URL('../src/architecture.js',import.meta.url),'utf8');
 assert.match(scene,/addDetailedVenue\(this\.root,model\)/);
 assert.match(scene,/concrete riser/);
 assert.match(arch,/function ohioSpecific/);
 assert.match(arch,/function sportFurniture/);
 assert.match(arch,/scoreboardWidthM/);
});
test('UI exposes Ohio Stadium reconstruction and discloses uncertain capacity',()=>{
 const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../legacy/index.html',import.meta.url),'utf8');
 assert.match(html,/ohioVenueShortcut/);assert.match(app,/data-build-ohio-stadium/);
 assert.match(app,/NOT official/);assert.match(app,/detailLevel/);
 assert.match(html,/data-preset="soccer"/);assert.match(html,/data-preset="nba"/);
});
