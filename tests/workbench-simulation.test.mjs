// Deterministic, fictional venue benchmark for regression and trust-boundary QA.
// A green test proves behavior for generated cases, not real-world chart fidelity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {newVenue,normalizeVenue,parseVenueRows} from '../src/workbench/contract.mjs';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {buildWorkbenchPreview} from '../src/workbench/adapter.mjs';
import {parseVectorFile} from '../src/workbench/imports/vector.mjs';
import {importRowFile} from '../src/workbench/imports/tabular.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';

const rng=(seed)=>{
  let n=seed>>>0;
  return ()=>{
    n^=n<<13;n^=n>>>17;n^=n<<5;
    return (n>>>0)/4294967296;
  };
};
const between=(random,a,b)=>a+Math.floor(random()*(b-a+1));
function syntheticVenue(seed){
  const random=rng(seed),venue=newVenue(seed%5===0?'ncaa':'nfhs-basketball');
  venue.school='Synthetic district '+seed;
  venue.venue='Synthetic venue '+seed;
  const sectionCount=between(random,2,8);
  for(let i=0;i<sectionCount;i++){
    const id='SECTION-'+(i+1),side=i%2===0?-1:1, group=Math.floor(i/2);
    const z0=-45+group*18,z1=z0+15.4;
    const inner=side*(10.5+random()*.5),outer=side*(22.5+random()*.5);
    venue.sections.push({
      id,
      front:[{x:inner,z:z0},{x:inner,z:z1}],
      back:[{x:outer,z:z0},{x:outer,z:z1}],
      trace:[],baseHeight:.45,rowRise:.24+random()*.12,
      provenance:'fictional-property-test'
    });
    const count=between(random,8,18);
    for(let j=0;j<count;j++){
      const seats=between(random,12,25),hasAisle=j%5===2;
      const row={section:id,row:String(j+1),seats,first:between(random,1,8),
        tier:'T1',seatType:j%3===1?'chair':'bleacher',
        seatDirection:side<0?'forward':'reverse'};
      if(hasAisle)row.gaps=[{after:Math.floor(seats/2),width:.95}];
      if(j%7===3){
        row.seatNumbers=Array.from({length:seats},(_,k)=>'R'+(j+1)+'-'+(k+1));
      }
      venue.rows.push(row);
    }
  }
  return venue;
}
test('property benchmark: 75 unrelated synthetic seating layouts preserve source counts',()=>{
  let total=0,sections=0,aisles=0;
  const begun=performance.now();
  for(let seed=1;seed<=75;seed++){
    const source=syntheticVenue(seed*101+37);
    const result=generateTracedVenue(source);
    const expected=source.rows.reduce((sum,row)=>sum+row.seats,0);
    assert.equal(result.seats.length,expected,'seed '+seed+' exact counts');
    assert.equal(result.audit.declaredSeats,expected,'seed '+seed+' declared seats');
    assert.equal(new Set(result.seats.map(s=>s.id)).size,expected,'seed '+seed+' seat uniqueness');
    assert.equal(result.quality.blockingCount,0,'seed '+seed+' no geometric blockers');
    assert.ok(result.seats.every(s=>[s.x,s.y,s.z].every(Number.isFinite)),
      'seed '+seed+' finite xyz');
    assert.equal(result.rowRuns.length,source.rows.length);
    if(seed<8)assert.deepEqual(result.seats,generateTracedVenue(source).seats,
      'seed '+seed+' deterministic placement');
    total+=expected;sections+=source.sections.length;
    aisles+=source.rows.reduce((n,r)=>n+(r.gaps?.length??0),0);
  }
  assert.ok(total>35000);
  assert.ok(sections>=250);
  assert.ok(aisles>=100);
  test.diagnostic('Synthetic property cases: 75; positions: '+total+
    '; distinct section footprints: '+sections+'; source aisle declarations: '+aisles+
    '; elapsed ms: '+Math.round(performance.now()-begun));
});
test('large input guard: supports 40,000 source records as metadata, rejects 40,001',()=>{
  const v=syntheticVenue(100);
  v.rows=[...Array.from({length:160},(_,j)=>({
    section:v.sections[j%v.sections.length].id,
    row:'R'+j,seats:250,first:1,tier:'T1',seatType:'chair'
  }))];
  const normalized=normalizeVenue(v);
  assert.equal(normalized.rows.reduce((s,r)=>s+r.seats,0),40000);
  v.rows[0].seats=251;
  assert.throws(()=>normalizeVenue(v),/40,000-seat/);
});
test('source row boundaries reject impossible gap geometry rather than hiding aisles',()=>{
  const v=fictionalGym();
  v.rows[0].gaps=[{after:12,width:4.5},{after:18,width:4.5}];
  assert.throws(()=>generateTracedVenue(v),/cannot fit source seats/);
  assert.equal(v.rows[0].seats,25);
});
test('synthetic missing and contradictory inputs fail closed',()=>{
  const fixture=fictionalGym();
  const noBanks=structuredClone(fixture);
  noBanks.sections=[];
  assert.throws(()=>generateTracedVenue(noBanks),/no traced section/);
  const duplicate=structuredClone(fixture);
  duplicate.rows.push({...duplicate.rows[0]});
  assert.throws(()=>normalizeVenue(duplicate),/Duplicate section\/row/);
  const invalid=structuredClone(fixture);
  invalid.sections[0].front[0].x=Infinity;
  assert.throws(()=>normalizeVenue(invalid),/must be between/);
  const tiny=structuredClone(fixture);
  tiny.sections[0].front[1].z=tiny.sections[0].front[0].z;
  assert.throws(()=>generateTracedVenue(tiny),/collapsed edge/);
});
test('adversarial row labels and seat counts never coerce to invented valid seats',()=>{
  for(const count of ['-1','NaN','Infinity','3.7','999999','', '2e99']){
    assert.throws(()=>parseVenueRows('section,row,seats\nHOME,A,'+count+'\n'));
  }
  for(const input of ['A,1,4,1,T9,chair','A,1,4,1,T1,standing']){
    assert.throws(()=>parseVenueRows(
      'section,row,seats,seat_start,tier,seat_type\n'+input+'\n'));
  }
});
test('PDF source baselines are correctly classified unsupported, not silently read as CSV',async()=>{
  // This synthetic header represents a PDF file; it does not establish PDF support.
  const sample=new File(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'],
    'synthetic_seating_chart.pdf',{type:'application/pdf'});
  await assert.rejects(importRowFile(sample),/Supported row formats/);
});
test('DXF contours are drawing candidates, not pre-certified ticket inventory',()=>{
  const dxf=[
    '0','SECTION','2','ENTITIES','0','LWPOLYLINE','8','BLOCK-A',
    '10','0','20','0','10','15','20','0','10','15','20','20',
    '10','0','20','20','0','ENDSEC','0','EOF'
  ].join('\n')+'\n';
  const parsed=parseVectorFile(dxf,'synthetic.dxf');
  assert.equal(parsed.contours.length,1);
  assert.equal(parsed.contours[0].id,'BLOCK-A');
  assert.match(parsed.limitations.join(' '),/independent calibration/);
  const malformed=dxf.replace('10\n15\n20\n20','10\nNaN\n20\n20');
  assert.throws(()=>parseVectorFile(malformed,'synthetic.dxf'),/Invalid vector coordinate/);
});
test('end-to-end fictional gym model never becomes a surveyed or live inventory',()=>{
  const preview=buildWorkbenchPreview(fictionalGym());
  assert.equal(preview.seats.length,1500);
  assert.equal(preview.plan.seats.length,1500);
  assert.equal(preview.quality.blockingCount,0);
  assert.equal(preview.quality.publicationEligible,false);
  assert.equal(preview.project.ticketing.inventoryMode,'none');
  assert.equal(preview.project.ticketing.coordinates,'estimated');
  assert.ok(preview.warnings.some(x=>/require school review/.test(x)));
});
