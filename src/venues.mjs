// Real-venue reference profiles. Architectural measurements are NOT a seat survey.
// Reconstructed values are deliberately separate from documented facts.
import { createProject, createCustomOutline, validateProject, makeSections } from './model.mjs';

export const OHIO_STADIUM = Object.freeze({
  id: 'ohio-stadium', name: 'Ohio Stadium', city: 'Columbus', state: 'Ohio', country: 'United States',
  lengthM: 919 * 0.3048, widthM: 679 * 0.3048,
  heightM: 136 * 0.3048, pressBoxRoofM: 183 * 0.3048,
  publishedCapacity: 102041,
  scoreboardWidthM: 125 * 0.3048, scoreboardHeightM: 42 * 0.3048,
  sources: [
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
  const p = createProject('nfl');
  p.title = 'Ohio Stadium — architectural reference';
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
  p.portals = [
    {id:'illustrative-east-lower',tierId:'T2',angle:9,width:5,firstRow:11,lastRow:17},
    {id:'illustrative-west-lower',tierId:'T2',angle:171,width:5,firstRow:11,lastRow:17},
    {id:'illustrative-north-lower',tierId:'T2',angle:270,width:5,firstRow:11,lastRow:17},
    {id:'illustrative-east-upper',tierId:'T4',angle:345,width:5,firstRow:9,lastRow:14},
    {id:'illustrative-west-upper',tierId:'T4',angle:195,width:5,firstRow:9,lastRow:14},
  ];
  p.survey.venue = 'Ohio Stadium';
  p.survey.source = 'Ohio State official architectural facts and seating maps; interpretive sector geometry';
  p.survey.sourceUrl = OHIO_STADIUM.sources[0];
  p.survey.mode = 'generated';
  return validateProject(p);
}
