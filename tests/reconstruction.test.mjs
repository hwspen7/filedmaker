import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  RECONSTRUCTION_FORMAT,createReconstruction,addRectangularBank,
  fictionalReconstruction,normalizeReconstruction,toWorkbenchVenue,generateReconstruction,
} from '../src/reconstruction/core.mjs';

test('new data-first venue has no fake sections, scan artifacts or exterior mesh',()=>{
  const p=createReconstruction();
  assert.equal(p.format,RECONSTRUCTION_FORMAT);
  assert.deepEqual(p.sections,[]);
  assert.deepEqual(p.exterior,{enabled:false,provider:null,parameters:null});
  assert.ok(!Object.hasOwn(p,'plan'));
  assert.throws(()=>generateReconstruction(p),/Add section rows/);
});

test('fictional batch demonstration generates exactly 1,500 seats and 4 separate banks',()=>{
  const p=fictionalReconstruction();
  assert.equal(p.sections.length,4);
  const result=generateReconstruction(p,{preview:false});
  assert.equal(result.sourceProject.totals.seats,1500);
  assert.equal(result.sourceProject.totals.rows,60);
  assert.equal(result.seats.length,1500);
  assert.equal(new Set(result.seats.map(s=>s.id)).size,1500);
  assert.equal(result.audit.capacityFitting,false);
  assert.equal(result.audit.exteriorBuilt,false);
  assert.equal(result.quality.blockingCount,0);
});

test('curved four-point banks, tier heights, aisle widths and row counts are kept',()=>{
  const p=createReconstruction('ncaa');
  p.school='Test University';p.venue='Irregular Arena';
  let model=addRectangularBank(p,{id:'101',rows:2,seatsPerRow:5,rowRise:.4});
  const s=model.sections[0];
  s.front=[{x:-10,z:-8},{x:-11,z:0},{x:-10,z:8}];
  s.back=[{x:-15,z:-8},{x:-18,z:0},{x:-15,z:8}];
  s.tier='T2';s.baseHeight=7.5;
  s.rows[0].label='A';s.rows[0].seats=5;s.rows[0].first=21;
  s.rows[0].gaps=[{after:2,width:1.2}];s.rows[0].elevation=8.75;
  s.rows[1].label='B';s.rows[1].seats=3;s.rows[1].first=26;
  s.rows[1].seatDirection='reverse';
  const output=generateReconstruction(model,{preview:false});
  assert.equal(output.seats.length,8);
  assert.equal(output.rowRuns.length,2);
  assert.equal(output.rowRuns[0].height,8.75);
  assert.equal(output.rowRuns[1].height,7.9);
  assert.equal(output.rowRuns[0].aisleGaps[0].width,1.2);
  assert.equal(output.seats[0].tier,'T2');
  assert.deepEqual(output.seats.slice(0,5).map(s=>s.number),['21','22','23','24','25']);
  assert.deepEqual(output.seats.slice(5).map(s=>s.number),['28','27','26']);
  const world=output.seats.map(s=>s.x);
  assert.ok(world.some(x=>x<-11),'Curved edges should affect the generated positions');
});

test('official capacity is reported, never used to fabricate missing chairs',()=>{
  let p=addRectangularBank(createReconstruction(),{
    id:'A',rows:3,seatsPerRow:12,side:'east'});
  p.officialCapacity=500;p.capacitySource='https://school.example.edu/capacity';
  const result=generateReconstruction(p,{preview:false});
  assert.equal(result.seats.length,36);
  assert.equal(result.audit.publishedCapacity,500);
  assert.ok(result.warnings.some(w=>w.includes('differs')));
  assert.equal(result.audit.capacityFitting,false);
});

test('source-provided explicit seat IDs survive without re-sequencing',()=>{
  let p=addRectangularBank(createReconstruction(),{
    id:'A',rows:1,seatsPerRow:3});
  p.sections[0].rows[0].seatNumbers=['E-3','E-7','E-8'];
  const result=generateReconstruction(p,{preview:false});
  assert.deepEqual(result.seats.map(s=>s.number),['E-3','E-7','E-8']);
});

test('missing sections, duplicate rows and bad gaps are rejected before rendering',()=>{
  let p=addRectangularBank(createReconstruction(),{
    id:'A',rows:2,seatsPerRow:8});
  p.sections.push(structuredClone(p.sections[0]));
  assert.throws(()=>normalizeReconstruction(p),/Duplicate section/);
  p.sections.pop();
  p.sections[0].rows[1].label=p.sections[0].rows[0].label;
  assert.throws(()=>normalizeReconstruction(p),/Repeated row/);
  p.sections[0].rows[1].label='2';
  p.sections[0].rows[0].gaps=[{after:100,width:1}];
  assert.throws(()=>normalizeReconstruction(p),/Aisle after seat/);
});

test('external architecture remains an intentionally disabled extension point',()=>{
  const p=addRectangularBank(createReconstruction(),{id:'101',rows:1,seatsPerRow:8});
  p.exterior.enabled=true;
  assert.throws(()=>normalizeReconstruction(p),/future extension/);
});

test('school model bridges into the existing native WebGL2 instance pipeline',()=>{
  const p=addRectangularBank(createReconstruction(),{id:'MAIN',rows:5,seatsPerRow:12});
  const output=generateReconstruction(p,{preview:true});
  assert.equal(output.plan.seats.length,60);
  assert.equal(output.model.seats.length,60);
  assert.ok(output.plan.instanceCount>60);
  assert.equal(output.plan.instanceData.length%11,0);
  assert.ok(output.plan.instanceData.every(Number.isFinite));
  assert.equal(output.plan.operatorWorkspace,true);
  assert.equal(output.audit.capacityFitting,false);
  const legacy=toWorkbenchVenue(p);
  assert.equal(legacy.sections.length,1);
  assert.equal(legacy.rows.length,5);
});

test('data-first builder exposes editable geometry without any scan file input',()=>{
  const html=readFileSync(new URL('../builder/index.html',import.meta.url),'utf8');
  for(const id of ['school','venue','sport','courtWidth','courtLength',
    'sectionList','sectionSelect','newSectionId','addSection','frontPoint','backPoint',
    'rowEditor','bulkRowCount','importRows','saveProject','sceneCanvas','planCanvas',
    'rebuild','show3d','viewHuman'])
    assert.match(html,new RegExp('id="'+id+'"'),'Missing control '+id);
  assert.doesNotMatch(html,/accept="[^"]*\.(?:png|jpg|jpeg|pdf)/i);
  assert.match(html,/builder\.js/);
});
