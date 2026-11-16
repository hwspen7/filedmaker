# FiledMaker — Simplified user interface

A light, restrained interface for staff-assisted school venue modeling. Attractive
geometry is never treated as proof of exact seat identity or measurement.

## Pages

- / — Ohio State basketball and football reference previews, seat views and
  optional advanced roster controls.
- /cases/ — searchable, filterable library of ten reference, real-school,
  synthetic and extended cases. Every case declares its evidence status.
- /workbench/ — four-stage editor. All original import, calibrate, generation,
  correction, comparison and export controls remain available.

## Four workbench stages

1. Import — school and venue dimensions, PDF, bitmap, SVG/DXF, row inventories,
   PDF page selector, text hints and separately sourced published capacity.
2. Calibrate — four source-image corners, hand-traced section polygons, reviewed
   vector contour candidates, section heights and independent check points.
3. 3D — generate draft, inspect overview, click a seat, enter its viewpoint.
4. Review — quality report, editable JSON, seat CSV, offline preview,
   compare prior project, edit history and downloads requested in this tab.

The canvas remains visible between stages. The context inspector shows relevant
source evidence, staff checklist, selected seat or audit depending on the stage.

## Case gallery truth

Schottenstein Center and Ohio Stadium are illustrative Ohio State references.
The 1,500-seat school gym is fully fictional.
The Aiken Taylor Gym 1,418-seat 3D draft preserves real bank totals but uses
operator-assumed rows, heights, footprints and seat numbering; it is NOT an
official model. Other real schools (Sanderson, Hatton, Howard MS No. 20,
Northview, Wills Point) open authentic sources for staff-assisted review;
they do not fabricate seat rows merely to make a 3D preview.
Bay Port PAC is an out-of-scope auditorium PDF stress case, not a school gym.

Gallery illustrations are marked schematic; they are not purported official
plans or photographs. Case documents open from the original external sources,
and their files must be uploaded by staff into the local workbench.

## Acceptance

Use npm run verify for syntax, source integrity and geometry tests.
Use npm run test:workbench-browser to run the OSU, PDF, case library,
Aiken estimate, source-only and four-stage navigation checks in Chrome.
The separate Real School PDF Acceptance workflow verifies actual public PDF
bytes, SHA-256 fingerprints and that no seats appear without a row inventory.

There is no cloud history, permanent archive of downloads, certified CAD
survey, automatic scan recognition or live ticketing feature. Project edit
history lives in exported JSON. Download-request activity is limited to the
current browser tab and never claims the OS download succeeded.
