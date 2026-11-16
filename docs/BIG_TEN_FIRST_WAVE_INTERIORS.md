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
  source-verified section adjacency, row limits and independently
  supported voids. Unsupported hand-drawn portal gaps were removed; the
  same modeled seat runs produce the labeled 2D section polygons.
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
| Purdue | Circular 18-section lower/18-section upper bowl | Lower **1–18** (no leading zeros) and upper 101–118, premium blocks 8–11 remain occupied | Exact curvature and inner/outer accessible entrances |
| Illinois | Three radially separate rings including 48-sector upper gallery | 101–120; 121–129 and 134–143 with a suite-space interruption; 201–248 | Court-level 9–13 are reconstructed using published student-section row labels; exact individual seat XY and suite/ADA geometry remain estimated |
| Iowa | Compact sunken ring with **28 contiguous full-height section columns** | A, AA, BB, ... NN, N, M, ... B in clockwise order. Both modeled row-depth bands use these same labels, with students in G–I and lower E/K | Verified section-specific row depths, courtside ECS/SCS/NCS and ADA positions remain unmodeled |
| Michigan State | Lower/upper different shapes and material by row | Lower bench 1–9, no 10–12, lower chairs 13–28; upper chairs 1–13 and benches 14–19 | Exact student bench boundary and aisle portal widths |
| Wisconsin | Angular 3-level bowl with staggered/overhanging balcony fronts | 101–128, 201–228, 301–328; south student sections | Source-labeled N128/N101/N102, SC114–116, CCN/CCS premium blocks remain **unmodeled**, as do cantilever survey dimensions |
| UCLA | Angular/octagonal bowl with distinct sideline and corner banks | 101–126; individually placed 206A/B/C, 210A/B, 211A/B/C, 219A/B/C, 223A/B, 224A/B/C; **215 MEDIA**, no seats | Exact student/ADA polygons and Pauley Perch table locations not surveyed |
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

## Verified chart alignment corrections (November 2026)

`data/big-ten/section-chart-verified-order.json` is the authority for
section identifiers and neighbor order of these eight venues. It rejects
fabricated section IDs, records documented but unmodeled areas, and keeps
estimated angular dimensions separate from section identity. Generic cyclic
section widths, false zero-padding, and fictitious internal tunnels were
removed from the first-wave generator. The actual official diagram can now
be opened directly beside the capacity note on each Big Ten arena page.

The source-linked diagram **does not certify** the curve of each 3D section,
actual portal opening, individual row length, seat inventory, or survey
coordinates. A section marked as official means its *label and chart
location* were checked, not that its 3D vertices were measured. Any
unmodeled documented section remains listed as missing rather than being
silently approximated into a different section.

The original Ohio State preset is unchanged.

### Illinois State Farm Center visual correction

The earlier 3D overview displayed a thick gray ring even after the exterior
facade was hidden. That ring came from the generic concourse, gallery soffit,
roofDeck and backWall layers. The interior renderer now displays only the
seat-row treads, fascias, aisle edges and actual seat instances for non-OSU
bowl interiors. The *Building exterior* mode continues to show the shell.

The Illinois 100 lower deck now uses a court-oriented rounded-rectangle
contour rather than the same circular curve as its 200-level upper gallery.
Published section-specific row spans are applied to 101, 102, 110, 119, 121,
125, 127 and 201, including the A/B/C lettered courtside-leading rows and
the 201 first present row 6. Documented east-side student seating sections
9–13 are now represented as separate court-edge seating banks with authentic
row labels. Their specific chair coordinates, platform edges and row widths
remain *diagram-derived estimates*, not authoritative seat inventory.
