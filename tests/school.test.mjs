import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SURFACES,generateSeats,validateProject} from '../src/model.mjs';
import {SCHOOL_PROFILES,createSchoolProject,parseSchoolRowsCSV,schoolRowCoordinates,applySchoolRowPlan,applySchoolSurvey,schoolReadiness,schoolExampleRowsCSV} from '../src/schoolPipeline.mjs';
import {buildSchoolViewerHTML} from '../src/schoolPublisher.mjs';
const info={school:'Example Community College',venue:'Campus Gym'};

test('every school template builds a valid project with explicit unverified status',()=>{
  for(const key of Object.keys(SCHOOL_PROFILES)){
    const p=createSchoolProject(key,info);
    assert.equal(validateProject(p).school.status,'draft');
    assert.equal(p.survey.mode,'generated');
    assert.equal(p.school.seatCoordinateMethod,'parametric-estimate');
    assert.ok(generateSeats(p).seats.length>0,key);
  }
});
test('regulation size differs between NCAA and NFHS, middle school is configurable example only',()=>{
  assert.ok(Math.abs(SURFACES.ncaa.length-94*.3048)<1e-9);
  assert.ok(Math.abs(SURFACES['nfhs-basketball'].length-84*.3048)<1e-9);
  assert.ok(Math.abs(SURFACES['youth-basketball'].length-74*.3048)<1e-9);
  assert.match(SURFACES['youth-basketball'].label,/verify locally/i);
  assert.ok(Math.abs(SURFACES['ncaa-football'].endZone-10*.9144)<1e-9);
  assert.equal(SURFACES['nfhs-basketball'].threePointRadiusM,6.0198);
});
test('school names and venue must be supplied; no unknown profile',()=>{
  assert.throws(()=>createSchoolProject('college-gym',{school:'',venue:'X'}),/school/i);
  assert.throws(()=>createSchoolProject('false',info),/template/i);
});
test('school row CSV maps exact school seat labels without inventing surveyed coordinates',()=>{
  const p=applySchoolRowPlan(createSchoolProject('college-gym',info),schoolExampleRowsCSV());
  const model=generateSeats(p);
  assert.equal(model.seatOrigin,'imported');
  assert.equal(model.seats.length,66);
  assert.equal(model.seats[0].uid,'HOME-A-1');
  assert.equal(model.seats.at(-1).uid,'VISITOR-C-10');
  assert.equal(p.school.status,'layout-provided');
  assert.match(p.school.notice,/approximations/i);
  const r=schoolReadiness(p,model);
  assert.equal(r.exactPositionsVerified,false);
  assert.match(r.blockers.join(' '),/estimated|approximations|modeled/i);
});
test('unique row and seat labels are required',()=>{
  const csv='section,row,seats,side\nA,1,3,east\nA,1,2,west\n';
  assert.throws(()=>parseSchoolRowsCSV(csv),/duplicate/i);
  assert.throws(()=>parseSchoolRowsCSV('section,row,seats,side\nA,1,4,wrong\n'),/Invalid side/);
});
test('oversized gym row and invalid seat pitch cannot be imported',()=>{
  assert.throws(()=>parseSchoolRowsCSV('section,row,seats,side\nA,1,8,west\nA,2,8,west\n') /* valid */ && schoolRowCoordinates(parseSchoolRowsCSV('section,row,seats,side\nA,1,250,west\n'),'youth-basketball'),/exceeds/);
  assert.throws(()=>parseSchoolRowsCSV('section,row,seats,side,seat_pitch_m\nA,1,5,west,0.1\n'),/Seat pitch/);
});
test('school row template maps to both sides of gym without overlap',()=>{
  const rows=parseSchoolRowsCSV('section,row,seats,side\nA,A,5,west\nA,B,5,west\nB,A,5,east\nB,B,5,east\n');
  const r=schoolRowCoordinates(rows,'nfhs-basketball');
  assert.equal(r.seats.length,20);
  assert.ok(r.seats[0].x<0&&r.seats.at(-1).x>0);
  assert.ok(r.seats.find(x=>x.id==='A-A-1').y<r.seats.find(x=>x.id==='A-B-1').y);
});
test('measured XYZ is kept as submitted, not automatically claimed independently verified',()=>{
  const project=createSchoolProject('college-gym',info);
  const csv='seat_id,section,row,seat,x_m,y_m,z_m\nG-A-1,G,A,1,3.5,2.1,4.5\nG-A-2,G,A,2,4,2.1,4.5\n';
  const p=applySchoolSurvey(project,csv);
  assert.equal(generateSeats(p).seats[0].y,2.1);
  assert.equal(schoolReadiness(p,generateSeats(p)).exactPositionsVerified,false);
});
test('invalid import fails atomically without mutating original project',()=>{
  const p=createSchoolProject('high-basketball',info),before=JSON.stringify(p);
  assert.throws(()=>applySchoolRowPlan(p,'bad'),/header|CSV/i);
  assert.equal(JSON.stringify(p),before);
});
test('standalone seat preview contains selectable map, optional 3D and explicit sales boundary',()=>{
  const p=applySchoolRowPlan(createSchoolProject('college-gym',info),schoolExampleRowsCSV());
  const html=buildSchoolViewerHTML(p);
  assert.match(html,/Seat-selection preview · no sales/);
  assert.match(html,/HOME-A-1/);
  assert.match(html,/2D seats/);
  assert.match(html,/3D stadium/);
  assert.match(html,/Human view/);
  assert.match(html,/no real-time inventory/i);
  assert.match(html,/jsdelivr.net/);
});
test('generated preview safely escapes untrusted venue names and JSON payload',()=>{
  const p=createSchoolProject('middle-basketball',{school:'<img src=x onerror=alert(1)>',venue:'</script><script>alert(1)</script>'});
  const html=buildSchoolViewerHTML(p);
  assert.ok(!html.includes('</script><script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.match(html,/\\u003c/);
});
test('school landing page exposes import and publish actions',()=>{
  const html=readFileSync(new URL('../school/index.html',import.meta.url),'utf8');
  for(const id of ['build','rowsCsv','surveyCsv','publish','canvas','schoolName','venueName'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/School Venue Studio/);
});
