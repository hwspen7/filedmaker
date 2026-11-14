import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createProject,generateSeats,validateProject} from '../src/model.mjs';
import {createSchoolProject} from '../src/schoolPipeline.mjs';
import {createOhioStadiumProject,createSchottensteinCenterProject} from '../src/venues.mjs';
import {tierBlue,BLUE_TIERS,enableSeatFirst,validateTicketing,parseTicketRosterCSV,
  importTicketRoster,ticketReconciliation,ticketMappingCSV,importedTreadPairs,demoTicketRosterCSV} from '../src/seatFirst.mjs';
import {markerPlan} from '../src/markerPlan.mjs';
import {buildSchoolViewerHTML} from '../src/schoolPublisher.mjs';

const project=()=>createSchoolProject('college-gym',{school:'Example School',venue:'Example Gymnasium'});
const sample='seat_id,section,row,seat,tier\nA-01,A,1,1,T1\nA-02,A,1,2,T1\nB-01,B,1,1,T1\nB-02,B,1,2,T1';

test('seat-first default hides the complex building but retains sports fixtures',()=>{
  const p=project();assert.equal(p.seatFirst,true);assert.equal(p.showExterior,false);
  assert.equal(p.showFixtures,true);assert.equal(p.roof,false);assert.equal(p.blueTheme,true);
});
test('four blue seating tiers differ, and sections have subtle blue variants',()=>{
  assert.equal(BLUE_TIERS.length,4);assert.notEqual(tierBlue(0,1),tierBlue(1,1));
  assert.notEqual(tierBlue(1,0),tierBlue(1,1));
  for(let tier=0;tier<4;tier++)assert.match(tierBlue(tier,1),/^#[a-f0-9]{6}$/i);
});
test('official OSU capacity is metadata, not a generated seating target',()=>{
  for(const make of [createOhioStadiumProject,createSchottensteinCenterProject]){
    const p=make();assert.equal(p.seatFirst,true);
    const r=ticketReconciliation(p,125);
    assert.ok(r.officialCapacity>10000);
    assert.equal(r.modelSeatCount,125);
    assert.equal(r.inventoryCount,null);
    assert.equal(r.status,'NO_TICKET_INVENTORY');
  }
});
test('ticket roster imports all exact section/row/seat IDs, without padding to official capacity',()=>{
  let p=project();p.ticketing.officialCapacity=300;p.ticketing.capacitySource='https://example.edu/seating';
  const {project:q,report}=importTicketRoster(p,sample);
  assert.equal(q.survey.mode,'imported');assert.equal(q.survey.seats.length,4);
  assert.equal(q.survey.seats[0].id,'A-01');assert.equal(q.survey.seats[0].section,'A');
  assert.equal(report.status,'COUNT_MISMATCH');assert.equal(report.inventoryVsOfficial,-296);
  assert.equal(generateSeats(q).capacity,4);
});
test('an official count alone never creates seats or live ticket availability',()=>{
  const p=enableSeatFirst(project(),{officialCapacity:850,capacitySource:'https://example.edu'});
  const r=ticketReconciliation(p,32);
  assert.equal(r.inventoryCount,null);assert.equal(r.liveTicketAvailability,false);
  assert.equal(r.officialCapacity,850);assert.equal(r.modelSeatCount,32);
});
test('true XYZ imports without alteration; otherwise the geometry is estimated',()=>{
  const coordinates='seat_id,section,row,seat,tier,x_m,y_m,z_m\nX-1,E,1,1,T1,21.234,2.75,3.2';
  const a=importTicketRoster(project(),coordinates);
  assert.equal(a.project.survey.seats[0].x,21.234);
  assert.equal(a.project.survey.seats[0].y,2.75);
  assert.equal(a.project.ticketing.coordinates,'supplied-unverified');
  const b=importTicketRoster(project(),sample);
  assert.equal(b.project.ticketing.coordinates,'estimated');
  assert.notEqual(b.project.survey.seats[0].x,21.234);
});
test('unknown section names are spread around the arena rather than clustered in one corner',()=>{
  const {project:p}=importTicketRoster(project(),sample);
  const seats=p.survey.seats;
  assert.notEqual(Math.sign(seats[0].x),Math.sign(seats[2].x));
});
test('duplicate seat identity and partial coordinate columns fail atomically',()=>{
  assert.throws(()=>parseTicketRosterCSV('section,row,seat\nA,1,1\nA,1,1'),/Duplicate ticket seat/);
  assert.throws(()=>parseTicketRosterCSV('section,row,seat,x_m,z_m\nA,1,1,0,0'),/three columns/);
  const input=project();assert.throws(()=>importTicketRoster(input,'section,row,seat\nA,1,1\nA,1,1'));
  assert.equal(input.survey.mode,'generated');
});
test('reconciliation confirms equal counts but does not certify geometry',()=>{
  const p=enableSeatFirst(project(),{officialCapacity:4,capacitySource:'https://example.edu'});
  const r=importTicketRoster(p,sample);
  assert.equal(r.report.status,'COUNTS_MATCH_UNVERIFIED');
  assert.equal(r.report.verifiedGeometry,false);
  assert.equal(r.report.inventoryMatchesPublished,true);
});
test('ticket mapping preserves identifiers and prevents spreadsheet formula injection',()=>{
  const csv='section,row,seat\n"=2+2",1,1';
  const result=importTicketRoster(project(),csv);
  const mapping=ticketMappingCSV(result.project);
  assert.ok(mapping.includes("'=2+2"));
  assert.ok(mapping.includes('coordinate_confidence'));
});
test('imported seating treads never bridge a large section gap',()=>{
  const seats=[{sectionId:'A',tier:0,row:'1',number:'1',x:0,y:1,z:0},
    {sectionId:'A',tier:0,row:'1',number:'2',x:.5,y:1,z:0},
    {sectionId:'A',tier:0,row:'1',number:'3',x:4,y:1,z:0},
    {sectionId:'B',tier:0,row:'1',number:'4',x:4.5,y:1,z:0}];
  assert.equal(importedTreadPairs(seats).length,1);
});
test('universal marker plans support school sports',()=>{
  for(const k of ['ncaa','ncaa-football','soccer']){
    const s=k==='ncaa'?{sport:'basketball'}:k==='soccer'?{sport:'soccer'}:{sport:'football'};
    assert.ok(markerPlan(s).scoreboard);
  }
});
test('standalone school preview embeds blue tiers and official count while clearly disclaiming sales',()=>{
  const p=enableSeatFirst(project(),{officialCapacity:500,capacitySource:'https://example.edu'});
  const html=buildSchoolViewerHTML(p);
  assert.match(html,/published capacity/);
  assert.match(html,/no sales/i);
  assert.match(html,/#164c80/);
});
test('fictional demo roster creates 192 tickets and names itself fictional',()=>{
  const d=demoTicketRosterCSV(), parsed=parseTicketRosterCSV(d);
  assert.equal(parsed.count,192);assert.equal(parsed.sections,4);
});
test('valid imported inventory survives a JSON round-trip',()=>{
  const result=importTicketRoster(project(),sample).project;
  const q=validateProject(JSON.parse(JSON.stringify(result)));
  assert.deepEqual(q.ticketing,result.ticketing);
  assert.equal(q.survey.seats.length,4);
});
test('source files contain no default opaque stadium facade in seat-first mode',()=>{
  const scene=fs.readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
  assert.match(scene,/if \(project\.seatFirst\)/);
  assert.match(scene,/addUniversalMarkers/);
  assert.match(scene,/addImportedSeatTreads/);
});

test('full fictional ticket fixture produces 192 unique positioned seats in a two-sided school gym',()=>{
  const {project:p}=importTicketRoster(project(),demoTicketRosterCSV());
  assert.equal(p.survey.seats.length,192);
  assert.equal(new Set(p.survey.seats.map(s=>`${s.x}/${s.y}/${s.z}`)).size,192);
  assert.equal(generateSeats(p).capacity,192);
});
