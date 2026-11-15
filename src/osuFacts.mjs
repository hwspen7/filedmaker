// Source-backed Ohio State venue facts. These are *not* surveyed seat coordinates.
// Keep published capacity, building metrics and generated seat counts separate.
export const OSU_FACTS = Object.freeze({
  'ohio-stadium': {
    name: 'Ohio Stadium', sport: 'ncaa-football', city: 'Columbus, Ohio',
    capacity: {value: 102041, year: 2026, asOf: '2026-10-13', scope: 'stadium capacity in more recent 2026 OSU game notes',
      source: 'https://ohiostatebuckeyes.com/documents/download/2026/10/13/7_Indiana.pdf'},
    historicalCapacity: {value: 102780, year: 2026, asOf: '2026-05-26',
      source: 'https://ohiostatebuckeyes.com/documents/download/2026/5/26/7_2026_FB_Media_Guide_Award_Winners_FINAL.pdf',
      note: 'Earlier 2026 media guide lists 102,780. October 2026 game notes and the OSU facts page give 102,041. Preserve both with dates.'},
    dimensions: {
      buildingLengthM: 919 * .3048, buildingWidthM: 679 * .3048,
      buildingHeightM: 136 * .3048, pressBoxRoofHeightM: 183 * .3048,
      scoreboardWidthM: 125 * .3048, scoreboardHeightM: 42 * .3048,
      source: 'https://ohiostatebuckeyes.com/sports/2023/6/2/ohio-stadium'
    },
    // The 2026 media guide prints these as separate facts. Some categories overlap:
    // the values must NEVER be summed to reconstruct the stadium capacity.
    publishedDeckFigures: {A:36483, AA:9581, B:21030, C:30873, D:2529,
      hospitalitySuitesAndLoges:2284, southStands:19748},
    deckFiguresSource: 'https://ohiostatebuckeyes.com/documents/download/2026/5/26/7_2026_FB_Media_Guide_Award_Winners_FINAL.pdf',
    seatingMap: 'https://ohiostatebuckeyes.com/sports/2018/6/4/seating-charts',
    modelNotice: 'Historic horseshoe, southern stand and west press facilities are a reference reconstruction. Exact rows, seat centers, tunnels and section boundaries remain unverified.'
  },
  'schottenstein-center': {
    name: 'Jerome Schottenstein Center', sport: 'ncaa', city: 'Columbus, Ohio',
    capacity: {value:19500, scope:'basketball configuration, published figure',
      source:'https://ohiostatebuckeyes.com/sports/2023/6/1/the-jerome-schottenstein-center'},
    alternativeCapacity: {value:19700, scope:'basketball maximum, venue quick facts',
      source:'https://www.schottensteincenter.com/events/buckeyes',
      note:'Published figures vary by configuration and source; do not calibrate generated seating to either without a seat inventory.'},
    dimensions: {buildingGrossFloorAreaSqM:770000*.09290304,
      source:'https://ohiostatebuckeyes.com/sports/2023/6/1/the-jerome-schottenstein-center',
      note:'Gross floor area across the venue, NOT building footprint or bowl diameter.'},
    court: {lengthM:94*.3048, widthM:50*.3048, type:'NCAA regulation basketball court',
      note:'Court dimensions are NCAA rules, not a survey of the OSU building.'},
    videoUpgrade: {year:2026, fourConvexFaces:true, underbellyDisplays:true,
      ribbonHeightInches:36, vomitoryDisplayCount:43, cornerDisplays:true,
      source:'https://ohiostatebuckeyes.com/news/2026/7/17/mens-ice-hockey-schottenstein-center-to-feature-video-board-enhancements-this-season',
      note:'Screen feature counts are published; their exact physical dimensions and positions are not established by this source.'},
    seatingMap:'https://ohiostatebuckeyes.com/sports/2018/6/4/seating-charts',
    mensSeatingChartImage:'https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites/ohiostatebuckeyes.com/documents/2023/7/12/Mens-basketball-2023-diagram.jpeg?timestamp=20230823042629',
    modelNotice:'Lower, premium and upper bowls are illustrative until measured seat rows, floor elevations and architectural plans are supplied.'
  }
});

export function venueFacts(id) {return OSU_FACTS[id] ?? null;}

export function venueQualityReport(project, generatedSeats) {
  const facts = venueFacts(project?.venueReference?.id);
  if (!facts) return null;
  if (!Number.isInteger(generatedSeats) || generatedSeats < 0) throw new Error('Generated seat count must be a non-negative integer.');
  return {
    venue: facts.name,
    sourceBackedCapacity: facts.capacity.value,
    publishedCapacityScope: facts.capacity.scope,
    alternatePublishedCapacity: facts.historicalCapacity?.value ?? facts.alternativeCapacity?.value ?? null,
    generatedSeatCount: generatedSeats,
    generatedMinusPublished: generatedSeats - facts.capacity.value,
    surveyedSeatCount: project?.survey?.mode === 'imported' ? (project.survey.seats?.length ?? 0) : 0,
    measuredModel: false,
    seatCoordinates: project?.survey?.mode === 'imported' ? 'imported (source must be verified)' : 'estimated (synthetic)',
    evidence: [facts.capacity.source, facts.dimensions.source, facts.seatingMap],
    warnings: [facts.modelNotice,
      'Published capacity is not the sum of generated seats; never infer individual row counts from capacity.',
      'This reference is not approved for exact-seat sightline or live ticket sales without on-site verification.']
  };
}
