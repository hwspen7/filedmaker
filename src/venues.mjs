// Real-venue reference profiles. Architectural measurements are NOT a seat survey.
// Reconstructed values are deliberately separate from documented facts.
import { createProject, createCustomOutline, validateProject, makeSections } from './model.mjs';
import { OSU_FACTS } from './osuFacts.mjs';

export const OHIO_STADIUM = Object.freeze({
  id: 'ohio-stadium', name: 'Ohio Stadium', city: 'Columbus', state: 'Ohio', country: 'United States',
  lengthM: 919 * 0.3048, widthM: 679 * 0.3048,
  heightM: 136 * 0.3048, pressBoxRoofM: 183 * 0.3048,
  publishedCapacity: OSU_FACTS['ohio-stadium'].capacity.value,
  scoreboardWidthM: 125 * 0.3048, scoreboardHeightM: 42 * 0.3048,
  sources: [
    OSU_FACTS['ohio-stadium'].capacity.source,
    'https://ohiostatebuckeyes.com/sports/2023/6/2/ohio-stadium',
    'https://ohiostatebuckeyes.com/sports/2022/8/17/maps',
    'https://library.osu.edu/a-walk-in-our-shoe/renovations',
    'https://ohiostatebuckeyes.com/news/2022/2/7/new-ohio-stadium-field-turf-design-announced',
  ],
});

export function isOhioReference(project) {
  return project?.venueReference?.id === OHIO_STADIUM.id;
}

export function ohioSectionRegion(angleDegrees) {
  // In the FiledMaker coordinate system north is -Z, south is +Z,
  // east is +X and west is -X. These are *visual sectors*, not ticket numbers.
  const a = ((angleDegrees % 360) + 360) % 360;
  if (a >= 48 && a < 132) return 'south';
  if (a >= 228 && a < 312) return 'north';
  return a < 180 ? 'east' : 'west';
}

export function ohioTierRowCount(tierId, angleDegrees, baseRows) {
  const zone = ohioSectionRegion(angleDegrees);
  if (zone === 'south' && tierId === 'T4') return 0; // Separates historic upper horseshoe from permanent South Stands.
  if (zone === 'south' && tierId === 'T3') return Math.min(baseRows, 10);
  return baseRows;
}

export function ohioFactReport(project, generatedCount = 0) {
  return {
    venue: OHIO_STADIUM.name,
    publishedDimensions: `${OHIO_STADIUM.lengthM.toFixed(1)} × ${OHIO_STADIUM.widthM.toFixed(1)} m`,
    publishedCapacity: OHIO_STADIUM.publishedCapacity,
    publishedCapacityYear: OSU_FACTS['ohio-stadium'].capacity.year,
    previouslyPublishedCapacity: OSU_FACTS['ohio-stadium'].historicalCapacity.value,
    generatedReferenceSeats: generatedCount,
    officialSeatCoordinatesAvailable: false,
    reconstructionStatus: 'architectural interpretation — not surveyed',
    notes: [
      'Horseshoe upper bowl, permanent south stands, west-side premium/press structures and north rotunda reflect official venue descriptions.',
      'Individual aisle positions, rows, seat numbering, facade bays and bowl radii are illustrative until measured drawings are obtained.',
      'The generated seat count is NOT official venue capacity.',
    ],
    sources: [...OHIO_STADIUM.sources],
  };
}

export function createOhioStadiumProject() {
  const p = createProject('ncaa-football');
  p.title = 'Ohio Stadium — 2026 architectural reference';
  p.country = 'United States';
  p.city = 'Columbus';
  p.shape = 3.15;
  p.seatPitch = 0.55;
  p.aisleWidth = 1.34;
  p.roof = false;
  p.detailLevel = 'high';
  p.showExterior = true;
  p.showFixtures = true;
  p.venueReference = {
    id: OHIO_STADIUM.id,
    dataLevel: 'documented-architecture/estimated-seating',
    seatNumbering: 'synthetic',
    measurementNotice: 'Architectural reference only. Exact section boundaries, seat locations and risers require survey.',
  };
  p.sections = makeSections(32).map((s, i) => {
    const region = ohioSectionRegion((s.start + s.end) / 2);
    return {
      ...s,
      label: `${region[0].toUpperCase() + region.slice(1)} bowl sector ${String(i + 1).padStart(2,'0')}`,
      // Scarlet and neutral gray approximate the stadium's broad seat-color pattern.
      color: i % 6 === 0 || i % 6 === 1 ? '#a9293d' : i % 6 === 4 ? '#a4a9a9' : '#778387',
    };
  });
  p.tiers = [
    { id: 'T1', label: 'AA deck / field-level interpretation', rows: 12, depth: .80, rise: .28, offset: 4.5, height: .9, gap: 2.0, heightGap: 1.9 },
    { id: 'T2', label: 'A deck / lower bowl interpretation', rows: 25, depth: .81, rise: .34, offset: 0, height: 0, gap: 2.4, heightGap: 2.5 },
    { id: 'T3', label: 'B / club-tier interpretation', rows: 12, depth: .83, rise: .38, offset: 0, height: 0, gap: 2.4, heightGap: 3.1 },
    { id: 'T4', label: 'C / upper horseshoe interpretation', rows: 22, depth: .86, rise: .52, offset: 0, height: 0, gap: 0, heightGap: 0 },
  ];
  // A super-elliptical plan with a curved north bowl and straightened side walls.
  // All control-point radii are inferred from reference imagery, not architectural CAD.
  p.outline = createCustomOutline(p, 48);
  p.outline.points = p.outline.points.map(point => ({
    x: Number((point.x * (point.z < 0 ? 1.025 : .995)).toFixed(3)),
    z: Number((point.z * (point.z < 0 ? 1.025 : 1.015)).toFixed(3)),
  }));
  p.sectionProfiles = [];
  for (const section of p.sections) {
    const angle = (section.start + section.end) / 2;
    for (const tier of p.tiers) {
      const rows = ohioTierRowCount(tier.id, angle, tier.rows);
      if (rows === tier.rows) continue;
      p.sectionProfiles.push({sectionId: section.id, tierId: tier.id, rows,
        frontShift: 0, heightShift: 0, rise: tier.rise, depth: tier.depth});
    }
  }
  p.aisles = Array.from({length: 14}, (_,i)=>({
    id:`illustrative-aisle-${i+1}`, angle: Number(((i+.5)*360/14).toFixed(3)), width: 1.45, tier:'all',
  }));
  // Real portal locations and opening dimensions have not been verified.
  // Do not invent conspicuous cutouts in a named real stadium. Schools can
  // add evidence-backed openings from surveyed CAD/SVG or venue photos.
  p.portals = [];
  p.survey.venue = 'Ohio Stadium';
  p.survey.source = 'Ohio State official architectural facts and seating maps; interpretive sector geometry';
  p.survey.sourceUrl = OHIO_STADIUM.sources[0];
  p.survey.mode = 'generated';
  return validateProject(p);
}

// NCAA basketball sample. The venue identity, capacities and 2026 video-board
// features are documented. Geometry deliberately remains non-surveyed.
export const SCHOTTENSTEIN_CENTER = Object.freeze({
  id: 'schottenstein-center',
  name: OSU_FACTS['schottenstein-center'].name,
  basketballCapacity: OSU_FACTS['schottenstein-center'].capacity.value,
  buildingGrossFloorAreaSqM: OSU_FACTS['schottenstein-center'].dimensions.buildingGrossFloorAreaSqM,
  sources: [
    OSU_FACTS['schottenstein-center'].capacity.source,
    OSU_FACTS['schottenstein-center'].videoUpgrade.source,
    OSU_FACTS['schottenstein-center'].seatingMap
  ]
});

export const isSchottensteinReference = project => project?.venueReference?.id === SCHOTTENSTEIN_CENTER.id;

export function createSchottensteinCenterProject() {
  const p = createProject('ncaa');
  p.title = 'Jerome Schottenstein Center — basketball reference';
  p.city = 'Columbus';
  p.country = 'United States';
  p.roof = true;
  p.detailLevel = 'high';
  p.shape = 4.25;
  p.seatPitch = .54;
  p.aisleWidth = 1.2;
  p.showExterior = true;
  p.showFixtures = true;
  // Sectors and each row count are illustrative, not an OSU section inventory.
  p.sections = makeSections(24).map((sector, index) => ({
    ...sector,
    label: `Illustrative arena sector ${String(index+1).padStart(2,'0')}`,
    color: index % 6 === 0 ? '#bb243b' : index % 4 === 1 ? '#42464d' : '#8d9298',
  }));
  p.tiers = [
    {id:'T1',label:'Lower bowl — illustrative', rows:20,depth:.81,rise:.32,offset:3.0,height:1.0,gap:3.8,heightGap:3.0},
    {id:'T2',label:'Huntington Club / premium level — illustrative', rows:8,depth:.86,rise:.38,offset:0,height:0,gap:4.8,heightGap:3.1},
    {id:'T3',label:'Upper bowl — illustrative', rows:20,depth:.82,rise:.44,offset:0,height:0,gap:0,heightGap:0},
  ];
  p.aisles = Array.from({length:16}, (_,i)=>({
    id:`schematic-aisle-${i+1}`,angle:(i+.5)*22.5,width:1.12,tier:'all'
  }));
  // No tunnel is cut unless its real position is verified; automatic black holes
  // were an earlier defect in reference models.
  p.portals=[];
  p.venueReference = {
    id:SCHOTTENSTEIN_CENTER.id,
    dataLevel:'published-building-facts/estimated-bowl',
    seatNumbering:'synthetic',
    measurementNotice:'Schottenstein Center reference: no verified seat coordinates, tier elevations, tunnel locations or structural dimensions.'
  };
  p.survey.venue = SCHOTTENSTEIN_CENTER.name;
  p.survey.source = 'OSU athletics and Schottenstein Center official public information; estimated arena geometry';
  p.survey.sourceUrl = SCHOTTENSTEIN_CENTER.sources[0];
  p.survey.mode='generated';
  return validateProject(p);
}
