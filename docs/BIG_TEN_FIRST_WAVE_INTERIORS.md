# First-wave Big Ten basketball interiors

This document is the model acceptance record for the first eight schools.
The established Ohio State Schottenstein Center scene is the reference
interaction and presentation standard. The new structures **are not copies**
of its contour, row mesh, or seating identifiers.

## Implementation

- `data/big-ten/interior-reconstructions.json` records eight distinct
  evidence-linked, human-adjustable configurations.
- `src/next/engines/geometry.mjs` builds each school's separate bowl
  outline and tier profile. It supports circular, elliptical, octagonal,
  near-rectangular, and paired-grandstand layouts.
- `src/next/engines/seating.mjs` uses actual section identifiers,
  nonuniform section angles, row limits, skip rows, and area-specific
  partial cutouts. The same seat runs produce labeled 2D section polygons.
- `src/next/engines/architecture.mjs` constructs concrete seat-deck
  strips and risers from individual modeled rows. It never fills an
  entire empty grandstand sector with a generic deck.
- `src/next/venuePlan.mjs` uses documented bleacher-versus-chair
  variants where the venue source states them.
- The same models load in the **main FiledMaker home-page venue list**
  and the 18-school batch export. Section, seat-eye, and 3D modes remain
  available in the same UI as Ohio State.

### Venue-specific modeled interiors

| School | Modeled geometry difference | Source-derived seating details | Still estimates |
| --- | --- | --- | --- |
| Indiana | Opposing detached main stands and separately clipped balcony banks | A–F and G–M lower stands, AA–FF and GG–MM balcony sections | Curved side-edge endpoints, internal portal sizes and rake |
| Purdue | Circular 18-section lower/18-section upper bowl | Lower 01–18 and upper 101–118, premium blocks occupied | Exact curvature and inner/outer accessible entrances |
| Illinois | Three radially separate rings including 48-sector upper gallery | 101–120, 121–143, 201–248 | 100/200 transition and accessible suite footprints |
| Iowa | Compact sunken lower ring and distinct upper letter bank | A–N/AA–NN, student seating G–I and lower portions of E/K | Row-to-row tier transition and ADA row 42 platform |
| Michigan State | Lower/upper different shapes and material by row | Lower bench 1–9, no 10–12, lower chairs 13–28; upper chairs 1–13 and benches 14–19 | Exact student bench boundary and aisle portal widths |
| Wisconsin | Angular 3-level bowl with staggered/overhanging balcony fronts | 101–128, 201–228, 301–328; south student sections | Cantilever dimensions and Nicholas/South club boundaries |
| UCLA | Angular/octagonal bowl with nonuniform side sections | 101–126 and 200-level A/B/C subsections; 215 is media rather than spectator seating | Irregular student side polygons and individual media platform widths |
| Washington | Compact long rectangular bowl with 14 matching section columns in each row band | Sections 1–14 across rows 1–31; section 1 row 10/14 entrances | Most section-specific row widths and row break depths |

## Primary documentation

- Indiana 2026–27 seating diagram:
  https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites/iuhoosiers.com/documents/2026/4/30/MBB_2027_Seating_Configuration.pdf?timestamp=20260430075019
- Purdue Mackey official seating map:
  https://purduesports.com/mens-basketball-ticket-information
- Illinois basketball configuration:
  https://www.statefarmcenter.com/assets/doc/production_guide_19-4d1fa8277a.pdf
- Iowa arena game day guide:
  https://hawkeyesports.com/mbbgameday
- Michigan State Breslin Center seating requirements:
  https://msuspartans.com/sports/2018/7/20/facilities-breslin-center-section-map-html
- Wisconsin basketball chart:
  https://uwbadgers.com/documents/download/2023/6/27/MBB_Kohl_Center_Seating_Map_2024.pdf
- UCLA 2026–27 men’s ticket map:
  https://www.woodenathleticfund.com/assets/media/tickets-and-parking/2026-27-mbb-seating-map.pdf
- Washington arena section overview:
  https://gohuskies.com/facilities/alaska-airlines-arena/41

## How to inspect

Switch schools through the **VENUE** sidebar of the FiledMaker homepage.
The 2D Map displays individual section polygons and the same documented
section IDs as the seat selector. The 3D Overview displays the reconstructed
row-supported seating bowl, and Seat View uses the exact modeled seat positions.

Run `npm run verify` and
`npm run generate:big-ten -- --out build/big-ten-18 --html --strict`.
CI browser acceptance captures three first-wave screenshots per school:
`studio-ID-sections.png`, `studio-ID-interior.png`, and
`studio-ID-seat-eye.png`.

## Quality boundaries

Passing the collision audit, capacity tolerance, and 3D screenshot test
means a model is **functioning and individually differentiated**, not
photographically or architecturally certified.

The public seating maps document section identity and some row boundaries.
They do **not** publish survey-grade XYZ geometry for every chair, exact
portal shape, wheelchair platform, seat width, structural profile or
spectator sightline. Consequently the eight first-wave bowl outlines are
chart-informed human edits, not official licensed CAD meshes. They need
visual comparison and per-section adjustments against authoritative
photos or architectural drawings before they can be described as
fully OSU-equivalent reconstructions or production-ready ticket inventory.

The original Ohio State preset is unchanged.
