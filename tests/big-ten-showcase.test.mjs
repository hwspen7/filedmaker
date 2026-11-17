import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BIG_TEN_CASES,prepareBigTenExample}
  from '../src/reconstruction/bigTenShowcase.mjs';
import {generateReconstruction,normalizeReconstruction}
  from '../src/reconstruction/core.mjs';

const source={
  venues:JSON.parse(readFileSync(new URL('../data/big-ten/arenas-2026-27.json',import.meta.url),'utf8')).venues,
  layouts:JSON.parse(readFileSync(new URL('../data/big-ten/reference-section-layouts.json',import.meta.url),'utf8')).layouts,
  charts:JSON.parse(readFileSync(new URL('../data/big-ten/section-chart-verified-order.json',import.meta.url),'utf8')).venues,
  interiors:JSON.parse(readFileSync(new URL('../data/big-ten/interior-reconstructions.json',import.meta.url),'utf8')).venues,
};
const expectedSections={illinois:87,indiana:24,michigan:55,purdue:36,wisconsin:84};
const expectedTiers={illinois:3,indiana:2,michigan:2,purdue:2,wisconsin:3};
const fingerprints=new Set();
for(const item of BIG_TEN_CASES){
  test('Big Ten '+item.id+' prepared structure is reproducible, independent and count-exact',()=>{
    const path=new URL('../data/reconstruction-showcase/'+item.id+'.json',import.meta.url);
    const committed=JSON.parse(readFileSync(path,'utf8'));
    const prepared=prepareBigTenExample(item.id,source);
    assert.deepEqual(committed,prepared,'Demo must match reusable source preparation');
    const p=normalizeReconstruction(committed);
    assert.equal(p.sections.length,expectedSections[item.id]);
    assert.equal(new Set(p.sections.map(s=>s.id)).size,p.sections.length);
    assert.equal(new Set(p.sections.map(s=>s.tier)).size,expectedTiers[item.id]);
    assert.equal(p.exterior.enabled,false);
    assert.match(p.notes,/NOT AN OFFICIAL 3D VENUE/);
    const width=p.sections.map(s=>s.front[0].x).join(',');
    assert.ok(!fingerprints.has(width),'Geometry must not reuse a single bank shape');
    fingerprints.add(width);
    const result=generateReconstruction(p,{preview:false});
    assert.equal(result.seats.length,p.totals.seats);
    assert.equal(result.rowRuns.length,p.totals.rows);
    assert.equal(result.audit.capacityFitting,false);
    assert.equal(result.audit.exteriorBuilt,false);
    assert.equal(result.quality.blockingCount,0);
    assert.ok(result.seats.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.z)));
    assert.ok(result.warnings.some(w=>w.includes('capacity')));
    assert.notEqual(result.seats.length,p.officialCapacity,
      'A capacity citation is not a measured seating roster');
  });
}

test('five distinct venue cases are exposed by the builder and source data is served',()=>{
  const html=readFileSync(new URL('../builder/index.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../builder/builder.js',import.meta.url),'utf8');
  const server=readFileSync(new URL('../scripts/server.mjs',import.meta.url),'utf8');
  for(const {id} of BIG_TEN_CASES){
    assert.match(html,new RegExp('data-showcase="'+id+'"'));
    assert.match(html,new RegExp('data-case-image="'+id+'"'));
  }
  assert.match(js,/openBigTenCase/);
  assert.match(js,/normalizeReconstruction\(raw\)/);
  assert.match(js,/drawCaseMiniature/);
  assert.match(js,/requestAnimationFrame/);
  assert.match(server,/'data'/);
});
