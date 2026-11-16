import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { addIllustrativeConcertStage } from '../src/next/concertStage.mjs';

const read = path => readFileSync(new URL(path, import.meta.url),'utf8');

test('live experience exposes all necessary native seat-view controls',()=>{
  const html=read('../experience/index.html');
  for(const id of [
    'venueChoice','eventChoice','tier','section','rowInput','seatInput',
    'seatmap','scene','target','posture','depthRange','lateralRange',
    'selected','favorite','share','compareLeft','compareRight',
    'photo','galleryList','searchBtn','fit','seatView',
  ]) assert.match(html,new RegExp('id="'+id+'"'), 'missing '+id);
  assert.match(html,/src="\.\.\/viewer\/viewer\.js"/);
  assert.match(html,/src="\.\/experience\.js"/);
  const server=read('../scripts/server.mjs');
  assert.match(server,/'experience'/);
});

test('concert stage adds five non-selectable WebGL instances without modifying ticket identities',()=>{
  const input=new Float32Array(22).fill(.5);
  const plan={instanceData:input,instanceCount:2,roundedCount:1,seats:[{uid:'authentic-1'}]};
  const model={project:{liveStage:'end'},surface:{width:15.24,length:28.6512}};
  const result=addIllustrativeConcertStage(plan,model);
  assert.equal(result.instanceCount,7);
  assert.equal(result.instanceData.length,77);
  assert.equal(result.instanceData.length%11,0);
  assert.equal(result.roundedCount,1);
  assert.equal(result.seats,plan.seats);
  assert.equal(plan.instanceData,input,'source geometry must remain untouched');
  assert.deepEqual([...result.instanceData.slice(0,22)],[...input]);
  for(let i=22;i<result.instanceData.length;i+=11) {
    const box=Array.from(result.instanceData.slice(i,i+11));
    assert.ok(box.every(Number.isFinite));
    assert.ok(box[3]>0 && box[4]>0 && box[5]>0);
    assert.equal(box[10],-1,'stage boxes must not receive synthetic seat IDs');
  }
  assert.match(result.concertStageStatus,/illustrative/);
});
test('normal sports mode does not mutate native venue geometry',()=>{
  const plan={instanceData:new Float32Array(11),instanceCount:1};
  const model={project:{liveStage:null},surface:{width:15,length:29}};
  assert.equal(addIllustrativeConcertStage(plan,model),plan);
});
test('stage construction rejects invalid model dimensions',()=>{
  assert.throws(()=>addIllustrativeConcertStage({instanceData:new Float32Array(11)},
    {project:{liveStage:'end'},surface:{width:0,length:29}}),/valid playing surface/);
});
