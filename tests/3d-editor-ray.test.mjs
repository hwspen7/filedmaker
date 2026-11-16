import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeVenueRenderer} from '../src/next/webgl.js';

const fake=(camera,width=800,height=600)=>({
  plan:{operatorStructures:[]},mode:'overview',
  canvas:{getBoundingClientRect:()=>({left:0,top:0,width,height})},
  currentCamera:()=>camera
});
const project=(context,x,y,plane=0)=>
  NativeVenueRenderer.prototype.unprojectToPlane.call(context,x,y,plane);

test('3D object editor maps overhead screen center onto measured XZ origin',()=>{
  const v=fake({eye:[0,60,0],target:[0,0,0],up:[0,0,-1],fov:52});
  const center=project(v,400,300);
  assert.ok(center);
  assert.ok(Math.abs(center.x)<1e-9);
  assert.ok(Math.abs(center.z)<1e-9);
  assert.equal(center.y,0);
  const right=project(v,550,300);
  assert.ok(right.x>0);
  assert.ok(Math.abs(right.z)<1e-6);
});
test('3D editor uses horizontal planes for selected structure elevations',()=>{
  const v=fake({eye:[35,55,45],target:[0,5,0],up:[0,1,0],fov:52});
  for(const elevation of [0,2.5,12]){
    const location=project(v,400,300,elevation);
    assert.ok(location);
    assert.ok(Math.abs(location.y-elevation)<1e-9);
    assert.ok(Number.isFinite(location.x+location.z));
  }
});
test('3D camera rejects no-scene or backward-facing pointer-plane projections',()=>{
  const nothing=fake({eye:[0,10,0],target:[0,20,0],up:[0,0,1],fov:52});
  assert.equal(project(nothing,400,300,0),null);
  const missing=fake({eye:[0,10,0],target:[0,0,0],up:[0,0,-1],fov:52});
  missing.plan=null;
  assert.equal(project(missing,400,300,0),null);
  missing.plan={};
  missing.mode='human';
  assert.equal(project(missing,400,300,0),null);
});
