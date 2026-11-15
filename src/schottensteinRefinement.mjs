// Manual preview refinements, kept separate from the raw chart and ticket data.
// Coordinates here are chart pixels, in the same order as the contour source.
const scanArtifacts = {
  313: [[985,344],[986,296],[987,344]],
  315: [[987,443],[986,489],[985,443]],
  319: [[804,685],[802,686]],
  320: [[735,694],[779,695],[735,696]],
};

const protectedBanks = new Set([105,114,131]);
export const SCHOTTENSTEIN_MEDIA_BANKS = new Set([321,322,323,324,325,326]);
export const ACCESS_FRONT_DEPTH = .48;
const accessBanks = new Set([304,307,314,331]);
const alignToRear = new Set([313,315,320]);

export function refineSchottensteinContour(section, outlines) {
  const artifacts = scanArtifacts[section];
  if (!artifacts) return outlines;
  return outlines.map(outline => {
    const points = [];
    for(let i=0;i<outline.length;i+=2){
      const a=outline[i],b=outline[i+1];
      if(!artifacts.some(([x,y])=>x===a&&y===b))points.push(a,b);
    }
    return points;
  });
}

export function schottensteinRowHeading(section, front, rear) {
  if (alignToRear.has(section)) return rear;
  if (section < 200 || SCHOTTENSTEIN_MEDIA_BANKS.has(section)) {
    return {x:front.x+rear.x,z:front.z+rear.z};
  }
  // The two bearings describe the same bank. Weight them by direction
  // rather than chord length so a long taper cannot skew every row.
  const frontLength=Math.hypot(front.x,front.z);
  const rearLength=Math.hypot(rear.x,rear.z);
  return {x:.43*front.x/frontLength+.57*rear.x/rearLength,
    z:.43*front.z/frontLength+.57*rear.z/rearLength};
}

const runWidth = (spansAt, depth) => Math.max(0,...spansAt(depth).map(([lo,hi])=>hi-lo));

function broaderEnd(start, limit, direction, width, target) {
  const step = .05;
  const candidates=Array.from({length:1+Math.floor(limit/step)},(_,i)=>start+i*step*direction);
  const widths=candidates.map(width);
  const full=Math.max(...widths);
  const index=widths.findIndex(value=>value>=full*target);
  return candidates[index]??start;
}

// Correct narrow clipped ends across all levels while keeping charts with
// keyed inventories and documented voids on their original boundaries.
export function refineSchottensteinBank(section, tier, near, far, rows, spansAt) {
  if (protectedBanks.has(section)||accessBanks.has(section))return {near,far};
  const minimum = SCHOTTENSTEIN_MEDIA_BANKS.has(section)?Math.min(.60,(far-near)/rows*.84):[.47,.58,.65][tier];
  const totalAdjustment=Math.max(0,(far-near)-minimum*rows);
  const rearLimit=Math.min(totalAdjustment,SCHOTTENSTEIN_MEDIA_BANKS.has(section)?1.75:[.85,1.15,2.25][tier]);
  const rear=broaderEnd(far,rearLimit,-1,end=>runWidth(spansAt,end-(end-near)/(2*rows)),.90);
  const firstWidth=start=>runWidth(spansAt,start+(rear-start)/(2*rows));
  const pitch=(rear-near)/rows;
  const neighbors=[1.5,2.5,3.5].map(slot=>runWidth(spansAt,near+slot*pitch)).sort((a,b)=>a-b);
  const limit=tier===0?1.45:1.25;
  const frontLimit=Math.min(limit,Math.max(0,totalAdjustment-(far-rear)));
  const front=firstWidth(near)<neighbors[1]*.86
    ?broaderEnd(near,frontLimit,1,firstWidth,.92)
    :near;
  return {near:front,far:rear};
}

// Keep a compact front bank and an open access landing. Expand the
// continuous H–U bank to a full-width tread pitch close to its neighbors.
export function refineAccessibleRear(section, near, treadDepth, spansAt) {
  if(!accessBanks.has(section))return null;
  const end=near+20.5*treadDepth;
  const desiredWidth=runWidth(spansAt,end)*.91;
  const frontEnd=near+treadDepth*.5+2.5*ACCESS_FRONT_DEPTH;
  for(let depth=.72;depth>treadDepth;depth-=.01){
    const firstRear=end-13*depth;
    if(firstRear-depth*.5-frontEnd>=1.05 && runWidth(spansAt,firstRear)>=desiredWidth &&
       Array.from({length:13},(_,i)=>end-i*depth).every(p=>runWidth(spansAt,p)>=desiredWidth)){
      return {end,depth};
    }
  }
  return {end,depth:treadDepth};
}

// Drop thin fragments unsupported by a bank of three consecutive rows.
// Compare lateral ranges within a section so aisles never tie two banks together.
export function connectedSchottensteinRuns(rows, minimumWidth) {
  const entries=rows.flatMap(row=>row.seatSpans.filter(span=>span.width>=minimumWidth)
    .map(span=>({slot:row.g.slot,span})));
  const rowsBySlot=new Map();
  const retained=new Set(), seen=new Set();
  for(const entry of entries){
    const layer=rowsBySlot.get(entry.slot)??[];
    layer.push(entry);
    rowsBySlot.set(entry.slot,layer);
  }
  for(const entry of entries){
    if(seen.has(entry))continue;
    const connected=[entry],slots=new Set();
    seen.add(entry);
    for(let i=0;i<connected.length;i++){
      const {slot,span}=connected[i];
      slots.add(slot);
      for(const neighbor of [...(rowsBySlot.get(slot-1)??[]),...(rowsBySlot.get(slot+1)??[])]){
        const overlap=Math.min(span.high,neighbor.span.high)-Math.max(span.low,neighbor.span.low);
        if(overlap<.16||seen.has(neighbor))continue;
        seen.add(neighbor);
        connected.push(neighbor);
      }
    }
    if(slots.size>=3)for(const item of connected)retained.add(item.span);
  }
  return retained;
}

export function schottensteinRake(tier, fraction) {
  // The narrow front treads climb more gently, with a progressive rake
  // towards the back. Both endpoints stay at the shared tier elevations.
  const curvature = tier===2 ? .075 : tier===1 ? .04 : 0;
  return fraction-curvature*fraction*(1-fraction);
}
