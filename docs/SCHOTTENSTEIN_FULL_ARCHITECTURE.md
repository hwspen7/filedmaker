# Schottenstein Center: Full Architectural 3D Preview

This experimental branch provides a **programmatically reconstructed building**, not a surveyed 3D twin or an official OSU ticket manifest. It develops the previous chart-based audience preview without changing the original audience-preview branch or main.

## Geometry layers

The renderer combines the following independent layers:

- **Lower bowl:** Existing per-row tread and riser modules retain the chart-derived elevations. A generic lower-deck surface is intentionally **not** overlaid because it would intersect seats where sector elevations differ.
- **Club and terrace bowls:** Regular banks share level row elevations. Each row retains its traced plan run, including separate ends at the media side. The row treads and risers align with the chairs.
- **Circulation:** Intermediate walking decks and narrow transition bands between bowl tiers.
- **Circulation openings:** The chart-derived seat gaps remain visible. The preview has no invented exit signs or radial stairs.
- **Building exterior:** A convex rounded-rectangle perimeter defines the foundation, wall, rear gallery and roof. Seat gaps cannot pull it inward. **Building** shows the full shell and corner rotundas. **3D overview** exposes the seating with a low exterior cut.
- **Upper gallery and press enclosure:** The rear gallery has a level floor, soffit and window heads. The press enclosure follows its own chart footprint at a lower elevation and keeps the documented seating gaps clear.
- **Foundation:** A structural base sits below court level and is hidden in **Seat view**.
- **Interior equipment:** The basketball court, scorer's area, video board and spectator-view interior are retained. Overhead roof structure and hangers appear only in enclosed human view.

The new independent geometry lives in `src/next/schottensteinArchitecture.mjs`. `src/next/venuePlan.mjs` includes it in Schottenstein chart previews, and `src/next/webgl.js` renders each layer through native WebGL2 as separate meshes. This path is not applied to generic schools, Ohio Stadium, or imported layouts without reconstructed seating rows.

## Manual seating refinement

`src/schottensteinRefinement.mjs` keeps the authored preview edits separate from the raw chart. The current set removes narrow trace artifacts in sections 313, 315, 319 and 320, aligns selected wedge sections to the rear edge, and samples the last row before the trace tapers to a narrow tip. The same seating allocator balances the adjusted spans to 19,049 modeled positions. The elevation profile eases into the lower rows and steepens towards the back, with common endpoints per tier. These adjustments retain the section map, accessible landings and press-side gaps.

## Source integrity

The model uses schematic section contours and the existing Schottenstein Center basketball configuration. The **19,049-seat demo count** is retained and independently checked. Matching a published capacity does not verify each seat's location, row numbering, sightline, wheelchair inventory or ticket availability. The reference basketball and press/band/accessible gaps are preserved. Imported ticket identifiers and XYZ data remain separate.

The architectural and seating contours may be deliberately regularized for clarity. Finite-geometry, triangle winding, facade bounds, first-person cutaway, capacity and unaffected-venue behavior are validated in `tests/full-architecture.test.mjs`.

## Run and verify

```bash
npm run verify
npm start
```

Open the development server and select **Schottenstein Center**. Orbit, overhead and section views display the reconstructed architecture. Select **Building** for the enclosed exterior. **Seat view** uses the same row treads as the architectural cutaway and hides the exterior facade. Geometry and CI validation are not substitutes for checking GPU rendering and sightlines on the target device.
