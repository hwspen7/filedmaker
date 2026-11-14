# OSU dual-venue reference samples — v8.0

FiledMaker is a low-cost school venue modeling and **seat-preview** tool. These two Ohio State projects are reference reconstructions, **not** geometrically certified copies of the original buildings. Published capacities and facts must not be treated as proof that the generated seats are accurate.

## Ohio Stadium (NCAA football)

- **Latest OSU-published capacity found in 2026 game notes:** **102,041** (Oct. 13, 2026; also on Ohio State's stadium facts page). The 2026 Football Media Guide published in May lists **102,780**. Both figures are preserved with their dates and sources; the later October value is the reference display.
- **Official building envelope:** length 919 ft (280.1112 m), width 679 ft (206.9592 m).
- **Official structure metrics:** stadium height 136 ft (41.4528 m), press-box roof 183 ft (55.7784 m) above field; 2012 scoreboard 125 × 42 ft (38.1 × 12.8016 m).
- **2026 guide deck figures:** A 36,483, AA 9,581, B 21,030, C 30,873, D 2,529, suites and loges 2,284, South Stands 19,748. The categories are not mutually exclusive. **Do not sum these to infer capacity or generate seats.**
- **Venue geometry:** horseshoe, south stand, north rotunda and west-side press facilities are visually reconstructed. Exact seating section boundaries, aisle positions, row depths and riser elevations are **not** verified.
- **Field:** NCAA football regulation playing surface, not the earlier NFL template name. Field layout is schematic, not a digitized field survey.

Sources:

- October 2026 OSU game notes (more recent capacity: 102,041) — https://ohiostatebuckeyes.com/documents/download/2026/10/13/7_Indiana.pdf
- May 2026 media guide (102,780) — https://ohiostatebuckeyes.com/documents/download/2026/5/26/7_2026_FB_Media_Guide_Award_Winners_FINAL.pdf
- Ohio State stadium facts (also 102,041) — https://ohiostatebuckeyes.com/sports/2023/6/2/ohio-stadium
- Seating charts / Virtual Venue — https://ohiostatebuckeyes.com/sports/2018/6/4/seating-charts

## Jerome Schottenstein Center (NCAA basketball)

- **Published basketball capacity:** Ohio State's arena facts page gives 19,500. The Schottenstein Center's own quick-facts page describes **up to 19,700** for basketball. Event layouts vary. These are published operating capacities, not the number of modeled seats.
- **Published building scale:** 770,000 sq ft (approximately 71,535 sq m) of **gross floor area**. This is **not** the building footprint, bowl diameter or ceiling area. No externally verified length, width or ceiling height has been hardcoded.
- **Court:** NCAA 94 × 50 ft (28.6512 × 15.24 m), a standard sport dimension, not a building-survey measurement.
- **2026 displays:** Ohio State announced four convex center-hung display faces, new underbelly screens, 36-inch-height 360-degree ribbon displays, enhanced upper-corner displays and 43 added vomitory displays.
- **Modeled board:** the four-face and underbelly concepts are generated in 3D. Board width, height, suspension, arena corner-display coordinates and ring location are **estimates**. The 43-vomitory-display number is documented, but **zero display positions** have been independently surveyed; the editor deliberately does not invent 43 exact entrance locations.
- **Modeled seats:** 24 synthetic visual sectors, with lower, premium and upper bowl approximations. These are **not** an OSU seating map, and every generated row/seat is synthetic until replaced by school-authorized inventories or measured coordinates.
- **Court look:** neutral gray wood is informed by the university's 2025–26 court redesign announcement; it is not a licensed official court texture or a photogrammetric material capture.

Sources:

- OSU venue facts — https://ohiostatebuckeyes.com/sports/2023/6/1/the-jerome-schottenstein-center
- Schottenstein Center basketball capacity quick facts — https://www.schottensteincenter.com/events/buckeyes
- 2026 screen upgrades — https://ohiostatebuckeyes.com/news/2026/7/17/mens-ice-hockey-schottenstein-center-to-feature-video-board-enhancements-this-season
- 2025–26 court redesign — https://ohiostatebuckeyes.com/news/2025/10/30/mens-basketball-new-season-and-new-look-at-the-schottenstein-center
- Seating maps and official seat preview — https://ohiostatebuckeyes.com/sports/2018/6/4/seating-charts

## How to open

Run `start-windows.bat` on Windows. Open `http://127.0.0.1:5174/`. From the left sidebar select **Ohio Stadium** or **Schottenstein Center**. Check the `Bowl` tab for published facts and `Info` for the capacity/seat-count QA report and its JSON export.

For a real school's public-facing seat viewer, first replace synthetic sections with the school's licensed/authorized section inventory; add row coordinates, seating elevations, tunnel and railing geometry; verify at least representative seats using photos or onsite measurement. Do not enable paid ticket inventory or guarantee exact sightlines from these samples alone.

## Current acceptance status

- Pure geometry, source metadata, validation, model generation and project UI wiring are tested automatically.
- Windows rendering, WebGL screenshots, detailed occlusion, and GLB validation are **not** considered verified until an interactive browser/equipment check succeeds.
- Progress toward actual school onboarding requires independent photo comparisons from lower bowl, upper bowl, baseline/end-zone, and seats behind railings.
