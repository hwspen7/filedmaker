import { SURFACES } from './model.mjs';
import { venueFacts } from './osuFacts.mjs';

const facts = venueFacts('schottenstein-center');

// Centers of the printed section labels in the published 1024 × 795 image.
// These coordinates drive map navigation only.
const sectionLabels = [
  [101,402,267], [104,470,271], [105,548,271], [106,620,271], [107,692,271],
  [110,761,267], [111,800,318], [114,780,391], [117,809,472], [118,779,516],
  [121,691,515], [122,620,515], [123,548,515], [124,471,515], [127,403,519],
  [128,363,472], [131,382,394], [134,364,318],
  [201,348,215], [203,403,189], [204,472,189], [205,546,189], [206,620,189],
  [207,693,189], [208,759,189], [210,814,213], [211,863,261], [213,886,316],
  [214,887,395], [215,887,471], [217,863,527], [218,813,575], [220,760,600],
  [221,692,599], [222,621,599], [223,544,599], [224,472,599], [225,404,599],
  [227,345,573], [228,301,532], [230,276,469], [231,275,394], [232,278,318],
  [234,301,258],
  [301,286,156], [302,343,125], [303,408,109], [304,471,109], [305,544,108],
  [306,620,109], [307,693,109], [308,760,106], [309,821,122], [310,878,156],
  [311,926,200], [312,951,257], [313,971,318], [314,971,394], [315,971,470],
  [316,950,530], [317,922,582], [318,876,632], [319,820,662], [320,760,678],
  [321,692,663], [322,620,664], [323,544,665], [324,471,665], [325,407,664],
  [326,349,652], [327,290,631], [328,245,587], [329,216,530], [330,196,471],
  [331,193,393], [332,197,320], [333,216,259], [334,244,202],
];

export const NCAA_BASKETBALL_VENUES = Object.freeze({
  'ohio-state-men': {
    id: 'ohio-state-men',
    university: 'Ohio State University',
    name: 'Schottenstein Center',
    arena: 'Value City Arena',
    city: 'Columbus, Ohio',
    configuration: 'Men’s basketball',
    surface: SURFACES.ncaa,
    capacity: facts.capacity,
    seatingChart: {
      source: facts.seatingMap,
      image: facts.mensSeatingChartImage,
      width: 1024,
      height: 795,
      sections: sectionLabels.map(([id, x, y]) => ({id:String(id), level:Math.floor(id / 100) * 100, x, y})),
    },
    virtualVenue: {
      title: 'Ohio State Basketball Virtual Venue',
      provider: 'IOMEDIA',
      url: 'https://ohiostatebb.io-media.com/',
      guide: 'https://ohiostatebuckeyes.com/sports/2025/9/16/mbb-seat-selection-step-by-step-process',
    },
    videoBoard: {
      year: facts.videoUpgrade.year,
      source: 'https://ohiostatebuckeyes.com/news/2026/7/17/mens-basketball-schottenstein-center-to-feature-video-board-enhancements-this-season',
    },
  },
});
