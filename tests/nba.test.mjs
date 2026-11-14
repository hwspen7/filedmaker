import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NBA_CATALOG,NBA_REFERENCE_PACK,createNBAArenaProject,nbaArenaReport} from '../src/nbaArenas.mjs';
import {getNBAArena} from '../src/nbaCatalog.mjs';
import {nbaArchitecturePlan,nbaArenaId} from '../src/nbaGeometry.mjs';
import {generateSeats,validateProject,SURFACES} from '../src/model.mjs';
import {eyePosition,spectatorSeatClearance,viewpoint,validateViewOptions} from '../src/view.mjs';
const focus=['knicks','warriors','lakers','bulls','clippers'];

test('NBA directory has exactly 30 unique 2026-27 teams and arenas including Toronto',()=>{
 assert.equal(NBA_CATALOG.length,30);
 assert.equal(new Set(NBA_CATALOG.map(v=>v.id)).size,30);
 assert.equal(new Set(NBA_CATALOG.map(v=>v.arena)).size,30);
 assert.equal(NBA_CATALOG.filter(v=>v.country==='CA').length,1);
 assert.equal(getNBAArena('raptors').arena,'Scotiabank Arena');
 assert.equal(getNBAArena('sixers').arena,'Xfinity Mobile Arena');
 assert.ok(NBA_CATALOG.every(v=>v.identitySource.startsWith('https://')));
});
test('Five priority arena profiles cite official evidence and vary structurally',()=>{
 assert.deepEqual(Object.keys(NBA_REFERENCE_PACK).sort(),focus.sort());
 const tierPatterns=focus.map(id=>createNBAArenaProject(id).tiers.map(t=>t.rows).join(','));
 assert.equal(new Set(tierPatterns).size,5);
 for (const id of focus){
  const p=createNBAArenaProject(id),report=nbaArenaReport(id);
  assert.equal(p.surface,'nba');
  assert.equal(p.venueReference.id,`nba:${id}`);
  assert.equal(p.venueReference.seatNumbering,'synthetic');
  assert.equal(report.measuredSeatCoordinates,0);
  assert.ok(report.claims.length>=2);
  assert.ok(report.sources.every(s=>s.quality==='official-public'));
  const model=generateSeats(p);
  assert.ok(model.capacity>1000);
  assert.ok(model.seats.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.z)&&Number.isFinite(s.y)));
 }
});
test('All 30 venue IDs can produce explicit illustrative preview without invented real seat numbers',()=>{
 for(const {id} of NBA_CATALOG){
  const p=createNBAArenaProject(id),report=nbaArenaReport(id);
  assert.equal(validateProject(p).venueReference.id,`nba:${id}`);
  assert.match(p.venueReference.measurementNotice,/not been verified/);
  assert.match(p.survey.source,/source|geometry|NBA|Official|official|directory/i);
  assert.match(report.limitations.join(' '),/NOT official/);
 }
});
test('Unrecognized arena references and cross-sport reference misuse are rejected',()=>{
 const p=createNBAArenaProject('knicks');
 p.venueReference.id='nba:made-up-arena';
 assert.throws(()=>validateProject(p),/Unknown venue reference/);
 const q=createNBAArenaProject('bulls');q.surface='nfl';
 assert.throws(()=>validateProject(q),/Unknown venue reference/);
 assert.throws(()=>createNBAArenaProject('fake'),/Unknown NBA arena/);
});
test('Intuit Dome 51-row reference Wall has no tier overlaps in its mapped sector',()=>{
 const p=createNBAArenaProject('clippers');
 const mapped=p.sectionProfiles.filter(x=>x.rows===51);
 assert.ok(mapped.length>0);
 assert.ok(mapped.every(x=>x.tierId==='T1'));
 for(const x of mapped){
  assert.ok(p.sectionProfiles.some(v=>v.tierId==='T2'&&v.sectionId===x.sectionId&&v.rows===0));
  assert.ok(p.sectionProfiles.some(v=>v.tierId==='T3'&&v.sectionId===x.sectionId&&v.rows===0));
 }
 assert.equal(nbaArchitecturePlan(p).scoreboard.kind,'halo');
 assert.equal(nbaArchitecturePlan(p).wall.rows,51);
});
test('MSG bridge and Lakers suite bands are separate planned architectural assets',()=>{
 assert.equal(nbaArchitecturePlan(createNBAArenaProject('knicks')).bridges.length,2);
 assert.equal(nbaArchitecturePlan(createNBAArenaProject('lakers')).premiumBands.length,3);
 assert.equal(nbaArchitecturePlan(createNBAArenaProject('warriors')).premiumBands.length,1);
 assert.equal(nbaArchitecturePlan(createNBAArenaProject('bulls')).premiumBands.length,1);
 assert.equal(nbaArenaId(createNBAArenaProject('knicks')),'knicks');
 assert.equal(nbaArenaId({venueReference:null}),null);
});
test('NBA court dimensions remain official 94×50 ft',()=>{
 assert.ok(Math.abs(SURFACES.nba.length-94*.3048)<1e-9);
 assert.ok(Math.abs(SURFACES.nba.width-50*.3048)<1e-9);
});
test('Human-eye offset moves in front of seat backrest in local yaw coordinates',()=>{
 for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI]){
  const s={x:15,y:10,z:-12,yaw};
  for(const posture of ['seated','standing','leaning']){
   const e=eyePosition(s,posture),check=spectatorSeatClearance(s,e);
   assert.equal(check.insideBackrest,false);
   assert.ok(check.forward>=.19);
   assert.ok(Math.abs(check.lateral)<1e-8);
   assert.ok(e.y>s.y+1);
   assert.ok(Number.isFinite(viewpoint(s,SURFACES.nba,{posture}).fov));
  }
 }
});
test('Special basketball targets remain distinct and within valid bounds',()=>{
 const s={x:17,y:6,z:0,yaw:-Math.PI/2};
 const near=viewpoint(s,SURFACES.nba,{target:'near-rim'});
 const far=viewpoint(s,SURFACES.nba,{target:'far-rim'});
 const board=viewpoint(s,SURFACES.nba,{target:'scoreboard'});
 assert.notEqual(near.target.z,far.target.z);
 assert.ok(board.target.y>near.target.y);
 assert.equal(validateViewOptions({posture:'leaning'}).posture,'leaning');
});
test('App and renderer expose NBA pack and hide occupied chair in human view',()=>{
 const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
 const arch=readFileSync(new URL('../src/nbaArchitecture.js',import.meta.url),'utf8');
 assert.match(app,/nbaArenaSelect/);assert.match(app,/createNBAArenaProject\(id\)/);
 assert.match(scene,/hideCurrentSeatForViewer\(true\)/);
 assert.match(scene,/hiddenSeatIndex/);
 assert.match(scene,/wasHumanView/);
 assert.match(arch,/kind==='halo'/);
});
