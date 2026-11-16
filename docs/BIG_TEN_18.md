# Big Ten 18 — sourced basketball arena batch

A deterministic, offline batch generator for the **18 Big Ten 2026–27 member schools' primary men's basketball arenas**. Its purpose is to validate the FiledMaker six-engine pipeline across multiple distinct venues.

**Scope:** 18 independent, clickable 3D/2D/seat-view previews, model exports, per-arena geometry reports, an index and machine-readable provenance. **Not in scope:** official ticket resale, a verified section map, licensed BIM/CAD import, absolute building coordinates, live arena availability or claims that synthetic positions are real ticket inventory.

## Start

```bash
npm run generate:big-ten -- --out build/big-ten-18 --html --strict
```

Open `build/big-ten-18/index.html`. Each school's link opens an offline preview under `<school-id>/venue-preview.html`. A manual GitHub Actions run using **Big Ten 18 Arena Batch** produces an archive containing the same outputs.

Preview only Michigan:

```bash
npm run generate:big-ten -- --only michigan --out build/crisler --html --strict
```

Metadata and input validation without writing files:

```bash
npm run generate:big-ten -- --dry-run --max-error 0.035
```

The script never connects to a website at execution time. Published reference facts were collected separately; reference links remain attached to outputs.

## Data contract

| Location | Role | Authoritativeness |
| --- | --- | --- |
| `data/big-ten/venue-catalog.schema.json` | JSON Schema, version 1.0.0 | Defines required fields and types |
| `data/big-ten/arenas-2026-27.json` | One record per member institution and primary home court | Identity and published capacity cite athletics sources; geometry is estimated |
| `scripts/generate-big-ten.mjs` | Validates and calls the existing six-engine generator | No hardcoded venue-specific renderers |
| `build/big-ten-18/manifest.json` | Aggregate capacity/QA status and generated links | Computed, never presented as official |
| `build/big-ten-18/<id>/venue-spec.json` | Normalized engine input | Estimated dimensions |
| `build/big-ten-18/<id>/project.filedmaker.json` | Importable FiledMaker project | Generated seats, not ticket IDs |
| `build/big-ten-18/<id>/geometry-report.json` | Capacity deviation, source URLs, and QA | Published vs generated clearly separated |
| `build/big-ten-18/<id>/venue-preview.html` | Standalone interactive WebGL2 viewer | Rendered synthetic model |

A venue record must contain:

- `id`: stable ASCII school slug, unique within the conference
- `school`: university name and athletic team nickname
- `venue`: official arena name, city/state/country, men's basketball usage
- `capacity`: published basketball seating, exact configuration, citation reference and description, plus any explicitly documented alternatives
- `sources`: original school or institution URLs, descriptive title, source ID and date of review
- `evidence`: independent statuses for seating map, surveyed section boundaries, seat roster and building dimensions
- `model`: explicitly **estimated** geometry (sections, rounded rectangle exponent, first-row clearance, aisles, per-tier row depth/rake/gaps, exterior style/entrances, declared exclusions)

No geometry parameter becomes an official fact merely because the capacity is documented. Published seating capacities can vary with student sections, accessible conversions, arena renovations, standing room or sports layout. These are retained as source notes.

Sample venue input excerpt:

```json
{
  "id": "michigan",
  "school": {"name": "University of Michigan", "team": "Wolverines"},
  "venue": {
    "name": "Crisler Center",
    "city": "Ann Arbor",
    "state": "MI",
    "country": "USA",
    "sport": "men-basketball"
  },
  "capacity": {
    "published": 12707,
    "configuration": "men-basketball",
    "notes": "12,707 since the 2013 capacity revision",
    "sourceId": "school-capacity"
  },
  "sources": [{
    "id": "school-capacity",
    "kind": "university-athletics",
    "title": "Michigan Athletics: Crisler Center",
    "url": "https://mgoblue.com/facilities/crisler-center/5",
    "verifiedOn": "2026-11-15"
  }],
  "evidence": {
    "seatMap": "not-digitized",
    "sectionCoordinates": "not-available",
    "seatRoster": "not-available",
    "buildingDimensions": "not-surveyed"
  },
  "model": {
    "evidenceLevel": "estimated-parametric",
    "surface": "ncaa",
    "template": "indoor-arena",
    "sections": 22,
    "roundness": 3.3,
    "clearance": 4.3,
    "aisleWidth": 1.1,
    "seatPitch": 0.54,
    "capacityTolerance": 0.035,
    "tiers": [
      {"rows": 18, "depth": 0.82, "rise": 0.31, "gap": 2.4, "elevationGap": 2.2},
      {"rows": 19, "depth": 0.83, "rise": 0.41, "gap": 0, "elevationGap": 0}
    ],
    "voids": [],
    "exterior": {
      "profile": "masonry",
      "entrances": [{"angle": 0.7853981633974483, "role": "primary"}]
    }
  }
}
```

The example shortens the actual record and shows a subset of the illustrative entrances. The official source only supports facility and capacity facts, **not** the estimated number of sections, tier contours, roof elevations or window placements.

## 2026–27 primary home arenas

The selected source and the adopted basketball configuration can be inspected individually in the catalog.

| School | Arena | Published reference capacity |
| --- | --- | ---: |
| Illinois | State Farm Center | 15,544 |
| Indiana | Simon Skjodt Assembly Hall | 17,222 |
| Iowa | Carver-Hawkeye Arena | 14,998 |
| Maryland | XFINITY Center | 17,300 |
| Michigan | Crisler Center | 12,707 |
| Michigan State | Breslin Center | 14,797 |
| Minnesota | Williams Arena | 14,625 |
| Nebraska | Pinnacle Bank Arena | 15,147 (2013 approximate reference) |
| Northwestern | Welsh–Ryan Arena | 7,039 |
| Ohio State | Value City Arena at the Schottenstein Center | 19,049 (18,809 with students) |
| Oregon | Matthew Knight Arena | 12,364 |
| Penn State | Bryce Jordan Center | 15,261 |
| Purdue | Mackey Arena | 14,876 |
| Rutgers | Jersey Mike's Arena | 8,000 |
| UCLA | Pauley Pavilion | 13,800 |
| USC | Galen Center | 10,258 |
| Washington | Alaska Airlines Arena at Hec Edmundson Pavilion | 9,294 |
| Wisconsin | Kohl Center | 16,838 |

Conference membership: [Big Ten 2026–27 men's basketball release](https://bigten.org/news/2026/5/11/big-ten-conference-announces-2026-27-men-s-basketball-opponents-051226-60009.aspx).

**Note:** Some previously circulated capacities are stale. The current Iowa official facility page says 14,998 rather than older 15,500. The Washington athletic facility page says 9,294, rather than the widely repeated 10,000. Wisconsin's official men's figure is 16,838, not its hockey or women's basketball configuration. Do not silently replace the chosen sources with general internet rankings.

## Generation pipeline and acceptance

1. Validate a complete 18-venue roster, unique school IDs, source links, source IDs, statuses and numeric modeling constraints.
2. Transform the venue-specific parameters into the standard `GeometryEngine` input.
3. Use `generateVenuePackage` for geometry, seating, architecture, material profile, optimization, provenance and validation.
4. Compare the actual generated position count with the sourced capacity for that arena.
5. Reject invalid geometry. With `--strict --max-error 0.035`, reject any school whose deviation exceeds 3.5%.
6. Produce one importable project, one report and (with `--html`) one standalone offline viewer per school.
7. Write the index and manifest. GitHub Actions uploads the entire verified directory as one artifact.

All 18 share the engine implementation. Per-venue configuration differences are intentionally limited to **data**. The existing Ohio State high-fidelity development model is not overwritten; the Big Ten batch creates a separate synthetic Ohio State profile to exercise common code.

## Fidelity levels and next steps

The first batch is **P0: source-backed procedural preview**. For P1, digitize or license actual section/row outlines and reconcile geometry against official seating charts. For P2, add site-specific concourse/entrance/elevation/roof features as reusable topology options and inspect 3D camera reprojection against photo references. For P3, introduce authorized seat-identifier inventories and per-seat sightline checks.

Until those milestones, the previews must not be marketed as exact 3D venue replicas or official ticket maps. Source images are references and are not copied or redistributed inside the output.


## Source-mapped sections for all 17 non-Ohio-State arenas

The source-linked section reference file `data/big-ten/reference-section-layouts.json` now contains a distinct configuration for **each of the 17 non-Ohio-State member arenas**. Illinois, Maryland, Nebraska, Northwestern, Oregon, Purdue and Washington were added to the earlier mapped Michigan, Indiana, Iowa, Michigan State, Minnesota, Penn State, Rutgers, UCLA, USC and Wisconsin configurations. The native Schottenstein Center implementation is preserved separately.

The 3D differences are generated by the **same shared geometry and seating engines**, not 17 copied standalone scene implementations. Chart-derived section IDs and tier counts replace the anonymous section numbering. Specific structural variations include Illinois's 48-section outer ring, Nebraska's 100/200/300 three-level layout, Purdue's nearly circular two-ring stadium, Washington's fourteen columns in two numbered row bands, Indiana's separated side-stand arcs and Michigan State's published lower-row break between rows 9 and 13.

**Fidelity boundary.** These source maps capture documented section identities and selected tier or row labels. Section angles, rise/rake, physical notches, tunnels, accessible platforms, suites, seat coordinates and calculated views remain modeler estimates. The completed geometry batch is therefore a source-linked **approximation**, not proof of the same measured visual fidelity as the manually refined Ohio State model. Do not use the synthetic positions as official ticket inventory.

`npm run verify` checks the catalog and engine. `npm run generate:big-ten -- --out build/big-ten-18 --html --strict --max-error 0.035` checks the full 18-school export. The `test:big-ten-browser` acceptance captures 3D WebGL and individual seat-view screenshots for **all 17** non-Ohio-State arenas. The GitHub Actions workflow archives its checks and generated previews.
