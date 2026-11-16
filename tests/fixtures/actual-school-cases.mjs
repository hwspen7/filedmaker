// Transcribed facts from publicly available architectural/venue documents.
// These are real source facts, NOT invented per-row seating maps.
export const REAL_SCHOOL_CASES=[
  {
    id:'aiken-high-taylor-gym',
    name:'Aiken High School James A. Taylor Gymnasium',
    source:{url:'https://core-docs.s3.us-east-1.amazonaws.com/documents/asset/uploaded_file/4726/district/4317364/AHS_Gym_Renovation_Design_Development__04_18_19_.pdf',
      document:'2019 design-development floor plans',page:4},
    precision:'exact',documentedSeats:1418,
    banks:[{id:'BANK A',netSeats:284},{id:'BANK B',netSeats:431},
      {id:'BANK C',netSeats:431},{id:'BANK D',netSeats:272}],
    notes:['Row-by-row inventory and surveyed bank contours not included in benchmark']
  },{
    id:'sanderson-high-main-gym',
    name:'Sanderson High School Main Gymnasium',
    source:{url:'https://primusstructures.com/wp-content/uploads/2023/12/Sanderson-High-Main-Gym-Improvements-Plan-Set.pdf',
      document:'2024 renovation floor plan A200'},
    precision:'exact',documentedSeats:929,accessiblePositions:12,
    banks:[{id:'BANK A',netSeats:461,grossSeats:592},
      {id:'BANK B',netSeats:468,grossSeats:592}],
    notes:['Published 929 net seats and 12 H/C positions must not be silently added as identical seat inventory',
      'Bank-by-row layout remains unverified']
  },{
    id:'hatton-school-gym',
    name:'Hatton School Gymnasium',
    source:{url:'https://dominguezdesign-build.com/wp-content/uploads/2024/03/Drawings-Addition-to-Hatton-High-School.pdf',
      document:'2024 code plan G1.2'},
    precision:'exact',documentedSeats:1318,
    banks:[{id:'BANK A',netSeats:485},{id:'BANK B',netSeats:180},
      {id:'BANK C',netSeats:653}],
    notes:['Published bank capacities do not establish row counts or seat labels']
  },{
    id:'howard-county-ms20',
    name:'Howard County Middle School No. 20, proposed gymnasium',
    source:{url:'https://www.hcpss.org/f/schoolplanning/ms20_designdevrpt_071212.pdf',
      document:'2012 design report, gymnasium bleacher plan'},
    precision:'exact',documentedSeats:180,accessiblePositions:1,
    banks:[{id:'UPPER BLOCK',netSeats:40},{id:'REAR ROW GROUP',netSeats:44},
      {id:'MIDDLE BLOCK',netSeats:56},{id:'LOWER BLOCK',netSeats:40}],
    notes:['Four drawing labels are count groups, not necessarily independent geometric banks',
      'The document identifies five rows and 22-inch row spacing but does not provide unambiguous seat count by row']
  },{
    id:'northview-junior-academy',
    name:'Northview Junior Academy Gymnasium',
    source:{url:'https://www.toadvine.com/portfolio/northview-junior-academy',
      document:'Vendor portfolio: approximately 534 seats, two 11-row bleacher banks'},
    precision:'approximate',documentedSeats:534,
    banks:[{id:'BANK 1',netSeats:null},{id:'BANK 2',netSeats:null}],
    notes:['Approximate 534 capacity cannot be used as a ticket-authoritative exact count',
      'Each bank contains 11 rows, but their separate capacities are not given']
  },{
    id:'wills-point-main-gym',
    name:'Wills Point High School Main Gym',
    source:{url:'https://origin.secure.website/wscfus/9532611/30644925/wills-point-gym-information.pdf',
      document:'2022–23 spectator information and seating map',page:3},
    precision:'unknown',documentedSeats:null,
    banks:[{id:'SPECTATOR SECTION 1',netSeats:null},
      {id:'SPECTATOR SECTION 2',netSeats:null},
      {id:'SPECTATOR SECTION 3',netSeats:null}],
    notes:['Official source provides section labels and spectator entry guidance, but not the seat inventory']
  }
];
export const BAY_PORT_PAC_SAMPLE_ROWS=[
  {section:'HOUSE LEFT',row:'A',seats:8,seat_start:1,seat_type:'chair',
    seat_numbers:'A1|A3|A5|A7|A9|A11|A13|A15'},
  {section:'CENTER',row:'A',seats:14,seat_start:101,seat_type:'chair',
    seat_numbers:Array.from({length:14},(_,i)=>'A'+(114-i)).join('|')},
  {section:'HOUSE RIGHT',row:'A',seats:8,seat_start:2,seat_type:'chair',
    seat_numbers:'A2|A4|A6|A8|A10|A12|A14|A16'},
  {section:'HOUSE LEFT',row:'B',seats:9,seat_start:1,seat_type:'chair',
    seat_numbers:'B1|B3|B5|B7|B9|B11|B13|B15|B17'},
  {section:'CENTER',row:'B',seats:14,seat_start:101,seat_type:'chair',
    seat_numbers:Array.from({length:14},(_,i)=>'B'+(114-i)).join('|')},
  {section:'HOUSE RIGHT',row:'B',seats:9,seat_start:2,seat_type:'chair',
    seat_numbers:'B2|B4|B6|B8|B10|B12|B14|B16|B18'}
];
