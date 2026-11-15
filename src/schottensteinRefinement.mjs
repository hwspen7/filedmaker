// Manual preview refinements, kept separate from the raw chart and ticket data.
// Coordinates here are chart pixels, in the same order as the contour source.
const scanArtifacts = {
  313: [[985,344],[986,296],[987,344]],
  315: [[987,443],[986,489],[985,443]],
  319: [[804,685],[802,686]],
  320: [[735,694],[779,695],[735,696]],
};

const rearBanks = new Set([312,313,315,316,318,320]);
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
  return {x:front.x+rear.x,z:front.z+rear.z};
}

// A few tapered chart tips truncate the whole last row when the scan is
// extended to the furthest vertex. Limit these named banks to a broad rear
// tread, leaving the chart outline and the genuine cross-aisles intact.
export function refineSchottensteinRearDepth(section, near, far, rows, spansAt) {
  if (!rearBanks.has(section)) return far;
  const width = depth => Math.max(0,...spansAt(depth).map(([lo,hi])=>hi-lo));
  const lastWidth = end => width(end-(end-near)/(2*rows));
  const samples = 28, increment = .05;
  const candidates = Array.from({length:samples+1},(_,i)=>far-i*increment);
  const fullWidth = Math.max(...candidates.map(lastWidth));
  return candidates.find(end=>lastWidth(end)>=fullWidth*.90)??far;
}

export function schottensteinRake(tier, fraction) {
  // The narrow front treads climb more gently, with a progressive rake
  // towards the back. Both endpoints stay at the shared tier elevations.
  const curvature = tier===2 ? .075 : tier===1 ? .04 : 0;
  return fraction-curvature*fraction*(1-fraction);
}
