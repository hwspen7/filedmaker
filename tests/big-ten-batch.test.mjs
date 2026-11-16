import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GeometryEngine} from '../src/next/engines/geometry.mjs';
import {generateVenuePackage} from '../src/next/engines/factory.mjs';
import {validateBigTenCatalog,toProceduralSpec,generateBigTenBatch} from '../scripts/generate-big-ten.mjs';
import {toBigTenProceduralSpec} from '../src/next/bigTenCatalog.mjs';

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
    return a>2.70&&a<3.48;
  })());
  assert.equal(inMissingArc.length,0,'No seats should fill the structural side-stand gap');
});

test('unverified geometry cannot claim OSU-quality chart calibration by seat-count matching',()=>{
  for(const id of ['michigan','indiana','iowa','rutgers','ucla','usc','wisconsin','penn-state']){
    const spec=toProceduralSpec(get(id));
    const normalized=GeometryEngine.normalize(spec);
    assert.ok(normalized.sectionMap,id);
    assert.equal(spec.provenance.sectionOutlineProvenance,
      ['indiana','iowa','ucla','wisconsin'].includes(id)?'official-adjacency-estimated-shape':'estimated-arc',id);
    assert.equal(spec.provenance.seatCoordinates,'not-available',id);
  }
  for(const id of ['illinois','maryland','michigan-state','nebraska',
    'northwestern','oregon','purdue','washington']){
    const spec=toProceduralSpec(get(id));
    assert.ok(spec.sectionMap,id+' must use chart-derived sections');
    assert.equal(spec.provenance.sectionOutlineProvenance,
      ['illinois','michigan-state','purdue','washington'].includes(id)?
        'official-adjacency-estimated-shape':'estimated-arc',id);
  }
});

test('overlapping chart arc groups fail normalization',()=>{
  const mapped=toProceduralSpec(get('indiana'));
  const invalid=structuredClone(mapped);
  invalid.sectionMap[0][1].startAngle=1.58;
  assert.throws(()=>GeometryEngine.normalize(invalid),/Overlapping mapped section arcs/);
});

test('Indiana 3D structural treads do not bridge the empty side-stand gap',()=>{
  const mapped=toProceduralSpec(get('indiana'));
  const {plan}=generateVenuePackage(mapped);
  const full=structuredClone(mapped);delete full.sectionMap;
  const generic=generateVenuePackage(full);
  assert.ok(generic.plan.architectureGeometry.decks.length>0,
    'The unmapped comparison retains a valid generic deck');
  assert.ok(plan.architectureGeometry.decks.length>0,
    'The chart-mapped grandstands retain individual concrete treads');
  // Row-bounded treads use finer triangles than the generic backing ring.
  // Never compare raw vertex counts as a proxy for occupied seating area.
  const points=plan.architectureGeometry.decks;
  for(let i=0;i<points.length;i+=6){
    const a=(Math.atan2(points[i+2],points[i])+Math.PI*2)%(Math.PI*2);
    assert.ok(!(a>2.82&&a<3.36),
      'Unoccupied side-stand gap must not have a gray structural floor');
  }
});


test('all seventeen non-OSU arenas have source-linked real section labels',()=>{
  for(const venue of catalog.venues.filter(v=>v.id!=='ohio-state')){
    const spec=toProceduralSpec(venue);
    assert.ok(spec.sectionMap,venue.id+' must not use a generic numbered bowl');
    assert.ok(spec.provenance.sourceSectionMap?.startsWith('https://'),venue.id);
    assert.equal(spec.provenance.sectionOutlineProvenance,
      FIRST_WAVE_INTERIORS.includes(venue.id)?'official-adjacency-estimated-shape':'estimated-arc');
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
  assert.deepEqual(purdue.sectionMap.map(t=>t[0].sectionIds[0]),['1','101']);
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


test('source measurements, not nominal capacity, determine three documented exterior bounding envelopes',()=>{
  const points=mesh=>{
    const out=[];
    for(let i=0;i<mesh.length;i+=6)out.push([mesh[i],mesh[i+1],mesh[i+2]]);
    return out;
  };
  const illinois=toProceduralSpec(get('illinois'));
  assert.equal(illinois.exterior.signature.radialButtresses,48);
  assert.equal(illinois.exterior.signature.outerDiameterMetres,121.92);
  const {plan:il,audit:ilAudit}=generateVenuePackage(illinois);
  assert.ok(ilAudit.passed,ilAudit.errors.join('; '));
  const ilPts=points(il.architectureGeometry.roofWhite);
  const radius=Math.max(...ilPts.map(p=>Math.hypot(p[0],p[2])));
  const apex=Math.max(...ilPts.map(p=>p[1]));
  assert.ok(Math.abs(radius-60.96)<.1,'Illinois 400 ft dome must drive roof mesh');
  assert.ok(Math.abs(apex-39.0144)<.2,'Illinois 128 ft apex must drive roof height');
  assert.ok(il.architectureGeometry.brickPiers.length>2000,
    'Illinois physical radial supports must be modeled');

  const washington=toProceduralSpec(get('washington'));
  assert.equal(washington.exterior.signature.historicalBuildingLengthMetres,145.0848);
  const {plan:wa,audit:waAudit}=generateVenuePackage(washington);
  assert.ok(waAudit.passed,waAudit.errors.join('; '));
  const waPts=points(wa.architectureGeometry.roofSlate);
  const halfWidth=Math.max(...waPts.map(p=>Math.abs(p[0])));
  const halfLength=Math.max(...waPts.map(p=>Math.abs(p[2])));
  assert.ok(Math.abs(halfWidth-50.1396)<.1,'Washington documented building width');
  assert.ok(Math.abs(halfLength-72.5424)<.1,'Washington documented building length');

  const purdue=toProceduralSpec(get('purdue'));
  const {plan:pu,audit:puAudit}=generateVenuePackage(purdue);
  assert.ok(puAudit.passed,puAudit.errors.join('; '));
  const puPts=points(pu.architectureGeometry.roofCopper);
  const outerRadius=Math.max(...puPts.map(p=>Math.hypot(p[0],p[2])));
  const edge=puPts.filter(p=>Math.hypot(p[0],p[2])>outerRadius-.3)
    .map(p=>Math.hypot(p[0],p[2]));
  assert.ok(Math.max(...edge)-Math.min(...edge)<.3,'Mackey must have a circular dome');
});

test('Pauley Pavilion varying-width exterior concourse is encoded in 3D perimeter',()=>{
  const spec=toProceduralSpec(get('ucla'));
  assert.deepEqual(spec.exterior.signature.asymmetricConcourseMetres,
    {north:12.192,south:6.096,east:6.096,west:2.7432});
  const {plan,audit}=generateVenuePackage(spec);
  assert.ok(audit.passed,audit.errors.join('; '));
  const roof=plan.architectureGeometry.roofPale;
  const zNorth=[],zSouth=[];
  for(let i=0;i<roof.length;i+=6){
    const x=roof[i],z=roof[i+2];
    if(Math.abs(x)>5)continue;
    if(z>0)zNorth.push(z);
    if(z<0)zSouth.push(-z);
  }
  assert.ok(zNorth.length&&zSouth.length,'Missing Pauley roof sampling');
  assert.ok(Math.max(...zNorth)-Math.max(...zSouth)>5,
    'The north concourse must project farther than the south concourse');
});

test('the native Seat Studio sidebar exposes all 18 Big Ten basketball venues like OSU',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const program=readFileSync(new URL('../src/next/studio.js',import.meta.url),'utf8');
  const ids=[...page.matchAll(/data-bigten="([a-z-]+)"/g)].map(item=>item[1]);
  const expected=catalog.venues.map(v=>v.id).filter(id=>id!=='ohio-state');
  assert.deepEqual(ids,expected,'Every Big Ten opponent must be a visible studio sidebar button');
  assert.match(page,/data-preset="schott"/,'OSU keeps its specialist reference preset');
  assert.match(page,/data-view="exterior"/,'Studio must expose building exterior alongside seat view');
  assert.match(program,/setBigTenVenue\(b\.dataset\.bigten\)/,
    'New venue buttons must trigger in-place selection');
  assert.match(program,/createProceduralProject\(spec\)/,
    'Selected venues must use the same native WebGL studio project pipeline');
  assert.match(program,/loadBigTenCatalog\(/,
    'Studio must load per-venue real source maps rather than demo presets');
});

test('Big Ten native browser and offline batch share exactly the same geometry specification',()=>{
  const sectionProfiles=JSON.parse(readFileSync(
    new URL('../data/big-ten/reference-section-layouts.json',import.meta.url))).layouts;
  const architecture=JSON.parse(readFileSync(
    new URL('../data/big-ten/architectural-signatures.json',import.meta.url))).venues;
  const interior=JSON.parse(readFileSync(
    new URL('../data/big-ten/interior-reconstructions.json',import.meta.url))).venues;
  for(const venue of catalog.venues){
    const charts=JSON.parse(readFileSync(new URL('../data/big-ten/section-chart-verified-order.json',import.meta.url))).venues;
    const inStudio=toBigTenProceduralSpec(venue,sectionProfiles,architecture,interior,charts);
    const inBatch=toProceduralSpec(venue);
    assert.deepEqual(inStudio,inBatch,venue.id+' must not fall back to a different template');
  }
});


const FIRST_WAVE_INTERIORS=[
  'indiana','purdue','illinois','iowa','michigan-state',
  'wisconsin','ucla','washington'
];

test('each first-wave arena has independent chart-informed sections, 2D polygons and matching 3D treads',()=>{
  const shapes=new Set();
  for(const id of FIRST_WAVE_INTERIORS){
    const input=toProceduralSpec(get(id)),{model,plan,audit}=generateVenuePackage(input);
    assert.ok(input.interior,id+' must have its own interior reference');
    assert.match(input.interior.geometryStatus,/(not-surveyed|unsurveyed)/,
      'Source records must explicitly distinguish verified section labels from unsurveyed seat geometry');
    assert.ok(input.interior.source.startsWith('https://'),id);
    assert.ok(audit.passed,id+': '+audit.errors.join('; '));
    assert.ok(model.interiorSectionFootprints?.length>5,
      id+' must have actual clickable per-row section polygons');
    assert.ok(model.interiorSectionFootprints.every(s=>s.outlines.length>0),id);
    assert.ok(plan.architectureGeometry.decks.length>1000,
      id+' must have independently tessellated row-bounded treads');
    assert.ok(plan.architectureGeometry.fascias.length>200,
      id+' must have individual risers');
    assert.ok(Math.abs(model.seats.length-get(id).capacity.published)/
      get(id).capacity.published<=.035,id+' must stay within published capacity tolerance');
    const outline=model.interiorSectionFootprints;
    const low=outline.filter(s=>s.tier===0);
    const stats=[low.length,outline.length,
      Math.round(Math.max(...model.seats.map(s=>Math.abs(s.x)))),
      Math.round(Math.max(...model.seats.map(s=>Math.abs(s.z)))),
      model.proceduralSpec.interior.outline].join(':');
    shapes.add(stats);
  }
  assert.equal(shapes.size,8,
    'The eight arena seating footprints must not be the same transformed bowl');
});

test('Indiana, Purdue, Illinois and Iowa preserve characteristic independently modeled seating',()=>{
  const iu=toProceduralSpec(get('indiana'));
  assert.equal(iu.sectionMap[0].length,2,'IU must have separate facing lower stands');
  assert.equal(iu.sectionMap[1].length,2,'IU balconies must remain split');
  assert.equal(iu.interior.outline,'grandstands');
  const pu=toProceduralSpec(get('purdue'));
  assert.equal(pu.sectionMap[0][0].sectionIds.length,18);
  assert.equal(pu.sectionMap[1][0].sectionIds.length,18);
  const circular=GeometryEngine.create(pu);
  const x=circular.point(0,0,.5),z=circular.point(0,Math.PI/2,.5);
  assert.ok(Math.abs(Math.abs(x.x)-Math.abs(z.z))<1e-8,
    'Mackey lower-bowl envelope must be circular rather than the generic oval');
  const ill=toProceduralSpec(get('illinois'));
  assert.equal(ill.sectionMap.length,3);
  assert.equal(ill.sectionMap[2][0].sectionIds.length,48);
  const iowa=generateVenuePackage(toProceduralSpec(get('iowa'))).model;
  assert.ok(iowa.seats.some(s=>s.sectionId==='G'),
    'Iowa G student bank must exist with its official section label');
  assert.ok(!iowa.seats.some(s=>s.sectionId==='G'&&s.seatType==='bleacher'),
    'Student designation alone cannot justify fabricated bleacher furniture');
  assert.ok(iowa.seats.some(s=>s.sectionId==='A'&&s.seatType==='chair'));
});

test('MSU rows, Wisconsin overhang, UCLA subsection IDs and Washington entries survive generation',()=>{
  const msu=generateVenuePackage(toProceduralSpec(get('michigan-state'))).model;
  for(const row of ['10','11','12'])
    assert.ok(!msu.seats.some(s=>s.tier===0&&s.row===row),
      'Breslin lower row '+row+' is a documented break');
  assert.ok(msu.seats.some(s=>s.tier===0&&s.row==='9'&&s.seatType==='bleacher'));
  assert.ok(msu.seats.some(s=>s.tier===0&&s.row==='13'&&s.seatType==='chair'));
  assert.ok(msu.seats.some(s=>s.tier===1&&s.row==='14'&&s.seatType==='bleacher'));
  const uw=GeometryEngine.create(toProceduralSpec(get('wisconsin')));
  assert.equal(uw.spec.interior.outline,'octagon');
  const r=(tier,frac)=>Math.hypot(...[
    uw.point(tier,Math.PI/2,frac).x,uw.point(tier,Math.PI/2,frac).z]);
  assert.ok(r(1,0)<r(0,1)+.8,'Kohl first balcony front projects toward lower bowl');
  assert.ok(r(2,0)<r(1,1)+.8,'Kohl upper balcony is not the generic outer ring');
  const ucla=toProceduralSpec(get('ucla'));
  for(const id of ['206A','206B','206C','210A','210B','211C','219A',
    '223B','224A','224B','224C'])
    assert.ok(ucla.sectionMap[1].flatMap(g=>g.sectionIds).includes(id),'Missing official Pauley subdivision '+id);
  assert.ok(!ucla.sectionMap[1].flatMap(g=>g.sectionIds).includes('215'),
    'Pauley section 215 on the published map is a media block');
  const was=GeometryEngine.create(toProceduralSpec(get('washington')));
  assert.equal(was.spec.sectionMap[0][0].sectionIds.length,14);
  const seat1=was.banksForTier(was.spec.tiers[0]).find(b=>b.sectionId==='1');
  const full=seat1.hi-seat1.lo;
  const entry=was.rowIntervals(was.spec.tiers[0],seat1,9);
  assert.equal(entry.length,2,'Hec Edmundson section 1 row 10 must show the published entrance');
  assert.ok(entry.reduce((sum,[a,b])=>sum+b-a,0)<full*.96,
    'Entrances must remove actual model positions and tread geometry');
});


test('eight school section sets and clockwise positions are exactly chart-backed without invented IDs',()=>{
  const chart=JSON.parse(readFileSync(
    new URL('../data/big-ten/section-chart-verified-order.json',import.meta.url)));
  const ids=['indiana','purdue','illinois','iowa','michigan-state','wisconsin','ucla','washington'];
  for(const id of ids){
    const spec=toProceduralSpec(get(id));
    const expected=chart.venues[id];
    const actual=new Set(spec.sectionMap.flatMap(level=>level.flatMap(group=>group.sectionIds)));
    assert.deepEqual([...actual].sort(),[...expected.verifiedSections].sort(),
      id+' must contain exactly the official diagram section IDs');
    assert.equal(spec.provenance.verifiedChartSource,expected.source);
    assert.equal(spec.provenance.sectionOutlineProvenance,'official-adjacency-estimated-shape');
    assert.ok(spec.provenance.notice.includes('unverified'),id);
    for(const missing of expected.unmodeledSections??[])
      assert.ok(!actual.has(missing),id+' fabricated still-unmapped official section '+missing);
    for(const level of spec.sectionMap){
      for(const group of level)assert.ok(group.sectionIds.length,
        id+' must not include empty synthetic chart blocks');
    }
  }
  const purdue=toProceduralSpec(get('purdue'));
  assert.deepEqual(purdue.sectionMap[0][0].sectionIds,
    Array.from({length:18},(_,i)=>String(i+1)));
  assert.ok(!purdue.sectionMap[0][0].sectionIds.includes('01'));
  const iowa=toProceduralSpec(get('iowa'));
  const first=iowa.sectionMap[0][0].sectionIds,second=iowa.sectionMap[1][0].sectionIds;
  assert.equal(first.length,28);
  assert.deepEqual(first,second,'Iowa has 28 continuous section columns, not separate lettered floors');
  assert.equal(iowa.tiers[0].gap,0,
    'A continuous Iowa seating column cannot contain a fabricated full 360-degree concourse');
  const iowaPlan=generateVenuePackage(iowa).model;
  assert.equal(iowaPlan.interiorSectionFootprints.length,28,
    'There must be exactly one clickable Iowa section footprint per official section');

  assert.deepEqual(first.slice(0,5),['A','AA','BB','CC','DD']);
  assert.deepEqual(first.slice(-4),['E','D','C','B']);
  const illinois=toProceduralSpec(get('illinois'));
  assert.equal(illinois.sectionMap[1].length,2,
    'Documented east-side Illinois suites separate its middle seating banks');
  assert.ok(!illinois.sectionMap[1].some(g=>g.sectionIds.includes('130')));
  assert.deepEqual(illinois.provenance.unmodeledDocumentedSections,['9','10','11','12','13']);
  const ucla=toProceduralSpec(get('ucla'));
  assert.equal(ucla.sectionMap[1].length,2,
    'UCLA 215 is a source-verified media interruption, not a spectator section');
  assert.ok(!ucla.sectionMap[1].some(g=>g.sectionIds.includes('215')));
  for(const tier of ucla.sectionMap[1])assert.ok(tier.sectionIds.length>0);
  for(const id of ['indiana','purdue','illinois','iowa','michigan-state','wisconsin','ucla']){
    assert.equal(toProceduralSpec(get(id)).interior.notches.length,0,
      id+' must not insert undocumented hand-drawn portal holes');
  }
  const washington=toProceduralSpec(get('washington'));
  assert.equal(washington.interior.notches.length,2,
    'Washington row 10 and 14 documented portals may remain');
  assert.ok(washington.interior.notches.every(x=>x.id==='1'));
});

test('source verification guard rejects a fabricated section not present on official chart',()=>{
  const chart=JSON.parse(readFileSync(
    new URL('../data/big-ten/section-chart-verified-order.json',import.meta.url))).venues;
  const sections=JSON.parse(readFileSync(
    new URL('../data/big-ten/reference-section-layouts.json',import.meta.url))).layouts;
  const architecture=JSON.parse(readFileSync(
    new URL('../data/big-ten/architectural-signatures.json',import.meta.url))).venues;
  const interior=JSON.parse(readFileSync(
    new URL('../data/big-ten/interior-reconstructions.json',import.meta.url))).venues;
  const fake=structuredClone(chart);
  fake.purdue.tierGroups[0][0].sectionIds[2]='FAKE';
  assert.throws(()=>toBigTenProceduralSpec(get('purdue'),sections,architecture,interior,fake),
    /Chart section identity mismatch/,
    'Unknown section IDs must never silently become 3D seating');
});
