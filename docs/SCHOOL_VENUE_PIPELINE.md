# FiledMaker School Venue Pipeline

## Purpose

FiledMaker is building a low-cost way for colleges, high schools, middle schools and school districts to publish **venue-accurate seating previews**. The ambition is to replace generic seat maps with geometrically grounded, accessible, configurable 2D and 3D previews, not to act as a ticketing/payment processor.

The **School Studio** is at `http://127.0.0.1:5174/school/`. It works alongside the existing advanced stadium geometry editor at `/`.

## Workflow today

1. Choose an NCAA basketball/football, NFHS high-school basketball/football, or small-gym example.
2. Name the school and venue. This does **not** turn a generic template into a real surveyed building.
3. Import whichever records the school has:
   - A simple **row-count CSV** preserving actual section/row/seat identifiers, with automatically estimated XYZ coordinates.
   - A **seat-survey CSV** containing measured `x_m`, `y_m`, `z_m` values for each seat. This preserves source XYZ but is not independently certified.
4. Inspect positions with the 3D model and its human-eye camera. Adjust the geometry in the advanced editor and trace a real SVG plan as needed.
5. Export editable project JSON, seat CSV, GLB, or **standalone HTML seat-selection preview**. The HTML map works without 3D dependencies; optional 3D loads Three.js from jsDelivr and requires connectivity.
6. Compare with school photographs and actual venue plans before public deployment.

### Row-count CSV

The included `examples/school-gym-rows.csv` has this header:

```
section,row,seats,side,tier,seat_pitch_m,center_offset_m,seat_type
```

Required columns: `section`, `row`, `seats`, `side`.

- `side`: `north`, `south`, `east`, `west`, expressed relative to the playing area.
- `tier`: one of `T1`–`T4`, defaults to `T1`.
- `seat_pitch_m`: defaults to 0.53 m; this and other unspecified geometric parameters are **estimates**, not measurements.
- Optional `row_depth_m`, `row_rise_m`, `center_offset_m`, `seat_start`, `seat_type`.
- Row order in the CSV sets estimated height ordering within each section and tier.
- Coordinates are computed in metres from these inputs. Do not present them as measured data.

A row-count CSV is suitable for rapid early validation when a school knows its seat IDs and row counts but has no 3D data. To make a **real** venue, schools need to supply verified locations, floor plans, and reference photos so the shape and elevation can be checked.

### Seat-survey CSV

```
seat_id,section,row,seat,x_m,y_m,z_m
```

Coordinates must describe one consistent origin and axis orientation. The existing advanced editor also supports plan-coordinate registration using matched control points, and notes missing elevations explicitly. Accessible seat designations must only come from school-approved records, never inference from geometry.

## Practical publication limits

- Standalone HTML preview is capped at 40,000 seat locations. It is intended for smaller venues, not the largest football stadiums.
- No inventory source, hold/release state, checkout, payment, barcode or attendance authorization is implemented. A school or ticket vendor must supply these securely through a separately designed backend.
- The 2D preview is static data, not a live occupancy map. Do not attach sensitive patron information, unpublished pricing, or private school records to a publicly distributed HTML file.
- A school must review accessibility, egress, visibility and sign-off before the public is asked to rely on a seat position.
- The middle-school 74 × 42 ft playing surface is **a configurable example**, not a mandatory NFHS rule.

## Accuracy and source priority

1. School-issued measured coordinates or building drawings and signed records.
2. School seat-map PDFs/SVGs and documented section/row lists, manually checked.
3. Reference photographs with landmark calibration.
4. Procedural geometry for rough layout only, clearly marked estimated.

We do not scrape third-party ticket-provider seat inventories or claim that online diagrams alone establish survey accuracy.

## Next production requirements

- School-supplied SVG/PDF alignment to 2D stands, with true polygon-based bleacher placement.
- Signed source manifests and per-section geometric confidence.
- Venue-specific accessibility and obstructed-view review.
- Hosted ticket-inventory API with authentication, transaction integrity and payment-provider integration.
- Rendering performance tests and school-staff usability tests on low-end devices.

## Rules references

- [NCAA 2026–27 basketball full court](https://www.ncaa.org/championships/playing-rules/mens-basketball-playing-rules/): 94 × 50 ft.
- [NFHS 2025–26 basketball diagram](https://khsaa.org/common_documents/Rules-Basketball-Rules%20and%20NFHS%20Guidance/2025-26/NFHS%202025-26%20Basketball%20Court%20Diagram.pdf): 84 × 50 ft is a common optimal high-school size. Individual school court dimensions must be checked.
