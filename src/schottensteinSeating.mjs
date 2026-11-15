import {
  SCHOTTENSTEIN_CHART_LABELS, SCHOTTENSTEIN_DIAGRAM_EDGE, SCHOTTENSTEIN_SECTION_CONTOURS,
} from './schottensteinChartContours.mjs';

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
const rowDetails = new Map([
  ['105', {labels:letterRows('ABCDEFGHIJKLMNOPQRSTU')}],
  ['114', {labels:[...letterRows('ABCDEFGHIJ').map(c=>c+c),...letterRows('ABCDEFGHIJKLMNOPQRS')]}],
  ['206', {labels:letterRows('ABCDEFGHIJ')}],
  ['302', {labels:letterRows('ABCDEFGHIJKLMNOPQRSTU')}],
  ['323', {labels:letterRows('ABFGHIJKLMN'), slots:[0,1,5,6,7,8,9,10,11,12,13]}],
]);
const clubWithPublishedCounts = new Set(['204','205','206','207','221','222','223','224']);
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

// The chart is a top view. In the right-handed arena, its right-hand end
// is negative Z, so the spectator camera and the published map agree.
const toWorld = (z, x) => ({ x: (x - 393.5) * 15.24 / 112, z: (582 - z) * 28.6512 / 222 });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
const unpack = pixels => Array.from({length:pixels.length/2},(_,i)=>toWorld(pixels[i*2],pixels[i*2+1]));
const labels = new Map(SCHOTTENSTEIN_CHART_LABELS.map(([id,x,y])=>[id,toWorld(x,y)]));
export const schottensteinDiagramEdge=unpack(SCHOTTENSTEIN_DIAGRAM_EDGE);

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
    const projected=outlines.map(points=>points.map(({x,z})=>({x:-nx*x-nz*z,z:-nz*x+nx*z})));
    const depths=projected.flat().map(p=>p.x);
    const near=Math.min(...depths), depth=Math.max(...depths)-near;
    const sectionId=String(id),details=rowDetails.get(sectionId);
    const depthRows=details?.slots ? details.slots.at(-1)+1
      : details?.labels.length ?? (clubWithPublishedCounts.has(sectionId)?10:Math.max(2,Math.round(depth/[.82,.88,.82][tier])));
    const rows=details?.labels.length??depthRows;
    const treadDepth=depth/depthRows;
    const rise=tier===0?(treadDepth<.74?.24:.31):tier===1?.34:Math.min(.45,6.85/(depthRows-1));
    const frontHeight=tier===0?(id===114||id===131?.42:.64):tier===1?8.05:14.65;
    return {id:sectionId,tier,rows,depthRows,corners,outlines,projected,nx,nz,near,
      treadDepth,rise,frontHeight,details,labelPoint:labels.get(id)};
  })
);
const byId=new Map(blocks.map(block=>[block.id,block]));

export function schottensteinFootprints() {
  return blocks.map(({id,tier,rows,depthRows,rise,frontHeight,corners,outlines,labelPoint})=>
    ({id,tier,rows,depthRows,rise,frontHeight,corners,outlines,labelPoint}));
}

export function usesSchottensteinChart(project) {
  return project.audienceLayout === 'schottenstein-men' &&
    project.venueReference?.id === 'schottenstein-center' && project.surface === 'ncaa';
}

function rowGeometry(block,rowIndex) {
  const slot=block.details?.slots?.[rowIndex]??rowIndex;
  const depth=block.near+(slot+.5)*block.treadDepth;
  const {nx,nz}=block;
  const point=lateral=>({x:-nx*depth-nz*lateral,z:-nz*depth+nx*lateral});
  // Split seats and treads anywhere a scan crosses a notch or a circulation gap.
  const spans=polygonSpans(block.projected,depth).map(([low,high])=>
    ({left:point(high),right:point(low),width:high-low}));
  return {spans,width:spans.reduce((sum,span)=>sum+span.width,0),yaw:Math.atan2(nx,nz),
    y:block.frontHeight+slot*block.rise,slot};
}

const entryRows = [
  ['105','U'], ['114','S'], ['206','A'], ['302','A'], ['323','A'],
];

export function schottensteinSectionView(rows,sectionId,requestedRow) {
  const section=rows.filter(row=>row.sectionId===sectionId);
  const slot=section[Math.floor(section.length/2)]?.slot;
  const candidates=requestedRow===undefined?section.filter(row=>row.slot===slot)
    :section.filter(row=>String(row.row)===String(requestedRow));
  const row=candidates.reduce((longest,item)=>!longest||item.width>longest.width?item:longest,null);
  if(!row)return null;
  return {...lerp(row.left,row.right,.5),y:row.y,yaw:row.yaw,sectionId,row:requestedRow,reference:true};
}

function buildSchottensteinFeatures(rows) {
  const features=entryRows.flatMap(([sectionId,label])=>{
    const sectionRows=rows.filter(row=>row.sectionId===sectionId&&String(row.row)===label);
    const row=sectionRows.reduce((largest,item)=>!largest||item.width>largest.width?item:largest,null);
    if(!row)return [];
    const point=lerp(row.left,row.right,.10);
    const opening=label==='A'?-.45:.85;
    return [{kind:'entrance',label:`Section ${sectionId} access`,sectionId,row:label,
      x:point.x-Math.sin(row.yaw)*opening,y:row.y,z:point.z-Math.cos(row.yaw)*opening,yaw:row.yaw,
      source:referenceSite+sectionId}];
  });
  const region=(kind,label,sectionId,pixels)=>{
    const outline=unpack(pixels);
    const point=outline.reduce((a,b)=>({x:a.x+b.x/outline.length,z:a.z+b.z/outline.length}),{x:0,z:0});
    const section=rows.filter(row=>row.sectionId===sectionId);
    const row=section.reduce((nearest,item)=>{
      const p=lerp(item.left,item.right,.5), d=Math.hypot(p.x-point.x,p.z-point.z);
      return d<(nearest?.d??Infinity)?{d,y:item.y}:nearest;
    },null);
    return {kind,label,sectionId,...point,y:row?.y??0,outline,source:SCHOTTENSTEIN_CHART_URL};
  };
  return [
    ...features,
    region('band','Band Area','114',[764,401,808,401,808,432,764,432]),
    region('press','Press Box','323',[439,697,706,695,733,727,439,727]),
    region('accessible','Accessible Platform','105',[513,217,577,217,577,229,513,229]),
  ];
}

export function buildSchottensteinLayout() {
  const seatingRows=[];
  for(const block of blocks){
    for(let i=0;i<block.rows;i++){
      const g=rowGeometry(block,i);
      const row=block.details?.labels?.[i]??i+1;
      for(const span of g.spans)seatingRows.push({...span,y:g.y,yaw:g.yaw,slot:g.slot,
        tier:block.tier,sectionId:block.id,row,depth:block.treadDepth,rise:block.rise});
    }
  }
  return {seatingRows,sectionFootprints:schottensteinFootprints(),features:buildSchottensteinFeatures(seatingRows)};
}

export function schottensteinSeatTier(section,fallback) {
  const block=byId.get(section);
  return block?`T${block.tier+1}`:fallback;
}

export function hasCompleteSchottensteinCoordinates(seats) {
  const positions=new Set();
  for(const seat of seats){
    if(![seat.x,seat.y,seat.z].every(Number.isFinite))return false;
    const key=JSON.stringify([seat.x,seat.y,seat.z]);
    if(positions.has(key))return false;
    positions.add(key);
  }
  return seats.length>0;
}
