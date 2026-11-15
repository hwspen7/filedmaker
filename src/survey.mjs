import { facingYaw } from './seatPresentation.mjs';
// Real-world seat-data ingestion and 2D registration. Pure functions with no DOM access.
// All finished coordinates are meters in the stadium model's X (lateral), Y (up), Z (longitudinal) frame.
export const MAX_IMPORT_SEATS = 150000;
const finite = (v, label, limit = 100000) => {
  const n = Number(v);
  if (v === '' || v === undefined || v === null || !Number.isFinite(n) || Math.abs(n) > limit) throw new Error(`Invalid ${label}.`);
  return n;
};
const clean = (v, max = 80) => String(v ?? '').trim().slice(0, max);
const unitFactor = unit => unit === 'ft' ? 0.3048 : 1;
export const EMPTY_SURVEY = Object.freeze({ mode: 'generated', venue: '', source: '', sourceUrl: '', inputUnit: 'm', yUnit: 'm', heightOffset: 0, seats: [], anchors: [], obstacles: [] });
export function createSurvey() { return JSON.parse(JSON.stringify(EMPTY_SURVEY)); }

export function parseCSV(raw, maxRows = MAX_IMPORT_SEATS) {
  if (typeof raw !== 'string' || raw.length > 32_000_000) throw new Error('Seat CSV is too large (maximum 32 MB).');
  const text = raw.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') {
      if (cell !== '') throw new Error('Unexpected quote in CSV.');
      quoted = true;
    } else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      row.push(cell); cell = '';
      if (row.some(x => x.trim())) rows.push(row);
      if (rows.length > maxRows + 1) throw new Error(`CSV exceeds ${maxRows.toLocaleString()} seats.`);
      row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else cell += ch;
  }
  if (quoted) throw new Error('Unterminated quoted CSV value.');
  row.push(cell); if (row.some(x => x.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('CSV needs a header and at least one seat.');
  const cols = rows.shift().map(s => s.trim().toLowerCase());
  if (new Set(cols).size !== cols.length) throw new Error('Duplicate CSV header.');
  return rows.map((values, idx) => {
    if (values.length !== cols.length) throw new Error(`CSV row ${idx + 2} has ${values.length} columns; expected ${cols.length}.`);
    return Object.fromEntries(cols.map((key, i) => [key, values[i]]));
  });
}

export function parseSeatCSV(csv) {
  const rows = parseCSV(csv);
  const required = (obj, keys, field) => {
    const key = keys.find(k => Object.hasOwn(obj, k));
    if (!key) throw new Error(`Missing CSV column: ${field}.`);
    return obj[key];
  };
  const ids = new Set();
  const seats = rows.map((r, i) => {
    const id = clean(required(r, ['seat_id','uid','id'], 'seat_id'), 100);
    if (!id) throw new Error(`Empty seat ID on row ${i + 2}.`);
    if (ids.has(id)) throw new Error(`Duplicate seat ID: ${id}`);
    ids.add(id);
    const section = clean(required(r, ['section','section_id'], 'section'));
    const rowValue = clean(required(r, ['row','row_number'], 'row'), 40);
    const number = clean(required(r, ['seat','seat_number'], 'seat'), 40);
    const x = finite(required(r, ['x','x_m','x_ft'], 'x'), 'X coordinate');
    const z = finite(required(r, ['z','z_m','z_ft'], 'z'), 'Z coordinate');
    const yRaw = r.y_m ?? r.y_ft ?? r.y ?? '';
    const y = yRaw === '' ? null : finite(yRaw, 'elevation', 1500);
    if (!section || !rowValue || !number) throw new Error(`Missing section, row, or seat on CSV row ${i + 2}.`);
    return { id, section, tier: clean(r.tier || r.deck || 'T1', 40), row: rowValue, number, x, y, z };
  });
  return seats;
}

export function validateSurvey(input = null) {
  const survey = { ...createSurvey(), ...(input || {}) };
  if (!['generated','imported'].includes(survey.mode)) throw new Error('Seat source must be generated or imported.');
  survey.venue = clean(survey.venue, 120); survey.source = clean(survey.source, 160);
  survey.sourceUrl = clean(survey.sourceUrl, 500);
  if (survey.sourceUrl && !/^https:\/\//i.test(survey.sourceUrl)) throw new Error('Seat source link must use HTTPS.');
  if (!['m','ft','drawing'].includes(survey.inputUnit)) throw new Error('Invalid horizontal coordinate units.');
  if (!['m','ft'].includes(survey.yUnit)) throw new Error('Invalid elevation units.');
  survey.heightOffset = finite(survey.heightOffset, 'elevation offset', 200);
  if (!Array.isArray(survey.seats) || survey.seats.length > MAX_IMPORT_SEATS) throw new Error('Imported seat data exceeds the maximum size.');
  const ids = new Set();
  survey.seats = survey.seats.map((s, i) => {
    if (!s || typeof s !== 'object') throw new Error(`Invalid imported seat ${i + 1}.`);
    const id = clean(s.id, 100), section = clean(s.section), tier = clean(s.tier || 'T1', 40);
    const row = clean(s.row, 40), number = clean(s.number, 40);
    if (!id || !section || !row || !number || ids.has(id)) throw new Error('Seat IDs must be unique and section, row and seat must be present.');
    ids.add(id);
    return { id, section, tier, row, number, x: finite(s.x, 'seat X'), y: s.y === null || s.y === '' ? null : finite(s.y, 'seat elevation', 1500), z: finite(s.z, 'seat Z') };
  });
  if (!Array.isArray(survey.anchors) || survey.anchors.length > 32) throw new Error('Use at most 32 survey control points.');
  survey.anchors = survey.anchors.map((a,i) => ({
    id: clean(a.id || `CP${i+1}`, 30),
    srcX: finite(a.srcX,'control point plan X'), srcZ: finite(a.srcZ,'control point plan Z'),
    dstX: finite(a.dstX,'control point stadium X'), dstZ: finite(a.dstZ,'control point stadium Z'),
  }));
  if (new Set(survey.anchors.map(a=>a.id)).size !== survey.anchors.length) throw new Error('Duplicate control point ID.');
  if (!Array.isArray(survey.obstacles) || survey.obstacles.length > 100) throw new Error('Use at most 100 surveyed obstacles.');
  survey.obstacles = survey.obstacles.map((o,i) => {
    if (!o || typeof o !== 'object') throw new Error('Invalid obstruction.');
    const obstacle = {
      id: clean(o.id || `O${i+1}`,30), type: clean(o.type || 'rail',30), source: clean(o.source || 'user-model',100),
      x: finite(o.x,'obstruction X'), y: finite(o.y,'obstruction Y'), z: finite(o.z,'obstruction Z'),
      width: finite(o.width,'obstruction width'), height: finite(o.height,'obstruction height'), depth: finite(o.depth,'obstruction depth'), yaw: finite(o.yaw || 0,'obstruction angle',360)
    };
    if (obstacle.width <= 0 || obstacle.height <= 0 || obstacle.depth <= 0 || Math.max(obstacle.width,obstacle.height,obstacle.depth)>200) throw new Error('Obstruction dimensions must be between 0 and 200 m.');
    return obstacle;
  });
  if (new Set(survey.obstacles.map(o=>o.id)).size !== survey.obstacles.length) throw new Error('Duplicate obstruction ID.');
  if (survey.photoCheck !== undefined && survey.photoCheck !== null) {
    const v=survey.photoCheck;
    if (!v || typeof v !== 'object') throw new Error('Invalid photo calibration record.');
    if (!Array.isArray(v.points) || v.points.length<3 || v.points.length>12 || !Number.isInteger(v.width) || !Number.isInteger(v.height) || v.width<100 || v.height<100) throw new Error('Photo calibration must include 3–12 points and image dimensions.');
    v.points=v.points.map(p=>({id:clean(p.id,30),x:finite(p.x,'photo landmark X',1),y:finite(p.y,'photo landmark Y',1)}));
    if (new Set(v.points.map(p=>p.id)).size!==v.points.length || v.points.some(p=>p.x<0||p.y<0)) throw new Error('Invalid photo landmark coordinates.');
    v.seatId=clean(v.seatId,100);
    for (const key of ['yaw','pitch','fov','rmsPx','maxErrorPx']) v[key]=finite(v[key],`photo ${key}`,100000);
  }
  if (survey.mode === 'imported' && !survey.seats.length) throw new Error('Import a seat CSV before using imported mode.');
  if (survey.mode === 'imported' && survey.inputUnit === 'drawing' && survey.anchors.length < 2) throw new Error('Drawing coordinates require at least two matched control points.');
  return survey;
}

export function fitPlanRegistration(anchors) {
  if (!Array.isArray(anchors) || anchors.length < 2) throw new Error('At least two matched landmark coordinates are required.');
  const n = anchors.length;
  const a = { x: 0, z: 0 }, b = { x: 0, z: 0 };
  for (const p of anchors) { a.x += finite(p.srcX,'source X'); a.z += finite(p.srcZ,'source Z'); b.x += finite(p.dstX,'target X'); b.z += finite(p.dstZ,'target Z'); }
  a.x /= n; a.z /= n; b.x /= n; b.z /= n;
  let dot = 0, cross = 0, denom = 0;
  for (const p of anchors) {
    const x = p.srcX-a.x, z = p.srcZ-a.z, X = p.dstX-b.x, Z = p.dstZ-b.z;
    dot += x*X+z*Z; cross += x*Z-z*X; denom += x*x+z*z;
  }
  if (denom < 1e-9) throw new Error('Control points overlap in the input plan.');
  const scale = Math.hypot(dot,cross)/denom;
  if (!(scale > 1e-9) || scale > 10000) throw new Error('Invalid control point calibration scale.');
  const angle = Math.atan2(cross,dot), c = Math.cos(angle), s = Math.sin(angle);
  const tx=b.x-scale*(c*a.x-s*a.z), tz=b.z-scale*(s*a.x+c*a.z);
  const transform = {scale,angle,tx,tz};
  const errors=anchors.map(p=>{const v=applyRegistration(transform,p.srcX,p.srcZ);return Math.hypot(v.x-p.dstX,v.z-p.dstZ);});
  return {...transform,count:n,rms:Math.hypot(...errors)/Math.sqrt(n),maxError:Math.max(...errors),errors};
}
export function applyRegistration(t,x,z) {const c=Math.cos(t.angle),s=Math.sin(t.angle);return {x:t.scale*(c*x-s*z)+t.tx,z:t.scale*(s*x+c*z)+t.tz};}

export function seatRegistration(survey) {
  const fit = survey.anchors.length >= 2 ? fitPlanRegistration(survey.anchors) : null;
  if (!fit && survey.inputUnit === 'drawing') throw new Error('Drawing units require a calibrated two-point alignment.');
  return fit || {scale:unitFactor(survey.inputUnit),angle:0,tx:0,tz:0,count:0,rms:null,maxError:null,errors:[]};
}

export function importedSeats(survey, project) {
  if (survey.mode !== 'imported') return null;
  const registration=seatRegistration(survey), tierLookup = new Map(project.tiers.map((t,i)=>[t.id.toUpperCase(),i]));
  const yIsEstimated=project.ticketing?.coordinates==='estimated';
  const seats=survey.seats.map(s=>{
    const p=applyRegistration(registration,s.x,s.z);
    const angle=((Math.atan2(p.z,p.x)*180/Math.PI)+360)%360;
    const index=Math.max(0,project.sections.findIndex(sec=>angle>=sec.start && angle<sec.end));
    const tier=tierLookup.get(s.tier.toUpperCase())??0;
    const y=(s.y??0)*unitFactor(survey.yUnit)+survey.heightOffset;
    return {uid:s.id,sectionId:s.section,sectionIndex:index,tier,row:s.row,number:s.number,
      x:p.x,y,z:p.z,yaw:Math.atan2(-p.x,-p.z),dataOrigin:'imported',elevationKnown:s.y!==null&&!yIsEstimated};
  });
  // Infer local seat facing from row tangent, not from radial angle to
  // the global origin (that misorients seats in long rectangular stands).
  const rows=new Map();
  for(const seat of seats){const key=JSON.stringify([seat.sectionId,seat.tier,seat.row]);
    if(!rows.has(key)) rows.set(key,[]);rows.get(key).push(seat);}
  for(const row of rows.values()){
    row.sort((a,b)=>{
      const n=Number(a.number),m=Number(b.number);
      return Number.isFinite(n)&&Number.isFinite(m)?n-m:String(a.number).localeCompare(String(b.number),undefined,{numeric:true});
    });
    for(let i=0;i<row.length;i++){
      const prev=row[Math.max(0,i-1)],next=row[Math.min(row.length-1,i+1)];
      row[i].yaw=facingYaw(row[i].x,row[i].z,prev===row[i]?null:prev,next===row[i]?null:next);
      // For the end seat in a two-seat row the tangent still comes from
      // the other seat. No fabricated nearby positions are introduced.
      if(row.length>1 && (i===0||i===row.length-1)) row[i].yaw=facingYaw(row[i].x,row[i].z,row[0],row[row.length-1]);
    }
  }
  return {seats,registration,elevationCount:yIsEstimated?0:survey.seats.filter(s=>s.y!==null).length};
}

// Exact line-of-sight against user-modeled oriented rectangular obstructions.
function localObstacle(o,p) {
  const a=o.yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-o.x,z=p.z-o.z;
  return {x:c*x-s*z,y:p.y-o.y,z:s*x+c*z};
}
export function intersectObstruction(eye,target,obstacle) {
  const from=localObstacle(obstacle,eye),to=localObstacle(obstacle,target);
  const min={x:-obstacle.width/2,y:-obstacle.height/2,z:-obstacle.depth/2};
  const max={x:obstacle.width/2,y:obstacle.height/2,z:obstacle.depth/2};
  let near=0,far=1;
  for(const k of ['x','y','z']){
    const v=to[k]-from[k];
    if(Math.abs(v)<1e-12){if(from[k]<min[k]||from[k]>max[k])return null;continue;}
    let a=(min[k]-from[k])/v,b=(max[k]-from[k])/v;
    if(a>b)[a,b]=[b,a];
    near=Math.max(near,a);far=Math.min(far,b);
    if(near>far)return null;
  }
  if(near<=1e-8||near>=1-1e-8)return null;
  return {fraction:near,distance:near*Math.hypot(target.x-eye.x,target.y-eye.y,target.z-eye.z),obstacleId:obstacle.id,type:obstacle.type};
}
export function obstructionReport(eye,target,obstacles=[]) {
  const hits=obstacles.map(o=>intersectObstruction(eye,target,o)).filter(Boolean).sort((a,b)=>a.distance-b.distance);
  return {blocked:hits.length>0,nearest:hits[0]??null,hitCount:hits.length,scope:'Modeled rectangular obstructions only; unmodeled rails, spectators, geometry and sightlines are unknown.'};
}

export function demoSurveyRows() {
  // Fictional coordinate fixture. Never assign real ticket section labels or claim these are Ohio Stadium seats.
  const lines=['seat_id,section,tier,row,seat,x,y,z'];
  for(let r=1;r<=3;r++)for(let s=1;s<=8;s++)lines.push(`DEMO-A-${r}-${s},DEMO-A,T1,${r},${s},${(-31.5-(r-1)*0.9).toFixed(2)},${(2+(r-1)*0.34).toFixed(2)},${(-3.2+(s-1)*0.8).toFixed(2)}`);
  return lines.join('\n');
}
