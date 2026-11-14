# FiledMaker v9.0 — Seat-first school venue generator

## Product scope

FiledMaker helps schools publish **seat-selection previews** at lower modeling cost. It is not a ticketing vendor, payment processor, inventory authority or certified architectural/sightline survey. NCAA is the initial focus, with smaller high-school and middle-school facilities supported by the same pipeline. NBA/NFL generators remain solely for backward compatibility.

**Identity source of truth:** a school-supplied list of `section / row / seat` records. The renderer does not increase or delete ticket identities to match a published capacity figure. The official capacity is descriptive, dated, and configuration-dependent.

## Quick start

1. Run `start-windows.bat` on Windows, or `npm start` with Node 20+.
2. Open `http://127.0.0.1:5174/school/` to create an NCAA basketball or football / K–12 venue.
3. Enter the school, venue, level and sport. Select **Generate editable draft**.
4. Import the school **row-count CSV**, **full ticket-inventory CSV**, or **XYZ survey CSV**.
5. Enter a *published* capacity and an HTTPS source URL if known. Do not use approximate audience counts as authoritative seat IDs.
6. Verify the three separate quantities: published capacity, supplied ticket identities and displayed 3D positions.
7. Inspect seat lookups, the stand/field relationship and representative photographs. Export an HTML preview, ticket mapping CSV and project backup.

The advanced editor at `/` retains SVG tracing and photo calibration. Its **Ticket data** tab also accepts a full ticket roster. Turning on **Seat-first** hides fabricated facades while retaining the playing surface and simple sport landmarks.

## Import formats

### School row-count CSV

`section,row,seats,side,tier,seat_pitch_m,center_offset_m,seat_type`

Example: `HOME,A,12,west,T1,0.53,0,bleacher`. This records section and row names plus counts, but starts numbering seats at 1 unless optional `seat_start` is provided. It does **not** prove physical seat positions.

### Full ticket inventory CSV (recommended)

Required columns: `section,row,seat`. Recommended column: `seat_id` (globally unique). Optional `tier` is `T1`–`T4`; optional *complete* coordinate set: `x_m,y_m,z_m`.

```
seat_id,section,row,seat,tier
DEMO-A-1-1,A,1,1,T1
DEMO-A-1-2,A,1,2,T1
DEMO-B-1-1,B,1,1,T1
```

All rows must have unique `(section,row,seat)` tuples and unique `seat_id`. Text row labels are preserved. Without XYZ, seats are positioned using the template's perimeter and row-rise geometry. Unknown section labels are distributed around the schematic bowl in import order. This **cannot be presented as a real physical section location**. The system rejects implausibly dense placements instead of silently compressing seats to force a count.

When all three XYZ columns are provided, the coordinates are imported unchanged in meters and marked `supplied-unverified`. They still require independent verification. The export preserves the original IDs, labels and coordinate-provenance flag.

### Measured XYZ CSV (existing advanced workflow)

`seat_id,section,tier,row,seat,x,y,z`

The older survey importer supports drawing and imperial-unit calibration, obstacles and photograph references. It is separate from the simpler ticket-inventory importer, whose XYZ columns are always **meters**.

## Capacity reconciliation and transparency

| Source | Meaning |
| --- | --- |
| Official capacity | Published by the school for a particular configuration/season, with URL and scope |
| Ticket inventory count | Exact number of supplied unique ticket seat identities in the CSV |
| Modeled seats | Number of positions generated from imported identifiers, or synthetic draft geometry when no inventory is supplied |

Statuses include `NO_TICKET_INVENTORY`, `OFFICIAL_CAPACITY_UNKNOWN`, `COUNT_MISMATCH` and `COUNTS_MATCH_UNVERIFIED`. **A numerical match is not evidence of positional accuracy.** Capacity may include accessibility, premium, standing or event-dependent areas that differ from the supplied ticket inventory. Never synthesize missing ticket IDs or live availability to hide a mismatch.

## Rendering design

- Stadium seats are GPU-instanced, with four default blue tier shades and subtle section variants.
- Imported seats get *local shallow row treads* only between adjacent points. Gaps remain gaps; no unsurveyed grandstands or walls are invented.
- Generic sport markers include the playing surface, hoops/goals/goalposts, small benches and a simplified scoreboard.
- The standalone HTML preview retains lightweight 2D seat navigation; optional 3D requires the Three.js CDN. Its blue seats are generated from the same imported identities.
- The legacy building-detail system remains available only when seat-first mode is disabled.

## Verification and readiness

`npm run verify` runs syntax checks and Node geometry/data tests, including duplicate detection, count integrity and the ticket CSV writer. Browser WebGL visuals, measured views, GLB output and compatibility with school ticket APIs **must be tested separately** on supported devices before deployment.

For commercial ticket purchase flows, a future provider connector needs authorized inventory APIs, secure server-side credentials, seat holds, concurrent updates, payments and privacy/security review. This release implements **CSV mapping and visual selection only**, not real-time synchronization.

## Demonstrations and source attribution

- `examples/fictional-ticket-roster.csv`: fictional 192-seat teaching fixture (not a real school).
- Ohio Stadium and Schottenstein Center reference profiles retain source-backed, configuration-specific capacity metadata, while all generated seat geometry remains explicitly estimated.
- School logos and brand assets are not bundled; obtain permission before publishing branded real-venue content.
