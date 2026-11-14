import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createProject,generateSeats,SURFACES} from '../src/model.mjs';
import {VIEW_DEFAULTS,validateViewOptions,eyePosition,viewpoint,viewingTarget,nearbySeat,crowdCandidates,sightlineNote,apparentAngleMeters} from '../src/view.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const model=generateSeats(createProject('nba'));
const seat=model.seats.find(s=>s.row===8&&s.number>=5);

test('default viewpoint retains safe options and clamps camera limits',()=>{
 const opts=validateViewOptions({zoom:99,pitch:99,yaw:-500,posture:'flying',optic:'infrared',crowd:'other'});
 assert.equal(opts.zoom,8);assert.equal(opts.pitch,75);assert.equal(opts.yaw,-175);
 assert.equal(opts.posture,'seated');assert.equal(opts.optic,'human');assert.equal(opts.crowd,'empty');
 assert.equal(VIEW_DEFAULTS.zoom,1);
});
test('standing eye is physically higher than seated and seat remains unchanged',()=>{
 const initial={...seat};const a=eyePosition(seat,'seated'),b=eyePosition(seat,'standing');
 assert.ok(Math.abs((b.y-a.y)-.43)<1e-8);assert.deepEqual(seat,initial);
});
test('viewpoint is unit length, directed to the field, and vertical FOV is controlled by zoom',()=>{
 const a=viewpoint(seat,model.surface,{zoom:1});const b=viewpoint(seat,model.surface,{zoom:2});
 assert.ok(Math.abs(Math.hypot(...Object.values(a.direction))-1)<1e-8);
 assert.equal(b.fov,a.fov/2);assert.ok(a.distance>0);
});
test('panning changes gaze while retaining eye coordinates',()=>{
 const a=viewpoint(seat,model.surface,{yaw:0,pitch:0}),b=viewpoint(seat,model.surface,{yaw:25,pitch:12});
 assert.deepEqual(a.origin,b.origin);assert.notDeepEqual(a.direction,b.direction);
});
test('all field targets are within the playing area',()=>{
 for(const s of Object.values(SURFACES)) for(const target of ['center','near','far','left','right']) {
  const p=viewingTarget(s,target);assert.ok(Math.abs(p.x)<=s.width/2);assert.ok(Math.abs(p.z)<=s.length/2);
 }
});
test('seat navigation respects row bounds and original section',()=>{
 for(const dir of ['left','right','front','back']) {
  const next=nearbySeat(model,seat,dir);
  if(next){assert.equal(next.sectionId,seat.sectionId);assert.equal(next.tier,seat.tier);assert.notEqual(next.uid,seat.uid);}
 }
 const first=model.seats.find(s=>s.row===1&&s.number===1);
 assert.equal(nearbySeat(model,first,'front'),null);
 assert.equal(nearbySeat(model,first,'left'),null);
});
test('local crowd simulation is spatially bounded and excludes selected seat',()=>{
 const close=crowdCandidates(model,seat,40);
 assert.ok(close.length<=40 && close.length>1);
 assert.ok(close.every(s=>s.uid!==seat.uid&&s.tier===seat.tier&&Math.abs(s.row-seat.row)<=5));
});
test('view notes disclose uncertainty and reported distances remain positive',()=>{
 const d=sightlineNote(seat,model.surface);assert.ok(d.distance>0);assert.match(d.status,/Illustrative|surveyed/i);
 assert.ok(apparentAngleMeters(15,40)>apparentAngleMeters(15,100));
});
test('app exposes view finder, crowd settings, comparisons and local reference photos',()=>{
 for(const id of ['humanViewHud','seatSearch','findSeat','postureButtons','opticButtons','zoomSlider','viewTarget','crowdMode','comparisonDialog','viewPhotoUpload','phoneFrame','favoritesSelect'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(app,/switchView\('seat'\)/);assert.match(app,/applySeatLink\(\)/);
});
test('scene has eye-level pointer control, physical parapet, and captures a rendered frame',()=>{
 assert.match(scene,/addArchitecturalDetails/);assert.match(scene,/pointermove/);assert.match(scene,/setViewOptions/);
 assert.match(scene,/this\.renderer\.render\(this\.scene, this\.camera\); return this\.canvas\.toDataURL/);
});
