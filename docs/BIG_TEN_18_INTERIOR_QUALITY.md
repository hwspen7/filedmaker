# Big Ten basketball interiors — reconstruction and seat-retention audit

## Outcome and scope

This branch provides **18 basketball venues within the same FiledMaker
homepage**, not 18 standalone static image viewers.

The native Schottenstein Center reference (Ohio State) is handled by its
specialized chart-contour model. The other **17 venue interiors** are generated
from individual section-map definitions and venue-specific seating geometry.
A campus name, a published capacity, or a screenshot is not evidence that
every seat or section polygon has been verified.

### Confirmed fixes

1. Removed **406 non-surveyed per-section front-row taper/trim rules**
   which visibly chopped occupied seats out of the first eight arenas.
2. Preserved the published section numbering and documented row gaps,
   including the IU split banks, Iowa continuous letter columns, MSU's
   absent row labels 10–12, UCLA's 215 media block, and Wisconsin's
   separate numbered levels.
3. Ensured an angular seat run capable of holding at least one seat
   with the model's 0.43 m minimum pitch is not dropped solely because
   the capacity-fitting pitch was larger.
4. Computed `sectionCoverage` on every generated model. This reports
   omitted physically seatable rows and chart sections with zero seats.
   Both conditions are errors in the normal model-integrity audit.
5. Unified duplicate official section identities across row-depth bands,
   so Iowa and Maryland do not draw separate duplicate 2D polygons.
6. Removed unsupported circular gap geometry from Michigan and
   Northwestern pending actual tracing of the band/club entrances.
7. Replaced the separate rectangular blocks supporting OSU's lower
   bowl with the same chart-row-based 3D tread and fascia mesh already
   used above. Lower-row elevations now share a continuous analytic
   surface, not independent per-section linear interpolation.

### Evidence scope by arena

| Arena | Section data | 3D interior | What still requires verified source geometry |
| --- | --- | --- | --- |
| Ohio State — Schottenstein Center | Specialized traced OSU chart contours | Row-aligned three-level concrete mesh | Survey-grade seats, full ADA and authoritative building CAD |
| Indiana — Assembly Hall | Official opposing stand and balcony labels | Independent two-side bank geometry | Main/balcony outer limits and courtside SEC 1–10 |
| Purdue — Mackey Arena | Verified 1–18 and 101–118 labels | Circular two-ring bowl | Premium/courtside seat inventory and physical portals |
| Illinois — State Farm Center | Verified three-ring numbering | Three-ring individual bowl with club gap | Courtside 9–13 modeled from published row labels; suite/accessible footprints remain estimated |
| Iowa — Carver-Hawkeye Arena | 28 full-height continuous lettered sections | Connected row bands without fake level | Section row extents and ADA platform coordinates |
| Michigan State — Breslin Center | Real 100/200 IDs and documented row 9→13 | Separately shaped levels | Section-specific portals and seating widths |
| Wisconsin — Kohl Center | Three 100/200/300 chart rings | Three-tier faceted overhang model | N/SC/CC premium blocks and exact offset |
| UCLA — Pauley Pavilion | A/B/C subsections and 215 MEDIA excluded | Distinct two-level angled bowl | Perch, media and student-area contours |
| Washington — Hec Edmundson Pavilion | Official 1–14 section columns across row bands | Compact rectangular seating bowl | Section-specific opening widths and row geometry |
| Maryland — XFINITY Center | Current 101–126 / 201–226 IDs | Three-stage rounded-rectangle bowl | Lower club and student-wall tracing |
| Michigan — Crisler Center | Current Michigan Athletics lower/upper chart | Asymmetric ellipse-based bowl, invented lower gaps removed | Club/student/band cutouts and row-specific outlines |
| Minnesota — Williams Arena | **Historic-only** letter/number reference | Schematic elevated-floor rectangle | Current 2026–27 section labels and every row shape |
| Nebraska — Pinnacle Bank Arena | Basketball chart 100/200/300 IDs | Three-tier faceted bowl | Suite, loge, accessible platforms |
| Northwestern — Welsh–Ryan Arena | Current 100/200 diagram labels | Compact two-tier rounded rectangle | Wilson Club edge and entry geometry |
| Oregon — Matthew Knight Arena | Diagram-labelled 100/200 sections | Angular two-level seating bowl | Official 2026 section-specific shapes and upper student banks |
| Penn State — Bryce Jordan Center | Venue-issued basketball section charts | Two-level broad ellipse | C-series boxes and actual 100/200 tier topology |
| Rutgers — Jersey Mike's Arena | Athletics' 100/200/300 layout | Compact three-tier box bowl | Courtside 97-seat roster and correct mezzanine/promenade edges |
| USC — Galen Center | Current 2026–27 men's pricing/section map | Rectangular two-level bowl | Courtside first/second rows and all sideline/corner boundaries |

**Important:** For the first eight non-OSU sites, published section labels
and neighboring order have been checked against linked charts, but the
section width, angle, rake, seat centers and modified envelope remain
**estimated**. The other nine model variants are also explicitly
**source-linked schematics**, not measured interior layouts. These
limitations are surfaced in the website and generated capacity reports.

## Engineering acceptance checks

Run:

```powershell
npm run verify
npm run generate:big-ten -- --out build/big-ten-18 --html --strict --max-error 0.035
npm run test:big-ten-browser
```

GitHub CI checks the full 18-school build, all mapped section identities,
all model seatable-row coverage, capacity error (at most 3.5%),
Schottenstein's seat count and lower-bowl step continuity, and WebGL2
screenshots of each school in the native homepage. The screenshot files
are stored in the `big-ten-arena-browser-visual-review` workflow artifact.

Capacity fitting is **not** used to invent a new section or enlarge an
undocumented tunnel. A source section which has not been reconstructed
is disclosed as missing rather than silently replaced by a generic block.

## Not yet certified

This branch does **not** claim OSU-equivalent architectural photo
calibration for all other 17 venues. Obtaining that requires
independently tracing each section boundary against authoritative
ticketing images, validating rows and portal polygons, comparing multiple
camera elevations, and separately inspecting the resulting scene. Until
those tasks are supported by evidence, a visually attractive schematic
must not be called a fully verified arena.

### Illinois State Farm Center visual correction

The earlier 3D overview displayed a thick gray ring even after the exterior
facade was hidden. That ring came from the generic concourse, gallery soffit,
roofDeck and backWall layers. The interior renderer now displays only the
seat-row treads, fascias, aisle edges and actual seat instances for non-OSU
bowl interiors. The *Building exterior* mode continues to show the shell.

The Illinois 100 lower deck now uses a court-oriented rounded-rectangle
contour rather than the same circular curve as its 200-level upper gallery.
Published section-specific row spans are applied to 101, 102, 110, 119, 121,
125, 127 and 201, including the A/B/C lettered courtside-leading rows and
the 201 first present row 6. Documented east-side student seating sections
9–13 are now represented as separate court-edge seating banks with authentic
row labels. Their specific chair coordinates, platform edges and row widths
remain *diagram-derived estimates*, not authoritative seat inventory.
