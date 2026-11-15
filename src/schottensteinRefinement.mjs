// Manual preview refinements, kept separate from the raw chart and ticket data.
// Coordinates here are chart pixels, in the same order as the contour source.
const scanArtifacts = {
  313: [[985,344],[986,296],[987,344]],
  315: [[987,443],[986,489],[985,443]],
  319: [[804,685],[802,686]],
  320: [[735,694],[779,695],[735,696]],
};

const protectedBanks = new Set([105,114,131,321,322,323,324,325,326]);
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
  if (section < 200 || protectedBanks.has(section)) {
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
  const minimum = [.47,.58,.65][tier];
  const totalAdjustment=Math.max(0,(far-near)-minimum*rows);
  const rearLimit=Math.min(totalAdjustment,[.85,1.15,2.25][tier]);
  const rear=broaderEnd(far,rearLimit,-1,end=>runWidth(spansAt,end-(end-near)/(2*rows)),.90);
  const frontLimit=Math.min(.45,Math.max(0,totalAdjustment-(far-rear)));
  const front=broaderEnd(near,frontLimit,1,start=>runWidth(spansAt,start+(rear-start)/(2*rows)),.83);
  return {near:front,far:rear};
}

// Keep the chart's separate front row and access landing. Expand the
// continuous H–U bank to a full-width tread pitch close to its neighbors.
export function refineAccessibleRear(section, near, treadDepth, spansAt) {
  if(!accessBanks.has(section))return null;
  const end=near+20.5*treadDepth;
  const desiredWidth=runWidth(spansAt,end)*.91;
  for(let depth=.72;depth>treadDepth;depth-=.01){
    if(runWidth(spansAt,end-13*depth)>=desiredWidth &&
       Array.from({length:13},(_,i)=>end-i*depth).every(p=>runWidth(spansAt,p)>=desiredWidth)){
      return {end,depth};
    }
  }
  return null;
}

export function schottensteinRake(tier, fraction) {
  // The narrow front treads climb more gently, with a progressive rake
  // towards the back. Both endpoints stay at the shared tier elevations.
  const curvature = tier===2 ? .075 : tier===1 ? .04 : 0;
  return fraction-curvature*fraction*(1-fraction);
}
