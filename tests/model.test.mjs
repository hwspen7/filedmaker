import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SURFACES, createProject, makeSections, validateProject, generateSeats,
  resolveTiers, sectionStats, perimeterPath, pointAtDistance, distanceAtAngle,
} from '../src/model.mjs';

for (const preset of Object.keys(SURFACES)) {
  test(`preset ${preset} produces valid geometry and unique seats`, () => {
    const model = generateSeats(createProject(preset));
    assert.equal(model.surface, SURFACES[preset]);
    assert.ok(model.capacity > 5000 && model.capacity < 200000);
    assert.equal(new Set(model.seats.map(seat => seat.uid)).size, model.capacity);
    assert.equal(model.groups.reduce((sum, group) => sum + group.count, 0), model.capacity);
    for (const seat of model.seats) {
      assert.ok([seat.x, seat.y, seat.z, seat.yaw].every(Number.isFinite));
      assert.ok(seat.row >= 1);
      assert.ok(seat.number >= 1);
    }
  });
}
test('field specifications remain in meter units', () => {
  assert.equal(SURFACES.nfl.length, 120 * 0.9144);
  assert.equal(SURFACES.cfl.width, 65 * 0.9144);
  assert.equal(SURFACES.nba.width, 50 * 0.3048);
  assert.equal(SURFACES.soccer.length, 105);
});
test('tier front offsets and heights are derived from previous tiers', () => {
  const project = createProject('soccer');
  const tiers = resolveTiers(project);
  assert.equal(tiers.length, 3);
  assert.equal(tiers[1].startOffset, tiers[0].startOffset + tiers[0].rows * tiers[0].depth + tiers[0].gap);
  assert.equal(tiers[1].startHeight, tiers[0].startHeight + tiers[0].rows * tiers[0].rise + tiers[0].heightGap);
});
test('sections are contiguous by default and bounded by full circle', () => {
  const sections = makeSections(13);
  assert.equal(sections[0].start, 0);
  assert.equal(sections.at(-1).end, 360);
  for (let i = 1; i < sections.length; i++) assert.ok(Math.abs(sections[i].start - sections[i - 1].end) < 1e-9);
});
test('disabled sections remove all seats from their sector', () => {
  const project = createProject('nba');
  const before = generateSeats(project).capacity;
  const removedId = project.sections[0].id;
  project.sections[0].enabled = false;
  const model = generateSeats(project);
  assert.ok(model.capacity < before);
  assert.equal(sectionStats(model, removedId).seats, 0);
});
test('increased row count increases model capacity', () => {
  const project = createProject('nfl');
  const initial = generateSeats(project).capacity;
  project.tiers[0].rows += 3;
  assert.ok(generateSeats(project).capacity > initial);
});
test('larger aisle gaps reduce capacity', () => {
  const project = createProject('nba');
  const initial = generateSeats(project).capacity;
  project.aisleWidth = 4.5;
  assert.ok(generateSeats(project).capacity < initial);
});
test('custom section arcs affect capacity and stay non-overlapping', () => {
  const project = createProject('nba');
  const initial = generateSeats(project).capacity;
  project.sections[2].start += 4;
  project.sections[2].end -= 3;
  const model = generateSeats(project);
  assert.ok(model.capacity < initial);
  assert.throws(() => validateProject({ ...project, sections: project.sections.map((s, i) => i === 2 ? { ...s, start: 0 } : s) }), /non-overlapping/);
});
test('invalid schema and empty tiers are rejected', () => {
  const p = createProject('nfl');
  assert.throws(() => validateProject({ ...p, schemaVersion: 999 }), /Unsupported project schema/);
  assert.throws(() => validateProject({ ...p, tiers: [] }), /between 1 and 4/);
});
test('input constraints are clamped and source is never mutated', () => {
  const p = createProject('nba');
  p.shape = 99;
  p.tiers[0].rows = 1000;
  const validated = validateProject(p);
  assert.equal(validated.shape, 8);
  assert.equal(validated.tiers[0].rows, 75);
  assert.equal(p.shape, 99);
});
test('path interpolation is continuous and finite', () => {
  const path = perimeterPath(50, 65, 4.5);
  assert.ok(path.length > 0);
  assert.deepEqual(pointAtDistance(path, 0).x, pointAtDistance(path, path.length).x);
  assert.equal(distanceAtAngle(path, Math.PI * 2), path.length);
  for (const fraction of [0, 0.15, 0.5, 0.77, 1]) {
    const point = pointAtDistance(path, path.length * fraction);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z));
  }
});
test('duplicate section ids and invalid colors are validated', () => {
  const p = createProject('soccer');
  p.sections[0].color = 'red';
  assert.match(validateProject(p).sections[0].color, /^#[0-9a-f]{6}$/i);
  p.sections[1].id = p.sections[0].id;
  assert.throws(() => validateProject(p), /Duplicate section ID/);
});
