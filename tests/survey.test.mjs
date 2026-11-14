import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProject,generateSeats,validateProject,CURRENT_SCHEMA,SURFACES} from '../src/model.mjs';
import {parseCSV,parseSeatCSV,fitPlanRegistration,applyRegistration,validateSurvey,obstructionReport,intersectObstruction,importedSeats,demoSurveyRows} from '../src/survey.mjs';
import {nearbySeat,eyePosition,viewingTarget} from '../src/view.mjs';

test('real data project schema supports migration without changing synthetic seats',()=>{
  const old=createProject();old.schemaVersion=3;delete old.survey;
  const migrated=validateProject(old);
  assert.equal(CURRENT_SCHEMA,5);assert.equal(migrated.survey.mode,'generated');
  assert.ok(generateSeats(old).capacity>10000);
});
test('CSV importer reads UTF-8 BOM, CRLF, quoted commas and numeric elevations',()=>{
  const csv='\ufeffseat_id,section,tier,row,seat,x,y,z\r\n"S,01",A,T1,1,2,-33,1.23,5\r\nR2,A,T1,1,3,-33,1.2,6\r\n';
  const rows=parseSeatCSV(csv);assert.equal(rows.length,2);assert.equal(rows[0].id,'S,01');assert.equal(rows[0].y,1.23);
  assert.equal(rows[0].x,-33);
});
test('CSV format rejects duplicates, malformed records and missing columns',()=>{
  assert.throws(()=>parseSeatCSV('seat_id,section,row,seat,x,z\na,S,1,1,1,2\na,S,1,2,1,2'),/Duplicate seat ID/);
  assert.throws(()=>parseSeatCSV('seat_id,section,row,seat,x\na,S,1,1,2'),/Missing CSV column: z/);
  assert.throws(()=>parseSeatCSV('seat_id,section,row,seat,x,z\na,S,1,1,NaN,2'),/Invalid X/);
  assert.throws(()=>parseCSV('a,b\n"unterminated'),/Unterminated/);
  assert.throws(()=>parseCSV('a,a\nx,y'),/Duplicate CSV header/);
  assert.throws(()=>parseCSV('a,b\nx,y,z'),/columns/);
});
test('example CSV is self-consistent and matches local fictional fixture',()=>{
  const external=parseSeatCSV(readFileSync(new URL('../examples/fictional-survey-seats.csv',import.meta.url),'utf8'));
  const generated=parseSeatCSV(demoSurveyRows());assert.deepEqual(external,generated);assert.equal(external.length,24);
});
test('two point similarity solves scale rotation and translation exactly',()=>{
  const tx={scale:.3048,angle:Math.PI/3,tx:25,tz:-10};
  const src=[{x:0,z:0},{x:100,z:0},{x:0,z:70},{x:-10,z:8}];
  const anchors=src.map((v,i)=>({id:`p${i}`,srcX:v.x,srcZ:v.z,...Object.fromEntries(Object.entries(applyRegistration(tx,v.x,v.z)).map(([k,val])=>[k==='x'?'dstX':'dstZ',val]))}));
  const fit=fitPlanRegistration(anchors);assert.ok(Math.abs(fit.angle-tx.angle)<1e-9);assert.ok(Math.abs(fit.scale-tx.scale)<1e-9);
  assert.ok(fit.rms<1e-10);
});
test('registration residual shows independent inaccurate controls',()=>{
  const controls=[{srcX:0,srcZ:0,dstX:0,dstZ:0},{srcX:100,srcZ:0,dstX:100,dstZ:0},{srcX:0,srcZ:100,dstX:0,dstZ:110}];
  const fit=fitPlanRegistration(controls);assert.ok(fit.rms>1);assert.ok(fit.maxError>=fit.rms);
});
test('calibration refuses coincident points and zero spread',()=>{
  assert.throws(()=>fitPlanRegistration([{srcX:1,srcZ:2,dstX:0,dstZ:0}]),/At least two/);
  assert.throws(()=>fitPlanRegistration([{srcX:1,srcZ:2,dstX:0,dstZ:0},{srcX:1,srcZ:2,dstX:4,dstZ:5}]),/overlap/);
});
test('imported seat mode uses authoritative imported coordinates and hides invented capacity',()=>{
  const p=createProject('nfl');p.survey.seats=parseSeatCSV(demoSurveyRows());p.survey.mode='imported';
  const m=generateSeats(p);assert.equal(m.seatOrigin,'imported');assert.equal(m.capacity,24);assert.equal(m.groups.length,0);
  assert.equal(m.seats[0].x,-31.5);assert.equal(m.seats[0].y,2);assert.equal(m.elevationCount,24);
  assert.equal(m.seats[0].uid,'DEMO-A-1-1');assert.ok(m.seats.every(s=>s.dataOrigin==='imported'));
});
test('feet conversion is physical and missing elevation does not pretend to be a surveyed height',()=>{
  const p=createProject();p.survey.mode='imported';p.survey.inputUnit='ft';p.survey.yUnit='ft';p.survey.seats=[{id:'a',section:'13A',tier:'T1',row:'1',number:'1',x:100,y:10,z:0},{id:'b',section:'13A',tier:'T1',row:'1',number:'2',x:100,y:null,z:4}];
  const m=generateSeats(p);assert.equal(m.seats[0].x,30.48);assert.equal(m.seats[0].y,3.048);assert.equal(m.seats[1].elevationKnown,false);assert.equal(m.elevationCount,1);
});
test('unscaled drawing coordinates require two matching landmarks',()=>{
  const p=createProject();p.survey.mode='imported';p.survey.inputUnit='drawing';p.survey.seats=parseSeatCSV(demoSurveyRows());
  assert.throws(()=>validateProject(p),/at least two/);
  p.survey.anchors=[{id:'a',srcX:0,srcZ:0,dstX:1,dstZ:2},{id:'b',srcX:10,srcZ:0,dstX:21,dstZ:2}];
  const model=generateSeats(p);assert.equal(model.registration.scale,2);assert.equal(model.seats[0].x,-62);
});
test('invalid reference urls and obstacle dimensions cannot be persisted',()=>{
  const s=validateSurvey();s.sourceUrl='javascript:alert(1)';assert.throws(()=>validateSurvey(s),/HTTPS/);
  delete s.sourceUrl;s.obstacles=[{id:'x',x:0,y:1,z:0,width:0,height:1,depth:.5,yaw:0,type:'rail'}];
  assert.throws(()=>validateSurvey(s),/dimensions/);
});
test('obstruction ray detects exact physical intersection and nonintersection',()=>{
  const eye={x:0,y:1.5,z:0},target={x:0,y:1.5,z:10};
  const rail={id:'bar',type:'rail',x:0,y:1.5,z:5,width:2,height:1,depth:.25,yaw:0};
  const hit=intersectObstruction(eye,target,rail);assert.equal(hit.obstacleId,'bar');assert.ok(hit.distance>4&&hit.distance<5);
  assert.equal(obstructionReport(eye,target,[rail]).blocked,true);
  assert.equal(obstructionReport(eye,target,[{...rail,x:10}]).blocked,false);
  assert.ok(intersectObstruction(eye,target,{...rail,yaw:90})?.distance>0);
});
test('rotated obstruction hit test matches actual mesh yaw and is not a false positive',()=>{
  const o={id:'c',type:'rail',x:0,y:1.5,z:5,width:10,height:1,depth:.1,yaw:90};
  const eye={x:4,y:1.5,z:0};const target={x:4,y:1.5,z:10};
  assert.equal(intersectObstruction(eye,target,o),null,'after 90deg rotation, local x width maps along world Z not world X');
});
test('imported seats use numeric row navigation even though CSV labels are strings',()=>{
  const p=createProject();p.survey.seats=parseSeatCSV(demoSurveyRows());p.survey.mode='imported';const m=generateSeats(p),s=m.seats[0];
  assert.equal(nearbySeat(m,s,'right').number,'2');assert.equal(nearbySeat(m,s,'back').row,'2');assert.equal(nearbySeat(m,s,'front'),null);
});
test('reviewer has explicit provenance and no false survey verification in UI',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(html,/Real data/);assert.match(html,/calibrationPhotoInput/);assert.match(app,/unverified/);
  assert.match(app,/seatCsvUpload/);assert.match(app,/obstructionReport/);
});
