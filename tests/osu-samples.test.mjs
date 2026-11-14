import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OSU_FACTS,venueFacts,venueQualityReport} from '../src/osuFacts.mjs';
import {createOhioStadiumProject,createSchottensteinCenterProject,isSchottensteinReference} from '../src/venues.mjs';
import {generateSeats,validateProject,SURFACES,resolveTiers} from '../src/model.mjs';
import {schottensteinFeaturePlan} from '../src/schottensteinKit.mjs';

const schott=createSchottensteinCenterProject();
const ohio=createOhioStadiumProject();

test('October 2026 OSU stadium capacity is separate from earlier 2026 media-guide figure',()=>{
  const facts=venueFacts('ohio-stadium');
  assert.equal(facts.capacity.value,102041);
  assert.equal(facts.capacity.year,2026);
  assert.equal(facts.historicalCapacity.value,102780);
  assert.ok(facts.capacity.source.includes('2026'));
  assert.equal(facts.capacity.asOf,'2026-10-13');
  assert.equal(facts.dimensions.buildingLengthM,919*.3048);
  assert.equal(facts.dimensions.buildingWidthM,679*.3048);
});

test('deck counts and southern stand figures must not be summed to infer official seat capacity',()=>{
  const facts=OSU_FACTS['ohio-stadium'];
  const naiveSum=Object.values(facts.publishedDeckFigures).reduce((n,v)=>n+v,0);
  assert.ok(naiveSum>facts.capacity.value);
  assert.notEqual(naiveSum,facts.capacity.value);
  const report=venueQualityReport(ohio,generateSeats(ohio).capacity);
  assert.equal(report.sourceBackedCapacity,102041);
  assert.match(report.warnings.join(' '),/never infer individual row counts/i);
});

test('Ohio Stadium now uses the NCAA football surface, not a fictitious NFL home label',()=>{
  assert.equal(ohio.surface,'ncaa-football');
  assert.equal(SURFACES[ohio.surface].sport,'football');
  assert.equal(ohio.portals.length,0);
  assert.equal(ohio.venueReference.seatNumbering,'synthetic');
});

test('Schottenstein Center reference is NCAA basketball with a distinct three-tier schematic bowl',()=>{
  assert.equal(schott.surface,'ncaa');
  assert.ok(isSchottensteinReference(schott));
  assert.equal(schott.tiers.length,3);
  assert.equal(schott.sections.length,24);
  assert.ok(schott.tiers.some(t=>/premium/i.test(t.label)));
  assert.equal(schott.portals.length,0);
  assert.equal(validateProject(schott).venueReference.id,'schottenstein-center');
  assert.ok(resolveTiers(schott).at(-1).startHeight>0);
});

test('Schottenstein public seating capacity is distinct from a generated model and from the building area',()=>{
  const facts=OSU_FACTS['schottenstein-center'];
  const count=generateSeats(schott).capacity;
  assert.equal(facts.capacity.value,19500);
  assert.equal(facts.alternativeCapacity.value,19700);
  assert.ok(facts.dimensions.buildingGrossFloorAreaSqM>71000);
  assert.ok(facts.dimensions.buildingGrossFloorAreaSqM<72000);
  assert.ok(count>10000&&count<30000);
  assert.notEqual(count,facts.capacity.value);
  const report=venueQualityReport(schott,count);
  assert.equal(report.generatedSeatCount,count);
  assert.equal(report.surveyedSeatCount,0);
  assert.equal(report.measuredModel,false);
  assert.match(report.seatCoordinates,/estimated/);
});

test('Schottenstein 2026 video-board kit preserves documented counts without inventing entrance positions',()=>{
  const spec=schottensteinFeaturePlan(schott);
  assert.equal(spec.board.faceCount,4);
  assert.ok(spec.board.underbelly);
  assert.equal(spec.ribbon.publishedHeightInches,36);
  assert.equal(spec.ribbon.widthM,36*.0254);
  assert.equal(spec.documentedVomitoryDisplayCount,43);
  assert.equal(spec.positionedVomitoryDisplays,0);
  assert.match(spec.modelStatus,/illustrative/);
  assert.equal(schottensteinFeaturePlan(ohio),null);
});

test('sports arena pipeline and court render include Schottenstein visual features',()=>{
  const architecture=readFileSync(new URL('../src/architecture.js',import.meta.url),'utf8');
  const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
  assert.match(architecture,/schottensteinSpecific\(root,project\)/);
  assert.match(architecture,/screen faces documented/);
  assert.match(architecture,/surveyedVomitoryDisplayPositions/);
  assert.match(scene,/isSchottensteinReference\(project\)/);
});

test('both OSU samples are reachable in the editor and expose QA export',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(html,/schottVenueShortcut/);
  assert.match(html,/ohioVenueShortcut/);
  assert.match(app,/data-build-schottenstein/);
  assert.match(app,/data-export-osu-qa/);
  assert.match(app,/Generated model seat count/);
  assert.match(app,/NOT an official seat inventory/);
});

test('public-source identity validation cannot be forged by setting an unrelated sport',()=>{
  const corrupted=structuredClone(schott);
  corrupted.surface='nfl';
  assert.throws(()=>validateProject(corrupted),/Unknown venue reference/);
  assert.equal(venueFacts('made-up-campus'),null);
  assert.equal(venueQualityReport({venueReference:{id:'unknown'}},0),null);
  assert.throws(()=>venueQualityReport(schott,-1),/non-negative integer/);
});
