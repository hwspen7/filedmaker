import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAU, SURFACES, CURRENT_SCHEMA, createProject, createCustomOutline,
  validateOutline, validateProject, generateSeats, modelPerimeterPoint,
  modelPerimeterPath, outlineMinimumRadius, outlineAngle,
  seatingIntervals, resolveTiers,
} from '../src/model.mjs';

for (const key of Object.keys(SURFACES)) {
  test(`${key} can generate editable outline with valid three-dimensional seats`, () => {
    const project = createProject(key);
    project.outline = createCustomOutline(project);
    const model = generateSeats(project);
    assert.equal(project.outline.points.length, 20);
    assert.ok(model.capacity > 2000);
    assert.equal(new Set(model.seats.map(s => s.uid)).size, model.capacity);
    assert.equal(model.groups.reduce((n, g) => n + g.count, 0), model.capacity);
    for (const angle of [0, 0.3, Math.PI / 2, 1.93, 3.7, TAU]) {
      const point = modelPerimeterPoint(project, SURFACES[key], angle);
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z));
      assert.ok(Math.hypot(point.x, point.z) > 0);
    }
  });
}

test('schema v1 projects migrate to v2 without losing tier or section definitions', () => {
  const legacy = createProject('soccer');
  legacy.schemaVersion = 1;
  delete legacy.outline;
  delete legacy.aisles;
  legacy.tiers[0].rows = 14;
  const migrated = validateProject(legacy);
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA);
  assert.deepEqual(migrated.aisles, []);
  assert.equal(migrated.outline.mode, 'parametric');
  assert.equal(migrated.tiers[0].rows, 14);
  assert.equal(generateSeats(migrated).capacity, generateSeats(legacy).capacity);
});

test('outline controls are ordered, have finite coordinates and do not intersect pitch', () => {
  const project = createProject('nfl');
  project.outline = createCustomOutline(project);
  const p = project.outline.points;
  assert.equal(validateOutline(p, SURFACES.nfl), true);
  const bad = structuredClone(p);
  bad[0] = { x: 0, z: 0 };
  assert.throws(() => validateOutline(bad, SURFACES.nfl), /outside the playing surface/);
  bad[0] = { x: 2, z: Number.NaN };
  assert.throws(() => validateOutline(bad, SURFACES.nfl), /invalid coordinates/);
  const disordered = structuredClone(p);
  disordered[1] = { ...disordered[2] };
  assert.throws(() => validateOutline(disordered, SURFACES.nfl), /ordered/);
});

test('custom profile is continuous at the wrap seam and along an aisle', () => {
  const project = createProject('nba');
  project.outline = createCustomOutline(project);
  const surface = SURFACES.nba;
  const path = modelPerimeterPath(project, surface, 3, 720);
  assert.ok(path.length > 0);
  const left = modelPerimeterPoint(project, surface, TAU - 1e-6, 3);
  const right = modelPerimeterPoint(project, surface, 1e-6, 3);
  assert.ok(Math.hypot(left.x - right.x, left.z - right.z) < 0.01);
  for (let i = 0; i < 720; i++) {
    const a = i * TAU / 720;
    const point = modelPerimeterPoint(project, surface, a);
    assert.ok(Math.hypot(point.x, point.z) >= outlineMinimumRadius(surface, a) - 1e-6);
  }
});

test('multiple radial aisles remove real seat positions without duplicate seat IDs', () => {
  const project = createProject('soccer');
  const initial = generateSeats(project);
  project.aisles = [
    { id: 'A1', angle: 2, width: 3, tier: 'all' },
    { id: 'A2', angle: 130, width: 4, tier: 'all' },
    { id: 'A3', angle: 357, width: 2, tier: 'all' },
  ];
  const changed = generateSeats(project);
  assert.ok(changed.capacity < initial.capacity);
  assert.equal(changed.capacity, changed.groups.reduce((sum, group) => sum + group.count, 0));
  assert.equal(new Set(changed.seats.map(seat => seat.uid)).size, changed.capacity);
  const row = changed.seats.filter(s => s.tier === 0 && s.row === 1 && s.sectionIndex === 0);
  assert.ok(row.every((seat, i) => i === 0 || seat.number === row[i - 1].number + 1));
});

test('aisle may affect one specific tier without reducing other tiers', () => {
  const project = createProject('nfl');
  const initial = generateSeats(project);
  project.aisles = [{ id: 'A1', angle: 88, width: 8, tier: 'T2' }];
  const changed = generateSeats(project);
  assert.ok(changed.capacity < initial.capacity);
  for (const tier of [0, 2]) {
    assert.equal(initial.seats.filter(s => s.tier === tier).length, changed.seats.filter(s => s.tier === tier).length);
  }
  assert.ok(initial.seats.filter(s => s.tier === 1).length > changed.seats.filter(s => s.tier === 1).length);
});

test('invalid aisle definitions fail validation and do not modify sources', () => {
  const original = createProject('nba');
  original.aisles = [{ id: 'A1', angle: 23, width: 1.8, tier: 'all' }];
  const valid = validateProject(original);
  assert.deepEqual(valid.aisles, original.aisles);
  assert.notEqual(valid, original);
  const duplicate = structuredClone(original);
  duplicate.aisles.push({ ...duplicate.aisles[0] });
  assert.throws(() => validateProject(duplicate), /Duplicate aisle ID/);
  const invalid = structuredClone(original);
  invalid.aisles[0].angle = 360;
  assert.throws(() => validateProject(invalid), /angles/);
  invalid.aisles[0].angle = 0;
  invalid.aisles[0].tier = 'T99';
  assert.throws(() => validateProject(invalid), /missing tier/);
});

test('aisle segments subtract their widths from the rendered terrace path', () => {
  const project = createProject('nba');
  const surface = SURFACES.nba;
  const tier = resolveTiers(project)[0];
  const path = modelPerimeterPath(project, surface, tier.startOffset);
  const section = project.sections[0];
  const before = seatingIntervals(path, section, project, tier.id);
  project.aisles = [{ id: 'A1', angle: (section.start + section.end) / 2, width: 3, tier: 'T1' }];
  const after = seatingIntervals(path, section, project, tier.id);
  const total = list => list.reduce((n, [s, e]) => n + e - s, 0);
  assert.equal(before.length, 1);
  assert.equal(after.length, 2);
  assert.ok(Math.abs(total(before) - total(after) - 3) < 1e-4);
});
