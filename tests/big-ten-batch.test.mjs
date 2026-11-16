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
