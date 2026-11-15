import {
  SCHOTTENSTEIN_CHART_LABELS, SCHOTTENSTEIN_DIAGRAM_EDGE, SCHOTTENSTEIN_SECTION_CONTOURS,
} from './schottensteinChartContours.mjs';
import { OSU_FACTS } from './osuFacts.mjs';
import { ACCESS_FRONT_DEPTH, connectedSchottensteinRuns, refineAccessibleRear, refineSchottensteinBank, refineSchottensteinContour,
  schottensteinMediaElevation, schottensteinRake, schottensteinRowHeading } from './schottensteinRefinement.mjs';

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
      ?{labels:['A','A2','A3',...rowsAtoU.slice(7)],slots:[0,1,2,...rowsAtoU.slice(7).map((_,i)=>i+7)]}
      :{labels:rowsAtoU.slice(0,terraceEnds.get(id)??rowsAtoU.length)}
  ]),
  ['323', {labels:['A','B','B2',...letterRows('FGHIJKLMN')], slots:[0,1,2,5,6,7,8,9,10,11,12,13]}],
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
// The end-corner sections taper across two aisles. Use their inward aisle
// bearings from the chart because the end chords are not parallel to the rows.
const lowerCornerAisles={
  111:[[850,348,757,348],[824,262,771,308]],
  117:[[850,439,757,439],[824,526,771,480]],
  128:[[319,439,408,439],[342,523,398,476]],
  134:[[319,349,408,349],[342,263,398,310]],
};
const minimumPitch=.48;
const tierElevations = [[.56, 6.34], [8.05, 11.56], [15.45, 28.55]];
// Model datum shared by the enclosure and the suspended interior fixtures.
export const SCHOTTENSTEIN_ROOF_EAVE = 40.6;
export const SCHOTTENSTEIN_TERRACE_RIM = { front: tierElevations[2][0], rear: tierElevations[2][1] };
// Manually fitted to the chart's sideline and end stands, excluding local
// seating notches. The building footprint is independent of seat run ends.
const elevatedAxes = [null, [[27.5,42.6],[34.7,49.0]], [[34.5,49.7],[50.1,64.9]]];
function roundedRadius(angle, x, z) {
  const exponent = 2.9;
  return (Math.abs(Math.cos(angle)/x)**exponent +
    Math.abs(Math.sin(angle)/z)**exponent)**(-1/exponent);
}

export function schottensteinBuildingRadius(angle, offset=0) {
  return roundedRadius(angle, 52.2+offset, 66.8+offset);
}

const turn = 2 * Math.PI;
const azimuth = ({x,z}) => (Math.atan2(z,x) + turn) % turn;
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
    const {x:dx,z:dz}=schottensteinRowHeading(id,
      {x:frontRight.x-frontLeft.x,z:frontRight.z-frontLeft.z},
      {x:backRight.x-backLeft.x,z:backRight.z-backLeft.z});
    const magnitude=Math.hypot(dx,dz);
    const center=lerp(frontLeft,frontRight,.5);
    let nx=-dz/magnitude,nz=dx/magnitude;
    if(nx*center.x+nz*center.z>0){nx=-nx;nz=-nz;}
    if(lowerCornerAisles[id]){
      const inward=lowerCornerAisles[id].reduce((sum,axis)=>{
        const [a,b]=unpack(axis);
        const length=Math.hypot(b.x-a.x,b.z-a.z);
        return {x:sum.x+(b.x-a.x)/length,z:sum.z+(b.z-a.z)/length};
      },{x:0,z:0});
      const length=Math.hypot(inward.x,inward.z);
      nx=inward.x/length;nz=inward.z/length;
    }
    if (id === 334) {
      // The corner wedge follows the aisle tangent towards section 301.
      const turn = Math.PI / 15;
      [nx,nz] = [nx*Math.cos(turn)-nz*Math.sin(turn), nx*Math.sin(turn)+nz*Math.cos(turn)];
    }
    const outlines=refineSchottensteinContour(id,SCHOTTENSTEIN_SECTION_CONTOURS[id]).map(unpack);
    // Local X runs outward, local Z runs to a spectator's right.
    const project=({x,z})=>({x:-nx*x-nz*z,z:-nz*x+nx*z});
    const projected=outlines.map(points=>points.map(project));
    const depths=projected.flat().map(p=>p.x);
    const tracedFar=Math.max(...depths);
    let near=Math.min(...depths);
    const sectionId=String(id),details=rowDetails.get(sectionId);
    const depthRows=details?.slots ? details.slots.at(-1)+1
      :details?.labels.length??Math.max(2,Math.round((tracedFar-near)/[.82,.88,.82][tier]));
    const rows=details?.labels.length??depthRows;
    const spansAt=depth=>polygonSpans(projected,depth);
    const adjusted=clubWithPublishedCounts.has(sectionId)?{near,far:tracedFar}
      :refineSchottensteinBank(id,tier,near,tracedFar,depthRows,spansAt);
    near=adjusted.near;
    const far=adjusted.far;
    let treadDepth=(far-near)/depthRows;
    const canSeat=depth=>polygonSpans(projected,depth).some(([lo,hi])=>hi-lo>=minimumPitch);
    let firstCenter=near+treadDepth*.5;
    const frontLimit=firstCenter+treadDepth*3;
    while(firstCenter<frontLimit&&!canSeat(firstCenter))firstCenter+=.04;
    if(firstCenter>near+treadDepth*.5&&firstCenter<frontLimit){
      treadDepth=(far-firstCenter)/(depthRows-.5);
      near=firstCenter-treadDepth*.5;
    }
    // Keep the elevation sample on a fixed axis when an aisle interrupts
    // a row. Sampling the center of the remaining seats skews the rake.
    const centerSpans = polygonSpans(projected, (near + far) * .5);
    const profileAxis = centerSpans.length
      ? (centerSpans[0][1] + centerSpans.at(-1)[0]) * .5 : project(center).z;
    const accessibleRear=refineAccessibleRear(id,near,treadDepth,spansAt);
    const publishedRowCounts=clubWithPublishedCounts.has(sectionId);
    const reserved=chartRegions.filter(region=>region.sectionId===sectionId||(tier===2&&region.kind==='press')).map(region=>region.outline.map(project));
    return {id:sectionId,tier,rows,depthRows,corners,outlines,projected,reserved,nx,nz,near,
      treadDepth,accessibleRear,profileAxis,details,publishedRowCounts,labelPoint:labels.get(id)};
  })
);
const byId=new Map(blocks.map(block=>[block.id,block]));

export function schottensteinSeatTier(section) {
  const block=byId.get(section);
  return block?`T${block.tier+1}`:null;
}

export function schottensteinFootprints() {
  return blocks.map(({id,tier,rows,depthRows,corners,outlines,labelPoint,nx,nz,near,treadDepth,publishedRowCounts})=>
    ({id,tier,rows,depthRows,corners,outlines,labelPoint,nx,nz,near,treadDepth,publishedRowCounts}));
}

export function usesSchottensteinChart(project) {
  return project.audienceLayout === 'schottenstein-men' &&
    project.venueReference?.id === 'schottenstein-center' && project.surface === 'ncaa';
}

function rowPlane(block, slot) {
  const rear=slot>=7?block.accessibleRear:null;
  const front=block.accessibleRear&&slot<3;
  const depth=rear?rear.end-(20-slot)*rear.depth
    :front?block.near+block.treadDepth*.5+slot*ACCESS_FRONT_DEPTH
    :block.near+(slot+.5)*block.treadDepth;
  const {nx,nz} = block;
  const point = lateral => ({x:-nx*depth-nz*lateral,z:-nz*depth+nx*lateral});
  return {point,depth,treadDepth:front?ACCESS_FRONT_DEPTH:rear?.depth??block.treadDepth};
}

function traceEntryRim(rear) {
  return blocks.filter(block=>block.tier===0 && (rear || !['101','110','118','127'].includes(block.id)))
    .map(block=>{
      const {point}=rowPlane(block,rear?block.depthRows-1:0);
      const p=point(block.profileAxis);
      return {angle:azimuth(p),radius:Math.hypot(p.x,p.z)};
    }).sort((a,b)=>a.angle-b.angle);
}
const entryEdges=[false,true].map(traceEntryRim);

function rimRadius(edge, angle) {
  const index = edge.findIndex(p => p.angle >= angle);
  const next = index < 0 ? 0 : index;
  const a = edge[(next + edge.length - 1) % edge.length], b = edge[next];
  const span = (b.angle - a.angle + turn) % turn;
  const offset = (angle - a.angle + turn) % turn;
  return span > 1e-9 ? a.radius + offset / span * (b.radius - a.radius) : b.radius;
}

function deckHeight(tier, fraction) {
  const [base, top] = tierElevations[tier];
  return base+(top-base)*schottensteinRake(tier,fraction);
}

export function schottensteinDeckHeight(tier, point) {
  const angle = azimuth(point);
  const [front, rear] = tier===0 ? entryEdges.map(edge=>rimRadius(edge,angle))
    : elevatedAxes[tier].map(([x,z])=>roundedRadius(angle,x,z));
  const fraction = (Math.hypot(point.x, point.z) - front) / (rear - front);
  return deckHeight(tier, tier === 0 ? Math.max(0, Math.min(1, fraction)) : fraction);
}

export function schottensteinDeckPoint(tier, angle, fraction) {
  let radius;
  if(tier===0){
    const [front,rear]=entryEdges.map(edge=>rimRadius(edge,angle));
    radius=front-1+fraction*(rear-front+2.05);
  }else{
    const [[x0,z0],[x1,z1]]=elevatedAxes[tier];
    radius=roundedRadius(angle,x0+(x1-x0)*fraction,z0+(z1-z0)*fraction);
  }
  return {x:radius*Math.cos(angle),z:radius*Math.sin(angle)};
}

const lowerElevations = new Map(blocks.filter(block => block.tier === 0).map(block => {
  const heightAt = slot => schottensteinDeckHeight(0, rowPlane(block, slot).point(block.profileAxis));
  const first = heightAt(0), last = heightAt(block.depthRows - 1);
  return [block.id, {first, rise: (last - first) / (block.depthRows - 1)}];
}));

function rowGeometry(block,rowIndex,{reserve=false}={}) {
  const slot = block.details?.slots?.[rowIndex] ?? rowIndex;
  const {point,depth,treadDepth}=rowPlane(block,slot);
  const {nx,nz} = block;
  // Split seats and treads anywhere a scan crosses a notch or a circulation gap.
  let ranges=polygonSpans(block.projected,depth);
  const lowerProfile = lowerElevations.get(block.id);
  const [frontY]=tierElevations[block.tier];
  const media=schottensteinMediaElevation(Number(block.id),frontY,block.depthRows,block.treadDepth);
  const y=lowerProfile ? lowerProfile.first + slot * lowerProfile.rise
    : media ? media.front+(media.rear-media.front)*slot/(block.depthRows-1)
    : block.accessibleRear&&slot<3 ? frontY+slot*.38
    : deckHeight(block.tier,slot/(block.depthRows-1));
  if(reserve){
    for(const [start,end] of polygonSpans(block.reserved,depth)){
      ranges=ranges.flatMap(([low,high])=>end<=low||start>=high?[[low,high]]:
        [[Math.max(low,end),high],[low,Math.min(high,start)]].filter(([a,b])=>b-a>.01));
    }
  }
  const spans=ranges.map(([low,high])=>
    ({left:point(high),right:point(low),width:high-low,low,high}));
  return {spans,width:spans.reduce((sum,span)=>sum+span.width,0),yaw:Math.atan2(nx,nz),
    y,slot,treadDepth};
}

function pointAlongSpans(spans,distance) {
  for(const span of spans){
    if(distance<=span.width)return lerp(span.left,span.right,distance/span.width);
    distance-=span.width;
  }
  return spans.at(-1).right;
}

function buildSchottensteinFeatures(rows) {
  return chartRegions.map(region=>{
    const {sectionId,outline}=region;
    const point=outline.reduce((center,p)=>({x:center.x+p.x/outline.length,z:center.z+p.z/outline.length}),{x:0,z:0});
    const row=rows.filter(item=>item.sectionId===sectionId).sort((a,b)=>{
      const distance=item=>Math.hypot((item.left.x+item.right.x)/2-point.x,(item.left.z+item.right.z)/2-point.z);
      return distance(a)-distance(b);
    })[0];
    return {...region,...point,y:row?.y??0,source:SCHOTTENSTEIN_CHART_URL};
  });
}

const publishedSeatTotal=OSU_FACTS['schottenstein-center'].mensBasketballCapacity.value;

export function allocateSeats(spans,count){
  // Reserve one location in every eligible chart-backed run before sharing
  // the remaining capacity. Actual accessible/aisle voids are clipped earlier.
  const unseeded=spans.filter(span=>span.count===0&&span.width>=minimumPitch);
  if(count>=unseeded.length){
    for(const span of unseeded){span.count++;count--;}
  }
  const choices=spans.flatMap(span=>Array.from({length:Math.floor(span.width/minimumPitch)-span.count},
    (_,i)=>({span,pitch:span.width/(span.count+i+1)})));
  if(choices.length<count)throw new Error('The seating runs cannot fit the published count at the modeled minimum spacing.');
  choices.sort((a,b)=>b.pitch-a.pitch);
  for(const {span} of choices.slice(0,count))span.count++;
}

export function buildSchottensteinSeating(pitch) {
  const seats=[],groups=[],seatingRows=[];
  const rows=[],unallocated=[];
  let assignedSeats=0;
  blocks.forEach((block,sectionIndex)=>{
    const sectionRows=[];
    for(let row=0;row<block.rows;row++){
      const g=rowGeometry(block,row,{reserve:true});
      if(!g.spans.length)continue;
      const rowLabel=block.details?.labels?.[row]??row+1;
      const documentedCount=block.publishedRowCounts?(row<5?14:18):null;
      const seatSpans=g.spans.map(span=>({...span,count:0}));
      sectionRows.push({block,sectionIndex,rowLabel,g,seatSpans,documentedCount});
    }
    const retained=connectedSchottensteinRuns(sectionRows,minimumPitch);
    for(const row of sectionRows){
      const {documentedCount}=row;
      if(!documentedCount)row.seatSpans=row.seatSpans.filter(span=>retained.has(span));
      if(!row.seatSpans.length)continue;
      if(documentedCount){
        allocateSeats(row.seatSpans,documentedCount);
        assignedSeats+=documentedCount;
      }else{
        const widest=row.seatSpans.reduce((best,span)=>!best||span.width>best.width?span:best,null);
        if(widest?.width>=minimumPitch){widest.count=1;assignedSeats++;}
        unallocated.push(...row.seatSpans);
      }
      rows.push(row);
    }
  });
  allocateSeats(unallocated,publishedSeatTotal-assignedSeats);
  for(const {block,sectionIndex,rowLabel,g,seatSpans} of rows){
    const from=seats.length;
    for(const {left,right,width,count} of seatSpans){
      if(!count)continue;
      // Fill a row run evenly when its real-scale pitch remains plausible.
      // Fixed-width centering produced seat-sized empty margins at the ends.
      const fullPitch=width/count;
      const cappedPitch=Math.min(fullPitch,Math.max(minimumPitch,pitch));
      const spacing=fullPitch<=Math.max(.79,pitch*1.43)?fullPitch:cappedPitch;
      const inset=(width-count*spacing)/2;
      // Keep the blank ends of the chart scan out of the circulation gaps.
      seatingRows.push({
        left:lerp(left,right,inset/width),right:lerp(left,right,1-inset/width),width:count*spacing,
        y:g.y,yaw:g.yaw,slot:g.slot,tier:block.tier,sectionId:block.id,row:rowLabel,depth:g.treadDepth,
      });
      for(let i=0;i<count;i++){
        const position=lerp(left,right,(inset+(i+.5)*spacing)/width);
        const number=seats.length-from+1;
        seats.push({...position,y:g.y,yaw:g.yaw,tier:block.tier,sectionId:block.id,
          sectionIndex,row:rowLabel,number,uid:`DEMO-${block.id}-${rowLabel}-${number}`,
          seatingDepth:g.treadDepth,seatWidth:spacing,
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
        const position = pointAlongSpans(g.spans,(i+.5)*g.width/members.length);
        seats.push({ ...seat, ...position, y: g.y, tier: `T${block.tier + 1}` });
      });
    });
  }
  return { seats, unmatchedSections: [], coordinateMethod: 'estimated' };
}
