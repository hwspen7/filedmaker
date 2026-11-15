# FiledMaker — six-engine procedural venue pipeline

## Status and limitations

This branch implements a **working, deterministic, data-driven venue preview**. The six engines can generate two deliberately different fictional venues without hard-coded OSU architecture. The Schottenstein Center continues to use its specialized reference reconstruction. Generated positions are **not** an official ticket manifest, measured audience geometry, or certified sightline study. In particular, photographic single-image reconstruction, automatic floor-plan vision, legal source acquisition, structural code compliance, and real-time ticket inventory are **not** provided.

## Engine contracts

| Engine | Module | Input and output |
| --- | --- | --- |
| Geometry | `src/next/engines/geometry.mjs` | Validated JSON spec → tier rings, heights, superellipse sampling, aisle and void rules |
| Seating | `src/next/engines/seating.mjs` | Geometry profile → deterministic rows, seats, ID namespaces and synthetic capacity |
| Architecture | `src/next/engines/architecture.mjs` | Geometry profile → independent typed meshes for decks, fascia, concourse, facade, glazing, trim, stairs |
| Optimization | `src/next/engines/optimization.mjs` | Pitch bounds and target capacity → bounded monotonic search, realistic-spacing diagnostics |
| Reference | `src/next/engines/reference.mjs` | Source pack and manual landmark pairs → validated provenance and metric 2D similarity transform |
| Validation | `src/next/engines/validation.mjs` | Seats + mesh layers + declared capacity → finite checks, collision audit, triangle winding, warnings and metrics |

The public API lives in `src/next/engines/factory.mjs`.

`createProceduralProject(spec)` returns a normal FiledMaker project carrying a validated `proceduralVenue` input. `generateSeats()` uses the generic seating engine for that project. `buildVenuePlan()` creates the generic architecture, spectator deck and audit, which the existing `NativeVenueRenderer` displays in 3D. Existing Schottenstein, Ohio Stadium, school and imported-seat branches remain separate. The generic system does not overwrite imported coordinates.

`generateVenuePackage(spec, options)` executes all six components and returns `{project,model,plan,reference,audit}`.

## Create a venue

For an indoor basketball venue:

```bash
npm run generate:venue -- --input examples/procedural-arena.json --out build/example-arena --html
```

For an outdoor football stadium:

```bash
npm run generate:venue -- --input examples/procedural-stadium.json --out build/example-stadium --html
```

Output:
- `project.filedmaker.json` — editable project specification; reopen in the FiledMaker studio.
- `geometry-report.json` — provenance, capacity deviation, QA metrics and warnings.
- `venue-preview.html` — optional fully self-contained interactive 2D / WebGL2 / seat-view preview.

The CLI uses no network services and does not fetch/copy copyrighted external venue models. The `--strict` switch fails instead of merely warning on a capacity mismatch.

Alternatively open the studio and choose **Procedural arena** or **Procedural stadium** from the venue picker. These are fictional test fixtures, not real venues.

## Data format

```json
{
  "id": "new-venue",
  "name": "New Arena",
  "surface": "ncaa",
  "template": "indoor-arena",
  "sections": 20,
  "roundness": 4.25,
  "clearance": 4,
  "seatPitch": 0.54,
  "aisleWidth": 1.2,
  "targetCapacity": 10500,
  "capacityTolerance": 0.04,
  "tiers": [
    {"rows": 19, "depth": 0.83, "rise": 0.31, "gap": 3, "elevationGap": 2.3},
    {"rows": 22, "depth": 0.83, "rise": 0.40}
  ],
  "voids": [
    {"tier": 0, "section": 3, "firstRow": 1, "lastRow": 3, "reason": "Accessible landing"}
  ]
}
```

All distances are **metres**. `field.width` and `field.length` can override regulation-surface measurements for demonstration only. `targetCapacity` is a **modeling target**, never automatically displayed as official. A void removes seating in the specified tier, section and row range before optimizing capacity. Use multiple voids for accessible decks, press boxes, closed sections, reserved platforms and other hard no-seat areas.

Restrictions: one to four tiers, four to 36 sections, 1–75 rows per tier, 0.43–0.90 m requested seat pitch, up to 256 voids and 150,000 target seats. Validation rejects nonfinite and out-of-range inputs. This is not an engineering/building-code dimensional certification.

## Data and source integrity

The Reference Engine stores HTTPS citations, a provenance level and optional surveyed landmark correspondences. For `ReferenceEngine.calibrate`, two landmark pairs solve a planar rotation, scale and translation; at least three pairs are required even to obtain a nontrivial in-sample residual. Held-out control points are needed to validate real accuracy. Photographs alone **do not** determine 3D seating heights, facades, exact sightlines or ticket IDs.

The Validation Engine checks finite vertices, nondegenerate triangle winding, unique seat IDs, approximate seat collisions, capacity error and generated triangle counts. No pass label is a certified unobstructed-view statement. Automatic seat count matching is a soft requirement; if a requested target is physically incompatible with pitch constraints, it is reported instead of silently falsified.

## Browser acceptance

Run:

```bash
node scripts/browser-visual-smoke.mjs
```

This script requires Chrome or Chromium, launches the real FiledMaker web app with WebGL2/SwiftShader, checks all three presets and stores actual screenshots under `artifacts/visual/`. The GitHub workflow runs the same script on the new full-architecture branch and uploads the three frames. This is intentionally different from a source-only ZIP smoke test.

## Next precision steps

The six engines are now genuinely reusable for the supported parametric archetypes. Exact real-world reconstruction still needs opt-in image-assisted tracing, survey/CAD ingestion, distinct stadium topology (horseshoe/open gaps), correct accessible-route validation, object-level occlusion tests and reviewed photo reprojection. Do not present a synthetic arena as a surveyed digital twin.
