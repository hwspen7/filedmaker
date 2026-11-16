# FiledMaker Live — independent venue-viewing experience

This route is an independent implementation of a venue-first 2D/3D seating workflow. It uses the existing FiledMaker seat model and native WebGL2 renderer. It is **not** affiliated with, nor a source-code or asset copy of, shijiao.xingpaste.com.

## Open

Start the repository on Node.js 20+ with npm start, then open:

http://127.0.0.1:5174/experience/

Routes:

- /experience/?venue=schott — Schottenstein Center reference
- /experience/?venue=ohio — Ohio Stadium reference
- /experience/?venue=schott&layout=concert — illustrative 3D end-stage arrangement

The original venue workbench and other tools are preserved. The live experience does not write over the school's locally saved importer project.

## Reference-style workflow

1. Choose a venue and a sports/concert scene.
2. Pick a tier and section, or select a seat in the 2D map or 3D model.
3. Enter a row/seat ID when the *rendered reference* contains it.
4. Adjust depth and lateral position. These controls select another **existing** model seat in the same section; they never synthesize a ticket identity.
5. Switch to the section close-up or human-eye WebGL2 view.
6. Change seated/leaning/standing posture, activate phone framing, save or compare positions.
7. Upload a local photo (JPEG, PNG or WebP, up to 10 MB). Photos stay local to this page session and are not uploaded, publicly published or supplied by the reference website.

## Fidelity boundaries

- The two referenced Ohio State venues are not official surveyed seat models. Exact sightlines, distances, section contours, seat coordinates and seating configurations still require verification.
- The concert stage is a visually distinct illustrative arrangement using native 3D box instances, NOT an actual concert seat map or promoter's stage CAD.
- Venue catalog, event schedules, public photo feed, user accounts, photo moderation, ticket inventory and external payment integrations from shijiao.xingpaste.com are **not** replicated. No 196-venue database is claimed.
- User-facing labels and graphics are independently created and do not reuse the source site's logo or proprietary photo assets.

## Technical structure

- experience/index.html — venue-first responsive application layout.
- experience/experience.css — self-contained page styling.
- experience/experience.js — venue routing, section-position sliders, gallery and UI integration.
- viewer/viewer.js — the existing 2D/3D seat explorer with a narrow public adapter on this route.
- src/next/compatScene.js — uses the shared WebGL2 renderer.
- src/next/concertStage.mjs — adds illustrative stage blocks to the renderer's existing instance buffer.

## Verification

npm run verify
npm run test:workbench-browser

The browser acceptance script includes the new route, verifies a genuine WebGL2 canvas, a non-empty referenced seat roster, slider-based seat changes, comparison, seat camera, switching back to 2D and a screenshot. The unit suite checks the page contract and stage instance geometry.

Do not claim that a successful code or screenshot test validates official geometry. Inspect the displayed UI in Chrome/Edge as well before using the experience for external audiences.
