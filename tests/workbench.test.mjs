import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newVenue,normalizeVenue,parseVenueRows} from '../src/workbench/contract.mjs';
import {registerCourt} from '../src/workbench/registration.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {buildWorkbenchPreview} from '../src/workbench/adapter.mjs';

const rowCSV='section,row,seats,seat_start,tier,seat_type\nHOME,A,12,3,T1,bleacher\nHOME,B,10,1,T1,chair\nAWAY,A,5,1,T1,chair\n';
test('school venue contract supports explicitly scoped basketball and football surfaces',()=>{
  assert.equal(newVenue().sport,'nfhs-basketball');
  assert.equal(newVenue('ncaa-football').court.length,109.728);
  assert.throws(()=>newVenue('unknown'),/Unsupported/);
  assert.throws(()=>normalizeVenue({format:'bad',sport:'nfhs-basketball'}),/Not a FiledMaker/);
});
test('row CSV importer preserves original row labels, counts and first seat numbers',()=>{
  const r=parseVenueRows(rowCSV);
  assert.deepEqual(r.map(x=>[x.section,x.row,x.seats,x.first]),[
    ['HOME','A',12,3],['HOME','B',10,1],['AWAY','A',5,1]]);
  assert.equal(r[0].seatType,'bleacher');
});
test('row CSV importer rejects invented counts, duplicates and missing headings',()=>{
  assert.throws(()=>parseVenueRows('section,row,seats\nA,1,3\nA,1,4\n'),/Duplicate/);
  assert.throws(()=>parseVenueRows('section,row,seats\nA,1,2.5\n'),/integers/);
  assert.throws(()=>parseVenueRows('section,row\nA,1\n'),/requires seats/);
  assert.throws(()=>parseVenueRows('section,row,seats\nA,1,0\n'),/between/);
});
test('project rejects unsourced capacity, illegal rows, and duplicate sections',()=>{
  const v=fictionalGym();
  v.officialCapacity=1500;
  assert.throws(()=>normalizeVenue(v),/HTTPS source/);
  v.capacitySource='https://example.edu/seats';
  v.sections.push(structuredClone(v.sections[0]));
  assert.throws(()=>normalizeVenue(v),/Duplicate section/);
});
test('court pixel registration maintains four corners and invertibility',()=>{
  const corners=[{x:30,y:60},{x:430,y:62},{x:453,y:640},{x:18,y:617}];
  const transform=registerCourt(corners,15.24,25.6032);
  assert.ok(transform.residual<1e-6);
  for(const p of corners){
    const back=transform.toImage(transform.toWorld(p));
    assert.ok(Math.hypot(back.x-p.x,back.y-p.y)<1e-6);
  }
});
test('calibration rejects overlapping anchors instead of inventing a scale',()=>{
  const corners=Array(4).fill({x:10,y:10});
  assert.throws(()=>registerCourt(corners,15,25),/degenerate/);
});
test('fictional 1,500-seat gym is deterministic, multi-section and count-exact',()=>{
  const sample=fictionalGym();
  const a=generateTracedVenue(sample),b=generateTracedVenue(sample);
  assert.equal(a.seats.length,1500);
  assert.equal(a.rowRuns.length,60);
  assert.equal(new Set(a.seats.map(s=>s.id)).size,1500);
  assert.equal(new Set(a.seats.map(s=>s.section)).size,4);
  assert.deepEqual(a.seats,b.seats);
  assert.deepEqual(a.rowRuns.map(r=>r.count),Array(60).fill(25));
  assert.equal(a.audit.independentSurvey,false);
});
test('unknown sections are rejected instead of creating fictional seating banks',()=>{
  const v=fictionalGym();
  v.sections=v.sections.slice(1);
  assert.throws(()=>generateTracedVenue(v),/no traced section/);
});
test('crowded imported rows flag QA but preserve exact source counts',()=>{
  const v=fictionalGym(),s=v.sections[0];
  s.front[1].z=s.front[0].z+8;
  s.back[1].z=s.back[0].z+8;
  const r=generateTracedVenue(v);
  assert.equal(r.seats.length,1500);
  assert.ok(r.warnings.some(w=>w.includes('average seat pitch')));
});
test('published capacity differences cannot silently add or delete seats',()=>{
  const v=fictionalGym();
  v.officialCapacity=1550;
  v.capacitySource='https://school.example.edu/venue';
  const r=generateTracedVenue(v);
  assert.equal(r.seats.length,1500);
  assert.equal(r.audit.publishedCapacity,1550);
  assert.ok(r.warnings.some(w=>w.includes('differs by -50')));
});
test('workbench project round-trips without a release-number contract',()=>{
  const v=fictionalGym(),decoded=normalizeVenue(JSON.parse(JSON.stringify(normalizeVenue(v))));
  assert.equal(decoded.sections.length,4);
  assert.equal(decoded.rows.length,60);
  assert.equal(decoded.format,'filedmaker-venue-workbench');
  assert.equal(Object.hasOwn(decoded,'schemaVersion'),false);
});
test('traced source rows feed the renderer without changing seat identities',()=>{
  const result=buildWorkbenchPreview(fictionalGym());
  assert.equal(result.model.seats.length,1500);
  assert.equal(result.project.survey.seats.length,1500);
  assert.equal(result.project.ticketing.coordinates,'estimated');
  assert.equal(result.project.ticketing.inventoryMode,'none');
  assert.equal(result.plan.seats.length,1500);
  assert.ok(result.plan.instanceData.length>0);
  assert.ok(result.plan.instanceData.every(Number.isFinite));
  assert.equal(result.model.seatOrigin,'imported');
});
test('homepage exposes only two OSU references and custom workbench',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.includes('data-preset="schott"')&&html.includes('data-preset="ohio"'));
  assert.doesNotMatch(html,/data-bigten=/);
  assert.match(html,/href="\.\/workbench\//);
});

test('Windows workbench launcher checks branch and runtime identity',()=>{
  const launcher=readFileSync(new URL('../scripts/launch-workbench.ps1',import.meta.url),'utf8');
  assert.match(launcher,/git branch --show-current/);
  assert.doesNotMatch(launcher,/\$target = 'feature\/big-ten-arena-parity'/);
  assert.match(launcher,/__filedmaker\/status/);
  assert.match(launcher,/workbench\//);
  assert.doesNotMatch(launcher,/data-bigten=/);
});
