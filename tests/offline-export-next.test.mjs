import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createSchoolProject,applySchoolRowPlan} from '../src/schoolPipeline.mjs';
import {buildOfflineSchoolViewerHTML} from '../src/schoolPublisher.mjs';
const source=readFileSync(new URL('../src/next/webgl.js',import.meta.url),'utf8');
test('published school preview bundles native WebGL2 without an internet CDN',()=>{
 const p=applySchoolRowPlan(createSchoolProject('college-gym',{school:'Fixture',venue:'Gym'}),'section,row,seats,side,tier\nHOME,A,4,east,T1\nHOME,B,4,east,T1\nAWAY,A,4,west,T1');
 const html=buildOfflineSchoolViewerHTML(p,source);
 assert.match(html,/NativeVenueRenderer/);
 assert.match(html,/2D Map/);assert.match(html,/Human View/);
 assert.doesNotMatch(html,/cdn\.jsdelivr\.net|unpkg\.com/);
 assert.match(html,/Published capacity/);
 assert.match(html,/synthetic seats only/);
 const script=html.match(/<script>([\s\S]*)<\/script>/)?.[1];
 assert.ok(script,'embedded script should exist');
 assert.doesNotThrow(()=>new Function(script));
});
