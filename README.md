# FiledMaker

A browser-based **parametric 3D stadium and arena modeling studio** for the United States and Canada. Create editable football stadiums, soccer stadiums and basketball arenas with repeatable geometry rather than placing every seat manually.

![CI](https://github.com/hwspen7/filedmaker/actions/workflows/quality.yml/badge.svg)

## School-first venue automation (NCAA → K–12)

**New: [School Studio](school/)** — a low-cost venue-building workflow for colleges and schools. Open `http://127.0.0.1:5174/school/` after running `start-windows.bat`. Build a draft from an NCAA basketball, NCAA football, high-school or middle-school template, import school row/seat CSV or measured-coordinate CSV, inspect the result in 3D and export a selectable HTML preview. The seat identities are preserved; estimated coordinates are not represented as surveyed. The independently shareable HTML supports 2D seat selection and optional CDN-powered 3D / human view, but has **no live ticket inventory or checkout**. See [School Venue Pipeline](docs/SCHOOL_VENUE_PIPELINE.md) for the exact data format, verification steps and limitations.

The main advanced editor remains available for SVG tracing, architectural geometry and imported seat calibration. Previous NBA/NFL work is retained for compatibility but is no longer the product priority.

## Version 6.1 — Stadium Detail Kit and sports-specific refinement

The v6.1 editor improves the **illustrative** Ohio Stadium reference and the reusable
football/soccer/basketball stadium generators without changing any published Ohio
Stadium measurements or claiming surveyed seat coordinates.

- **Open vomitory geometry.** Entrance voids are cut out of seating and terrace strips;
  only jambs, a shallow lintel and a tread-level threshold are rendered. Entrances
  are automatically skipped when their tier/section has no seats.
- **Seat construction.** Thin seat pans, a front lip, optional tilted backs, slim support
  legs and armrests replace bulky block seating. For the Ohio reference, upper tiers
  use *illustrative* simplified bleachers; their exact real-world seating type,
  numbering and distribution are still unknown. Seats remain GPU-instanced and
  retain the original per-seat picking IDs.
- **Guardrail alignment.** Instanced posts and two continuous handrail bars are
  clipped to the actual seat-bearing row intervals; aisle gaps are respected by
  rails and parapet walls instead of being closed by uninterrupted walls.
- **Event-day field details.** Football team benches, small rolling carts, pylons,
  chain markers and a broadcast platform; soccer dugouts and corner flags;
  basketball scorer table, team benches and a suspended display are produced by
  sport-specific asset plans. These furnishings are schematic, not measured.
- **Scoreboard alignment.** Display and frame share the same local coordinate
  system, preventing a rotated display from separating from its frame.
- **Reusable plans and tests.** All asset locations, entrance bounds and guardrail
  segments are computed in `src/detailKit.mjs` without Three.js. They can be
  tested and reused as we add more real venues.

**Quality check:** `npm run verify` includes the new Detail Kit checks. The scene
still downloads Three.js at runtime. A passing Node test suite does **not** prove
full WebGL rendering or GLB export works on every Windows browser/GPU. Test the
`High` detail setting and GLB export locally before publishing a stadium.

**Important:** the stadium exterior, portals, seat styles, aisles and guardrails
remain interpretations unless supplied with properly licensed architectural
plans or survey measurements. Never describe the Ohio reference as a seat-accurate
digital twin.

[Detail Kit design and verification](docs/STADIUM_DETAIL_KIT.md)

## Version 5.0 — Real Venue Calibration Pipeline

FiledMaker v5 joins the existing **ChatGPT-inspired light editor**, custom stadium outlines, human-eye seat views, and SVG tracing with a verifiable local workflow for real-world seating data. It is designed for **football, basketball and soccer venues in the United States and Canada**.

- **Real data tab:** import local seat-coordinate CSV files (up to 150,000 seats), with unique IDs, section/row/seat labels, optional measured elevation, meter/foot/drawing X/Z units, and explicit provenance. Imported seat positions replace generated seats and the schematic terraces are hidden instead of implying a surveyed building.
- **Control-point registration:** solve a 2D translation, rotation and scale from two or more matched landmarks, with in-sample RMS and maximum residual (meters). A two-point calibration cannot verify global accuracy.
- **2D map:** displays actual imported seat points with 2D selection and a **Focus seats / Full field** toggle.
- **Obstructions:** author rectangular 3D rails, parapets, columns or walls with metric coordinates and yaw. The View inspector checks the ray from the human eye to the chosen field target against these user-authored objects only.
- **Photo calibration:** mark 3–12 playing-field landmarks in a local reference image and fit the selected seat's camera yaw, pitch and FOV. Unacceptable pixel residuals are rejected; photos themselves are not persisted.
- **QA report:** export the calibration residuals, coordinate source, elevation coverage, obstacles and photo-fit metadata as JSON.
- **Practice project:** an Ohio Stadium reference shortcut links Ohio State's official seating-chart listing. It does **not** supply or claim to reconstruct official seat coordinates. The included [`fictional-survey-seats.csv`](examples/fictional-survey-seats.csv) is a clearly fictional integration fixture.

**Use this guide:** [docs/REAL_VENUE_WORKFLOW.md](docs/REAL_VENUE_WORKFLOW.md) for formats, calibration, in-sample error interpretation, photo registration and accuracy boundaries.

**Verification:** `npm run verify` performs syntax checks and pure-geometry tests. Full browser 3D/GLB behavior still depends on the Three.js CDN and must be checked in an actual supported browser. Browser tests were also performed with the 3D renderer replaced by a deterministic mock, so they validate UI wiring rather than WebGL rendering.

**Data integrity:** any stadium-specific coordinate source needs verified rights, coordinate reference and measurement metadata. Never advertise an imported but unverified seat as a surveyed, unobstructed or officially approved view.

## Version 3.0 — vector blueprint and independent seating profiles (legacy features)

FiledMaker keeps the **light, neutral workspace** introduced in v2.1. The stadium engineering tools now support a schematic workflow based on imported SVG vector floor plans, individual section-tier geometry, and row-limited entrance openings.

### From an SVG seating plan to an editable stadium

1. Click **2D editor** and open the **SVG plan** tab.
2. Import a local `.svg` blueprint (up to 1.5 MB). The importer recognizes line, rectangle, ellipse, circle, polygon and SVG paths, including curves and arcs. Vector data is parsed into inert coordinate arrays. Scripts, external references and embedded markup are **not executed**.
3. Use **Drawing width represented (m)** to calibrate the original SVG `viewBox` to real-world meters. Adjust X/Z offsets and rotation until the drawing aligns with the playing surface. The model uses X across the field and Z along the field.
4. Choose a **closed vector path** enclosing the playing surface, and click **Trace selected closed contour**. FiledMaker samples it radially into 32 editable control points. Non-star-shaped or pitch-intersecting outlines may be rejected because the current stadium model uses a star-shaped inner boundary.
5. Refine the resulting outline in the **2D editor**, then switch back to the 3D view to inspect seats and terraces.
6. In **Sections**, select any section, then click **Customize** for the desired tier to independently set row count, front setback, elevation shift, row rise and row depth.
7. In **Aisles**, add an **entrance opening** specifying tier, orientation, width and a limited row range. It removes seat positions and matching 3D terrace strips only in those rows.
8. Save a project JSON (schema v3), export seat coordinates, or export the GLB scene (Three.js must load for GLB).

**Practice file:** [`examples/football-bowl.svg`](examples/football-bowl.svg) contains a fictional stadium outline and football field for learning the tracing workflow. It is illustrative, not surveyed geometry.

### Scope and limitations

- **Native DWG, DXF, BIM, IFC and PDF CAD imports are not supported.** Convert a plan to a clean SVG first, preserving its `viewBox` and geometry. Some advanced SVG filters, embedded images, text outlines, and unsupported `<use>` references are intentionally skipped.
- The importer stores simplified vector coordinates in project JSON, not original SVG markup. Projects are compatible with older schema v1 and v2 files; a version 3 export should be backed up before editing in older software.
- The 3D seating bowl still requires a *radially ordered* star-shaped inner boundary. Per-section front/height/row overrides allow varied footprints but are not arbitrary standalone 3D polygon meshes, complete architectural walls, doors, or structural beams.
- No automatic scale inference or survey verification is performed. Users **must calibrate** drawings against known measurements. The generated capacity is indicative and not an officially certified seat count.
- Browser WebGL / full GLB export still depends on the externally loaded Three.js modules. SVG and 2D editing are independent of WebGL.

Use `Ctrl+Shift+R` if an older stylesheet remains in the browser cache after pulling an update.

## What you can build

- **Football:** NFL-sized, CFL 2026-sized and CFL 2027-sized schematic playing surfaces.
- **Soccer:** 105 × 68 m football pitches with field lines and simplified goals.
- **Basketball:** NBA and NCAA court presets with hoops, markings and an indoor-style seating bowl.
- **Bowl editor:** adjust overall contour, seat pitch, section-boundary aisle gaps and a schematic canopy.
- **2D outline editor (v3):** convert any regular bowl into a custom star-shaped perimeter with 8–64 editable handles. Drag handles, click to select, double-click near the boundary to insert, or edit exact X/Z coordinates. Invalid or self-intersecting profiles are rejected.
- **Reference image tracing:** temporarily overlay a local PNG/JPEG/WebP seating plan with adjustable opacity. The image stays on your computer and is not embedded in exported projects.
- **Independent radial aisles:** create up to 32 aisle cutouts with width and angular location, either across all levels or confined to a chosen tier. Both seat positions and concrete terrace strips reflect these gaps.
- **Tier editor:** add or remove tiers (up to four), tune row counts, depth, rise, front offset, elevation and inter-tier gaps.
- **Section editor:** choose up to 36 radial sections, edit each one's angle interval and label, enable/disable its seating, change its color.
- **Blueprint import (v3):** import and calibrate vector SVG paths; trace a closed perimeter into the 2D editor.
- **Independent sector/tier profiles (v3):** override row count, setback, elevation, row rise and row depth for one section on one level.
- **Entrances / vomitories (v3):** remove seats and terraces for a defined range of rows without cutting out entire stands.
- **Live 3D:** orbit, zoom, plan view, per-seat view, ray-pick seats and click terrace sections.
- **Exports:** editable `.filedmaker.json`, per-seat coordinates `.csv`, full `.glb` geometry and `.png` viewport screenshots.
- **Project management:** automatic browser-local recovery, named local snapshots, undo/redo and JSON import.

The **capacity number is a model-generated seat estimate**, not the officially licensed capacity of a real venue. Field markings, bowl curvature, the roof and seat units are schematic until calibrated against engineering or survey data.

## Start on Windows (no Python or Node.js required)

1. Clone the repository as a **separate folder**, for example `E:\Personal_Project\filedmaker`.
2. Double-click `start-windows.bat`.
3. The site opens at **http://127.0.0.1:5174/**. Keep the terminal open during use.

```powershell
git clone https://github.com/hwspen7/filedmaker.git "E:\Personal_Project\filedmaker"
cd "E:\Personal_Project\filedmaker"
.\start-windows.bat
```

The application uses the Three.js ES modules served from jsDelivr CDN. **Internet access is required for first-time 3D rendering and for 3D rendering on subsequent runs unless the library is cached.** If Three.js is blocked, editable geometry and JSON/CSV export can still operate, but the 3D viewport/GLB export will be unavailable. A server is still needed because modern browsers block ES modules over `file://`.

The app uses port **5174**, so it does not collide with the existing Stadium View prototype on port 5173.

### Other environments

Node.js 20+ (no `npm install` necessary):

```sh
npm start
```

macOS / Linux: `./start-unix.sh` (uses Node.js or Python 3).

## What's new in v2

Version 2 adds **a real 2D authoring workspace** instead of relying only on the default rounded-rectangle bowl. The editable radial outline changes the **actual seat generation and terrace geometry**, not just the image overlaid on top of the scene.

1. Select a football, soccer or basketball preset.
2. Select **Outline → Create editable outline**. This converts the procedural perimeter into a control-point profile while preserving the playing surface.
3. Open **2D Editor**. Drag any anchor, double-click near the outline to insert another anchor, or edit X/Z numerically in the sidebar. The contour stays closed and the curve is continuously validated to clear the field.
4. Optionally load a locally stored reference seat-plan image with the opacity control. **This is only an image overlay for manual tracing**, not an automatically calibrated CAD/SVG importer.
5. Open **Aisles** to add radial circulation gaps. Set angle, width, and all-tier/single-tier coverage. The 2D editor shows the corridors, and the seats and terrace geometry are regenerated using exactly the same interval-splitting algorithm.
6. Return to **3D Orbit** or **Top plan** for the updated model. Use **Seat view** to inspect a chosen seat. Export `.filedmaker.json`, `.csv`, `.glb`, or screenshot PNG.

### Geometry and data constraints

- A custom outline is an ordered, star-shaped polygon around the pitch. It is **not** an arbitrary freeform CAD polygon with holes or isolated stands. The model rejects curve segments that cross the playing surface clearance.
- Control points are stored in meters in X/Z. Each seating tier expands radially outward from the edited base contour. This is a parametric approximation, not a survey-quality normal offset.
- Radial aisles currently create physical gaps in seat rows and visible stepped terraces, but do not yet generate stair meshes, handrails, vomitories, portals or concourse floors.
- Saved projects have `schemaVersion: 2`. Existing v1 JSON documents and local recovery records are automatically migrated on load. Save a v2 JSON file for interchange.
- Seating is **synthetic**, based on modeled row spacing and dimensions. Do not claim actual venue capacities, unobstructed real-world sightlines or official seat identifiers without external measurements and calibration.

## Modeling workflow

1. Select **Football**, **Soccer** or **Arena** to start from a useful preset.
2. Open **Bowl** to edit the shape exponent, pitch, aisle gaps and roof.
3. Open **Tiers** to add levels and tune each level's seating slope and depth.
4. Open **Sections** to define angular sectors, toggle disabled sections, and assign visible colors.
5. Click a seat in the viewport or use **Previous / Next** in the inspector. Select **Seat view** to inspect the virtual spectator viewpoint.
6. Name your project and use **Save locally** for a browser snapshot, or **Export JSON** for a portable editable file.
7. Export `.glb` for a 3D pipeline or `.csv` with every seat's coordinates and IDs. Export GLB may take extra time for large stadiums.

### File formats

An editable JSON document follows this envelope:

```json
{
  "format": "filedmaker-project",
  "project": {
    "schemaVersion": 2,
    "title": "My Stadium",
    "country": "United States",
    "city": "Columbus",
    "surface": "nfl",
    "shape": 4.5,
    "seatPitch": 0.52,
    "aisleWidth": 1.55,
    "roof": false,
    "outline": { "mode": "parametric", "points": [] },
    "aisles": [],
    "tiers": [],
    "sections": []
  }
}
```

`tiers` and `sections` must contain validated definitions. Export an existing project to get a complete example. Each seat CSV record includes a stable project-specific seat UID, tier, section, row, seat number, position in meters and orientation in radians. The model uses a **Y-up** coordinate system with its playing surface centered at the origin and long axis aligned to Z.

The GLB export is intended for interchange with other 3D tools. Some software may not support GPU instancing extensions and may need to expand or convert the instanced seats after importing.

## Architecture

```text
filedmaker/
├── index.html                     # HTML editor shell and import map
├── styles.css                     # Responsive studio theme
├── src/
│   ├── model.mjs                  # Pure parameter validation / geometry / seats
│   ├── survey.mjs                 # CSV import, registration, line of sight
│   ├── photo.mjs                  # Pinhole projection and landmark fitting
│   ├── scene.js                   # Three.js renderer, picking, 3D exports
│   └── app.js                     # Browser editor, local storage, import / export
├── scripts/server.mjs             # Optional dependency-free Node static server
├── tests/                         # Pure-geometry and HTTP smoke tests
├── serve-windows.ps1              # Windows native static server
├── start-windows.bat              # Windows launcher
└── .github/workflows/quality.yml  # Automated syntax, geometry & server tests
```

The geometry engine deliberately has **no 3D or browser dependencies**. It deterministically generates seats from a superelliptic perimeter, samples each seating row by arc length, creates section-relative seat IDs and derives successive tier offsets and elevations. The renderer uses GPU-instanced seats instead of thousands of independent mesh objects.

## Development and verification

No dependencies are needed for the included test suite:

```sh
npm run verify
```

This executes Node's syntax checks and the geometry/server test suites. GitHub Actions executes the same command on pushes and pull requests against `main`.

## Known boundaries

- This is an **editor for schematic parametric stadiums**, not a ready-made catalog of surveyed NFL/NBA/MLS venues.
- Detailed architectural façades, signage, accurately modeled roofs and verified obstructions need separately licensed reference data or manual modeling in a DCC/CAD tool.
- First-person seat views offer selectable posture, target, yaw, pitch and zoom. Imported seats use provided coordinates, but the camera and visibility model are illustrative until checked against independent measurements.
- Imported projects are schema validated but are not an authoritative source of physical measurements.
- Local snapshots are stored in browser `localStorage`; export JSON for backups.

## License

MIT. See [LICENSE](LICENSE).


## v4 — Viewpoint Studio and human-eye preview

The editor now includes a **Viewpoint studio** in the right Inspector. Load a model, click a seat, and choose **Human view**. Drag on the 3D canvas to look around; scroll while in Human view to magnify. You can also choose **Section** for an external close-up or **3D view** for a whole-building overview.

* **Spectator eye** — Seated (1.17 m above each generated seat's floor reference) and standing (1.60 m) presets. Camera height changes without moving the seat.
* **Look direction** — Independent yaw and pitch control; select center, near end, far end, or sidelines. The selected target only initializes the gaze; dragging pans independently.
* **Optics** — A representative central-gaze crop (Human) or approximate phone framing overlay (Phone) and zoom from 0.5× to 8×. This is **not** a calibrated physical model of peripheral human vision or a specific phone's lens.
* **Nearby crowds** — Optional local seated or standing human *proxies* around the seat. These are simplistic head/body shapes that illustrate possible occlusion, not verified spectator heights, movement, or sightline grades.
* **Architecture** — Automatically generated simplified parapet walls, perimeter rails and tier geometry. No exact arena plans, railing locations, or real obstruction measurements are bundled.
* **Find seats** — Enter queries such as `S01 row 8 seat 12` or `T2 S05 row 10 seat 4`. Move left/right or forward/back through model seats; seat search operates on the locally generated seating database.
* **Comparison** — Capture two 3D viewpoint screenshots and compare them side by side. You can also open uploaded **local reference photos** in the comparator. Photos stay in browser memory, are not transferred to a server, and disappear on reload.
* **Favorites** — Save seats in browser local storage, or copy a link to a seat in the *same locally stored project*. These links are **not** hosted or portable project shares. To share the full model, export the project JSON first.
* **View diagnostics** — Approximate field-target distance, eye elevation, look-down angle and FOV are reported. They are derived from **generated geometry**, not surveyed seat data. No numerical obstruction-clearance grade is claimed.

### Relationship to Shijiao / View Live

The public pages of `shijiao.xingpaste.com` document 2D/3D venue views, area and seat selection, eye-level views, phone framing, comparison, photos and saved spots. We implement an independent sports-stadium editing version of those **verifiable viewer interactions**. We do **not** copy their source code, assets, account system, personal photo database, event catalog or copyrighted stadium data. Features that depend on a hosted service (user profiles, uploads, moderation, events and worldwide venue records) are **not** available in this local modeling application.

### Data and accuracy limitations

All existing demo seats, sections, spectator figures and generated architectural details are **illustrative**. Accurate real-world obstructed-view predictions require surveyed seating and railing positions, field geometry, actual patrons and verified photograph calibration. GLB includes generated architectural geometry, but temporary crowd proxies and editing markers are editor-only and excluded from export. High-quality 3D previews require Three.js CDN access and a browser that supports WebGL.

## v6.0 — Real sports architecture and Ohio Stadium reference

Choose **Ohio Stadium · real reference** in the left sidebar, or **Build Ohio Stadium reference** in Bowl properties. This loads the named, editable stadium **architectural reconstruction**, not an official seat survey. The old NFL, CFL, soccer, NBA and NCAA project generators remain available.

New scene detail options:

- **Draft:** basic terraces, seats and field for editing at low cost.
- **Standard:** stair treads and exterior structure with sports-equipment context.
- **High:** stepped concrete risers, stair nosing, extra seat support, front railings, fascia ribbons, entrance frames, arcade bays, west-side suites, press-box glazing, north rotunda, south-end structure and officially sized scoreboard framing on the Ohio preset.
- Independent **facade** and **sports fixtures** toggles.
- Football: one-yard field hash markers, team bench zones, pylons and Ohio-themed scarlet end zones when the Ohio reference is selected.
- Soccer: corner flags and technical areas. Basketball: scorer's table, team benches and suspended display.

The reference project uses source-backed top-level facts, but **all individual seat coordinates and detailed architectural elevations are estimated**. The official Ohio Stadium published capacity is **not** the capacity generated by the reference project. See [Ohio Stadium source and accuracy notes](docs/OHIO_STADIUM_REFERENCE.md).

Files: `src/venues.mjs` (venue reference data), `src/stadiumDetails.mjs` (testable detail plan and envelope), `src/architecture.js` (3D structures), `examples/ohio-stadium-reference.json` (editable project).

## NBA Real Arena Pipeline — v7.0

Bowl → **NBA Arena Reconstruction** includes all 30 NBA 2026–27 home-arena identities with source references and estimated geometry labels. Five priority venues have independently sourced, identifiable interior features: Madison Square Garden, Chase Center, Crypto.com Arena, United Center, and Intuit Dome. The remaining 25 are deliberately marked **identity-only previews**, not authentic 3D reconstructions.

- **Source-backed features:** tier identities, MSG overhead bridge, Crypto.com Arena suite levels, and Intuit Dome's Wall / Halo Board. Their rendered dimensions and exact location are still estimated.
- **Human View:** corrected seat-to-eye offset, lean-forward posture, special basket/scoreboard targets, and self-chair visual hiding restored on GLB export.
- **Validation:** project import/export retains arena identity, refuses unknown arena IDs, and keeps generated seat coordinates classified as estimates.
- **NBA data:** see [NBA Real Arena Pipeline](docs/NBA_REAL_ARENA_PIPELINE.md) for evidence and acceptance requirements.

This update is a production pipeline foundation, **not** 30 finished measured arena digital twins.

## v7.2 — Stadium geometry integrity and human-eye correction

This scoped release repairs the common white rectangular cutouts seen in old stadium mockups. Unverified Ohio Stadium entrance openings were removed from the default real-venue reference, and unchanged legacy openings are migrated away without deleting user edits. Authored openings now require sufficient row rise, generate fitted corridor linings and closed tread edge skirts, and report unusable requests instead of carving phantom holes. High-detail seats use softer, thinner instanced backrests and seat cushions. Human view now models independent seat/hip/eye/look anchors and bounds neighbor collision correction without moving the model's original seat coordinates.

See [Geometry Integrity — Phase 1](docs/GEOMETRY_INTEGRITY_PHASE1.md) for precise acceptance criteria, limitations and verification. The geometry is still **schematic**, and a successful unit-test run is not proof of accurate real-world seat views or complete watertight mesh topology.
