# Big Ten venue-quality parity: measured progress, not capacity theater

## Intent

The OSU Schottenstein project is the visual-quality reference. This expansion
**does not copy the OSU arena mesh**. It reuses shared geometry, seat placement,
architecture, material and camera engines, but reconstructs each arena's
real seat sections and building features using its own reference documents.

**A correct capacity total is not visual fidelity.** An arena is NOT ready for
"OSU-equivalent" labeling until the following independent tests pass:

1. Sourced basketball-specific section map for the target season.
2. Each section's actual polygon contour (not just a uniform radial wedge),
   drawn and aligned to a source seating diagram, with known aisle cutouts.
3. Section-specific row labels, row extents, premium/wheelchair gaps,
   and rear-terrace elevations calibrated to available photos.
4. Local basketball floor furnishings, court proportions, concourse
   geometry, distinctive scoreboard and any raised/split balconies.
5. Distinct exterior silhouette, wall/roof geometry, entry volumes and visible
   material character derived from that venue, not inherited from OSU.
6. Recorded overhead, 3D orbit and seat-eye browser screenshots compared with
   published venue images. No seat-supporting slab may occlude its own row.
7. Capacity difference within 3.5%, mesh/seat-collision validation, correct
   section IDs and no invented claims of official ticket-seat identities.

The capacity criterion is necessary but insufficient. "Estimated-arc" means
chart section IDs were entered, **NOT** that the chart was traced to polygons.
No per-seat coordinates are surveyed or licensed in this batch.

## Implemented shared functionality

- The generic Geometry Engine now validates a `sectionMap`: real section
  labels and real row-label ranges, with multiple disjoint arcs per tier.
- The Seating Engine now follows the per-tier map instead of generating the
  same identically numbered sections in every venue.
- The Big Ten generator merges sourced section maps into each school's
  parameter file, records the source URLs, and marks angular boundaries
  "estimated".
- Studio overlay labels display these mapped section IDs without enabling
  OSU-only scoreboard/building geometry.
- Standalone viewer embeds the actual school name and cited published
  capacity, using **3D overview + 2D map + seat view** with no separate
  Building mode.
- The dedicated CI builds all 18 models and uses Chromium WebGL2 to capture
  an independent 3D overview **and seat-eye screenshot** for each of the 17
  non-Ohio-State member arenas.

## Individual exterior geometry: current implemented status

A shared renderer does **not** mean that one fictional arena envelope is an
acceptable finished model. The earlier version reused one superellipse shell
and its two generic entrance rotundas for almost every university. Those
rotundas are now removed from all 17 non-OSU generated arena profiles.
The architecture engine generates individually configured real triangle meshes
for each venue's roof silhouette, roof material and recognizable entrance mass.

The reference registry is
`data/big-ten/architectural-signatures.json`. Each entry contains
documented venue traits plus separately identifiable, **estimated** roof
rise, entrance direction and signature facade feature. The 17 architectural
profiles currently include:

- Illinois: white folded dome, 48 radial support locations, glass ring.
  121.92 m published diameter, 39.0144 m apex above arena court.
- Purdue: circular brick body and copper dome. Original archive records
  12.192 m masonry wall and an additional 12.192 m dome.
- Washington: brick pavilion with a gable and ridge skylight, Romanesque
  entrance arches. Historical overall building 100.2792 × 145.0848 m.
- Indiana: saddle-profile suspension roof and separate stands.
- Iowa: shallow external long-span trusses and a sunken seating bowl.
- Michigan: low oval roof and signature glazed oval entry.
- Michigan State: east/southeast entrance pavilion.
- Minnesota: historic high barrel roof and masonry shell.
- Nebraska: oval mass and multi-storey glass lobby.
- Northwestern: historic roof and updated fieldhouse glass facades.
- Oregon: swept roof and curving transparent entrance.
- Maryland: wide, low roof and larger glass/entry volumes.
- Penn State: broad low-roofed brick and glass arena.
- Rutgers: trapezoidal angled-metal roof.
- UCLA: low broad roof with transparent/terracotta concourse language.
- USC: broad rectilinear building with four corner towers.
- Wisconsin: wide pale roof and glazed public entrance.

The Illinois, Purdue and Washington exterior footprint/height evidence
also influences the actual shape and position of generated roof and perimeter
mesh vertices rather than being restricted to metadata. See each signature's
`measuredFacts` for the precise source URL, unit and dimension.

**Viewer:** "3D overview" deliberately exposes the bowl and seating. The
new "Building exterior" button draws the opaque roof and facade without
drawing seats through the roof. "Seat view" remains independent.
Browser acceptance now captures 3D, exterior and seat-eye screenshots
for each of the 17.

**Remaining limitations:** 14 venue exterior footprint boundaries remain
estimated from the generic bowl envelope, and all 17 require manual
orthographic/photo overlay to reconstruct true walls, door offsets, roof
edges, loading/secondary structures, floor treatment and unique material
layouts. In particular, an estimated saddle mesh is NOT a measured
suspension roof; a historical length/width is NOT a surveyed polygon;
the Purdue 1967 profile is not proof that its 2011 adjacent facilities
are modeled. Most seating polygons and row/aisle cutouts are also still
schematic. Therefore `osuVisualParity.complete=false` remains mandatory
for **every** one of the 17 new arenas.

## Section-reference work by school

The status below describes source-derived **section identifiers**, not final
geometry. Neither historical nor current chart labels imply exact seat
positions or measured architecture.

| School | Section input | Primary source | Additional local reconstruction |
| --- | --- | --- | --- |
| Illinois | 101–120, 121–143, 201–248 (48-sector upper) | [Men's basketball tickets and 3D map](https://fightingillini.com/sports/2023/1/2/tickets-mens-basketball) | Distinctive State Farm Center bowl and entrances |
| Indiana | Main A–M (excluding I), AA–MM balconies | [Official 2026–27 map](https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites/iuhoosiers.com/documents/2026/4/30/MBB_2027_Seating_Configuration.pdf?timestamp=20260430075019) | North/south loges, actual stair and balcony positions |
| Iowa | A–N and AA–NN | [Men's basketball seating diagram](https://storage.googleapis.com/hawkeyesports-prod/2025/05/20/4FY3mLURtjTLeVfpBxPqO8U6pD3rHEl1UDrn7kgo.pdf) | Sunken lower bowl and true row-specific section ends |
| Maryland | 101–126 lower / 201–226 upper, modeler-estimated tier division | [XFINITY Center game day guide](https://umterps.com/sports/2020/1/15/xfinity-center-info-guide) | Extremely steep student wall and suite interruptions |
| Michigan | 19 lower, 36 upper; official row ranges | [Crisler 2026 text chart](https://mgoblue.com/sports/2026/9/22/mens-basketball-crisler-center-seating-chart-text-alternative) and [Crisler map](https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites/mgoblue.com/documents/2024/10/18/crisler-seating-bkm.pdf?timestamp=20241018115311) | Club/band voids, measured contour tracing, tower/roof |
| Michigan State | 100/200 series; source 2023 map plus current row rules | [Breslin seating map](https://msuspartans.com/sports/2018/7/20/facilities-breslin-center-section-map-html) | Verify current map details, student benches, upper rake |
| Minnesota | 100/200 numbering from *historical* 2007 map | [Archived seating guide](https://gophersports.com/documents/download/2011/7/13/_minn_m_baskbl_2007_8_misc_non_event__m-baskbl-media-guide-0708-sec9.pdf) | New source needed; raised playing floor and bank lofts |
| Nebraska | 101–122 / 201–222 / 301–322 across three tiers | [Nebraska basketball game day](https://huskers.com/basketball-game-day) | Split upper concourse and actual luxury suites |
| Northwestern | 101–115 / 201–220 with estimated club-side notch | [Welsh-Ryan Arena facilities](https://nusports.com/facilities/welsh-ryan-arena) | Compact seating bowls and realistic corner footprints |
| Oregon | 101–121 / 201–221, modeler-estimated steeper ends | [2026–27 ticket map](https://goducks.com/sports/2021/4/6/mens-basketball-tickets) | Steep west end zone and exterior architecture |
| Penn State | 100/200 series and box references | [BJC venue seating maps](https://bjc.psu.edu/events/seating-charts), [2026 production guide](https://venuecoalition.com/wp-content/uploads/2026/02/Production-Guide_BJC_2026.pdf) | Actual tier offsets, club boxes and ADA gaps |
| Purdue | 01–18 lower / 101–118 upper in two circular rings | [Mackey 2026–27 maps](https://purduesports.com/mens-basketball-ticket-information) | Circular roof and lower club layout |
| Rutgers | 100/200/300 section levels | [Official chart](https://scarletknights.com/sports/2017/6/11/tickets-rac-seating-html) and [2026 guide](https://scarletknights.com/documents/download/2026/10/28/Rutgers_MBB_2026-27_Media_Guide_FINAL.pdf) | Nonuniform mezzanine and promenade, lobby loges |
| UCLA | 101–126 / 201–226 | [2026–27 official seating map](https://www.woodenathleticfund.com/assets/media/tickets-and-parking/2026-27-mbb-seating-map.pdf) | Split 200 subzones, media cutout and octagonal perimeter |
| USC | 101–124 / 201–222 | [2026–27 Galen Center map](https://s3.us-east-2.amazonaws.com/sidearm.nextgen.sites/uscdev.sidearmsports.com/documents/2026/6/29/2026-27_MBB_PSM_pricing_-_For_Print.pdf) | Courtside gap and corner triangles |
| Washington | 1–14 court sections, row bands 1–13 and 14–31 | [Alaska Airlines Arena official facility](https://gohuskies.com/facilities/alaska-airlines-arena/41) | Historic pavilion building proportions |
| Wisconsin | 101–128, 201–228, 301–328 | [Kohl Center basketball map](https://uwbadgers.com/documents/download/2023/6/27/MBB_Kohl_Center_Seating_Map_2024.pdf) | Two genuinely overhanging balconies, not three ordinary tiers |

**Ohio State:** the separate Schottenstein-specific source contour and architecture
modules remain the existing visual baseline. The Big Ten batch uses a generic
18th OSU demonstration profile for cross-engine regression and does not replace
the specialized OSU model.

## Acceptance statuses

- `synthetic-uniform`: no source-backed section layout imported
- `chart-ids/estimated-arc`: source-backed IDs, but hand-shaped arc geometry
  still estimated
- `digitized-contours`: manually traced polygons with provenance (not yet
  delivered for the 17 new venues)
- `visual-reviewed`: model rendered, compared to source interior/exterior
  references and corrected locally
- `OSU-level-preview`: all seven visual-quality conditions above passed
  (not yet delivered for the 17 new venues)

Do not treat a successful GitHub build or a 0.02% seat-count deviation as an
`OSU-level-preview` result.

