import test from 'node:test';
import assert from 'node:assert/strict';
import {GRID_STEPS,quantize,objectGuideTargets,snapPosition,
  measuredOffset} from '../src/workbench/editorGuides.mjs';

test('grid steps are metric and deterministic at negative coordinates',()=>{
  assert.deepEqual(GRID_STEPS,[.1,.25,.5,1,2,5,10]);
  assert.equal(quantize(1.23,.25),1.25);
  assert.equal(quantize(-1.23,.25),-1.25);
  assert.equal(quantize(1.11,.1),1.1);
  assert.throws(()=>quantize(1,0));
});
test('snap infers other component centers and rotated extents',()=>{
  const targets=objectGuideTargets([
    {id:'a',x:5,z:6,yaw:90,width:4,depth:2,label:'Guide object'},
    {id:'selected',x:1,z:1,width:2,depth:2}
  ],[],null,['selected']);
  assert.ok(targets.some(t=>t.axis==='x'&&Math.abs(t.value-4)<1e-9));
  assert.ok(targets.some(t=>t.axis==='z'&&Math.abs(t.value-8)<1e-9));
  assert.ok(!targets.some(t=>t.source==='selected'));
  const snapped=snapPosition({x:5.12,z:6.18},{
    grid:.5,tolerance:.3,targets
  });
  assert.equal(snapped.x,5);
  assert.equal(snapped.z,6);
  assert.equal(snapped.guides.length,2);
  assert.ok(snapped.guides.every(g=>g.label==='Guide object'));
});
test('turning off snapping uses exact coordinates without hidden quantization',()=>{
  const targets=[{axis:'x',value:4,label:'A',source:'a'}];
  const p=snapPosition({x:4.06,z:2.18},{
    grid:1,gridEnabled:false,magnetEnabled:false,targets
  });
  assert.deepEqual(p,{x:4.06,z:2.18,guides:[]});
  const magnetic=snapPosition({x:4.06,z:2.18},{
    grid:1,gridEnabled:false,magnetEnabled:true,tolerance:.1,targets
  });
  assert.equal(magnetic.x,4);
  assert.equal(magnetic.z,2.18);
});
test('section endpoints and court center support alignment without permanent guides',()=>{
  const sections=[{id:'A',front:[{x:0,z:-8},{x:8,z:-8}],
    back:[{x:0,z:-16},{x:8,z:-16}]}];
  const targets=objectGuideTargets([],sections,{centerX:2,centerZ:3});
  assert.ok(targets.some(t=>t.axis==='x'&&t.value===8));
  assert.ok(targets.some(t=>t.source==='court'&&t.axis==='z'&&t.value===3));
  assert.equal(measuredOffset({x:1,z:2},{x:4,z:6}).length,5);
  assert.throws(()=>snapPosition({x:Infinity,z:0}));
});
