// School-first venue production. All generated XYZ coordinates are estimates.
// No school identity, accessibility designation or ticket availability is inferred.
import { createProject, validateProject, makeSections, SURFACES, generateSeats } from './model.mjs';
import { parseCSV, parseSeatCSV } from './survey.mjs';
import { enableSeatFirst } from './seatFirst.mjs';

const FT = 0.3048;
export const SCHOOL_PROFILES = Object.freeze({
  'college-basketball': { label:'NCAA basketball arena', level:'college', sport:'basketball', surface:'ncaa', layout:'arena', sections:12, rows:18 },
  'college-gym': { label:'NCAA small gymnasium', level:'college', sport:'basketball', surface:'ncaa', layout:'two-sides', sections:8, rows:10 },
  'college-football': { label:'NCAA football stadium', level:'college', sport:'football', surface:'ncaa-football', layout:'stadium', sections:20, rows:24 },
  'high-basketball': { label:'High-school gymnasium', level:'high', sport:'basketball', surface:'nfhs-basketball', layout:'two-sides', sections:8, rows:9 },
  'high-football': { label:'High-school football bleachers', level:'high', sport:'football', surface:'nfhs-football', layout:'two-sides', sections:8, rows:13 },
  'middle-basketball': { label:'Middle-school gymnasium', level:'middle', sport:'basketball', surface:'youth-basketball', layout:'two-sides', sections:8, rows:6 },
});
const clean = (v,max=90) => String(v??'').trim().slice(0,max);
const numeric = (v,label,min,max) => {
  const n=Number(v);if(!Number.isFinite(n)||n<min||n>max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
};

export function createSchoolProject(key, data={}) {
  const profile=SCHOOL_PROFILES[key];
  if(!profile) throw new Error('Unknown school venue template.');
  const school=clean(data.school,120);
  const venue=clean(data.venue,120);
  if(!school||!venue) throw new Error('Enter the school name and venue name.');
  const project=createProject(profile.surface);
  project.title=venue;
  project.city=clean(data.city,80);
  project.country=clean(data.country||'United States',70);
  project.shape=profile.sport==='basketball'?7.2:6.2;
  project.sections=makeSections(profile.sections);
  project.seatPitch=profile.sport==='basketball'?0.53:0.52;
  project.aisleWidth=1.0;
  project.roof=profile.sport==='basketball';
  if(profile.layout==='two-sides') {
    // The default preview is only a stand-placement draft, not an assertion
    // about the actual school's stands, row count or seating allocation.
    project.sections.forEach((s,i)=> {s.enabled= i===0||i===profile.sections/2;});
  }
  if(profile.layout==='arena') {
    project.tiers=[
      {id:'T1',label:'Lower seating',rows:profile.rows,depth:.82,rise:.29,offset:3.1,height:.62,gap:2.5,heightGap:2.7},
      {id:'T2',label:'Upper seating (draft)',rows:10,depth:.83,rise:.37,offset:0,height:0,gap:0,heightGap:0},
    ];
  } else if(profile.layout==='two-sides') {
    project.tiers=[{id:'T1',label:'Bleachers / lower seating',rows:profile.rows,depth:.80,rise:.28,offset:profile.sport==='basketball'?2.4:4.6,height:.43,gap:0,heightGap:0}];
  } else {
    project.tiers=[
      {id:'T1',label:'Lower stands',rows:profile.rows,depth:.85,rise:.34,offset:6,height:1.2,gap:3,heightGap:2},
      {id:'T2',label:'Upper stands (draft)',rows:12,depth:.86,rise:.41,offset:0,height:0,gap:0,heightGap:0},
    ];
  }
  project.school = {
    school, venue, level:profile.level, sport:profile.sport, profile:key,
    status:'draft', seatCoordinateMethod:'parametric-estimate',
    source:clean(data.source,300), updatedAt:'',
    notice:'Venue geometry and seat positions are illustrative until verified against school-supplied records.',
  };
  project.survey.venue=venue;
  project.survey.source='School configuration entered by an operator; geometry not surveyed.';
  return enableSeatFirst(project);
}

// Schools often own row-by-row counts but not survey coordinates.
// Accept that roster directly, keeping the identities while estimating XYZ.
export function parseSchoolRowsCSV(csv) {
  const records=parseCSV(csv, 12000), ids=new Set();
  if(records.length>12000) throw new Error('Too many rows.');
  return records.map((r,index)=>{
    for(const required of ['section','row','seats','side']) if(!Object.hasOwn(r,required)) throw new Error(`Missing column: ${required}.`);
    const section=clean(r.section,40),row=clean(r.row,40);
    if(!section||!row) throw new Error(`Missing section or row at CSV line ${index+2}.`);
    const key=`${section.toLowerCase()}|${row.toLowerCase()}`;
    if(ids.has(key)) throw new Error(`Duplicate section and row: ${section} ${row}.`);
    ids.add(key);
    const side=clean(r.side,20).toLowerCase();
    if(!['east','west','north','south'].includes(side)) throw new Error(`Invalid side '${side}' on CSV line ${index+2}.`);
    const tier=clean(r.tier||'T1',20);
    if(!/^T[1-4]$/.test(tier)) throw new Error(`Tier must be T1–T4 at CSV line ${index+2}.`);
    const seats=numeric(r.seats,'Seats per row',1,250);
    if(!Number.isInteger(seats)) throw new Error('Seat counts must be integers.');
    const pitch=numeric(r.seat_pitch_m===''||r.seat_pitch_m===undefined?0.53:r.seat_pitch_m,'Seat pitch',0.40,1.1);
    const depth=numeric(r.row_depth_m===''||r.row_depth_m===undefined?0.82:r.row_depth_m,'Row depth',0.65,1.8);
    const rise=numeric(r.row_rise_m===''||r.row_rise_m===undefined?0.30:r.row_rise_m,'Row rise',0.12,0.75);
    const center=numeric(r.center_offset_m===''||r.center_offset_m===undefined?0:r.center_offset_m,'Center offset',-100,100);
    const start=numeric(r.seat_start===''||r.seat_start===undefined?1:r.seat_start,'First seat number',1,9999);
    if(!Number.isInteger(start)) throw new Error('First seat number must be an integer.');
    const seatType=clean(r.seat_type||'standard',40);
    return {section,row,seats,side,tier,pitch,depth,rise,center,start,seatType};
  });
}

export function schoolRowCoordinates(rows, surfaceKey) {
  if(!(surfaceKey in SURFACES)) throw new Error('Unsupported school surface.');
  const surface=SURFACES[surfaceKey];
  const seatTotal=rows.reduce((sum,r)=>sum+r.seats,0);
  if(seatTotal>40000) throw new Error('School row CSV exceeds 40,000 seats; use survey CSV for large venues.');
  const ordering=new Map(),seats=[],types={};
  for(const r of rows){
    const group=`${r.section}|${r.tier}`;
    const order=ordering.get(group)||0;ordering.set(group,order+1);
    const along=r.side==='east'||r.side==='west'?'z':'x';
    const available=along==='z'?surface.length+12:surface.width+12;
    if(r.seats*r.pitch > available) throw new Error(`Row ${r.section} ${r.row} exceeds the ${r.side} stand's plausible width; split into sections or correct the pitch.`);
    if(Math.abs(r.center)+r.seats*r.pitch/2>available/2+0.01) throw new Error(`Row ${r.section} ${r.row} extends outside the modeled stand.`);
    const sign=r.side==='east'||r.side==='south'?1:-1;
    const base=along==='z'?surface.width/2:surface.length/2;
    const cross=sign*(base+2.5+order*r.depth);
    const y=.44+order*r.rise;
    for(let i=0;i<r.seats;i++) {
      const seq=r.start+i, offset=(i-(r.seats-1)/2)*r.pitch+r.center;
      const x=along==='z'?cross:offset, z=along==='z'?offset:cross;
      const id=`${r.section}-${r.row}-${seq}`;
      seats.push({id,section:r.section,tier:r.tier,row:r.row,number:String(seq),x:Number(x.toFixed(4)),y:Number(y.toFixed(4)),z:Number(z.toFixed(4))});
      types[id]=r.seatType;
    }
  }
  return {seats,types,source:'row-layout/estimated-coordinates',measuredSeats:0};
}

export function applySchoolRowPlan(input, csv) {
  const project=validateProject(input);
  const rows=parseSchoolRowsCSV(csv);
  const outcome=schoolRowCoordinates(rows,project.surface);
  project.survey={...project.survey,mode:'imported',inputUnit:'m',yUnit:'m',seats:outcome.seats,anchors:[],
    source:'School-supplied row and seat identities; XYZ positions procedurally estimated (NOT surveyed).'};
  project.ticketing={...(project.ticketing||{}),inventorySource:'School-provided row counts',inventoryCount:outcome.seats.length,inventoryMode:'file-import',coordinates:'estimated'};
  project.school={...(project.school||{}),status:'layout-provided',seatCoordinateMethod:'estimated-from-row-counts',rowRecords:rows.length,
    seatTypes:outcome.types,notice:'The row/seat identifiers come from the imported school roster; elevations, offsets and seat sightlines are approximations.'};
  return validateProject(project);
}

export function applySchoolSurvey(input,csv,source='School-provided measured seat coordinates') {
  const project=validateProject(input);
  const seats=parseSeatCSV(csv);
  project.survey={...project.survey,mode:'imported',inputUnit:'m',yUnit:'m',seats,anchors:[],source:clean(source,160)};
  project.ticketing={...(project.ticketing||{}),inventorySource:source,inventoryCount:seats.length,inventoryMode:'file-import',coordinates:'supplied-unverified'};
  project.school={...(project.school||{}),status:'survey-imported',seatCoordinateMethod:'supplied-coordinates/unverified',
    notice:'Coordinates are supplied by the operator but have not been independently validated.'};
  return validateProject(project);
}

export function schoolReadiness(project,model=null) {
  const s=project.school||{},seats=model?.seats||[],known=seats.filter(v=>v.elevationKnown!==false).length;
  return {school:s.school||'Unspecified',venue:s.venue||project.title,
    seatCount:seats.length,fromProvidedRoster:project.survey.mode==='imported',
    exactPositionsVerified:false,schoolReportedElevations:project.survey.mode==='imported' && s.seatCoordinateMethod==='supplied-coordinates/unverified'?known:0,
    sourceMethod:s.seatCoordinateMethod||'parametric-estimate',
    blockers:[
      ...(!s.school?['School identity is missing.']:[]),
      ...(project.survey.mode!=='imported'?['No school-provided seat inventory imported.']:[]),
      ...(project.survey.mode==='imported'&&s.seatCoordinateMethod==='estimated-from-row-counts'?['3D seat coordinates are modeled estimates, not survey measurements.']:[]),
      'No live ticket inventory or payment integration. Preview is not a booking system.',
      'Sightlines and accessibility must be reviewed by the school before publication.'
    ]};
}

export function schoolExampleRowsCSV() {
  return 'section,row,seats,side,tier,seat_pitch_m,center_offset_m,seat_type\n'
    +'HOME,A,12,west,T1,0.53,0,bleacher\nHOME,B,12,west,T1,0.53,0,bleacher\nHOME,C,12,west,T1,0.53,0,bleacher\nVISITOR,A,10,east,T1,0.53,0,bleacher\nVISITOR,B,10,east,T1,0.53,0,bleacher\nVISITOR,C,10,east,T1,0.53,0,bleacher\n';
}
