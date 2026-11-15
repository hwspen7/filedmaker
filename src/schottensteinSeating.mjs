import {
  SCHOTTENSTEIN_CHART_LABELS, SCHOTTENSTEIN_DIAGRAM_EDGE, SCHOTTENSTEIN_SECTION_CONTOURS,
} from './schottensteinChartContours.mjs';
import { OSU_FACTS } from './osuFacts.mjs';

// The guide endpoints orient the rows. The traced chart contours clip them.
export const SCHOTTENSTEIN_CHART_URL =
  'https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites/ohiostatebuckeyes.com/documents/2023/7/12/Mens-basketball-2023-diagram.jpeg?timestamp=20230823042629';

const horizontal = (id, left, right, front, back) =>
  [id, left, front, right, front, left, back, right, back];
const vertical = (id, upper, lower, front, back) =>
  [id, front, upper, front, lower, back, upper, back, lower];
const strip = (front, back, ranges) => ranges.map(([id, left, right]) =>
  horizontal(id, left, right, front, back));

const lower = [
  [101, 402, 305, 425, 305, 367, 260, 425, 235],
  ...strip(327, 218, [[104,438,503], [105,513,577], [106,586,651], [107,660,725]]),
  [110, 737,305, 761,305, 737,235, 794,260],
  [111, 757,344, 850,344, 791,268, 848,310],
  vertical(114, 354, 435, 710, 845),
  [117, 756,443, 851,443, 790,513, 851,475],
  [118, 737,480, 758,480, 737,555, 797,525],
  ...strip(459, 555, [[124,438,503], [123,513,577], [122,586,651], [121,660,725]]),
  [127, 402,481, 426,481, 365,525, 426,555],
  [128, 310,443, 405,443, 316,475, 373,514],
  vertical(131, 354, 435, 454, 319),
  [134, 310,344, 406,344, 318,310, 365,269],
];

const club = [
  [201,359,235,383,210,315,202,359,179],
  [203,394,219,430,211,382,173,430,166],
  ...strip(210, 166, [[204,438,503], [205,513,577], [206,586,651], [207,660,725]]),
  [208,733,211,771,219,733,166,783,173],
  [210,782,210,806,236,802,179,845,201],
  [211,808,239,833,272,852,210,877,263],
  [213,839,290,857,340,892,271,910,340],
  vertical(214, 354, 435, 866, 910),
  [215,857,447,839,497,910,447,892,515],
  [217,833,514,808,548,877,521,852,578],
  [218,804,550,778,576,845,588,802,609],
  [220,770,575,733,577,783,620,733,622],
  ...strip(575, 622, [[224,438,503], [223,513,577], [222,586,651], [221,660,725]]),
  [225,430,577,394,575,430,622,382,620],
  [227,384,576,357,548,360,609,317,587],
  [228,354,546,330,513,309,578,282,521],
  [230,324,496,305,447,269,515,253,447],
  vertical(231, 354, 435, 298, 252),
  [232,305,340,324,291,253,340,269,271],
  [234,330,273,354,240,282,265,309,210],
];

const upper = [
  [301,288,215,313,188,234,146,291,101],
  [302,320,183,350,173,298,99,351,77],
  [303,358,170,430,158,358,76,430,59],
  ...strip(155, 59, [[304,438,503], [305,513,577], [306,586,651], [307,660,725]]),
  [308,733,158,767,170,733,59,805,76],
  [309,774,173,805,186,812,78,865,99],
  [310,811,192,840,215,872,103,927,145],
  [311,846,221,872,249,933,151,975,209],
  [312,877,256,899,294,979,216,1003,264],
  [313,903,301,920,345,1006,272,1017,345],
  vertical(314, 354, 435, 920, 1017),
  [315,920,443,903,489,1017,443,1007,517],
  [316,899,495,877,533,1003,525,979,572],
  [317,871,540,846,569,975,579,933,636],
  [318,840,575,811,598,927,642,872,685],
  [319,805,604,774,618,865,690,812,711],
  [320,767,621,733,629,805,713,733,728],
  ...strip(631, 693, [[324,438,503], [323,513,577], [322,586,651], [321,660,725]]),
  [325,430,629,395,620,430,695,366,695],
  [326,387,617,355,604,358,693,301,666],
  [327,349,599,322,576,294,662,239,644],
  [328,317,570,290,541,232,637,190,579],
  [329,285,535,265,497,186,573,160,525],
  [330,261,490,245,443,156,518,146,443],
  vertical(331, 354, 435, 241, 146),
  [332,245,345,261,300,146,345,157,272],
  [333,265,294,285,255,161,264,185,216],
  [334,290,249,283,220,188,209,228,151],
];

const letterRows = letters => [...letters];
const rowsAtoU=letterRows('ABCDEFGHIJKLMNOPQRSTU');
const accessibleTerrace=new Set([304,307,314,331]);
const terraceEnds=new Map([[321,17],[322,13],[324,14],[325,14],[326,20]]);
const clubWithPublishedCounts = new Set(['204','205','206','207','221','222','223','224']);
// Published row labels from the section pages linked below. The slots keep
// the documented wheelchair landings and press-side breaks between rows open.
const rowDetails = new Map([
  ...['104','107','121','122','123','124'].map(id=>[id,{labels:['AA',...rowsAtoU]}]),
  ...['105','106','111','117','128','134'].map(id=>[id,{labels:rowsAtoU}]),
  ...['101','110','127'].map(id=>[id,{labels:rowsAtoU.slice(3,19)}]),
  ['118',{labels:rowsAtoU.slice(2)}],
  ['114',{labels:[...rowsAtoU.slice(0,10).map(c=>c+c),...rowsAtoU.slice(0,19)]}],
  ['131',{labels:[...rowsAtoU.slice(0,8).map(c=>c+c),...rowsAtoU.slice(0,19)]}],
  ...club.map(([id])=>[String(id),{labels:rowsAtoU.slice(0,10)}]),
  ...upper.filter(([id])=>id!==323).map(([id])=>[
    String(id),accessibleTerrace.has(id)
      ?{labels:['A',...rowsAtoU.slice(7)],slots:[0,...rowsAtoU.slice(7).map((_,i)=>i+7)]}
      :{labels:rowsAtoU.slice(0,terraceEnds.get(id)??rowsAtoU.length)}
  ]),
  ['323', {labels:letterRows('ABFGHIJKLMN'), slots:[0,1,5,6,7,8,9,10,11,12,13]}],
]);
const referenceSite = 'https://www.rateyourseats.com/schottenstein-center/seating/sections/';
export const SCHOTTENSTEIN_REFERENCE_VIEWS = Object.freeze([
  {section:'105', row:'D', label:'Lower sideline', source:referenceSite+'105'},
  {section:'114', row:'P', label:'Behind the basket', source:referenceSite+'114'},
  {section:'206', row:'H', label:'Club sideline', source:referenceSite+'206'},
  {section:'323', row:'M', label:'Upper sideline', source:referenceSite+'323'},
  {section:'302', row:'D', label:'Upper corner', source:'https://seatgeek.com/venues/value-city-arena-at-schottenstein-center/seating-chart'},
]);
export const SCHOTTENSTEIN_COURT_SOURCE = 'https://ohiostatebuckeyes.com/news/2025/10/30/mens-basketball-new-season-and-new-look-at-the-schottenstein-center';
export const SCHOTTENSTEIN_BOARD_SOURCE = 'https://ohiostatebuckeyes.com/news/2026/7/17/mens-basketball-schottenstein-center-to-feature-video-board-enhancements-this-season';

// Calibrate on the playing area inside the colored apron on the 1024px
// chart. The right-hand end of the drawing is negative Z.
const toWorld = (z, x) => ({ x: (x - 394.5) * 15.24 / 103, z: (582 - z) * 28.6512 / 194 });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
const unpack = pixels => Array.from({length:pixels.length/2},(_,i)=>toWorld(pixels[i*2],pixels[i*2+1]));
const labels = new Map(SCHOTTENSTEIN_CHART_LABELS.map(([id,x,y])=>[id,toWorld(x,y)]));
export const schottensteinDiagramEdge=unpack(SCHOTTENSTEIN_DIAGRAM_EDGE);
const chartRegions=[
  {kind:'band',label:'Band Area',sectionId:'114',outline:unpack([764,401,808,401,808,432,764,432])},
  {kind:'press',label:'Press Box',sectionId:'323',outline:unpack([439,697,706,695,733,727,439,727])},
  {kind:'accessible',label:'Accessible Platform',sectionId:'105',outline:unpack([513,217,577,217,577,229,513,229])},
];

export function polygonSpans(outlines,depth) {
  const spans=[];
  for(const points of outlines){
    const crossings=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      if((a.x>depth)===(b.x>depth))continue;
      crossings.push(a.z+(b.z-a.z)*(depth-a.x)/(b.x-a.x));
    }
    crossings.sort((a,b)=>a-b);
    for(let i=0;i+1<crossings.length;i+=2){
      if(crossings[i+1]-crossings[i]>.01)spans.push([crossings[i],crossings[i+1]]);
    }
  }
  return spans.sort((a,b)=>b[1]-a[1]);
}

const blocks = [lower,club,upper].flatMap((level,tier)=>
  level.map(([id,...p])=>{
    const corners=unpack(p);
    const [frontLeft,frontRight,backLeft,backRight]=corners;
    const dx=frontRight.x-frontLeft.x+backRight.x-backLeft.x;
    const dz=frontRight.z-frontLeft.z+backRight.z-backLeft.z;
    const magnitude=Math.hypot(dx,dz);
    const center=lerp(frontLeft,frontRight,.5);
    let nx=-dz/magnitude,nz=dx/magnitude;
    if(nx*center.x+nz*center.z>0){nx=-nx;nz=-nz;}
    const outlines=SCHOTTENSTEIN_SECTION_CONTOURS[id].map(unpack);
    // Local X runs outward, local Z runs to a spectator's right.
    const project=({x,z})=>({x:-nx*x-nz*z,z:-nz*x+nx*z});
    const projected=outlines.map(points=>points.map(project));
    const depths=projected.flat().map(p=>p.x);
    const near=Math.min(...depths), depth=Math.max(...depths)-near;
    const sectionId=String(id),details=rowDetails.get(sectionId);
    const depthRows=details?.slots ? details.slots.at(-1)+1
      : details?.labels.length ?? (clubWithPublishedCounts.has(sectionId)?10:Math.max(2,Math.round(depth/[.82,.88,.82][tier])));
    const rows=details?.labels.length??depthRows;
    const treadDepth=depth/depthRows;
    const rise=tier===0?(treadDepth<.74?.24:.31):tier===1?.34:Math.min(.45,6.85/(depthRows-1));
    const frontHeight=tier===0?(id===114||id===131?.42:.64):tier===1?8.05:14.65;
    const reserved=chartRegions.filter(region=>region.sectionId===sectionId).map(region=>region.outline.map(project));
    return {id:sectionId,tier,rows,depthRows,corners,outlines,projected,reserved,nx,nz,near,
      treadDepth,rise,frontHeight,details,labelPoint:labels.get(id)};
  })
);
const byId=new Map(blocks.map(block=>[block.id,block]));

export function schottensteinSeatTier(section) {
  const block=byId.get(section);
  return block?`T${block.tier+1}`:null;
}

export function schottensteinFootprints() {
  return blocks.map(({id,tier,rows,depthRows,rise,frontHeight,corners,outlines,labelPoint})=>
    ({id,tier,rows,depthRows,rise,frontHeight,corners,outlines,labelPoint}));
}

export function usesSchottensteinChart(project) {
  return project.audienceLayout === 'schottenstein-men' &&
    project.venueReference?.id === 'schottenstein-center' && project.surface === 'ncaa';
}

function rowGeometry(block,rowIndex,{reserve=false}={}) {
  const slot=block.details?.slots?.[rowIndex]??rowIndex;
  const depth=block.near+(slot+.5)*block.treadDepth;
  const {nx,nz}=block;
  const point=lateral=>({x:-nx*depth-nz*lateral,z:-nz*depth+nx*lateral});
  // Split seats and treads anywhere a scan crosses a notch or a circulation gap.
  let ranges=polygonSpans(block.projected,depth);
  if(reserve){
    for(const [start,end] of polygonSpans(block.reserved,depth)){
      ranges=ranges.flatMap(([low,high])=>end<=low||start>=high?[[low,high]]:
        [[Math.max(low,end),high],[low,Math.min(high,start)]].filter(([a,b])=>b-a>.01));
    }
  }
  const spans=ranges.map(([low,high])=>
    ({left:point(high),right:point(low),width:high-low}));
  return {spans,width:spans.reduce((sum,span)=>sum+span.width,0),yaw:Math.atan2(nx,nz),
    y:block.frontHeight+slot*block.rise,slot};
}

function pointAlongSpans(spans,distance) {
  for(const span of spans){
    if(distance<=span.width)return lerp(span.left,span.right,distance/span.width);
    distance-=span.width;
  }
  return spans.at(-1).right;
}

const accessRows=[
  ['104','U'],['105','U'],['106','U'],['107','U'],
  ['114','S'],['121','U'],['122','U'],['123','U'],['124','U'],
  ['206','A'],['302','A'],['323','A'],
];

function buildSchottensteinFeatures(rows) {
  const features=accessRows.flatMap(([sectionId,label])=>{
    const row=rows.filter(item=>item.sectionId===sectionId&&item.row===label)
      .sort((a,b)=>b.width-a.width)[0];
    if(!row)return [];
    const point=lerp(row.left,row.right,.15);
    const offset=label==='A'?-1.52:1.56;
    return [{kind:'entrance',label:`Access ${sectionId}`,sectionId,row:label,
      x:point.x-Math.sin(row.yaw)*offset,y:row.y,z:point.z-Math.cos(row.yaw)*offset,yaw:row.yaw,
      source:referenceSite+sectionId}];
  });
  const regions=chartRegions.map(region=>{
    const {sectionId,outline}=region;
    const point=outline.reduce((center,p)=>({x:center.x+p.x/outline.length,z:center.z+p.z/outline.length}),{x:0,z:0});
    const row=rows.filter(item=>item.sectionId===sectionId).sort((a,b)=>{
      const distance=item=>Math.hypot((item.left.x+item.right.x)/2-point.x,(item.left.z+item.right.z)/2-point.z);
      return distance(a)-distance(b);
    })[0];
    return {...region,...point,y:row?.y??0,source:SCHOTTENSTEIN_CHART_URL};
  });
  return [...features,...regions];
}

// Minimum seat-center spacing used for the reconstruction.
const minimumPitch=.48;
const publishedSeatTotal=OSU_FACTS['schottenstein-center'].mensBasketballCapacity.value;

function allocateSeats(spans,count){
  const choices=spans.flatMap(span=>Array.from({length:Math.floor(span.width/minimumPitch)},
    (_,i)=>({span,pitch:span.width/(i+1)})));
  if(choices.length<count)throw new Error('The seating runs cannot fit the published count at the modeled minimum spacing.');
  choices.sort((a,b)=>b.pitch-a.pitch);
  for(const {span} of choices.slice(0,count))span.count++;
}

export function buildSchottensteinSeating(pitch) {
  const seats=[],groups=[],seatingRows=[];
  const rows=[],unallocated=[];
  let fixedSeats=0;
  blocks.forEach((block,sectionIndex)=>{
    for(let row=0;row<block.rows;row++){
      const g=rowGeometry(block,row);
      if(!g.spans.length)continue;
      const rowLabel=block.details?.labels?.[row]??row+1;
      const documentedCount=clubWithPublishedCounts.has(block.id)?(row<5?14:18):null;
      const seatSpans=rowGeometry(block,row,{reserve:true}).spans.map(span=>({...span,count:0}));
      if(documentedCount){
        allocateSeats(seatSpans,documentedCount);
        fixedSeats+=documentedCount;
      }else unallocated.push(...seatSpans);
      rows.push({block,sectionIndex,rowLabel,g,seatSpans});
      for(const span of g.spans)seatingRows.push({...span,y:g.y,yaw:g.yaw,slot:g.slot,
        tier:block.tier,sectionId:block.id,row:rowLabel,depth:block.treadDepth,rise:block.rise});
    }
  });
  allocateSeats(unallocated,publishedSeatTotal-fixedSeats);
  for(const {block,sectionIndex,rowLabel,g,seatSpans} of rows){
    const from=seats.length;
    for(const {left,right,width,count} of seatSpans){
      if(!count)continue;
      const spacing=Math.min(width/count,Math.max(minimumPitch,pitch));
      const inset=(width-count*spacing)/2;
      for(let i=0;i<count;i++){
        const position=lerp(left,right,(inset+(i+.5)*spacing)/width);
        const number=seats.length-from+1;
        seats.push({...position,y:g.y,yaw:g.yaw,tier:block.tier,sectionId:block.id,
          sectionIndex,row:rowLabel,number,uid:`DEMO-${block.id}-${rowLabel}-${number}`,
          seatingDepth:block.treadDepth,seatWidth:spacing,
          inferredRowColor:block.tier===0&&g.slot<(block.id==='105'?11:Math.round(block.rows*.52))?'courtside':'bowl'});
      }
    }
    const count=seats.length-from;
    if(count)groups.push({tier:block.tier,sectionIndex,row:rowLabel,from,count});
  }
  return {seats,groups,seatingRows,sectionFootprints:schottensteinFootprints(),features:buildSchottensteinFeatures(seatingRows)};
}

export function estimateSchottensteinRoster(roster) {
  const sections = new Map();
  for (const seat of roster) {
    const block = byId.get(seat.section);
    if (!block) throw new Error(`Section ${seat.section} is outside the published basketball chart used here. Supply XYZ for this roster.`);
    if (!sections.has(block)) sections.set(block, new Map());
    const rows = sections.get(block);
    if (!rows.has(seat.row)) rows.set(seat.row, []);
    rows.get(seat.row).push(seat);
  }
  const seats = [];
  const compare = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
  for (const [block, rows] of sections) {
    const labels = [...rows.keys()].sort(compare);
    labels.forEach((label, index) => {
      // The chart has no row inventory. Relative order is used for visual approximation.
      const documentedRow = block.details?.labels.indexOf(label.toUpperCase()) ?? -1;
      const row = documentedRow>=0 ? documentedRow : Math.min(block.rows-1,index*block.rows/labels.length);
      const g = rowGeometry(block, row);
      const members = rows.get(label).sort((a, b) => compare(a.number, b.number));
      if (members.length * .32 > g.width) throw new Error(`Section ${block.id}, row ${label} exceeds this estimated footprint. Supply XYZ for this roster.`);
      members.forEach((seat, i) => {
        seats.push({ ...seat, ...pointAlongSpans(g.spans,(i+.5)*g.width/members.length),
          y: g.y, tier: `T${block.tier + 1}` });
      });
    });
  }
  return { seats, unmatchedSections: [], coordinateMethod: 'estimated' };
}
