import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SURFACES,createProject,validateProject} from '../src/model.mjs';
import {fieldLandmarks,photoProject,photoResidual,fitPhotoView} from '../src/photo.mjs';
import {viewpoint} from '../src/view.mjs';
const seat={x:0,y:15,z:80};
const surface=SURFACES.nfl;
const landmarks=fieldLandmarks(surface);
const correct={yaw:12,pitch:5,fov:55};
const actual=viewpoint(seat,surface,{optic:'phone',posture:'seated',yaw:12,pitch:5,zoom:67/55});
const points=landmarks.map(l=>({id:l.id,...photoProject(actual.origin,actual.direction,55,16/9,l)})).filter(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);

test('field landmarks occupy defined surface corners and center',()=>{
  assert.equal(landmarks.length,9);
  assert.ok(landmarks.some(l=>l.id==='nw'&&l.x===-surface.width/2));
  assert.ok(landmarks.some(l=>l.id==='center'&&l.z===0));
});
test('perspective camera places an aligned point at image center',()=>{
  const projection=photoProject({x:0,y:0,z:0},{x:0,y:0,z:1},65,1.5,{x:0,y:0,z:20});
  assert.ok(Math.abs(projection.x-.5)<1e-10&&Math.abs(projection.y-.5)<1e-10);
  assert.equal(photoProject({x:0,y:0,z:0},{x:0,y:0,z:1},65,1.5,{x:0,y:0,z:-20}),null);
});
test('synthetic photo recovers ground-truth yaw pitch and FOV with subpixel residual',()=>{
  assert.ok(points.length>=5);
  const fit=fitPhotoView({points,width:1600,height:900,seat,surface,initial:{yaw:10,pitch:4,fov:60}});
  assert.ok(Math.abs(fit.yaw-correct.yaw)<.06,JSON.stringify(fit));
  assert.ok(Math.abs(fit.pitch-correct.pitch)<.06);
  assert.ok(Math.abs(fit.fov-correct.fov)<.06);
  assert.ok(fit.rmsPx<1);
});
test('residual evaluates photo correspondences without changing seat location',()=>{
  const before=JSON.stringify(seat);
  const s=photoResidual(points,seat,surface,correct,16/9);
  assert.ok(s.meanSquare<1e-14);
  assert.equal(JSON.stringify(seat),before);
});
test('photo calibration rejects insufficient, repeated or unknown landmarks',()=>{
  const opts={points:points.slice(0,2),width:1600,height:900,seat,surface};
  assert.throws(()=>fitPhotoView(opts),/at least 3/);
  assert.throws(()=>fitPhotoView({...opts,points:[points[0],points[0],points[1]]}),/Duplicate/);
  assert.throws(()=>fitPhotoView({...opts,points:[...points.slice(0,2),{id:'not-real',x:.5,y:.5}]}),/invalid/);
});
test('project persists numeric photo registration diagnostics without embedding pixels',()=>{
  const p=createProject();
  p.survey.photoCheck={seatId:'test',points:points.slice(0,4),width:1600,height:900,yaw:12,pitch:5,fov:55,rmsPx:0,maxErrorPx:0};
  const a=validateProject(p);
  assert.equal(a.survey.photoCheck.points.length,4);
  assert.equal(a.survey.photoCheck.seatId,'test');
  assert.ok(!JSON.stringify(a).includes('data:image'));
});
test('UI provides photo landmark tagging and an explicit uncertainty disclaimer',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(html,/calibrationPhotoDialog|photoCalibrationDialog/);
  assert.match(app,/fitPhotoView/);
  assert.match(app,/does not certify seat coordinates/);
});
