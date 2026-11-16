// Deterministic parametric geometry and project validation. No DOM or 3D dependencies.
import { createSurvey, validateSurvey, importedSeats } from './survey.mjs';
import { getNBAArena } from './nbaCatalog.mjs';
import { facingYaw } from './seatPresentation.mjs';
import { buildSchottensteinSeating, schottensteinFootprints, usesSchottensteinChart } from './schottensteinSeating.mjs';
import { GeometryEngine } from './next/engines/geometry.mjs';
import { SeatingEngine } from './next/engines/seating.mjs';
export const TAU = Math.PI * 2;
export const CURRENT_SCHEMA = 5;

export const SURFACES = Object.freeze({
  nfl: { sport: 'football', label: 'NFL football', width: 48.768, length: 109.728, endZone: 9.144 },
  cfl: { sport: 'football', label: 'CFL (2026)', width: 59.436, length: 137.16, endZone: 18.288 },
  cfl27: { sport: 'football', label: 'CFL (2027)', width: 59.436, length: 118.872, endZone: 13.716 },
  soccer: { sport: 'soccer', label: 'Soccer (105 × 68 m)', width: 68, length: 105 },
  nba: { sport: 'basketball', label: 'NBA basketball', width: 15.24, length: 28.6512, threePointRadiusM: 7.24 },
  ncaa: { sport: 'basketball', label: 'NCAA basketball (94 × 50 ft)', width: 15.24, length: 28.6512, threePointRadiusM: 6.75 },
  'ncaa-football': { sport: 'football', label: 'NCAA football (120 × 53⅓ yd)', width: 48.768, length: 109.728, endZone: 9.144 },
  'nfhs-basketball': { sport: 'basketball', label: 'High-school basketball (84 × 50 ft)', width: 15.24, length: 25.6032, threePointRadiusM: 6.0198 },
  'nfhs-football': { sport: 'football', label: 'High-school football (120 × 53⅓ yd)', width: 48.768, length: 109.728, endZone: 9.144 },
  'youth-basketball': { sport: 'basketball', label: 'Small gym example (74 × 42 ft, verify locally)', width: 12.8016, length: 22.5552, threePointRadiusM: 6.0198 },
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
export const deepCopy = value => JSON.parse(JSON.stringify(value));
export const sectionColor = index => ['#547b83', '#638d94', '#477078', '#7ba0a1', '#4b777f', '#739096'][index % 6];

export function makeSections(count = 16) {
  count = Math.round(clamp(count, 4, 36));
  return Array.from({ length: count }, (_, i) => ({
    id: `S${String(i + 1).padStart(2, '0')}`,
    label: `Section ${String(i + 1).padStart(2, '0')}`,
    start: 360 * i / count,
    end: 360 * (i + 1) / count,
    enabled: true,
    color: sectionColor(i),
  }));
}

export function createProject(preset = 'nfl') {
  if (!(preset in SURFACES)) throw new Error('Unknown playing surface');
  const arena = SURFACES[preset].sport === 'basketball';
  return {
    schemaVersion: CURRENT_SCHEMA,
    title: 'Untitled Stadium',
    country: 'United States',
    city: '',
    surface: preset,
    shape: arena ? 4.1 : 4.5,
    seatPitch: arena ? 0.53 : 0.52,
    aisleWidth: arena ? 1.15 : 1.55,
    roof: arena,
    detailLevel: 'standard',
    showExterior: true,
    showFixtures: true,
    seatFirst: false,
    blueTheme: false,
    ticketing: null,
    venueReference: null,
    outline: { mode: 'parametric', points: [] },
    aisles: [],
    portals: [],
    sectionProfiles: [],
    plan: null,
    survey: createSurvey(),
    sections: makeSections(arena ? 16 : 20),
    tiers: arena ? [
      { id: 'T1', label: 'Lower bowl', rows: 18, depth: 0.83, rise: 0.32, offset: 4.2, height: 1.1, gap: 2.8, heightGap: 2.5 },
      { id: 'T2', label: 'Upper bowl', rows: 22, depth: 0.8, rise: 0.36, offset: 0, height: 0, gap: 0, heightGap: 0 },
    ] : [
      { id: 'T1', label: 'Lower deck', rows: 25, depth: 0.86, rise: 0.34, offset: 8, height: 1.65, gap: 5.4, heightGap: 3.5 },
      { id: 'T2', label: 'Club level', rows: 12, depth: 0.9, rise: 0.38, offset: 0, height: 0, gap: 6.5, heightGap: 4.0 },
      { id: 'T3', label: 'Upper deck', rows: 28, depth: 0.86, rise: 0.43, offset: 0, height: 0, gap: 0, heightGap: 0 },
    ],
  };
}

export function validateProject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a project object.');
  if (![1, 2, 3, 4, CURRENT_SCHEMA].includes(input.schemaVersion)) throw new Error(`Unsupported project schema. Expected 1, 2, 3, 4 or ${CURRENT_SCHEMA}.`);
  if (!(input.surface in SURFACES)) throw new Error('Unsupported playing surface.');
  if (!Array.isArray(input.tiers) || input.tiers.length < 1 || input.tiers.length > 4) throw new Error('Use between 1 and 4 seating tiers.');
  if (!Array.isArray(input.sections) || input.sections.length < 4 || input.sections.length > 36) throw new Error('Use between 4 and 36 sections.');
  const project = deepCopy(input);
  project.schemaVersion = CURRENT_SCHEMA;
  project.title = String(project.title || 'Untitled Stadium').slice(0, 100);
  project.country = String(project.country || '').slice(0, 80);
  project.city = String(project.city || '').slice(0, 100);
  project.shape = clamp(project.shape, 2, 8);
  project.seatPitch = clamp(project.seatPitch, 0.4, 1.1);
  project.aisleWidth = clamp(project.aisleWidth, 0, 5);
  project.roof = Boolean(project.roof);
  project.detailLevel = project.detailLevel ?? 'standard';
  if (!['draft','standard','high'].includes(project.detailLevel)) throw new Error('Invalid architectural detail level.');
  project.showExterior = project.showExterior !== false;
  project.showFixtures = project.showFixtures !== false;
  project.seatFirst = project.seatFirst === true;
  project.blueTheme = project.blueTheme === true;
  if(project.proceduralVenue != null){
    const profile=GeometryEngine.normalize(project.proceduralVenue);
    if(profile.surface!==project.surface)throw Error('Procedural surface must match project surface');
  }
  if(project.ticketing !== undefined && project.ticketing !== null){
    const t=project.ticketing;
    if(!t||typeof t!=='object'||Array.isArray(t))throw new Error('Invalid ticket metadata.');
    for(const key of ['officialCapacity','inventoryCount']){
      const v=t[key];
      if(v!==null&&v!==undefined&&(!Number.isInteger(v)||v<0||v>(key==='officialCapacity'?300000:150000))){
        throw new Error(`${key} must be a non-negative whole number within the supported limit.`);
      }
    }
    if(t.capacitySource&&(!/^https:\/\//i.test(t.capacitySource)||t.capacitySource.length>500))throw new Error('Official capacity source must be a short HTTPS URL.');
    if(t.capacityScope&&String(t.capacityScope).length>180)throw new Error('Capacity scope is too long.');
    if(t.inventoryMode&&!['none','file-import'].includes(t.inventoryMode))throw new Error('Invalid inventory metadata.');
    if(t.coordinates&&!['none','estimated','supplied-unverified'].includes(t.coordinates))throw new Error('Invalid seat-coordinate source.');
  } else project.ticketing=null;
  if (project.venueReference === undefined) project.venueReference = null;
  if (project.venueReference !== null) {
    const referenceId = String(project.venueReference?.id || '');
    if (referenceId === 'ohio-stadium') {
      project.venueReference = {
        id:'ohio-stadium', dataLevel:'documented-architecture/estimated-seating',
        seatNumbering:'synthetic',
        measurementNotice:'Architectural reference only. Exact section boundaries, seat locations and risers require survey.'
      };
    } else if (referenceId === 'schottenstein-center' && project.surface === 'ncaa') {
      project.venueReference = {
        id:'schottenstein-center', dataLevel:'published-building-facts/estimated-bowl',
        seatNumbering:'synthetic',
        measurementNotice:'Official capacity and screen features are documented. Every generated sector, row, seat coordinate and opening is estimated.'
      };
    } else if (referenceId.startsWith('nba:') && project.surface === 'nba' && getNBAArena(referenceId.slice(4))) {
      const arena = getNBAArena(referenceId.slice(4));
      project.venueReference = {
        id:referenceId,
        dataLevel: arena.modelStatus === 'identity-only' ? 'official-venue-identity-only' : 'official-identified-features/estimated-seating',
        seatNumbering:'synthetic',
        measurementNotice:'Arena identity and cited public features are documented. Bowl layout, row counts and seat coordinates are inferred and have not been verified.'
      };
    } else throw new Error('Unknown venue reference.');
  }
  if (project.outline === undefined) project.outline = { mode: 'parametric', points: [] };
  if (!project.outline || !['custom', 'parametric'].includes(project.outline.mode)) throw new Error('Invalid outline mode.');
  if (project.outline.mode === 'custom') {
    validateOutline(project.outline.points, SURFACES[project.surface]);
  } else {
    project.outline = { mode: 'parametric', points: [] };
  }
  if (project.aisles === undefined) project.aisles = [];
  if (!Array.isArray(project.aisles) || project.aisles.length > 32) throw new Error('Use at most 32 aisles.');
  const aisleIds = new Set();
  project.aisles.forEach((aisle, index) => {
    if (!aisle || typeof aisle !== 'object') throw new Error('Invalid aisle.');
    aisle.id = String(aisle.id || `A${index + 1}`).slice(0, 30);
    if (aisleIds.has(aisle.id)) throw new Error('Duplicate aisle ID.');
    aisleIds.add(aisle.id);
    aisle.angle = Number(aisle.angle);
    aisle.width = Number(aisle.width);
    if (!Number.isFinite(aisle.angle) || aisle.angle < 0 || aisle.angle >= 360) throw new Error('Aisle angles must be from 0 to below 360 degrees.');
    if (!Number.isFinite(aisle.width) || aisle.width < 0.8 || aisle.width > 10) throw new Error('Aisle width must be 0.8–10 m.');
    aisle.tier = aisle.tier || 'all';
    if (aisle.tier !== 'all' && !project.tiers.some(t => t.id === aisle.tier)) throw new Error('Aisle references a missing tier.');
  });
  const ids = new Set();
  project.tiers.forEach((tier, index) => {
    if (!tier || typeof tier !== 'object') throw new Error('Tier is invalid.');
    tier.id = `T${index + 1}`;
    tier.label = String(tier.label || `Tier ${index + 1}`).slice(0, 60);
    tier.rows = Math.round(clamp(tier.rows, 1, 75));
    tier.depth = clamp(tier.depth, 0.65, 1.8);
    tier.rise = clamp(tier.rise, 0.12, 0.75);
    tier.offset = clamp(tier.offset, 1, 60);
    tier.height = clamp(tier.height, 0.4, 30);
    tier.gap = clamp(tier.gap, 0, 30);
    tier.heightGap = clamp(tier.heightGap, 0, 15);
  });
  let lastEnd = 0;
  project.sections.forEach((section, index) => {
    if (!section || typeof section !== 'object') throw new Error('Section is invalid.');
    const id = String(section.id || `S${index + 1}`).slice(0, 30);
    if (ids.has(id)) throw new Error('Duplicate section ID.');
    ids.add(id);
    section.id = id;
    section.label = String(section.label || id).slice(0, 80);
    section.start = Number(section.start);
    section.end = Number(section.end);
    if (!Number.isFinite(section.start) || !Number.isFinite(section.end) || section.start < -0.001 || section.end > 360.001 || section.start + 0.01 >= section.end || section.start < lastEnd - 0.001) {
      throw new Error('Sections must be ordered, non-overlapping arcs within 0–360 degrees.');
    }
    lastEnd = section.end;
    section.enabled = Boolean(section.enabled);
    section.color = /^#[0-9a-fA-F]{6}$/.test(section.color) ? section.color : sectionColor(index);
  });
  // Section profiles can independently adjust the seating footprint of a tier.
  if (project.sectionProfiles === undefined) project.sectionProfiles = [];
  if (!Array.isArray(project.sectionProfiles) || project.sectionProfiles.length > 144) throw new Error('Use at most 144 section/tier profiles.');
  const profileKeys = new Set();
  project.sectionProfiles.forEach(profile => {
    if (!profile || !project.sections.some(section => section.id === profile.sectionId) || !project.tiers.some(tier => tier.id === profile.tierId)) throw new Error('Section profile references a missing section or tier.');
    const key = JSON.stringify([profile.sectionId, profile.tierId]);
    if (profileKeys.has(key)) throw new Error('Duplicate section/tier profile.');
    profileKeys.add(key);
    const finite = (value, label, low, high, integer = false) => {
      const number = Number(value);
      if (!Number.isFinite(number) || number < low || number > high || (integer && !Number.isInteger(number))) throw new Error(`${label} must be between ${low} and ${high}.`);
      return number;
    };
    profile.rows = finite(profile.rows, 'Section rows', 0, 75, true);
    profile.frontShift = finite(profile.frontShift, 'Section front shift', -4, 40);
    profile.heightShift = finite(profile.heightShift, 'Section height shift', -8, 30);
    profile.rise = finite(profile.rise, 'Section row rise', 0.12, 0.75);
    profile.depth = finite(profile.depth, 'Section row depth', 0.65, 1.8);
    const base = resolveTiers(project).find(t => t.id === profile.tierId);
    if (base.startOffset + profile.frontShift < 0.5) throw new Error('Section front shift intersects the playing surface.');
    if (base.startHeight + profile.heightShift < 0.15) throw new Error('Section elevation must remain above the playing surface.');
  });
  if (project.portals === undefined) project.portals = [];
  // Remove only untouched legacy sketch openings from the Ohio reference.
  // Earlier versions embedded five guessed portals. Those produced false
  // rectangular voids in the named real stadium. An edited user opening is
  // intentionally retained to avoid silently discarding authored geometry.
  if (project.venueReference?.id === 'ohio-stadium' && Array.isArray(project.portals)) {
    const legacy=[
      ['illustrative-east-lower','T2',9,5,11,17],
      ['illustrative-west-lower','T2',171,5,11,17],
      ['illustrative-north-lower','T2',270,5,11,17],
      ['illustrative-east-upper','T4',345,5,9,14],
      ['illustrative-west-upper','T4',195,5,9,14],
    ];
    project.portals=project.portals.filter(portal=>!legacy.some(([id,tierId,angle,width,firstRow,lastRow])=>
      portal.id===id&&portal.tierId===tierId&&portal.angle===angle&&
      portal.width===width&&portal.firstRow===firstRow&&portal.lastRow===lastRow));
  }
  if (!Array.isArray(project.portals) || project.portals.length > 40) throw new Error('Use at most 40 entrance openings.');
  const portalIds = new Set();
  project.portals.forEach((portal, index) => {
    if (!portal || typeof portal !== 'object') throw new Error('Invalid entrance opening.');
    portal.id = String(portal.id || `P${index + 1}`).slice(0, 30);
    if (portalIds.has(portal.id)) throw new Error('Duplicate entrance opening ID.');
    portalIds.add(portal.id);
    if (!project.tiers.some(tier => tier.id === portal.tierId)) throw new Error('Entrance opening references a missing tier.');
    for (const name of ['angle', 'width', 'firstRow', 'lastRow']) portal[name] = Number(portal[name]);
    if (!Number.isFinite(portal.angle) || portal.angle < 0 || portal.angle >= 360) throw new Error('Entrance opening angle must be 0–359.99 degrees.');
    if (!Number.isFinite(portal.width) || portal.width < 0.8 || portal.width > 18) throw new Error('Entrance opening width must be 0.8–18 m.');
    if (!Number.isInteger(portal.firstRow) || !Number.isInteger(portal.lastRow) || portal.firstRow < 1 || portal.lastRow < portal.firstRow || portal.lastRow > 75) throw new Error('Entrance row range is invalid.');
  });
  if (project.plan === undefined) project.plan = null;
  if (project.plan !== null) {
    const plan = project.plan;
    if (!plan || !Array.isArray(plan.paths) || plan.paths.length < 1 || plan.paths.length > 160) throw new Error('Imported plan contains an invalid number of paths.');
    const check = (value, min, max, label) => { if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid SVG ${label}.`); };
    check(plan.scale, 0.001, 100, 'scale');
    check(plan.rotation, -360, 360, 'rotation');
    check(plan.offsetX, -2000, 2000, 'X offset');
    check(plan.offsetZ, -2000, 2000, 'Z offset');
    if (!Array.isArray(plan.viewBox) || plan.viewBox.length !== 4 || plan.viewBox.some(v => !Number.isFinite(v))) throw new Error('Invalid SVG viewBox.');
    plan.name = String(plan.name || 'Imported SVG').slice(0, 80);
    plan.visible = Boolean(plan.visible);
    let totalPoints = 0;
    for (const path of plan.paths) {
      if (!path || !Array.isArray(path.points) || path.points.length < 2) throw new Error('Invalid SVG path geometry.');
      path.name = String(path.name || 'Path').slice(0, 80);
      path.closed = Boolean(path.closed);
      totalPoints += path.points.length;
      if (totalPoints > 25000) throw new Error('SVG plan exceeds the 25,000 point limit.');
      for (const point of path.points) if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z) || Math.abs(point.x) > 100000 || Math.abs(point.z) > 100000) throw new Error('SVG plan contains an invalid coordinate.');
    }
  }
  project.survey = validateSurvey(project.survey);
  return project;
}

export function resolveTiers(project) {
  const result = [];
  let nextOffset = 0;
  let nextHeight = 0;
  project.tiers.forEach((tier, index) => {
    const startOffset = index === 0 ? tier.offset : nextOffset;
    const startHeight = index === 0 ? tier.height : nextHeight;
    result.push({ ...tier, index, startOffset, startHeight });
    nextOffset = startOffset + tier.rows * tier.depth + tier.gap;
    nextHeight = startHeight + tier.rows * tier.rise + tier.heightGap;
  });
  return result;
}

export function resolveSectionTier(tier, sectionId, project) {
  const override = (project.sectionProfiles || []).find(p => p.tierId === tier.id && p.sectionId === sectionId);
  if (!override) return tier;
  return { ...tier, rows: override.rows, depth: override.depth, rise: override.rise,
    startOffset: tier.startOffset + override.frontShift,
    startHeight: tier.startHeight + override.heightShift };
}

export function perimeterPoint(angle, halfWidth, halfLength, exponent) {
  const cos = Math.cos(angle), sin = Math.sin(angle), power = 2 / exponent;
  return {
    x: halfWidth * Math.sign(cos) * Math.pow(Math.abs(cos), power),
    z: halfLength * Math.sign(sin) * Math.pow(Math.abs(sin), power),
  };
}

export function perimeterPath(halfWidth, halfLength, exponent, resolution = 512) {
  const points = [], distances = [0];
  for (let i = 0; i <= resolution; i++) {
    const angle = i * TAU / resolution;
    const point = { ...perimeterPoint(angle, halfWidth, halfLength, exponent), angle };
    points.push(point);
    if (i) distances.push(distances[i - 1] + Math.hypot(point.x - points[i - 1].x, point.z - points[i - 1].z));
  }
  return { points, distances, length: distances[resolution], resolution };
}

// A custom outline is a star-shaped, angle-ordered radial profile. This prevents
// self-intersections, negative row lengths and seats crossing the pitch.
export function outlineMinimumRadius(surface, angle, clearance = 1.5) {
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  return Math.min(c < 1e-9 ? Infinity : (surface.width / 2 + clearance) / c,
    s < 1e-9 ? Infinity : (surface.length / 2 + clearance) / s);
}
export function outlineAngle(point) {
  return (Math.atan2(point.z, point.x) + TAU) % TAU;
}
export function validateOutline(points, surface) {
  if (!Array.isArray(points) || points.length < 8 || points.length > 64) throw new Error('Custom outline needs 8–64 control points.');
  let previous = -Infinity;
  const first = outlineAngle(points[0]);
  for (const point of points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) throw new Error('Outline contains invalid coordinates.');
    if (Math.abs(point.x) > 400 || Math.abs(point.z) > 400) throw new Error('Outline control point exceeds 400 m.');
    const angle = outlineAngle(point);
    if (angle - previous < 0.025) throw new Error('Outline points must be ordered with at least 1.5° separation.');
    if (Math.hypot(point.x, point.z) < outlineMinimumRadius(surface, angle)) throw new Error('Outline must stay outside the playing surface with 1.5 m clearance.');
    previous = angle;
  }
  if (first + TAU - previous < 0.025) throw new Error('Outline closing angle is too narrow.');
  // Checking only handles is insufficient: interpolation could clip a pitch corner.
  const dummy = { outline: { mode: 'custom', points } };
  for (let i = 0; i < 720; i++) {
    const angle = i * TAU / 720;
    const point = modelPerimeterPoint(dummy, surface, angle, 0);
    if (Math.hypot(point.x, point.z) + 1e-6 < outlineMinimumRadius(surface, angle)) {
      throw new Error('Outline curve crosses the playing surface clearance.');
    }
  }
  return true;
}
export function createCustomOutline(project, controlCount = 20) {
  const surface = SURFACES[project.surface];
  const points = Array.from({ length: Math.max(8, Math.min(64, Math.round(controlCount))) }, (_, i) => {
    const angle = i * TAU / Math.max(8, Math.min(64, Math.round(controlCount)));
    const a = surface.width / 2 + 4, b = surface.length / 2 + 4;
    const radiusFromCurve = Math.pow(Math.pow(Math.abs(Math.cos(angle)) / a, project.shape) + Math.pow(Math.abs(Math.sin(angle)) / b, project.shape), -1 / project.shape);
    const radius = Math.max(radiusFromCurve, outlineMinimumRadius(surface, angle, 12));
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  });
  return { mode: 'custom', points };
}
export function modelPerimeterPoint(project, surface, angle, margin = 0) {
  if (project.outline?.mode !== 'custom') return perimeterPoint(angle, surface.width / 2 + margin, surface.length / 2 + margin, project.shape);
  const points = project.outline.points;
  const normalized = ((angle % TAU) + TAU) % TAU;
  let i = points.length - 1;
  for (let j = 0; j < points.length; j++) {
    if (outlineAngle(points[j]) > normalized) { i = j - 1; break; }
  }
  if (i < 0) i = points.length - 1;
  const j = (i + 1) % points.length;
  let a = outlineAngle(points[i]);
  let b = outlineAngle(points[j]);
  let target = normalized;
  if (j === 0) b += TAU;
  if (target < a) target += TAU;
  const t = (target - a) / (b - a);
  const r = Math.hypot(points[i].x, points[i].z) * (1 - t) + Math.hypot(points[j].x, points[j].z) * t + margin;
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}
export function modelPerimeterPath(project, surface, margin = 0, resolution = 512) {
  const points = [], distances = [0];
  for (let i = 0; i <= resolution; i++) {
    const angle = i * TAU / resolution;
    const point = { ...modelPerimeterPoint(project, surface, angle, margin), angle };
    points.push(point);
    if (i) distances.push(distances[i - 1] + Math.hypot(point.x - points[i - 1].x, point.z - points[i - 1].z));
  }
  return { points, distances, length: distances[resolution], resolution };
}

// Split a section's seat row at aisle strips, including wraparound at 0°.
// The same intervals drive visible terrace geometry and generated seat positions.
// An entrance is only cut when the enabled tier supplies enough rise for a
// walk-through aperture. A two-row opening must not become a floating hole.
// Returned geometry is schematic unless a measured opening is supplied.
export function eligiblePortal(project, portal) {
  if (!portal || !Number.isFinite(Number(portal.angle))) return null;
  const section = project.sections.find(s => s.enabled && portal.angle >= s.start && portal.angle < s.end);
  const tier = resolveTiers(project).find(t => t.id === portal.tierId);
  if (!section || !tier) return null;
  const profile = resolveSectionTier(tier, section.id, project);
  const firstRow = Math.max(1, Math.trunc(portal.firstRow));
  const lastRow = Math.min(profile.rows, Math.trunc(portal.lastRow));
  if (!Number.isFinite(firstRow) || !Number.isFinite(lastRow) || firstRow > lastRow) return null;
  const clearRise = (lastRow - firstRow + 1) * profile.rise;
  // Under-height cutouts were being rendered as white slots in the stand.
  if (clearRise < 1.85 || portal.width < 1.0) return null;
  return { portal, section, tier, profile, firstRow, lastRow, clearRise };
}

export function seatingIntervals(path, section, project, tierId = 'T1', row = null) {
  const start = distanceAtAngle(path, section.start * Math.PI / 180) + project.aisleWidth / 2;
  const end = distanceAtAngle(path, section.end * Math.PI / 180) - project.aisleWidth / 2;
  if (end <= start) return [];
  let segments = [[start, end]];
  for (const aisle of project.aisles || []) {
    if (aisle.tier !== 'all' && aisle.tier !== tierId) continue;
    const at = distanceAtAngle(path, aisle.angle * Math.PI / 180);
    for (const shift of [-path.length, 0, path.length]) {
      const low = at + shift - aisle.width / 2;
      const high = at + shift + aisle.width / 2;
      const next = [];
      for (const [s, e] of segments) {
        if (high <= s || low >= e) next.push([s, e]);
        else {
          if (low > s) next.push([s, low]);
          if (high < e) next.push([high, e]);
        }
      }
      segments = next;
    }
  }
  // Vomitories / entrance portals only remove seats within the specified row band.
  if (row !== null) {
    for (const portal of project.portals || []) {
      const valid = eligiblePortal(project, portal);
      if (!valid || valid.tier.id !== tierId || valid.section.id !== section.id || row < valid.firstRow || row > valid.lastRow) continue;
      const at = distanceAtAngle(path, portal.angle * Math.PI / 180);
      for (const shift of [-path.length, 0, path.length]) {
        const low = at + shift - portal.width / 2, high = at + shift + portal.width / 2;
        const next = [];
        for (const [s, e] of segments) {
          if (high <= s || low >= e) next.push([s, e]);
          else { if (low > s) next.push([s, low]); if (high < e) next.push([high, e]); }
        }
        segments = next;
      }
    }
  }
  return segments.filter(([s, e]) => e > s + 1e-5);
}

export function distanceAtAngle(path, radians) {
  const normalized = clamp(radians, 0, TAU) / TAU * path.resolution;
  const idx = Math.min(path.resolution - 1, Math.floor(normalized));
  const t = normalized - idx;
  return path.distances[idx] + (path.distances[idx + 1] - path.distances[idx]) * t;
}

export function pointAtDistance(path, distance) {
  const d = clamp(distance, 0, path.length);
  let low = 0, high = path.resolution;
  while (low + 1 < high) {
    const mid = (low + high) >>> 1;
    if (path.distances[mid] <= d) low = mid;
    else high = mid;
  }
  const span = path.distances[low + 1] - path.distances[low];
  const t = span ? (d - path.distances[low]) / span : 0;
  return {
    x: path.points[low].x + (path.points[low + 1].x - path.points[low].x) * t,
    z: path.points[low].z + (path.points[low + 1].z - path.points[low].z) * t,
    angle: path.points[low].angle + (path.points[low + 1].angle - path.points[low].angle) * t,
  };
}

export function generateSeats(input, { audienceLayout = true } = {}) {
  const project = validateProject(input);
  const surface = SURFACES[project.surface];
  const tiers = resolveTiers(project);
  const source = importedSeats(project.survey, project);
  const chart = audienceLayout && usesSchottensteinChart(project);
  if (source) {
    const sectionFootprints = chart ? schottensteinFootprints() : undefined;
    return { project, surface, tiers, seats: source.seats, groups: [], capacity: source.seats.length,
      seatOrigin: 'imported', registration: source.registration, elevationCount: source.elevationCount, sectionFootprints };
  }
  if (chart) {
    const reference = buildSchottensteinSeating(project.seatPitch);
    return { project, surface, tiers, ...reference, capacity: reference.seats.length,
      seatOrigin: 'generated', registration: null, elevationCount: reference.seats.length };
  }
  if(project.proceduralVenue){
    const output=SeatingEngine.generate(project.proceduralVenue);
    return {project,surface:{...surface,width:output.spec.field.width,length:output.spec.field.length},
      tiers,seats:output.seats,groups:output.groups,
      seatingRows:output.seatingRows,
      interiorSectionFootprints:output.interiorSectionFootprints,
      proceduralGeometry:output.geometry,
      proceduralSpec:output.spec,optimization:output.optimization,
      capacity:output.seats.length,seatOrigin:'generated',registration:null,
      elevationCount:output.seats.length};
  }
  const seats = [], groups = [];
  for (const tier of tiers) {
    for (let sectionIndex = 0; sectionIndex < project.sections.length; sectionIndex++) {
      const section = project.sections[sectionIndex];
      if (!section.enabled) continue;
      const geometry = resolveSectionTier(tier, section.id, project);
      if (geometry.rows === 0) continue;
      for (let row = 0; row < geometry.rows; row++) {
        const margin = geometry.startOffset + (row + 0.5) * geometry.depth;
        const path = modelPerimeterPath(project, surface, margin);
        const y = geometry.startHeight + row * geometry.rise + 0.08;
        const intervals = seatingIntervals(path, section, project, tier.id, row + 1);
        let seatNumber = 0;
        for (const [start, end] of intervals) {
          const span = end - start;
          const count = Math.floor(span / project.seatPitch);
          if (count < 1) continue;
          const from = seats.length, step = span / count;
          for (let i = 0; i < count; i++) {
            const position = pointAtDistance(path, start + (i + 0.5) * step);
            const number = ++seatNumber;
            seats.push({
              x: position.x, y, z: position.z,
              yaw: facingYaw(position.x,position.z,pointAtDistance(path,Math.max(0,start+(i+0.5)*step-.22)),pointAtDistance(path,Math.min(path.length,start+(i+0.5)*step+.22))),
              tier: tier.index, sectionId: section.id, sectionIndex,
              row: row + 1, number,
              uid: `${tier.id}-${section.id}-${row + 1}-${number}`,
            });
          }
          groups.push({ tier: tier.index, sectionIndex, row: row + 1, from, count });
        }
      }
    }
  }
  return { project, surface, tiers, seats, groups, capacity: seats.length, seatOrigin: 'generated', registration: null, elevationCount: seats.length };
}

export function sectionStats(model, sectionId) {
  const seats = model.seats.filter(seat => seat.sectionId === sectionId);
  return { seats: seats.length, rows: new Set(seats.map(seat => `${seat.tier}-${seat.row}`)).size };
}
