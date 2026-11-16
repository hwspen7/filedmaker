import test from 'node:test';
import assert from 'node:assert/strict';
import {newVenue,normalizeVenue} from '../src/workbench/contract.mjs';
import {fictionalGym} from '../src/workbench/fixtures.mjs';
import {buildWorkbenchPreview} from '../src/workbench/adapter.mjs';
import {editPlayingSurface} from '../src/workbench/surfaceEditor.mjs';
import {SURFACE_PRESETS,buildZoneInstances,zoneFitsCourt,
  worldToSurface,surfaceToWorld} from '../src/workbench/surface.mjs';
const edit=(v,action,params={})=>editPlayingSurface(v,{action,...params});
const channels=(arr)=>[...arr].every(Number.isFinite);
test('new and old venue projects normalize to bounded sport-specific court designs',()=>{
  const b=newVenue(),f=newVenue('nfhs-football');
  assert.equal(b.surfaceDesign.preset,'maple');
  assert.equal(f.surfaceDesign.preset,'turf');
  delete b.surfaceDesign;
  assert.equal(normalizeVenue(b).surfaceDesign.preset,'maple');
  assert.equal(Object.keys(SURFACE_PRESETS).length,8);
});
test('one-click court palettes update real WebGL2 instance colors without altering source seats',()=>{
  const start=fictionalGym(),before=buildWorkbenchPreview(start);
  const next=edit(start,'preset',{preset:'navy'});
  const after=buildWorkbenchPreview(next.venue);
  assert.equal(next.venue.surfaceDesign.floor,SURFACE_PRESETS.navy.floor);
  assert.equal(next.venue.surfaceDesign.apron,SURFACE_PRESETS.navy.apron);
  assert.equal(after.seats.length,1500);
  assert.equal(after.plan.surface.width,start.court.width);
  assert.equal(after.plan.operatorSurface.preset,'navy');
  assert.notDeepEqual(after.plan.instanceData,before.plan.instanceData);
  assert.equal(start.surfaceDesign.preset,'maple');
});
test('court dimensions affect 3D renderer geometry and require recalibration',()=>{
  const start=fictionalGym();
  const changed=edit(start,'dimensions',{width:17,length:28});
  const after=buildWorkbenchPreview(changed.venue);
  assert.equal(after.plan.surface.width,17);
  assert.equal(after.plan.surface.length,28);
  assert.equal(after.seats.length,1500);
  assert.equal(after.quality.publicationEligible,false);
  assert.ok(after.quality.issues.some(s=>s.code==='PLAYING_SURFACE_RECALIBRATION_REQUIRED'));
  assert.equal(start.court.width,15.24);
});
test('court origin and rotation are reflected in world conversion and staff QA',()=>{
  const input=fictionalGym();
  const after=edit(input,'style',{changes:{centerX:2.5,centerZ:-3,
    rotation:90,showMarkings:false,showBoards:false,apronWidth:6}});
  assert.deepEqual(surfaceToWorld({x:2,z:1},after.venue.surfaceDesign),
    {x:3.5,z:-5});
  const roundTrip=worldToSurface({x:3.5,z:-5},after.venue.surfaceDesign);
  assert.ok(Math.abs(roundTrip.x-2)<1e-8);
  assert.ok(Math.abs(roundTrip.z-1)<1e-8);
  assert.equal(after.venue.surfaceDesign.showMarkings,false);
  assert.equal(buildWorkbenchPreview(after.venue).plan.operatorSurface.rotation,90);
});
test('rectangles, circles and stripes append finite 3D geometry with stable IDs',()=>{
  let source=fictionalGym();
  const originalSeats=buildWorkbenchPreview(source).seats.length;
  const kinds=['rectangle','circle','stripe'];
  for(const kind of kinds){
    const out=edit(source,'zone-add',{kind,x:0,z:0,width:2,depth:1.2,
      color:'#557b9d'});
    source=out.venue;
    assert.equal(source.surfaceDesign.zones.at(-1).kind,kind);
    assert.ok(out.id.includes(kind));
  }
  const generated=buildZoneInstances(source.surfaceDesign);
  assert.ok(generated.length>0&&generated.length%11===0);
  assert.ok(channels(generated));
  const preview=buildWorkbenchPreview(source);
  assert.equal(preview.seats.length,originalSeats);
  assert.equal(preview.plan.instanceData.length>0,true);
  assert.equal(preview.plan.instanceData.length,buildWorkbenchPreview(fictionalGym()).plan.instanceData.length+generated.length);
  assert.ok(preview.quality.issues.some(s=>s.code==='PAINTED_FLOOR_ZONES_UNVERIFIED'));
});
test('one surface paint zone is editable, duplicable and removable',()=>{
  const before=fictionalGym();
  const first=edit(before,'zone-add',{kind:'rectangle',x:1,z:0,width:2,depth:3,color:'#ffffff'});
  const updated=edit(first.venue,'zone-update',{id:first.id,changes:{x:2,rotation:25}});
  assert.equal(updated.venue.surfaceDesign.zones[0].x,2);
  const duplicate=edit(updated.venue,'zone-duplicate',{id:first.id});
  assert.equal(duplicate.venue.surfaceDesign.zones.length,2);
  assert.notEqual(duplicate.id,first.id);
  const cleared=edit(duplicate.venue,'zone-remove',{id:duplicate.id});
  assert.equal(cleared.venue.surfaceDesign.zones.length,1);
  assert.equal(cleared.venue.surfaceDesign.zones[0].id,first.id);
  assert.equal(before.surfaceDesign.zones.length,0);
});
test('invalid dimensions, colors, and zones reject atomically',()=>{
  const before=fictionalGym();
  const snapshot=structuredClone(before);
  const commands=[
    {action:'preset',preset:'nope'},
    {action:'dimensions',width:400,length:28},
    {action:'zone-add',kind:'rectangle',x:0,z:0,width:100,depth:3,color:'#ffffff'},
    {action:'zone-add',kind:'rectangle',x:0,z:0,width:1,depth:1,color:'red'},
    {action:'zone-add',kind:'hexagon',x:0,z:0},
    {action:'style',changes:{floor:'#12345g'}},
    {action:'style',changes:{unexpected:1}},
    {action:'zone-update',id:'missing',changes:{x:1}},
    {action:'zone-remove',id:'missing'}
  ];
  for(const command of commands)
    assert.throws(()=>editPlayingSurface(before,command),undefined,JSON.stringify(command));
  assert.deepEqual(before,snapshot);
});
test('painted zone footprint checks enforce boundary even under rotation',()=>{
  const court={width:15,length:28};
  assert.equal(zoneFitsCourt({x:0,z:0,width:13,depth:20,rotation:0},court),true);
  assert.equal(zoneFitsCourt({x:7,z:0,width:5,depth:4,rotation:0},court),false);
  assert.equal(zoneFitsCourt({x:0,z:0,width:15,depth:28,rotation:45},court),false);
});
test('surface changes survive project JSON and reversible clear-to-default operation',()=>{
  const before=fictionalGym();
  const changed=edit(before,'preset',{preset:'charcoal'});
  const added=edit(changed.venue,'zone-add',{kind:'circle',x:1,z:0,width:1,depth:1,color:'#223344'});
  const copy=normalizeVenue(JSON.parse(JSON.stringify(added.venue)));
  assert.equal(copy.surfaceDesign.zones.length,1);
  assert.equal(copy.surfaceDesign.preset,'charcoal');
  const cleared=edit(copy,'reset');
  assert.equal(cleared.venue.surfaceDesign.preset,'maple');
  assert.equal(cleared.venue.surfaceDesign.zones.length,0);
  assert.equal(buildWorkbenchPreview(cleared.venue).seats.length,1500);
});
