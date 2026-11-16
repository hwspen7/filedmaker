import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSectionLabels,pdfImportSummary} from '../src/workbench/imports/pdf.mjs';
import {reviewReadiness,suggestionQueue} from '../src/workbench/review.mjs';
import {makeSchoolPdf} from './fixtures/synthetic-pdf.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
test('synthetic multi-page PDF is structurally complete and has an indexed xref',()=>{
  const content=Buffer.from(makeSchoolPdf()).toString('latin1');
  assert.ok(content.startsWith('%PDF-1.4'));
  assert.match(content,/xref\n0 8/);
  assert.match(content,/WEST-1/);
  assert.match(content,/\/Count 2/);
});
test('PDF text hint matching is strictly linked to imported real row labels',()=>{
  const labels=detectSectionLabels([
    {str:'WEST-1',x:10,y:20},{str:'WEST-1',x:10,y:20},
    {str:'SEC EAST-2',x:55,y:20},{str:'SCHOOL DISTRICT',x:30,y:80}
  ],[{section:'WEST-1'},{section:'EAST-2'}]);
  assert.deepEqual(labels.matches.map(x=>x.id),['WEST-1','EAST-2']);
  assert.equal(labels.matches[0].kind,'row-label-match');
  assert.equal(labels.matches[0].confidence,94);
  assert.equal(labels.matches.length,2);
});
test('low-text scanned PDF requires manual confirmation rather than inferred sections',()=>{
  const scan=pdfImportSummary({pageCount:1,textCount:0,matches:[]});
  assert.equal(scan.assistance,'raster-or-unreadable-text');
  assert.equal(scan.automaticGeometry,false);
  const labels=detectSectionLabels([{str:'SCHOOL',x:0,y:0}],[]);
  assert.equal(labels.matches.length,0);
  assert.equal(labels.mode,'manual-tracing-required');
});
test('only known row labels with no already traced section are actionable',()=>{
  const rows=[{section:'WEST-1'},{section:'EAST-1'}];
  const queued=suggestionQueue([
    {id:'WEST-1',x:10,y:10},{id:'WEST-1',x:10,y:10},
    {id:'EAST-1',x:20,y:10},{id:'UNKNOWN',x:5,y:5}
  ],rows,[{id:'WEST-1'}]);
  assert.deepEqual(queued.map(x=>x.id),['EAST-1']);
});
test('human-review checklist refuses to declare incomplete drawing ready',()=>{
  const venue=fictionalGym();
  const before=reviewReadiness(venue);
  assert.equal(before.ready,false);
  assert.equal(before.conditions.drawing,false);
  venue.plan={name:'synthetic.pdf',pageNumber:1};
  venue.calibration.corners=[{x:1,y:1},{x:2,y:1},{x:2,y:2},{x:1,y:2}];
  assert.equal(reviewReadiness(venue).ready,true);
  venue.sections.pop();
  const missing=reviewReadiness(venue);
  assert.equal(missing.ready,false);
  assert.ok(missing.missingSections.length>0);
  assert.equal(missing.reviewRequired,true);
});
