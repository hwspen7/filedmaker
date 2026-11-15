// Approximate seating footprints traced from Ohio State's men's basketball diagram.
// Pairs list the front edge and then the back edge, in matching endpoint order.
// The diagram establishes section labels and relative location, not dimensions.
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

const toWorld = (z, x) => ({ x: (x - 393.5) * 15.24 / 112, z: (z - 582) * 28.6512 / 222 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
const blocks = [lower, club, upper].flatMap((level, tier) =>
  level.map(([id, ...p]) => {
    const corners = [0, 2, 4, 6].map(i => toWorld(p[i], p[i + 1]));
    const [frontLeft, frontRight, backLeft, backRight] = corners;
    const depth = (distance(frontLeft, backLeft) + distance(frontRight, backRight)) / 2;
    const rows = Math.max(2, Math.round(depth / [.82, .88, .82][tier]));
    return { id: String(id), tier, rows, corners };
  })
);
const byId = new Map(blocks.map(block => [block.id, block]));

export function schottensteinFootprints() {
  return blocks.map(({ id, tier, rows, corners: [a, b, c, d] }) =>
    ({ id, tier, rows, outline: [a, b, d, c] }));
}

export function usesSchottensteinChart(project) {
  return project.audienceLayout === 'schottenstein-men' &&
    project.venueReference?.id === 'schottenstein-center' && project.surface === 'ncaa';
}

function rowGeometry(block, rowIndex) {
  const [a, b, c, d] = block.corners;
  const t = (rowIndex + .5) / block.rows;
  let left = lerp(a, c, t), right = lerp(b, d, t);
  const width = distance(left, right);
  const mid = lerp(left, right, .5);
  let nx = -(right.z - left.z) / width, nz = (right.x - left.x) / width;
  if (nx * mid.x + nz * mid.z > 0) { nx = -nx; nz = -nz; }
  const yaw = Math.atan2(nx, nz);
  // The published chart notes that seat 1 is on a seated person's right.
  if ((right.x - left.x) * -nz + (right.z - left.z) * nx > 0) [left, right] = [right, left];
  return { left, right, width, yaw, y: [.8, 7.4, 12.2][block.tier] + rowIndex * [.34, .39, .43][block.tier] };
}

export function buildSchottensteinSeating(pitch) {
  const seats = [], groups = [];
  blocks.forEach((block, sectionIndex) => {
    for (let row = 0; row < block.rows; row++) {
      const g = rowGeometry(block, row);
      const count = Math.floor(g.width / pitch);
      const from = seats.length;
      for (let i = 0; i < count; i++) {
        seats.push({ ...lerp(g.left, g.right, (i + .5) / count), y: g.y, yaw: g.yaw,
          tier: block.tier, sectionId: block.id, sectionIndex, row: row + 1, number: i + 1,
          uid: `DEMO-${block.id}-${row + 1}-${i + 1}` });
      }
      if (count) groups.push({ tier: block.tier, sectionIndex, row: row + 1, from, count });
    }
  });
  return { seats, groups, sectionFootprints: schottensteinFootprints() };
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
      const row = Math.min(block.rows - 1, index * block.rows / labels.length);
      const g = rowGeometry(block, row);
      const members = rows.get(label).sort((a, b) => compare(a.number, b.number));
      if (members.length * .32 > g.width) throw new Error(`Section ${block.id}, row ${label} exceeds this estimated footprint. Supply XYZ for this roster.`);
      members.forEach((seat, i) => {
        seats.push({ ...seat, ...lerp(g.left, g.right, (i + .5) / members.length),
          y: g.y, tier: `T${block.tier + 1}` });
      });
    });
  }
  return { seats, unmatchedSections: [], coordinateMethod: 'estimated' };
}
