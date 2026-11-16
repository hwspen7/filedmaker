import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPublicVenueCase} from '../src/workbench/publicCaseAudit.mjs';
import {REAL_SCHOOL_CASES,BAY_PORT_PAC_SAMPLE_ROWS} from './fixtures/actual-school-cases.mjs';
import {parseVenueRows} from '../src/workbench/contract.mjs';
import {buildWorkbenchPreview} from '../src/workbench/adapter.mjs';
import {makeAikenUnverifiedOperatorDraft} from '../src/workbench/qa/aiken-operator-draft.mjs';
test('six independently sourced US school facility cases reconcile without manufacturing rows',()=>{
  assert.equal(REAL_SCHOOL_CASES.length,6);
  for(const venue of REAL_SCHOOL_CASES){
    const result=auditPublicVenueCase(venue);
    assert.equal(result.canPublishExactModel,false,venue.id);
    assert.equal(result.canBuildDraft,false,venue.id);
    assert.ok(result.missingEvidence.includes('verified row-by-row seating inventory'));
    assert.ok(result.missingEvidence.includes('independently calibrated section geometry'));
  }
});
test('Aiken high school has four distinct documented banks totaling 1,418',()=>{
  const c=auditPublicVenueCase(REAL_SCHOOL_CASES[0]);
  assert.equal(c.bankNetSeats,1418);
  assert.equal(c.documentedSeats,1418);
  assert.equal(c.bankCount,4);
  assert.equal(c.exactBankReconciliation,true);
});
test('Sanderson high school reconciles 929 NET seats without adding 1,184 GROSS',()=>{
  const entry=REAL_SCHOOL_CASES[1],c=auditPublicVenueCase(entry);
  assert.equal(c.bankNetSeats,929);
  assert.equal(entry.banks.reduce((n,b)=>n+b.grossSeats,0),1184);
  assert.equal(c.accessiblePositions,12);
  assert.equal(c.exactBankReconciliation,true);
  assert.ok(c.warnings.some(x=>/distinct from ordinary/.test(x)));
});
test('Hatton school three banks independently reconcile to 1,318',()=>{
  const c=auditPublicVenueCase(REAL_SCHOOL_CASES[2]);
  assert.equal(c.bankNetSeats,1318);
  assert.equal(c.bankCount,3);
  assert.equal(c.exactBankReconciliation,true);
});
test('Howard County 180 bleacher places and one wheelchair place remain separate',()=>{
  const c=auditPublicVenueCase(REAL_SCHOOL_CASES[3]);
  assert.equal(c.bankNetSeats,180);
  assert.equal(c.accessiblePositions,1);
  assert.equal(c.documentedSeats,180);
  assert.equal(c.exactBankReconciliation,true);
});
test('Northview approximate 534 and Wills Point unknown capacity never pass exact check',()=>{
  for(const c of REAL_SCHOOL_CASES.slice(4).map(auditPublicVenueCase)){
    assert.equal(c.exactBankReconciliation,false);
    assert.ok(c.unknownBanks.length);
    assert.equal(c.canBuildDraft,false);
  }
});
test('an unverified bank sum cannot masquerade as an exact count',()=>{
  const c=structuredClone(REAL_SCHOOL_CASES[0]);
  c.banks[0].netSeats=285;
  assert.throws(()=>auditPublicVenueCase(c),/does not reconcile/);
  c.banks[0].netSeats=284;
  c.banks[1].grossSeats=100;
  assert.throws(()=>auditPublicVenueCase(c),/Gross capacity/);
  c.banks[1].grossSeats=null;
  c.banks[1].id='BANK A';
  assert.throws(()=>auditPublicVenueCase(c),/Duplicate/);
});
test('Bay Port real school arts venue: faithfully retain odd, even and reverse labels',()=>{
  // Separate venue category; tests the shared row parser only, not a fictitious basketball model.
  const keys=['section','row','seats','seat_start','seat_type','seat_numbers'];
  const raw=[keys.join(','),...BAY_PORT_PAC_SAMPLE_ROWS.map(row=>
    keys.map(k=>row[k]??'').join(','))].join('\n');
  const parsed=parseVenueRows(raw);
  assert.equal(parsed.length,6);
  assert.equal(parsed.reduce((n,r)=>n+r.seats,0),62);
  assert.equal(parsed.find(r=>r.section==='HOUSE LEFT'&&r.row==='A').seatNumbers[3],'A7');
  assert.equal(parsed.find(r=>r.section==='HOUSE RIGHT'&&r.row==='B').seatNumbers.at(-1),'B18');
  assert.equal(parsed.find(r=>r.section==='CENTER'&&r.row==='A').seatNumbers[0],'A114');
});

test('source-grounded Aiken human-draft generates 1,418 provisional, explicitly non-official seats',()=>{
  const draft=makeAikenUnverifiedOperatorDraft();
  const planned=new Map(REAL_SCHOOL_CASES[0].banks.map(b=>[b.id,b.netSeats]));
  for(const [id,count] of planned){
    assert.equal(draft.rows.filter(r=>r.section===id).reduce((n,r)=>n+r.seats,0),count);
  }
  assert.ok(draft.rows.every(row=>row.row.startsWith('ASSUMED-')));
  assert.ok(draft.sections.every(section=>section.provenance.includes('human-assumed')));
  assert.match(draft.notes.join(' '),/not the real official row counts/i);
  const actual=buildWorkbenchPreview(draft);
  assert.equal(actual.seats.length,1418);
  assert.equal(actual.model.seats.length,1418);
  assert.equal(actual.quality.blockingCount,0);
  assert.equal(actual.quality.publicationEligible,false);
  assert.equal(actual.quality.sourceReview.allReviewed,false);
});
