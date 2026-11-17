# FiledMaker — Data-driven venue reconstruction

This is the source-driven internal venue builder, designed for schools needing a customizable 3D seating layout without external modeling software or picture scanning.

## Principles

- A deterministic geometry pipeline accepts manually configured section boundaries, levels, seat inventories, aisle gaps and elevations.
- No PDF/OCR/image recognition is required, and the new builder does not offer it.
- The measured or entered seat inventory controls model capacity. No capacity fitting or manufactured seats.
- Every front/rear bank polyline is edited in metres using numeric coordinates or draggable handles.
- Section, row and seat labels are preserved when provided. Generated numbering is NOT proof of an official ticket inventory.
- Exterior modeling is disabled and remains an explicit future extension point.
- Unverified seating height, sightlines, door placement and inaccessible areas must be reviewed by school staff.

## Open

Run Node.js 20+ in the checked-out feature/data-driven-venue-core branch. Start the local server using npm start. Open the /builder/ path on the port printed by the server.

For example, if the server says it is listening on port 5201, use:

    http://127.0.0.1:5201/builder/

Use New blank project for your own data. The initially loaded 1,500-seat gym is explicitly fictional and for engine evaluation only.

## Big Ten five-venue demonstration

Five source-informed but still **non-surveyed** basketball arena interior drafts are available in the top gallery of /builder/. They use the same manually structured JSON input and the same renderer:

- Illinois, State Farm Center — 87 modeled sections in three levels, with a split club/mezzanine bank.
- Indiana, Simon Skjodt Assembly Hall — 24 modeled sections in two separated, tall grandstand structures.
- Michigan, Crisler Center — 55 modeled sections in a large elliptical two-level bowl.
- Purdue, Mackey Arena — 36 modeled sections in a near-circular two-level bowl.
- Wisconsin, Kohl Center — 84 modeled sections in a faceted three-level bowl with estimated upper-tier overhangs.

The model section IDs and rough adjacency are taken from the earlier sourced Big Ten dataset, as available. Other values such as seat counts per row, precise aisle/portal dimensions, heights and outline geometry are **estimated** and must not be marketed as official ticket positions or verified spectator sightlines. Generated seat counts are intentionally **not** forced to match official capacity and currently differ for all five.

Open, for example:

    http://127.0.0.1:5201/builder/?case=indiana

Replace 5201 with the local server's actual port. Click another gallery card to compare the distinct layout, or modify one selected section/row and rebuild the 2D and 3D model.

Regenerate the five editable JSON datasets from the older source catalog and the documented modeling assumptions:

    npm run prepare:big-ten-showcase

Regenerate a batch of independent seat XYZ exports and validation reports from the five prepared files:

    npm run generate:reconstruction -- --catalog data/reconstruction-showcase/catalog.json --out build/big-ten-showcase

The outputs are independent venue folders plus a manifest. To validate without writing files, append --dry-run.

This is a five-venue engine demonstration, not an assertion that five universities' full real seating bowls are complete. Building exteriors and professional seated-eye accuracy remain outside the current scope.

## Operator workflow

1. Enter school, venue, sport and court dimensions in metres.
2. Add named sections, choosing which side of the playing surface they initially occupy.
3. Drag the blue front-curve and orange rear-curve handles to correct the footprint. Add further control points for irregular sections, or enter exact X,Z point lists.
4. Enter tier T1–T4, first-row height, row rise and source information per section.
5. Enter actual row labels and seat counts or import CSV. Set seat gaps, optional absolute row elevations and per-row style.
6. Use advanced row editing for explicit nonsequential ticket numbers, reverse numbering, start/end insets and depth offsets.
7. Build the model. Inspect the 2D geometry, WebGL2 model, modeled seat IDs and geometry validation results.
8. Save editable project JSON and export simulated seat coordinate CSV.

## Coordinate system

X runs across the court, Z along the court, Y vertically above the floor. All units are metres. Coordinate origin is the court center. Front and rear polylines must be oriented in the same direction.

A seating row is interpolated between the corresponding arc-length fractions of its front and rear contours. Source seat counts, aisles and labels are preserved. If no absolute row elevation is provided, the generated height is baseHeight + rowIndex * rowRise.

A covered doorway, accessible platform, press-box void or disconnected stand must be modeled explicitly with separate banks and verified dimensions. The first-stage editor does not automatically construct accessible infrastructure or certify sightlines.

## Minimal project specification

Each JSON document uses format = filedmaker-reconstruction. Fields include:

    {
      "format": "filedmaker-reconstruction",
      "school": "Example School",
      "venue": "Example Gym",
      "sport": "nfhs-basketball",
      "court": {"width": 15.24, "length": 25.6032},
      "officialCapacity": null,
      "capacitySource": "",
      "sections": [{
        "id": "HOME",
        "tier": "T1",
        "baseHeight": 0.48,
        "rowRise": 0.28,
        "source": "operator-provided/unverified",
        "front": [{"x": -10, "z": -6}, {"x": -10.4, "z": 0}, {"x": -10, "z": 6}],
        "back": [{"x": -15, "z": -6}, {"x": -15.4, "z": 0}, {"x": -15, "z": 6}],
        "rows": [
          {"label": "A", "seats": 18, "first": 1,
           "seatType": "bleacher", "gaps": [{"after": 9, "width": 1.2}]},
          {"label": "B", "seats": 17, "first": 1, "seatType": "bleacher"}
        ]
      }],
      "exterior": {"enabled": false, "provider": null, "parameters": null}
    }

examples/reconstruction-compact-gym.json contains a fully editable fictional irregular gym model.

## Row CSV fields

Required: section, row, seats.

Optional: seat_start, tier (T1–T4), seat_type (chair/bleacher), aisle_gaps, elevation_m, seat_numbers, seat_direction, inset_start_m, inset_end_m, depth_offset_m.

For aisle_gaps, use 8:1.2|16:1.0 to reserve 1.2 metres after the eighth seat and one metre after the sixteenth. Explicit seat_numbers use | as a separator.

The CSV importer rejects unknown section IDs and mismatched tiers instead of silently creating sections. An imported row replaces that section's rows only. Sections not in the file remain unchanged.

## Batch CLI

Generate a single manually specified venue:

    npm run generate:reconstruction -- --input examples/reconstruction-compact-gym.json --out build/reconstruction-example

For multiple venues, create a JSON catalog such as:

    {
      "venues": [
        {"id": "school-a", "path": "school-a.json"},
        {"id": "school-b", "path": "school-b.json"}
      ]
    }

Run:

    npm run generate:reconstruction -- --catalog data/my-schools/catalog.json --out build/my-schools

Add --dry-run to validate input without writing files. Each venue receives reconstruction.json, seat-coordinates.csv and validation-report.json. The batch directory gets manifest.json. Full standalone website publishing is not implemented by the new CLI.

## Implementation files

- src/reconstruction/core.mjs — strict manual-data schema, no capacity fitting, legacy geometry adapter and QA block
- builder/index.html, builder/builder.js, builder/builder.css — editable 2D and 3D authoring workflow
- src/workbench/generator.mjs — arbitrary front/back curves and preserved per-row seating identities
- src/workbench/rowLayout.mjs — aisle gaps, source seat numbers and insets
- src/workbench/adapter.mjs — WebGL2 renderer connection, corrected chair/bleacher types and upper tiers
- scripts/generate-reconstruction.mjs — single/batch conversion and CSV+QA exports
- tests/reconstruction.test.mjs — schema, exact count, irregular banks, aisle/seat labels, multi-tier and batch regression tests

## Verification and remaining work

Run npm run verify and inspect /builder/ in Chrome or Edge. Static syntax checks and in-memory geometry smoke tests are useful but do not constitute browser/WebGL validation or physical survey verification.

Planned extensions: precise geometry for stairs, portals and accessibility platforms, stronger adjacent bank constraints, external building plugin, school authentication and one-click production publication. None of these are silently inferred from missing input.
