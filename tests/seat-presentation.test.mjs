import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createProject,generateSeats} from '../src/model.mjs';
import {createOhioStadiumProject,createSchottensteinCenterProject} from '../src/venues.mjs';
import {createSchoolProject,applySchoolRowPlan} from '../src/schoolPipeline.mjs';
import {importTicketRoster,ticketReconciliation} from '../src/seatFirst.mjs';
import {seatPalette,seatColor,seatKind,facingYaw,canSelectOfficialSeat} from '../src/seatPresentation.mjs';
import {buildSchoolViewerHTML} from '../src/schoolPublisher.mjs';

test('Ohio reference uses neutral bleacher-like display, not invented folding chairs',()=>{
  const p=createOhioStadiumProject(),m=generateSeats(p);
  assert.equal(p.blueTheme,false);
  assert.equal(seatKind(p,m.seats[0]),'bleacher');
  assert.match(seatColor(p,0,0),/^#[\da-f]{6}$/i);
  assert.notEqual(seatColor(p,0,0),'#164c80');
  assert.equal(canSelectOfficialSeat(p,m.seatOrigin),false);
});
test('Schottenstein reference uses independent chair style and charcoal tiers',()=>{
  const p=createSchottensteinCenterProject();
  assert.equal(seatKind(p,generateSeats(p).seats[0]),'chair');
  assert.equal(p.blueTheme,false);
  assert.notDeepEqual(seatPalette(p),seatPalette(createOhioStadiumProject()));
});
test('school-supplied seating colors change all tiers without changing ticket IDs',()=>{
  const p=createSchoolProject('college-gym',{school:'Test',venue:'Gym',primaryColor:'#a92843'});
  assert.equal(p.school.primaryColor,'#a92843');
  assert.equal(seatColor(p,0,0),'#a92843');
  assert.notEqual(seatColor(p,1,0),seatColor(p,0,0));
  const q=applySchoolRowPlan(p,'section,row,seats,side\nA,1,3,east');
  const m=generateSeats(q);
  assert.deepEqual(m.seats.map(s=>s.uid),['A-1-1','A-1-2','A-1-3']);
});
test('curved-row seat facing is inward and perpendicular to local row tangent',()=>{
  const p=createProject('ncaa-football'),m=generateSeats(p);
  const row=m.seats.filter(s=>s.sectionId==='S03'&&s.tier===0&&s.row===4);
  const index=Math.floor(row.length/2); const seat=row[index];
  const before=row[index-1],after=row[index+1];
  const dx=after.x-before.x,dz=after.z-before.z;
  const dirX=Math.sin(seat.yaw),dirZ=Math.cos(seat.yaw);
  const perpendicular=(dirX*dx+dirZ*dz)/Math.hypot(dx,dz);
  assert.ok(Math.abs(perpendicular)<.035,`invalid orientation: ${perpendicular}`);
  assert.ok(dirX*-seat.x+dirZ*-seat.z>0);
});
test('missing measurements and published capacity cannot become official tickets',()=>{
  const p=createOhioStadiumProject(),m=generateSeats(p);const audit=ticketReconciliation(p,m.capacity);
  assert.equal(audit.inventoryCount,null);
  assert.equal(audit.verifiedGeometry,false);
  assert.equal(audit.modelSeatCount,m.capacity);
  assert.equal(canSelectOfficialSeat(p,m.seatOrigin),false);
});
test('imported row facing remains valid, supplied IDs and positions stay intact',()=>{
  const p=createSchoolProject('college-gym',{school:'Test',venue:'Test'});
  const csv='seat_id,section,row,seat,tier,x_m,y_m,z_m\nA1,A,1,1,T1,10,1,-2\nA2,A,1,2,T1,10,1,-1\nA3,A,1,3,T1,10,1,0';
  const result=importTicketRoster(p,csv),m=generateSeats(result.project);
  assert.equal(canSelectOfficialSeat(result.project,m.seatOrigin),true);
  assert.deepEqual(m.seats.map(s=>s.uid),['A1','A2','A3']);
  assert.deepEqual(m.seats.map(s=>s.x),[10,10,10]);
  assert.ok(m.seats.every(s=>Math.sin(s.yaw)<-.98));
});
test('published preview uses shared colors and seat styles, no forced backs for bleachers',()=>{
  const p=createSchoolProject('high-basketball',{school:'Test',venue:'Gym',primaryColor:'#aa3333'});
  const q=applySchoolRowPlan(p,'section,row,seats,side\nX,1,3,east');
  const html=buildSchoolViewerHTML(q);
  assert.match(html,/"style":"bleacher"/);
  assert.match(html,/"color":"#aa3333"/);
  assert.match(html,/s\.style==='bleacher'/);
});
test('every rendering surface uses shared seat presentation',()=>{
  const scene=fs.readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
  const viewer=fs.readFileSync(new URL('../viewer/viewer.js',import.meta.url),'utf8');
  assert.match(scene,/seatKind\(project,seat\)/);
  assert.doesNotMatch(scene,/project\.seatFirst\s*\|\|\s*dims\.styleForTier/);
  assert.match(viewer,/seatColor\(project/);
});
