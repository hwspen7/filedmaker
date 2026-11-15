import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {venueBounds,overviewCamera} from '../src/seatCamera.mjs';
import {createSchoolProject,applySchoolRowPlan,schoolExampleRowsCSV} from '../src/schoolPipeline.mjs';
import {generateSeats} from '../src/model.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const project=applySchoolRowPlan(createSchoolProject('college-gym', {school:'Demo',venue:'Sample Gym'}),schoolExampleRowsCSV());
const model=generateSeats(project);

test('viewer bounds use actual school seat locations and playing field',()=>{
  const b=venueBounds(model.seats,model.surface);
  assert.ok(b.width>=model.surface.width);
  assert.ok(b.depth>=model.surface.length);
  assert.ok(b.center.x>=b.minX&&b.center.x<=b.maxX);
  assert.ok(model.seats.every(s=>s.x>=b.minX&&s.x<=b.maxX&&s.z>=b.minZ&&s.z<=b.maxZ));
});
test('overview framing remains bounded for small gyms and large NCAA stadiums',()=>{
 const b=venueBounds(model.seats,model.surface);
 const frame=overviewCamera(b,{aspect:16/9});
 const d=Math.hypot(frame.position.x-frame.target.x,frame.position.y-frame.target.y,frame.position.z-frame.target.z);
 assert.ok(d>25&&d<200);
 assert.ok(Number.isFinite(frame.fov));
 const large=overviewCamera(venueBounds([{x:130,y:36,z:90},{x:-130,y:5,z:-90}],{width:49,length:110}));
 assert.ok(large.position.y>frame.position.y);
});
test('camera rejects invalid properties and does not invent survey data',()=>{
 assert.throws(()=>venueBounds([],null),/Invalid/);
 assert.throws(()=>overviewCamera(venueBounds([],model.surface),{aspect:-1}),/Invalid/);
 assert.equal(model.seats.length,66);
 assert.equal(model.project.school.seatCoordinateMethod,'estimated-from-row-counts');
});
test('seat viewer has distinct map, orbit, section, human view and phone options',()=>{
 const html=read('../viewer/index.html');
 for(const id of ['seatmap','scene','section','tier','search','photo','share','phone','compareA','compareB','favorite']){
  assert.match(html,new RegExp(`id="${id}"`));
 }
 for(const view of ['map','orbit','section','seat'])assert.match(html,new RegExp(`data-view="${view}"`));
 assert.match(html,/Preview, not ticket sales/);
});
test('viewer 2D avoids per-seat DOM nodes and cluttered section annotation',()=>{
 const script=read('../viewer/viewer.js');
 assert.match(script,/getContext\('2d'/);
 assert.match(script,/const limit=Math\.min\(12/);
 assert.match(script,/for\(const \[id,r\] of shown\.slice\(0,limit\)\)/);
 assert.match(script,/for\(let i=0;i<seats\.length;i\+\+\)/);
 assert.match(script,/setView\('map'\)/);
});
test('school can open viewer using current project rather than a hardcoded venue name',()=>{
 const studio=read('../school/studio.js'),html=read('../school/index.html');
 assert.match(html,/id="openViewer"/);
 assert.match(studio,/localStorage\.setItem\('filedmaker\.viewer\.project'/);
 assert.match(studio,/window\.open\('\.\.\/viewer\/'/);
 assert.match(read('../viewer/viewer.js'),/if \(value\) return JSON\.parse\(value\)/);
});
test('viewers must not present checkout, inferred coordinates or upload as verified',()=>{
 const html=read('../viewer/index.html');
 const js=read('../viewer/viewer.js');
 assert.match(html,/before publication/);
 assert.match(html,/Seat coordinates/);
 assert.match(js,/not independently verified/);
 assert.match(js,/no real-time availability or checkout/);
});
