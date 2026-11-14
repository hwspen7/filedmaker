import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSvgPlan, parsePathData, planPoint, tracePlanOutline } from '../src/plan.mjs';
import { SURFACES, createProject, generateSeats, validateProject, resolveTiers, resolveSectionTier, modelPerimeterPath, seatingIntervals } from '../src/model.mjs';

const outer = `<svg viewBox="-120 -120 240 240"><path id="outline" d="M-85,-95 L85,-95 85,95 -85,95Z"/></svg>`;

test('SVG paths, curves, arcs and polygon geometry are imported as inert vector data', () => {
  const src = `<svg viewBox="0 0 200 200"><g transform="translate(10 5)"><path id="main" d="M20 30 C45 15 150 15 180 30 L180 170 Q100 190 20 170 Z"/><circle id="ring" cx="100" cy="100" r="25"/><polygon id="border" points="0,0 200,0 200,200 0,200"/><path d="M5 5 A20 20 0 0 1 45 5"/></g></svg>`;
  const plan = parseSvgPlan(src);
  assert.equal(plan.paths.length, 4);
  assert.equal(plan.paths[0].closed, true);
  assert.ok(plan.paths[0].points.length > 20);
  assert.equal(plan.paths[1].points.length, 96);
  assert.ok(plan.paths.at(-1).points.length > 2);
  assert.ok(Math.abs(plan.paths[0].points[0].x - (-70)) < 1e-6);
  assert.ok(Math.abs(plan.paths[0].points[0].z - (-65)) < 1e-6);
});

test('SVG scripts, external hrefs and SVG styles never become executable scene data', () => {
  const plan = parseSvgPlan(`<svg viewBox="0 0 100 100"><script>alert('no')</script><image href="https://example.com/pixel"/><foreignObject><div onclick="evil()">x</div></foreignObject><rect x="1" y="1" width="80" height="90" onload="evil()"/></svg>`);
  assert.equal(plan.paths.length, 1);
  assert.equal(plan.paths[0].points.length, 4);
  assert.ok(!JSON.stringify(plan).includes('evil'));
  assert.throws(() => parseSvgPlan('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg viewBox="0 0 1 1"><rect/></svg>'), /DTD/);
  assert.throws(() => parseSvgPlan('<svg><circle r="2"/></svg>'), /viewBox/);
});

test('SVG path parser handles relative drawing and rejects malformed input', () => {
  const paths = parsePathData('m 0 0 h 100 v 100 h -100 z');
  assert.equal(paths.length, 1);
  assert.equal(paths[0].points.length, 4);
  assert.equal(paths[0].closed, true);
  assert.throws(() => parsePathData('M 0 0 L 20'), /Malformed/);
  assert.throws(() => parsePathData('M 0 0 R 2 2'), /Unsupported/);
});

test('calibrated closed SVG outline can drive 3D seats', () => {
  const plan = parseSvgPlan(outer);
  plan.scale = 1.15;
  plan.rotation = 0;
  const traced = tracePlanOutline(plan, 0, SURFACES.nfl);
  const project = createProject();
  project.outline = traced;
  project.plan = plan;
  const model = generateSeats(project);
  assert.equal(model.project.schemaVersion, 3);
  assert.ok(model.capacity > 1000);
  assert.equal(new Set(model.seats.map(s => s.uid)).size, model.capacity);
  assert.equal(planPoint(plan, {x: 2, z: 4}).x, 2.3);
});

test('tracing rejects open paths and contours that do not enclose the stadium origin', () => {
  const plan = parseSvgPlan(`<svg viewBox="0 0 100 100"><polyline points="0 0 10 0 10 10"/><rect x="1" y="1" width="10" height="10"/></svg>`);
  assert.throws(() => tracePlanOutline(plan, 0, SURFACES.nfl), /closed/);
  assert.throws(() => tracePlanOutline(plan, 1, SURFACES.nfl), /enclose/);
});

test('an override changes only one section and tier, including row elevation', () => {
  const project = createProject('nba');
  const before = generateSeats(project);
  project.sectionProfiles.push({sectionId:'S01', tierId:'T1', rows:6, frontShift:4, heightShift:3, rise:.42, depth:.87});
  const result = generateSeats(project);
  const original = before.seats.filter(s=>s.tier===0&&s.sectionId==='S01');
  const changed = result.seats.filter(s=>s.tier===0&&s.sectionId==='S01');
  assert.ok(changed.length < original.length);
  assert.equal(Math.max(...changed.map(s=>s.row)), 6);
  assert.ok(changed[0].y > original[0].y + 2.9);
  const untouched = row => row.filter(s=>s.tier===0&&s.sectionId==='S02');
  assert.deepEqual(untouched(result.seats),untouched(before.seats));
  assert.ok(resolveSectionTier(resolveTiers(result.project)[0],'S01',result.project).startOffset > 4.2);
});

test('section can be completely omitted on one tier without removing other tiers', () => {
  const project = createProject('nba');
  const original = generateSeats(project);
  project.sectionProfiles.push({sectionId:'S03',tierId:'T1',rows:0,frontShift:0,heightShift:0,rise:.32,depth:.83});
  const changed = generateSeats(project);
  assert.equal(changed.seats.filter(s=>s.tier===0&&s.sectionId==='S03').length,0);
  assert.equal(changed.seats.filter(s=>s.tier===1&&s.sectionId==='S03').length,original.seats.filter(s=>s.tier===1&&s.sectionId==='S03').length);
});

test('entrance tunnel removes only rows in the specified tier; 2D and 3D use same intervals', () => {
  const project = createProject('nba');
  const before = generateSeats(project);
  project.portals = [{id:'P1',tierId:'T1',angle:30,width:5,firstRow:4,lastRow:9}];
  const after = generateSeats(project);
  const row = (m, tier, number) => m.seats.filter(s=>s.tier===tier&&s.row===number).length;
  assert.equal(row(before,0,2),row(after,0,2));
  assert.ok(row(before,0,6)>row(after,0,6));
  assert.equal(row(before,1,6),row(after,1,6));
  const path = modelPerimeterPath(project,SURFACES.nba,6);
  const section = project.sections.find(s=>s.start<=30&&s.end>30);
  const length = ranges=>ranges.reduce((sum,[a,b])=>sum+b-a,0);
  assert.ok(length(seatingIntervals(path,section,project,'T1',5)) < length(seatingIntervals(path,section,project,'T1',2)));
  assert.equal(new Set(after.seats.map(s=>s.uid)).size,after.capacity);
});

test('invalid imported plans and section profiles cannot enter project state', () => {
  const p = createProject('nba');
  p.sectionProfiles=[{sectionId:'OTHER',tierId:'T1',rows:3,frontShift:0,heightShift:0,rise:.3,depth:.8}];
  assert.throws(()=>validateProject(p),/missing section/);
  p.sectionProfiles=[{sectionId:'S01',tierId:'T1',rows:10,frontShift:999,heightShift:0,rise:.3,depth:.8}];
  assert.throws(()=>validateProject(p),/front shift/);
  p.sectionProfiles=[];
  p.portals=[{id:'P1',tierId:'T3',angle:45,width:5,firstRow:5,lastRow:8}];
  assert.throws(()=>validateProject(p),/missing tier/);
  p.portals=[];
  p.plan={name:'x',viewBox:[0,0,1,1],scale:1,rotation:0,offsetX:0,offsetZ:0,visible:true,paths:[{name:'x',closed:true,points:[{x:NaN,z:0},{x:0,z:0}]}]};
  assert.throws(()=>validateProject(p),/invalid coordinate/);
});

test('projects created under v2 migrate without breaking the new schema', () => {
  const p=createProject('soccer');delete p.sectionProfiles;delete p.portals;delete p.plan;p.schemaVersion=2;
  const next=validateProject(p);
  assert.equal(next.schemaVersion,3);
  assert.deepEqual(next.sectionProfiles,[]);
  assert.deepEqual(next.portals,[]);
  assert.equal(next.plan,null);
});

test('browser markup exposes plan upload, independent section profiles and entrance controls', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  for(const id of ['planUpload','showPlanTab','outlineSvg']) assert.match(html,new RegExp(`id="${id}"`));
  for(const key of ['data-plan-prop','data-toggle-profile','data-add-portal','data-trace-plan']) assert.ok(app.includes(key));
});

test('bundled illustrative stadium SVG can be traced with calibrated dimensions', () => {
  const svg = readFileSync(new URL('../examples/football-bowl.svg',import.meta.url),'utf8');
  const plan = parseSvgPlan(svg);
  assert.equal(plan.paths[0].name,'outer_bowl');
  assert.equal(plan.paths.length,5);
  plan.scale = 1;
  const outline = tracePlanOutline(plan,0,SURFACES.nfl);
  const project = createProject('nfl');
  project.outline = outline;
  assert.ok(generateSeats(project).capacity > 30000);
});
