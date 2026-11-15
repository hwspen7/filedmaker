import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOhioStadiumProject, createSchottensteinCenterProject } from '../src/venues.mjs';
import { generateSeats, validateProject, balancedReferenceSections } from '../src/model.mjs';
import { createSchoolProject } from '../src/schoolPipeline.mjs';
import { importTicketRoster } from '../src/seatFirst.mjs';
import { buildVenuePlan } from '../src/next/venuePlan.mjs';

function shortRuns(model){return model.groups.filter(g=>g.count<3);}

test('named reference projects no longer invent unverified aisle cutouts',()=>{
  for(const fn of [createOhioStadiumProject, createSchottensteinCenterProject]){
    const project=fn(),model=generateSeats(project);
    assert.equal(project.aisles.length,0);
    assert.equal(shortRuns(model).length,0, 'isolated seating fragments remain');
    assert.ok(model.groups.length>100);
    assert.equal(model.seats.length,model.capacity);
  }
});

test('balanced reference sections avoid ultra-short row fragments without faking real seating IDs',()=>{
  for(const fn of [createOhioStadiumProject, createSchottensteinCenterProject]){
    const project=fn();const sections=balancedReferenceSections(project,project.sections.length,project.tiers[0].offset);
    assert.equal(sections[0].start,0);
    assert.equal(sections.at(-1).end,360);
    assert.ok(sections.every((s,i)=>s.start<s.end && (i===0||Math.abs(s.start-sections[i-1].end)<1e-7)));
    assert.equal(project.venueReference.seatNumbering,'synthetic');
  }
});

test('legacy unmodified demonstration aisles migrate, custom changes remain intact',()=>{
  const p=createOhioStadiumProject();
  p.aisles=[{id:'illustrative-aisle-1',angle:Number((.5*360/14).toFixed(3)),width:1.45,tier:'all'},
    {id:'illustrative-aisle-2',angle:Number((1.5*360/14).toFixed(3)),width:1.55,tier:'all'},
    {id:'real-surveyed-aisle',angle:35,width:1.8,tier:'T1'}];
  const validated=validateProject(p);
  assert.deepEqual(validated.aisles.map(x=>x.id),['illustrative-aisle-2','real-surveyed-aisle']);
  assert.equal(p.aisles.length,3,'do not mutate caller source');
});

test('reference rebuild does not fill a real imported ticket inventory',()=>{
  const p=createSchoolProject('college-gym',{school:'Example',venue:'Gym'});
  const csv='section,row,seat,seat_id,tier\nA,1,1,EX-1,T1\nA,1,2,EX-2,T1';
  const result=importTicketRoster(p,csv),m=generateSeats(result.project);
  assert.equal(m.seats.length,2);
  assert.deepEqual(m.seats.map(s=>s.uid),['EX-1','EX-2']);
});

test('reference background does not contain the white paper floor',()=>{
  const webgl=readFileSync(new URL('../src/next/webgl.js',import.meta.url),'utf8');
  const legacy=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
  assert.match(webgl,/alpha:true/);
  assert.match(webgl,/clearColor\(0,0,0,0\)/);
  assert.match(legacy,/if \(!project\.seatFirst\) \{/);
  assert.doesNotMatch(legacy,/mat\(0xeff1f1\)/);
  const plan=buildVenuePlan(generateSeats(createSchottensteinCenterProject()));
  assert.ok(plan.instanceData.every(Number.isFinite));
});
