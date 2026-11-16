import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseVenueRows,normalizeVenue} from '../src/workbench/contract.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {assessVenueGeometry} from '../src/workbench/quality.mjs';
import {describeFile,appendSource,assessSources} from '../src/workbench/sources.mjs';
import {createHistory} from '../src/workbench/history.mjs';
import {assessRegistration} from '../src/workbench/registration-audit.mjs';
import {parseVectorFile} from '../src/workbench/imports/vector.mjs';
import {compareVenueProjects} from '../src/workbench/diff.mjs';
import {importRowFile} from '../src/workbench/imports/tabular.mjs';
import {readZip} from '../src/workbench/imports/zip.mjs';

const makeFile=(name,text,type='text/plain')=>new File([text],name,{type});
test('CSV, TSV and JSON converge on the same validated row contract',async()=>{
  const csv=await importRowFile(makeFile('rows.csv','section,row,seats\nHOME,A,18\n'));
  const tsv=await importRowFile(makeFile('rows.tsv','section\trow\tseats\nHOME\tA\t18\n'));
  const json=await importRowFile(makeFile('rows.json',JSON.stringify([{section:'HOME',row:'A',seats:18}])));
  assert.deepEqual(csv.rows,tsv.rows);assert.deepEqual(tsv.rows,json.rows);
  assert.equal(csv.rows[0].seats,18);
  await assert.rejects(importRowFile(makeFile('evil.pdf','not actually PDF')),/Supported row formats/);
});
test('ZIP reader verifies actual XLSX central directory, size and CRC',async()=>{
  const data=Buffer.from(readFileSync(new URL('./fixtures/row-workbook.base64.txt',import.meta.url),'utf8').trim(),'base64');
  const zip=await readZip(data,name=>name.startsWith('xl/'));
  assert.equal(zip.size,4);
  assert.ok(new TextDecoder().decode(zip.get('xl/workbook.xml')).includes('sheet name="HOME"'));
  const corrupted=Uint8Array.from(data);
  const location=corrupted.findIndex((_,i)=>i<corrupted.length-4&&
    corrupted[i]===0x50&&corrupted[i+1]===0x4b&&corrupted[i+2]===1&&corrupted[i+3]===2);
  assert.ok(location>0);
  corrupted[location+16]^=1;
  await assert.rejects(readZip(corrupted,name=>name.startsWith('xl/')),/checksum/);
});
test('ASCII DXF imported shapes are not treated as automatically verified seats',()=>{
  const dxf='0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nHOME\n10\n0\n20\n0\n10\n10\n20\n0\n10\n10\n20\n5\n10\n0\n20\n5\n0\nENDSEC\n0\nEOF\n';
  const x=parseVectorFile(dxf,'school.dxf');
  assert.equal(x.contours.length,1);assert.equal(x.contours[0].id,'HOME');
  assert.equal(x.format,'DXF');
  assert.ok(x.limitations.some(x=>/scale/.test(x)));
});
test('source manifest hashes real file bytes and preserves traceability',async()=>{
  const v=fictionalGym(),f=makeFile('rows.csv','section,row,seats\nHOME,A,5\n');
  const a=await describeFile(f,{role:'seat-rows',origin:'school-supplied'});
  assert.match(a.id,/^sha256:[0-9a-f]{64}$/);
  const b=appendSource(v,a);b.rowSourceId=a.id;
  const c=appendSource(b,a);
  assert.equal(c.sources.length,1);
  assert.ok(assessSources(c).issues.length===0);
  assert.throws(()=>normalizeVenue({...c,rowSourceId:'sha256:fake'}),/Active source/);
});
test('source manifests never imply external certification without review',()=>{
  const v=fictionalGym();
  const report=assessSources(v);
  assert.ok(report.issues.some(x=>x.includes('Rows have no hashed source')));
  assert.equal(report.allReviewed,false);
});
test('bounded undo/redo recovers edits and invalidates redo after new action',()=>{
  const a={value:1},h=createHistory(2);
  h.record(a,'first');const b={value:2};
  const back=h.undo(b);assert.equal(back.venue.value,1);
  const forward=h.redo(back.venue);assert.equal(forward.venue.value,2);
  h.undo(forward.venue);h.record({value:3},'new edit');assert.equal(h.canRedo,false);
});
test('independent check points expose calibration error unlike training anchors',()=>{
  const corners=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  const base=assessRegistration(corners,20,20);
  assert.equal(base.status,'unverified');assert.equal(base.rmsErrorM,null);
  const good=assessRegistration(corners,20,20,[{pixelX:50,pixelY:50,actualX:0,actualZ:0}]);
  assert.ok(good.rmsErrorM<1e-7);
  const bad=assessRegistration(corners,20,20,[{pixelX:50,pixelY:50,actualX:5,actualZ:5}]);
  assert.equal(bad.status,'recalibrate');assert.ok(bad.rmsErrorM>6);
});
test('quality gate flags crossed contours and near-collisions without deleting source seats',()=>{
  const v=fictionalGym(),initial=generateTracedVenue(v);
  assert.equal(initial.seats.length,1500);assert.equal(initial.quality.blockingCount,0);
  assert.equal(initial.quality.publicationEligible,false);
  v.sections[0].back.reverse();
  const crossed=generateTracedVenue(v);
  assert.ok(crossed.quality.issues.some(x=>x.code==='CROSSED_SECTION'));
  assert.equal(crossed.seats.length,1500);
});
test('vector candidates and independent calibration checks survive project export',()=>{
  const v=fictionalGym();
  v.calibration.checkpoints=[{pixelX:50,pixelY:80,actualX:0,actualZ:0}];
  v.vectorCandidates=[{id:'HOME',kind:'rect',
    points:[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}]}];
  const decoded=normalizeVenue(JSON.parse(JSON.stringify(normalizeVenue(v))));
  assert.equal(decoded.vectorCandidates.length,1);
  assert.equal(decoded.calibration.checkpoints.length,1);
});

test('annual project comparison identifies modified rows and added bank geometry',()=>{
  const before=fictionalGym(),after=structuredClone(before);
  after.rows[0].seats=27;
  after.sections[0].baseHeight+=.15;
  const delta=compareVenueProjects(before,after);
  assert.equal(delta.seatDelta,2);
  assert.equal(delta.sectionChanges.length,1);
  assert.equal(delta.rowChanges.length,1);
  assert.equal(delta.hasChanges,true);
  assert.equal(compareVenueProjects(before,before).hasChanges,false);
});
