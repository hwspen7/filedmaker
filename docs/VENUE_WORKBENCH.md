# FiledMaker Venue Workbench

## Product scope

FiledMaker creates reviewable, editable models for schools and small venues from
operator-supplied reference material. The flagship reference library contains
only Ohio State's Schottenstein Center and Ohio Stadium. A fictional 1,500-seat
high-school gym fixture is strictly an engine exercise, not a documented venue.

The first deliverable is a manual source-to-preview workflow:
bitmap reference, four-corner registration, independently traced section banks,
school row-count CSV, geometry generation, correction, audit and offline export.
Automatic PDF interpretation, computer-vision section detection and CAD
reconstruction are not implemented and must not be promised to schools.

## Getting started

Run Node.js 20 or later. On Windows, the branch-verified launcher is
scripts/launch-workbench.ps1. It selects a fresh localhost port and verifies
the actual Git branch and commit through the built-in status endpoint.
Alternatively use npm start and open:
http://127.0.0.1:5174/workbench/

The main homepage contains the two Ohio State reference studies.
The /school/ importer remains a supplementary tool for full ticket inventories
and measured seat coordinates. /legacy/ keeps advanced calibration utilities.

## Staff workflow

1. Enter the school, venue, sport and actual court dimensions in metres.
2. Upload a PNG, JPEG or WebP seating diagram. For PDF sources, export the
   relevant page as an image before upload; PDF is not automatically parsed.
3. Mark the court corners: near-left, near-right, far-right, far-left.
   Four-point planar projective registration aligns the diagram, not elevation.
4. Enter each real section ID, then trace four section corners: front-left,
   front-right, rear-right, rear-left. Drag handles for local corrections.
5. Upload row CSV. Names must match traced sections. All original row labels,
   first seat numbers and counts are preserved without capacity fitting.
6. Set section base elevation and rise if known. Otherwise they remain estimates.
   Generate the model and inspect the 2D, 3D and spectator viewpoints.
7. Export editable workbench JSON, seat locations CSV, QA JSON and a standalone
   offline 2D/3D HTML preview.

All files are processed locally. No drawing or roster is uploaded to a server.
Exports can embed source bitmaps under 3.5 MB. Larger images are not embedded
and must be manually reattached for image-overlay editing after project import.
The stored section geometry is retained regardless.

## Source CSV

Required: section,row,seats

Optional: seat_start,tier,seat_type

Example records:
HOME,A,12,1,T1,bleacher
AWAY,A,10,1,T1,chair

Seat identities are generated from the imported row counts and starting
numbers. They are NOT asserted to be verified ticket inventory identifiers.
The school can provide full ticket identities and measured XYZ data in the
existing seat-first data tools.

## Modeling and provenance rules

- Frame: X across the court, Y vertical, Z along court; origin at center.
  All world coordinates use metres.
- Each traced section has front and rear polylines. For each row, the engine
  interpolates the edges and positions the imported count at equal arc-length
  intervals. The source seat count is not changed by geometry optimization.
- Section and row identities are unique. Unknown sections, duplicate labels,
  nonfinite coordinates, degenerate edges and oversized files are rejected.
- Mean seat pitch under 0.43 metres is flagged rather than fixed by deletion.
- Published capacity is sourced metadata and separately reconciled.
- Elevations, portals, egress, accessibility, seating furniture, sightlines,
  precise walls and contours all require school-approved verification.
- Preview HTML has no payments, availability holds or live ticket inventory.

## Code layout

src/workbench/contract.mjs          Input validation and source row parser
src/workbench/registration.mjs      Reversible four-point registration
src/workbench/generator.mjs         Count-exact traced seat geometry
src/workbench/adapter.mjs           Existing renderer bridge
src/workbench/fixtures.mjs          Fictional, deterministic exercise
workbench/workbench.js              Import, tracing, calibration, editing, export
workbench/workbench.css             Responsive staff interface
tests/workbench.test.mjs            Contract, numeric, identity and integration QA

## Acceptance

npm run verify
npm run test:workbench-browser

The latter requires Chrome/Chromium. CI captures both OSU references and the
fictional school exercise in native WebGL2. A screenshot validates rendering
only, not official dimensions or sightline quality.

17 other Big Ten arenas are removed from the production interface. Previous
research and batch outputs remain recoverable through Git history. Automatic
conference builds are retired.


## Additional input pathways and quality gates

The primary workbench accepts **CSV, TSV, JSON, and XLSX row inventories**.
XLSX worksheets can be selected independently. Only cached values are read;
spreadsheet formulas, external workbook links, executable macros, pivot tables,
and embedded objects are never executed. XLSX archives are bounded, verified
against central-directory sizes and CRC32, and never extracted to disk.
Encrypted archives and unsupported compression fail closed.

**SVG and ASCII DXF** are imported as untrusted contour candidates.
SVG accepts viewBox-aligned rectangles, polygons, polylines and straight-line
paths without unsupported transforms. DXF accepts flat LWPOLYLINE entities.
Curved shapes, bulge arcs, drawings with transforms, layouts without a
supported coordinate system, and damaged or encrypted files require conversion
or manual tracing. All drawing units are aligned through playing-surface
calibration. Candidates need exact labels matching school row sections and
explicit operator review before creating a geometry bank. No invented seat IDs
are sourced from the drawing.

Each file imported into the main workbench now produces a local SHA-256
fingerprint and a manifest entry. A digest identifies input bytes, but is not
authentication or proof that the information is correct. Source rows and
drawing entries retain their active source association. Operators can also add
an independent point with actual X/Z measurements to assess registration
residuals; the four calibration anchors alone give zero *training* error and
must never be used as an accuracy claim.

Geometry QA reports blocking violations, including self-intersecting sections,
degenerate footprints and nearly coincident seats, separately from review
findings such as implausible pitch, unverified positions and seat-capacity
differences. Blocking geometry errors prevent exporting an offline preview.
All unsigned estimates remain **review-required** even when calculations pass.

A bounded undo/redo journal supports section corrections, plan calibration,
file import and metadata changes. Project JSON contains the source manifest
and change trail; it does not contain private school ticketing credentials.
Large raster attachments omitted from exports must be reattached by a human.
Published capacity and imported seat identities remain distinct.

Projects may be audited outside the browser with:

    npm run audit:workbench -- path/to/school.filedmaker-workbench.json

Use --strict for a deliberately conservative gate: it will reject a project
whose geometry or source review is incomplete, even if all seats render.
Tests cover archive integrity, four-way tabular convergence, SVG/DXF contours,
data provenance, independent calibration checks, undo/redo, geometric
violations, and native WebGL2 browser rendering.

## What is deliberately not certified yet

Direct PDF/DWG ingestion, extracting text or structured seats from scans,
automatic OCR/CV section detection, curves/bulges in CAD files, complex
multilevel accessible seating, clash-tested egress and automated external
ticketing are separate engineering efforts. There is no claim that a school
can upload arbitrary drawings and automatically obtain an exact model.
Before commercial launch, repeat the pipeline with independently measured
real-world venues and recorded staff review, benchmark large examples on
low-end devices, and commission privacy, accessibility and security review.
