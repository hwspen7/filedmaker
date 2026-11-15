import { parseTicketRosterCSV } from './seatFirst.mjs';

export function readSeatSurvey(csv) {
  const { seats, hasCoordinates } = parseTicketRosterCSV(csv);
  if (!hasCoordinates || seats.some(seat => seat.y === null)) {
    throw new Error('Supply surveyed x_m, y_m and z_m for every seat. A name or row number cannot establish a physical position.');
  }
  const positions = new Set();
  for (const {x,y,z,id} of seats) {
    const key = JSON.stringify([x,y,z]);
    if (positions.has(key)) throw new Error(`Duplicate XYZ position at seat ${id}.`);
    positions.add(key);
  }
  return seats;
}

export function buildSurveyPointPlan(seats, surface) {
  const points = seats.map(seat => ({
    uid: seat.id,
    sectionId: seat.section,
    row: seat.row,
    number: seat.number,
    x: seat.x,
    y: seat.y,
    z: seat.z,
  }));
  const instanceData = new Float32Array(points.length * 11);
  for (const [i, {x,y,z}] of points.entries()) {
    instanceData.set([x,y,z,.20,.12,.20,0,.67,.18,.23,i], i * 11);
  }
  return {surface, pointOnly:true, seats:points, instanceCount:points.length, instanceData};
}
