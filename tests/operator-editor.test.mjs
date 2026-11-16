import test from 'node:test';
import assert from 'node:assert/strict';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {normalizeVenue} from '../src/workbench/contract.mjs';
import {applyVenueEdit} from '../src/workbench/editing.mjs';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {rowStations} from '../src/workbench/rowLayout.mjs';

const edit=(v,type,more={})=>applyVenueEdit(v,{type,...more});
const baseline=()=>fictionalGym();
test('immutable, documented section movement does not silently move another section',()=>{
  const v=baseline(),before=structuredClone(v);
  const p=edit(v,'translate-section',{section:'WEST-1',dx:.4,dz:.2});
  assert.deepEqual(v,before);
  assert.equal(p.venue.sections[0].front[0].x,before.sections[0].front[0].x+.4);
  assert.equal(p.venue.sections[1].front[0].x,before.sections[1].front[0].x);
  assert.equal(p.venue.sections[0].provenance,'operator-adjusted/estimated');
  assert.equal(p.venue.sections[0].trace.length,0);
  assert.equal(p.seatDelta,0);
  assert.equal(p.publicationEligible,false);
  assert.equal(p.audit.seats,1500);
});
test('width resize modifies row pitch, not the number of documented seats',()=>{
  const v=baseline(),p=edit(v,'resize-section',{section:'WEST-1',factor:.9});
  assert.equal(p.venue.rows.reduce((n,r)=>n+r.seats,0),1500);
  assert.ok(p.audit);
  const original=generateTracedVenue(v),after=generateTracedVenue(p.venue);
  const before=original.rowRuns.find(r=>r.section==='WEST-1'&&r.row==='1');
  const changed=after.rowRuns.find(r=>r.section==='WEST-1'&&r.row==='1');
  assert.ok(changed.seatPitch<before.seatPitch);
  assert.equal(changed.count,before.count);
});
test('section elevation operation changes generated coordinates, retaining source counts',()=>{
  const v=baseline(),result=edit(v,'set-section-elevation',{
    section:'WEST-1',baseHeight:1.15,rowRise:.35
  });
  assert.equal(result.venue.sections[0].baseHeight,1.15);
  assert.equal(result.venue.sections[0].rowRise,.35);
  const row=generateTracedVenue(result.venue).seats.filter(s=>
    s.section==='WEST-1'&&s.row==='1');
  assert.equal(row.length,25);
  assert.ok(row.every(s=>Math.abs(s.y-1.15)<1e-9));
});
test('manual row count change keeps a source-seat baseline and is reviewable',()=>{
  const v=baseline(),result=edit(v,'update-row',{section:'WEST-1',row:'1',
    changes:{seats:24,first:5,insetStartM:.5,insetEndM:.5}});
  assert.equal(result.seatDelta,-1);
  assert.equal(result.venue.rows[0].sourceSeats,25);
  assert.equal(result.venue.rows[0].operatorEdited,true);
  assert.equal(result.venue.editLedger[0].beforeSeats,25);
  assert.equal(result.venue.editLedger[0].afterSeats,24);
  const seats=generateTracedVenue(result.venue);
  const first=seats.seats.find(s=>s.section==='WEST-1'&&s.row==='1');
  assert.equal(first.number,'5');
  assert.equal(first.provenance,'operator-edited/needs-source-review');
  assert.ok(seats.quality.issues.some(x=>x.code==='STAFF_EDITS_PENDING_SOURCE_RECONCILIATION'));
  assert.equal(seats.quality.publicationEligible,false);
});
test('aisle gaps and insets reserve genuine void space, never synthetic seats',()=>{
  const v=baseline();
  const result=edit(v,'update-row',{section:'WEST-1',row:'1',
    changes:{gaps:[{after:12,width:1.2}],insetStartM:.5,insetEndM:.6}});
  const row=result.venue.rows[0];
  const station=rowStations(row,13);
  assert.equal(station.positions.length,25);
  assert.ok(station.positions[0].distance>=.5);
  assert.ok(station.positions.at(-1).distance<12.4);
  assert.ok(station.positions[12].distance-station.positions[11].distance>1.2);
  assert.equal(generateTracedVenue(result.venue).seats.length,1500);
});
test('explicit nonsequential seat IDs survive an operator label and direction edit',()=>{
  const v=baseline(),labels=Array.from({length:25},(_,i)=>String(100+i*2));
  const edited=edit(v,'update-row',{section:'WEST-1',row:'1',
    changes:{seatNumbers:labels,seatDirection:'reverse'}});
  const seatIds=generateTracedVenue(edited.venue).seats.filter(s=>
    s.section==='WEST-1'&&s.row==='1').map(s=>s.number);
  assert.deepEqual(seatIds,[...labels].reverse());
  assert.equal(new Set(seatIds).size,25);
});
test('changing count with explicit seat IDs is rejected without a replacement list',()=>{
  const v=baseline();
  v.rows[0].seatNumbers=Array.from({length:25},(_,i)=>'S'+i);
  assert.throws(()=>edit(v,'update-row',{section:'WEST-1',row:'1',
    changes:{seats:24}}),/must be revised/);
  assert.equal(v.rows[0].seats,25);
});
test('staff-added row has no invented official provenance, and counts change explicitly',()=>{
  const v=baseline();
  const result=edit(v,'add-row',{section:'WEST-1',afterRow:'2',
    newRow:{row:'NEW-1',seats:6,first:101,seatType:'bleacher'}});
  assert.equal(result.seatDelta,6);
  const added=result.venue.rows.find(r=>r.row==='NEW-1');
  assert.equal(added.sourceSeats,null);
  assert.equal(added.operatorAdded,true);
  assert.equal(added.operatorEdited,true);
  assert.ok(generateTracedVenue(result.venue).quality.issues.some(x=>
    x.code==='STAFF_EDITS_PENDING_SOURCE_RECONCILIATION'));
});
test('remove row never falsely claims original source counts were reconciled',()=>{
  const v=baseline(),out=edit(v,'remove-row',{section:'WEST-1',row:'1'});
  assert.equal(out.seatDelta,-25);
  assert.equal(out.venue.rows.length,59);
  assert.equal(out.venue.editLedger[0].operation,'remove-row');
  assert.ok(generateTracedVenue(out.venue).quality.issues.some(x=>x.code==='DELETED_SOURCE_ROWS'));
  assert.equal(v.rows.length,60);
});
test('reorder rows changes layout only, preserves all original count records',()=>{
  const v=baseline(),out=edit(v,'move-row',{section:'WEST-1',row:'2',direction:'up'});
  const ours=out.venue.rows.filter(x=>x.section==='WEST-1');
  assert.deepEqual(ours.slice(0,3).map(r=>r.row),['2','1','3']);
  assert.equal(out.seatDelta,0);
});
test('invalid edits reject atomically and guard source row/count/geometry',()=>{
  const v=baseline(),snapshot=structuredClone(v);
  const failures=[
    {type:'translate-section',section:'WEST-1',dx:Infinity,dz:0},
    {type:'resize-section',section:'WEST-1',factor:0},
    {type:'resize-section',section:'WEST-1',factor:1},
    {type:'update-row',section:'WEST-1',row:'1',changes:{seats:2.3}},
    {type:'update-row',section:'WEST-1',row:'1',changes:{seats:301}},
    {type:'update-row',section:'WEST-1',row:'1',changes:{gaps:[{after:12,width:500}]}},
    {type:'update-row',section:'WEST-1',row:'1',changes:{insetStartM:30,insetEndM:30}},
    {type:'add-row',section:'WEST-1',newRow:{row:'1',seats:5}},
    {type:'remove-row',section:'WEST-1',row:'absent'},
    {type:'move-row',section:'WEST-1',row:'1',direction:'up'}
  ];
  for(const op of failures)assert.throws(()=>applyVenueEdit(v,op),undefined,JSON.stringify(op));
  assert.deepEqual(v,snapshot);
});
test('edited document roundtrips with staff audit and remains unverified',()=>{
  let doc=baseline();
  doc=edit(doc,'update-row',{section:'EAST-2',row:'2',
    changes:{seats:23,depthOffsetM:.07,elevation:1.13}}).venue;
  const round=normalizeVenue(JSON.parse(JSON.stringify(doc)));
  assert.equal(round.rows.find(r=>r.section==='EAST-2'&&r.row==='2').sourceSeats,25);
  assert.equal(round.editLedger.length,1);
  assert.equal(generateTracedVenue(round).seats.length,1498);
});
test('adjacent sections with inconsistent row rise produce an actionable warning',()=>{
  const v=baseline();
  const out=edit(v,'set-section-elevation',{section:'WEST-2',baseHeight:.48,rowRise:.52});
  assert.ok(generateTracedVenue(out.venue).quality.issues.some(x=>
    x.code==='ADJACENT_SECTION_ELEVATION'));
});


test('a single-seat correction changes only that seat, without altering row capacity',()=>{
  const original=baseline(),before=generateTracedVenue(original);
  const result=edit(original,'set-seat-offset',{section:'WEST-1',row:'1',
    number:'1',dx:.08,dy:.12,dz:-.05});
  const after=generateTracedVenue(result.venue);
  assert.equal(result.seatDelta,0);
  assert.equal(after.seats.length,1500);
  const first=before.seats.find(s=>s.id==='WEST-1-1-1');
  const changed=after.seats.find(s=>s.id===first.id);
  assert.ok(Math.abs(changed.x-first.x-.08)<1e-8);
  assert.ok(Math.abs(changed.y-first.y-.12)<1e-8);
  assert.ok(Math.abs(changed.z-first.z+.05)<1e-8);
  const coordinates=s=>({id:s.id,number:s.number,x:s.x,y:s.y,z:s.z});
  assert.deepEqual(coordinates(after.seats.find(s=>s.id==='WEST-1-1-2')),
    coordinates(before.seats.find(s=>s.id==='WEST-1-1-2')));
  assert.ok(after.quality.issues.some(x=>x.code==='INDIVIDUAL_SEAT_OFFSETS'));
  assert.equal(after.quality.publicationEligible,false);
  assert.equal(original.rows[0].seatOverrides,undefined);
});
test('per-seat offset is reversible and survives an editable JSON round-trip',()=>{
  const v=baseline();
  const modified=edit(v,'set-seat-offset',{section:'WEST-1',row:'1',
    number:'1',dx:.1,dy:0,dz:0}).venue;
  const restored=normalizeVenue(JSON.parse(JSON.stringify(modified)));
  assert.deepEqual(restored.rows[0].seatOverrides,[{number:'1',dx:.1,dy:0,dz:0}]);
  const cleared=edit(restored,'clear-seat-offset',{section:'WEST-1',row:'1',
    number:'1'}).venue;
  assert.equal(cleared.rows[0].seatOverrides.length,0);
  const after=generateTracedVenue(cleared);
  const before=generateTracedVenue(v);
  const coordinates=seats=>seats.map(s=>({id:s.id,x:s.x,y:s.y,z:s.z}));
  assert.deepEqual(coordinates(after.seats),coordinates(before.seats));
  assert.equal(cleared.editLedger.length,2);
});
test('unknown, duplicate and excessive individual offsets fail closed',()=>{
  const v=baseline();
  assert.throws(()=>edit(v,'set-seat-offset',{section:'WEST-1',row:'1',
    number:'999',dx:.2,dy:0,dz:0}),/Invalid or duplicated seat override/);
  assert.throws(()=>edit(v,'set-seat-offset',{section:'WEST-1',row:'1',
    number:'1',dx:3,dy:0,dz:0}),/between/);
  assert.throws(()=>edit(v,'set-seat-offset',{section:'WEST-1',row:'1',
    number:'1',dx:0,dy:0,dz:0}),/nonzero/);
  assert.throws(()=>edit(v,'clear-seat-offset',{section:'WEST-1',row:'1',
    number:'1'}),/no staff offset/);
  v.rows[0].seatOverrides=[{number:'1',dx:.1,dy:0,dz:0},
    {number:'1',dx:.2,dy:0,dz:0}];
  assert.throws(()=>normalizeVenue(v),/duplicated seat override/);
});
test('Aiken QA draft permits staff coordinate correction but stays non-official',async()=>{
  const {makeAikenUnverifiedOperatorDraft}=await import('../src/workbench/qa/aiken-operator-draft.mjs');
  const draft=makeAikenUnverifiedOperatorDraft();
  const first=draft.rows[0];
  const revised=edit(draft,'set-seat-offset',{section:first.section,row:first.row,
    number:'1',dx:.08,dy:0,dz:0});
  const preview=generateTracedVenue(revised.venue);
  assert.equal(preview.seats.length,1418);
  assert.equal(preview.audit.publishedCapacity,1418);
  assert.equal(preview.quality.publicationEligible,false);
  assert.match(revised.venue.notes.join(' '),/not the real official row counts/i);
});
