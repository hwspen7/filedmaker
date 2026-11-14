// Deterministic parametric geometry and project validation. No DOM or 3D dependencies.
export const TAU = Math.PI * 2;
export const CURRENT_SCHEMA = 1;

export const SURFACES = Object.freeze({
  nfl: { sport: 'football', label: 'NFL football', width: 48.768, length: 109.728, endZone: 9.144 },
  cfl: { sport: 'football', label: 'CFL (2026)', width: 59.436, length: 137.16, endZone: 18.288 },
  cfl27: { sport: 'football', label: 'CFL (2027)', width: 59.436, length: 118.872, endZone: 13.716 },
  soccer: { sport: 'soccer', label: 'Soccer (105 × 68 m)', width: 68, length: 105 },
  nba: { sport: 'basketball', label: 'NBA basketball', width: 15.24, length: 28.6512 },
  ncaa: { sport: 'basketball', label: 'NCAA basketball', width: 15.24, length: 28.6512 },
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
  if (input.schemaVersion !== CURRENT_SCHEMA) throw new Error(`Unsupported project schema. Expected ${CURRENT_SCHEMA}.`);
  if (!(input.surface in SURFACES)) throw new Error('Unsupported playing surface.');
  if (!Array.isArray(input.tiers) || input.tiers.length < 1 || input.tiers.length > 4) throw new Error('Use between 1 and 4 seating tiers.');
  if (!Array.isArray(input.sections) || input.sections.length < 4 || input.sections.length > 36) throw new Error('Use between 4 and 36 sections.');
  const project = deepCopy(input);
  project.title = String(project.title || 'Untitled Stadium').slice(0, 100);
  project.country = String(project.country || '').slice(0, 80);
  project.city = String(project.city || '').slice(0, 100);
  project.shape = clamp(project.shape, 2, 8);
  project.seatPitch = clamp(project.seatPitch, 0.4, 1.1);
  project.aisleWidth = clamp(project.aisleWidth, 0, 5);
  project.roof = Boolean(project.roof);
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

export function generateSeats(input) {
  const project = validateProject(input);
  const surface = SURFACES[project.surface];
  const tiers = resolveTiers(project);
  const seats = [], groups = [];
  for (const tier of tiers) {
    for (let row = 0; row < tier.rows; row++) {
      const margin = tier.startOffset + (row + 0.5) * tier.depth;
      const path = perimeterPath(surface.width / 2 + margin, surface.length / 2 + margin, project.shape);
      const y = tier.startHeight + row * tier.rise + 0.08;
      for (let sectionIndex = 0; sectionIndex < project.sections.length; sectionIndex++) {
        const section = project.sections[sectionIndex];
        if (!section.enabled) continue;
        const start = distanceAtAngle(path, section.start * Math.PI / 180) + project.aisleWidth / 2;
        const end = distanceAtAngle(path, section.end * Math.PI / 180) - project.aisleWidth / 2;
        const span = end - start;
        const count = Math.floor(span / project.seatPitch);
        if (count < 1) continue;
        const from = seats.length;
        const step = span / count;
        for (let i = 0; i < count; i++) {
          const position = pointAtDistance(path, start + (i + 0.5) * step);
          seats.push({
            x: position.x, y, z: position.z,
            yaw: Math.atan2(-position.x, -position.z),
            tier: tier.index, sectionId: section.id, sectionIndex,
            row: row + 1, number: i + 1,
            uid: `${tier.id}-${section.id}-${row + 1}-${i + 1}`,
          });
        }
        groups.push({ tier: tier.index, sectionIndex, row: row + 1, from, count });
      }
    }
  }
  return { project, surface, tiers, seats, groups, capacity: seats.length };
}

export function sectionStats(model, sectionId) {
  const seats = model.seats.filter(seat => seat.sectionId === sectionId);
  return { seats: seats.length, rows: new Set(seats.map(seat => `${seat.tier}-${seat.row}`)).size };
}
