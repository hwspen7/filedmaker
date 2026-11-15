# FiledMaker v10 — Seat Studio Rebuild

**New default entry point:** `http://127.0.0.1:5174/` is a rebuilt seat-first viewer powered by a single dependency-free WebGL2 renderer. 2D remains available when WebGL2 is blocked. The school tool at `/school/` and viewer at `/viewer/` share the same renderer. The previous advanced modeling UI is retained at `/legacy/` for compatibility and its GLB export.

## Audience preview

The first venue is Ohio State men’s basketball at the Schottenstein Center. FiledMaker renders the arena, section map, camera and seating geometry in its own offline WebGL2 viewer. The seat inspector includes five reference positions for comparing the model to published seat-view photos.

| Reference | Model feature |
| --- | --- |
| [Ohio State men’s basketball seating chart](https://ohiostatebuckeyes.com/sports/2018/6/4/seating-charts) | 78 traced section contours, including concave notches, separated corner blocks and the press-box cutout |
| [Ohio State video board update](https://ohiostatebuckeyes.com/news/2026/7/17/mens-basketball-schottenstein-center-to-feature-video-board-enhancements-this-season) | Four convex faces, underside displays and 36-inch ribbon display |
| [105](https://www.rateyourseats.com/schottenstein-center/seating/sections/105), [114](https://www.rateyourseats.com/schottenstein-center/seating/sections/114), [206](https://www.rateyourseats.com/schottenstein-center/seating/sections/206), [323](https://www.rateyourseats.com/schottenstein-center/seating/sections/323), [302](https://seatgeek.com/venues/value-city-arena-at-schottenstein-center/seating-chart) | Reference rows, club row counts, the gap behind 323 B, and interior sightline comparisons |

The generic floor uses NCAA court dimensions and standard court markings. The scoreboard uses unbranded display panels. The 2D map and 3D seating rows share contours traced from the published chart, scaled to the playing lines inside the painted apron. Published row labels guide all three levels, including the documented gaps in terrace sections 304, 307, 314, 323 and 331. The eight club sections with published per-row counts retain those counts. Remaining positions are distributed across available row spans with at least 0.48 m of modeled center spacing. The allocator keeps the marked wheelchair platform, band area and press box clear of modeled chairs. Geometry outside the playing surface and the seat numbers remain approximate.

The [official Schottenstein Center concourse map](https://web.mappedin.com/ohio-state/ohio-state-schottenstein-center.html) shows 26 access stair runs at Entry Level, 26 in Huntington Club and 34 at Terrace Level. The preview registers these against seating sections, adds corresponding aisle geometry and shows the level and nearest sections when a marker is selected on the 2D map. The mapped runs describe access between bowl seating and its concourses. Their 3D elevations and dimensions are reconstructed. See the [venue guide](https://www.schottensteincenter.com/a-z-guide) for named public building entrances. **Seat view** opens at the 105 D reference if no position is selected.

The [2026–27 Ohio State men's basketball record book](https://ohiostatebuckeyes.com/documents/download/2026/11/6/2026-27_Ohio_State_Men_s_Basketball_Record_Book.pdf) lists a capacity of 19,049 and 18,809 with students. Seat Studio renders 19,049 chairs in the default preview and lists the student configuration separately. How the total is split among modeled rows is a reconstruction. A venue roster with XYZ can replace the preview positions for the seats it covers.

Subsequent phases extend the same reference-and-geometry workflow to NCAA basketball arenas, then NCAA football stadiums, then lower-cost profiles for universities and secondary schools.

For a surveyed Ohio State men's basketball import, use a CSV with `section,row,seat,x_m,y_m,z_m` and optional `seat_id`. Supply seat centers at tread height, in metres, with the playing surface centered at the origin. Y is elevation, X runs across the court and Z runs lengthwise. The right end of the published chart is negative Z. Each seat needs a distinct XYZ point. The imported inventory replaces the demo chairs in the open project and retains the traced section map. Published capacity remains a separate comparison. A partial survey displays the seats it covers. The [official public Virtual Venue](https://ohiostatebb.io-media.com/web/index.html) provides view references. The [Athletics Ticket Office](https://ohiostatebuckeyes.com/sports/2024/1/16/contact-us-ticket-office) is the point of contact for an event configuration's complete seat manifest and measured seat plan.

## What changed

- One shared seat geometry plan for studio, school preview and viewer instead of multiple incompatible seat meshes.
- Compact chair geometry for NCAA basketball. Backless spectator benches for schematic American-football tiers, except where an explicit seat style is supplied.
- Tread and riser support for every seat row, including end caps without bridging aisles.
- Smooth orbit, overhead plan, section preview and human-eye camera, with self-seat and nearby-camera geometry exclusion.
- A minimal playing surface, scoreboard, football goalposts or basketball hoops. No fabricated external architecture by default.
- Published capacity, imported ticket inventory and model positions are separate metrics. A published capacity does not create seats.
- School CSV import preserves section/row/seat IDs; missing XYZ positions are inferred and labeled as estimated.
- Adjustable venue-derived seat palettes. Blue is not forced on every institution.
- The school tool's Publish action can now export a self-contained offline HTML preview with bundled native 2D and WebGL2 rendering (large outputs for major stadiums).

## Run locally

On Windows run `start-windows.bat` from the repo folder, then open `http://127.0.0.1:5174/`. On macOS/Linux run `npm start`. Node 20+ is needed for the Node server, but the included Windows PowerShell server does not require Node.

Run `npm run verify` for unit, geometry and HTTP checks.

## Accuracy and visual validation

Ohio Stadium and Schottenstein Center in the demo are **architectural/identity references with synthetic seat positions**. The official published capacity is separate from the number of programmatically rendered seat locations. There is no verified OSU seat inventory or surveyed bowl geometry in this repository. Do not publish demo seats as ticket seats.

A complete school production deployment needs its authorized seat IDs, section geometry and a visual alignment check against photographs of known rows. The renderer and geometry rules have local unit verification, but current CI does **not** test the visual WebGL output. An actual browser/graphics-device inspection is required before declaring production visual acceptance.

Older scene modules are preserved only for the legacy editor. The standalone legacy HTML exporter is still supported for previous projects; School Studio Publish now uses a bundled offline viewer instead.

---

## New: School Seat Viewer (v9.2)

The main production experience is now **seat-first**, not architectural cloning.

- Launch the School Studio at `http://127.0.0.1:5174/school/`.
- Import the actual school row CSV, ticket roster, or XYZ seat data.
- Click **Open interactive Seat Viewer** to inspect the current data at `http://127.0.0.1:5174/viewer/`.
- Viewer opens in 2D immediately and supports sections, levels, seat search, pan/zoom, favorites, local photo reference and A/B seat selection. It lazily loads Three.js for orbit, section and human-eye views. A failed WebGL load must not prevent 2D access.
- Published capacity, ticket roster, and modeled seat count are distinct. Never infer a live ticket inventory.

The external site used as a functional reference (`shijiao.xingpaste.com`) publicly marks some venues as schematic and their seat positions as estimated. Its private modeling code, complete datasets, and exact software stack are **not** available for verification. FiledMaker is an independent implementation, not a code copy.

# FiledMaker

## v9.0 — Seat-first NCAA / K–12 school venue generator

FiledMaker now prioritizes **ticket seat identities**, not complicated stadium architecture. School administrators can import a `section,row,seat` ticket roster and produce a tiered-blue 2D/3D seat preview with a generic court/field, hoops or goalposts and a simple scoreboard. The advanced editor's **Ticket data** tab performs published-capacity versus imported-ticket versus 3D-count reconciliation without manufacturing missing tickets. The **School Studio** at `/school/` supports row-count CSV, full ticket-inventory CSV, and XYZ survey CSV. Both export an editable project; School Studio also exports an independent HTML preview and ticket mapping CSV.

**Critical accuracy boundary:** official capacity is metadata backed by an official source. Ticket identities come only from the school import. XYZ coordinates computed from a roster are estimates, not surveyed seat centers or certified views. A count match does not certify geometry, and the preview has no live inventory or payments. The current v9 modules do not automatically read Ticketmaster or school ticket providers.

[Complete v9 seat-first workflow, CSV schemas, validation and limitations](docs/SEAT_FIRST_PIPELINE.md)

---


## v8.0 — OSU dual-venue NCAA reference samples

The advanced editor now includes both **Ohio Stadium** and the **Jerome Schottenstein Center**. Their published building facts are maintained separately from estimates used to render 3D seats.

| Sample | Published reference capacity | Real measurements used | Still estimated |
| --- | --- | --- | --- |
| Ohio Stadium | **102,041** (October 2026 OSU game notes and stadium page; May 2026 guide lists 102,780) | Building envelope 919 × 679 ft; building and press-box heights; 2012 screen dimensions | Individual seats, section angles, row depths and elevations, aisle and tunnel locations |
| Schottenstein Center | **19,500** basketball (OSU description; arena lists up to 19,700) | Gross floor area **770,000 sq ft**, NCAA court **94 × 50 ft**, documented 2026 board features | Building footprint and height, aisle positions, synthetic arena sectors and seating geometry |

**Generated seat counts are not the published capacity**. Download the evidence and capacity QA report from the **Info** tab of an OSU reference project. These sample projects are not certified exact-seat previews and are not ready to be used for paid ticket inventory. See [`docs/OSU_DUAL_SAMPLE_V8.md`](docs/OSU_DUAL_SAMPLE_V8.md) for data provenance, version discrepancies, and the remaining field-measurement requirements.


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

FiledMaker v5 joins the existing **light editor**, custom stadium outlines, human-eye seat views, and SVG tracing with a verifiable local workflow for real-world seating data. It is designed for **football, basketball and soccer venues in the United States and Canada**.

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

## v8.0 — Stadium geometry integrity and human-eye correction

This scoped release repairs the common white rectangular cutouts seen in old stadium mockups. Unverified Ohio Stadium entrance openings were removed from the default real-venue reference, and unchanged legacy openings are migrated away without deleting user edits. Authored openings now require sufficient row rise, generate fitted corridor linings and closed tread edge skirts, and report unusable requests instead of carving phantom holes. High-detail seats use softer, thinner instanced backrests and seat cushions. Human view now models independent seat/hip/eye/look anchors and bounds neighbor collision correction without moving the model's original seat coordinates.

See [Geometry Integrity — Phase 1](docs/GEOMETRY_INTEGRITY_PHASE1.md) for precise acceptance criteria, limitations and verification. The geometry is still **schematic**, and a successful unit-test run is not proof of accurate real-world seat views or complete watertight mesh topology.


## v9.1 Seat-row visual integrity correction

The v9.0 imported-ticket viewer drew only thin, two-triangle strips beneath the seats while skipping the normal stadium terraces. As a result, many seats appeared to float as parallel blue lines against a white background. The v9.1 renderer replaces those strips with non-surveyed **full-depth, capped row supports**: tread tops, risers, rear faces, and side caps, including breaks at actual roster gaps. The scene also renders simple neutral stair treads at known procedural section/aisle gaps.

The seat mesh now has visible support legs and backrests in the seat-first viewer even at standard detail quality. The default seats remain stylized, not representations of an institution's actual seat furniture. No imported ticket identifiers, coordinates, or official capacities are changed.

Verification: `npm run verify`. Real WebGL appearance, lighting, and performance need a browser screenshot check before labeling the graphics as visually accepted.


## Visual fidelity notes (v9.3)

A venue name, published capacity and generic 3D template are **not** a surveyed seat map.
For Ohio Stadium and the Schottenstein Center, the generated sector numbers and individual seats remain synthetic until a verified ticket manifest is imported. No synthetic seat is a purchasable ticket.

The visual renderer now shares seating type and school color rules across Studio and exported previews. OSU football uses a simplified bleacher-like representation instead of rendering every spectator position as an oversized folding chair. Seats use locally derived row normals; official seat sightlines still require verified geometry.

For actual ticket-sale integration, the school must supply canonical section/row/seat identifiers, valid coordinates or photographed controls, and a real ticket-provider inventory API. A published capacity does **not** establish the number or location of sellable seats.
