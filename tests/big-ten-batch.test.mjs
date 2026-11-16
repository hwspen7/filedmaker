import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GeometryEngine} from '../src/next/engines/geometry.mjs';
import {generateVenuePackage} from '../src/next/engines/factory.mjs';
import {validateBigTenCatalog,toProceduralSpec,generateBigTenBatch} from '../scripts/generate-big-ten.mjs';

const catalog=JSON.parse(readFileSync(new URL('../data/big-ten/arenas-2026-27.json',import.meta.url)));
const schema=JSON.parse(readFileSync(new URL('../data/big-ten/venue-catalog.schema.json',import.meta.url)));
const get=id=>catalog.venues.find(v=>v.id===id);

test('Big Ten 2026–27 catalog preserves all eighteen official schools and a complete schema',()=>{
  const summary=validateBigTenCatalog(catalog);
  assert.equal(summary.schools,18);
  assert.equal(summary.arenas,18);
  assert.equal(summary.publishedCapacityTotal,249119);
  assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.venues.minItems,18);
  assert.equal(schema.properties.venues.maxItems,18);
  const ids=catalog.venues.map(x=>x.id);
  assert.deepEqual(ids,[
    'illinois','indiana','iowa','maryland','michigan','michigan-state',
    'minnesota','nebraska','northwestern','ohio-state','oregon','penn-state',
    'purdue','rutgers','ucla','usc','washington','wisconsin'
  ]);
  for(const venue of catalog.venues){
    assert.equal(venue.sources.find(s=>s.id===venue.capacity.sourceId)?.kind,
      'university-athletics',venue.id);
    assert.ok(venue.sources.every(s=>s.url.startsWith('https://')));
    assert.equal(venue.evidence.seatRoster,'not-available');
    assert.equal(venue.model.evidenceLevel,'estimated-parametric');
    assert.ok(venue.model.tiers.every(t=>t.rows>=1&&t.rise>=.12));
    const result=GeometryEngine.normalize(toProceduralSpec(venue));
    assert.equal(result.targetCapacity,venue.capacity.published);
    assert.equal(result.template,'indoor-arena');
  }
});

test('published arena capacity variants remain separate from synthetic inventory',()=>{
  assert.equal(get('ohio-state').capacity.published,19049);
  assert.deepEqual(get('ohio-state').capacity.alternates.map(x=>x.published),[18809]);
  assert.equal(get('iowa').capacity.published,14998);
  assert.equal(get('washington').capacity.published,9294);
  assert.equal(get('wisconsin').capacity.published,16838);
  assert.equal(get('purdue').capacity.published,14876);
  assert.equal(get('michigan').capacity.published,12707);
  assert.equal(get('rutgers').capacity.published,8000);
  for(const v of catalog.venues)assert.ok(!('seatIds' in v),v.id);
});

test('catalog rejects missing sources, duplicate schools and unverified model claims',()=>{
  const bad=structuredClone(catalog);
  bad.venues[1].id=bad.venues[0].id;
  assert.throws(()=>validateBigTenCatalog(bad),/Duplicate/);
  bad.venues[1].id='indiana';
  bad.venues[1].capacity.sourceId='nonexistent';
  assert.throws(()=>validateBigTenCatalog(bad),/source/);
  bad.venues[1].capacity.sourceId='school-capacity';
  bad.venues[1].model.evidenceLevel='surveyed';
  assert.throws(()=>validateBigTenCatalog(bad),/synthetic model/);
  bad.venues[1].model.evidenceLevel='estimated-parametric';
  bad.venues[1].sources[0].url='http://untrusted.example/test';
  assert.throws(()=>validateBigTenCatalog(bad),/source URLs/);
});

test('shared six-engine pipeline produces distinct scalable arenas without OSU hardcoding',()=>{
  for(const id of ['michigan','northwestern','nebraska']){
    const venue=get(id),input=toProceduralSpec(venue);
    const {project,model,plan,audit,reference}=generateVenuePackage(input);
    assert.ok(audit.passed,id+' '+audit.errors?.join('; '));
    assert.equal(model.seatOrigin,'generated',id);
    assert.equal(project.proceduralVenue.provenance.seatCoordinates,'not-available',id);
    assert.ok((plan.architectureGeometry.facade.length+
      plan.architectureGeometry.brickBase.length)>1000,id);
    assert.ok(plan.architectureGeometry.decks.length>1000,id);
    assert.ok(model.seats.length>6000,id);
    assert.equal(project.title,venue.venue.name);
    assert.equal(reference.level,'estimated');
    assert.ok(reference.sources.some(s=>s.url===venue.sources[0].url),id);
    assert.ok(Math.abs(model.seats.length-venue.capacity.published)/venue.capacity.published<=.035,
      id+' should remain within the bounded modeling deviation');
  }
});

test('batch generator exports a source-backed venue package and manifest',()=>{
  const out=mkdtempSync(join(tmpdir(),'filedmaker-bigten-'));
  try{
    const manifest=generateBigTenBatch(catalog,{out,only:'michigan',strict:true,maxError:.035});
    assert.equal(manifest.schoolCount,1);
    assert.ok(manifest.withinTolerance);
    assert.equal(manifest.venues[0].schoolId,'michigan');
    for(const name of ['manifest.json','michigan/venue-spec.json',
      'michigan/project.filedmaker.json','michigan/geometry-report.json'])
      assert.ok(existsSync(join(out,name)),name);
    const report=JSON.parse(readFileSync(join(out,'michigan/geometry-report.json')));
    assert.equal(report.publishedCapacity.value,12707);
    assert.equal(report.evidence.seatRoster,'not-available');
    assert.equal(report.modelStatus,'estimated-parametric');
  }finally{rmSync(out,{recursive:true,force:true});}
});


test('Crisler Center uses documented 100/200 identifiers and row-label ranges',()=>{
  const spec=toProceduralSpec(get('michigan'));
  assert.equal(spec.sectionMap[0].reduce((sum,g)=>sum+g.sectionIds.length,0),19);
  assert.equal(spec.sectionMap[0].length,2,'Actual chart contains a lower-band void');
  assert.equal(spec.sectionMap[1][0].sectionIds.length,36);
  const {model,audit}=generateVenuePackage(spec);
  assert.ok(audit.passed,audit.errors.join('; '));
  const ids=new Set(model.seats.map(seat=>seat.sectionId));
  for(const id of ['101','105','130','136','201','205','221','236'])
    assert.ok(ids.has(id),'Missing authentic Crisler section '+id);
  assert.ok(model.seats.some(seat=>seat.sectionId==='205'&&seat.row==='22'));
  assert.ok(model.seats.some(seat=>seat.sectionId==='205'&&seat.row==='41'));
  assert.ok(!ids.has('1')&&!ids.has('2'));
  assert.ok(model.seats.every(seat=>seat.uid.startsWith('EST-')));
});

test('Indiana Assembly Hall has separated opposing stands, not a continuous uniform oval',()=>{
  const spec=toProceduralSpec(get('indiana'));
  assert.equal(spec.sectionMap.length,2);
  assert.equal(spec.sectionMap[0].length,2);
  assert.equal(spec.sectionMap[1].length,2);
  const {model,audit}=generateVenuePackage(spec);
  assert.ok(audit.passed,audit.errors.join('; '));
  const ids=new Set(model.seats.map(s=>s.sectionId));
  for(const id of ['A','F','G','M','AA','FF','GG','MM'])assert.ok(ids.has(id),id);
  const inMissingArc=model.seats.filter(s=>s.tier===0&&(()=>{
    const a=(Math.atan2(s.z,s.x)+Math.PI*2)%(Math.PI*2);
    return a>4.28&&a<5.05;
  })());
  assert.equal(inMissingArc.length,0,'No seats should fill the structural side-stand gap');
});

test('unverified geometry cannot claim OSU-quality chart calibration by seat-count matching',()=>{
  for(const id of ['michigan','indiana','iowa','rutgers','ucla','usc','wisconsin','penn-state']){
    const spec=toProceduralSpec(get(id));
    const normalized=GeometryEngine.normalize(spec);
    assert.ok(normalized.sectionMap,id);
    assert.equal(spec.provenance.sectionOutlineProvenance,'estimated-arc',id);
    assert.equal(spec.provenance.seatCoordinates,'not-available',id);
  }
  for(const id of ['illinois','maryland','michigan-state','nebraska',
    'northwestern','oregon','purdue','washington']){
    const spec=toProceduralSpec(get(id));
    assert.ok(spec.sectionMap,id+' must use chart-derived sections');
    assert.equal(spec.provenance.sectionOutlineProvenance,'estimated-arc',id);
  }
});

test('overlapping chart arc groups fail normalization',()=>{
  const mapped=toProceduralSpec(get('indiana'));
  const invalid=structuredClone(mapped);
  invalid.sectionMap[0][1].startAngle=3;
  assert.throws(()=>GeometryEngine.normalize(invalid),/Overlapping mapped section arcs/);
});

test('Indiana 3D structural treads do not bridge the empty side-stand gap',()=>{
  const mapped=toProceduralSpec(get('indiana'));
  const {plan}=generateVenuePackage(mapped);
  const full=structuredClone(mapped);delete full.sectionMap;
  const generic=generateVenuePackage(full);
  assert.ok(plan.architectureGeometry.decks.length<
    generic.plan.architectureGeometry.decks.length*.82,
    'Mapped stands should contain less structural deck than a fully closed oval');
  const points=plan.architectureGeometry.decks;
  for(let i=0;i<points.length;i+=6){
    const a=(Math.atan2(points[i+2],points[i])+Math.PI*2)%(Math.PI*2);
    assert.ok(!(a>4.40&&a<4.95),
      'Unoccupied side-stand gap must not have a gray structural floor');
  }
});


test('all seventeen non-OSU arenas have source-linked real section labels',()=>{
  for(const venue of catalog.venues.filter(v=>v.id!=='ohio-state')){
    const spec=toProceduralSpec(venue);
    assert.ok(spec.sectionMap,venue.id+' must not use a generic numbered bowl');
    assert.ok(spec.provenance.sourceSectionMap?.startsWith('https://'),venue.id);
    assert.equal(spec.provenance.sectionOutlineProvenance,'estimated-arc');
    assert.equal(spec.provenance.seatCoordinates,'not-available');
    GeometryEngine.normalize(spec);
  }
});

test('Illinois, Nebraska, Purdue and Washington preserve distinct seating charts',()=>{
  const illinois=toProceduralSpec(get('illinois'));
  assert.equal(illinois.sectionMap.length,3);
  assert.equal(illinois.sectionMap[2][0].sectionIds.length,48);
  assert.equal(illinois.sectionMap[2][0].sectionIds.at(-1),'248');
  const nebraska=toProceduralSpec(get('nebraska'));
  assert.deepEqual(nebraska.sectionMap.map(t=>t[0].sectionIds[0]),['101','201','301']);
  const purdue=toProceduralSpec(get('purdue'));
  assert.deepEqual(purdue.sectionMap.map(t=>t[0].sectionIds[0]),['01','101']);
  const washington=toProceduralSpec(get('washington'));
  assert.equal(washington.sectionMap[0][0].sectionIds.length,14);
  assert.equal(washington.sectionMap[1][0].rowStart,14);
});

test('Breslin lower bowl leaves published row labels 10–12 empty',()=>{
  const spec=toProceduralSpec(get('michigan-state'));
  assert.deepEqual(spec.sectionMap[0][0].skipRows,[10,11,12]);
  const {model,audit}=generateVenuePackage(spec);
  assert.ok(audit.passed,audit.errors.join('; '));
  const lower=new Set(model.seats.filter(seat=>seat.tier===0).map(seat=>seat.row));
  for(const label of ['10','11','12'])assert.ok(!lower.has(label),label);
  for(const label of ['9','13','28'])assert.ok(lower.has(label),label);
});

test('mapped skipped rows are bounds-checked and cannot be repeated',()=>{
  const spec=toProceduralSpec(get('michigan-state'));
  spec.sectionMap[0][0].skipRows=[10,10];
  assert.throws(()=>GeometryEngine.normalize(spec),/skipped row/);
});


test('every non-OSU school carries an independently sourced architectural feature, not a generic entry rotunda',()=>{
  const venueIds=catalog.venues.filter(v=>v.id!=='ohio-state').map(v=>v.id);
  const signatures=new Map();
  for(const id of venueIds){
    const spec=toProceduralSpec(get(id));
    const signature=spec.exterior?.signature;
    assert.ok(signature,id+' has no venue architecture reference');
    assert.ok(signature.source.startsWith('https://'),id+' lacks an architecture source');
    assert.equal(spec.exterior.entrances.length,0,id+' still uses generic rotunda placeholders');
    assert.equal(spec.provenance.buildingStatus,'landmarks-modeled/unsurveyed',id);
    signatures.set(id,signature.roof+':'+signature.feature);
  }
  assert.equal(signatures.size,17);
  assert.notEqual(signatures.get('illinois'),signatures.get('purdue'));
  assert.notEqual(signatures.get('indiana'),signatures.get('iowa'));
  assert.notEqual(signatures.get('rutgers'),signatures.get('washington'));
});

test('distinctive Illinois, Purdue, Indiana, Iowa and Washington roofs produce real validated 3D meshes',()=>{
  const expected=new Map([
    ['illinois','roofWhite'],['purdue','roofCopper'],
    ['indiana','roofPale'],['iowa','roofSlate'],['washington','roofSlate']
  ]);
  for(const [id,roofLayer] of expected){
    const {plan,audit}=generateVenuePackage(toProceduralSpec(get(id)));
    assert.ok(audit.passed,id+': '+audit.errors.join('; '));
    assert.ok(plan.architectureGeometry[roofLayer]?.length>20000,
      id+' is missing its roof geometry');
    assert.ok(plan.architectureGeometry.entryGlass?.length>150,
      id+' is missing its independent entrance glazing');
    assert.ok(plan.architectureGeometry.entryMasonry?.length>100,
      id+' is missing its facade massing');
  }
});
