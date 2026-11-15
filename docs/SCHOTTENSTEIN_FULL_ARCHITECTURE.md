# Schottenstein Center: Full Architectural 3D Preview

This experimental branch provides a **programmatically reconstructed building**, not a surveyed 3D twin or an official OSU ticket manifest. It develops the previous chart-based audience preview without changing the original audience-preview branch or main.

## Geometry layers

The renderer combines the following independent layers:

- **Lower bowl:** Existing per-row tread and riser modules retain the chart-derived elevations. A generic lower-deck surface is intentionally **not** overlaid because it would intersect seats where sector elevations differ.
- **Club and terrace bowls:** Continuous, analytic sloping seating surfaces aligned to the corresponding seat coordinates, with front and rear fascias.
- **Circulation:** Intermediate walking decks and narrow transition bands between bowl tiers.
- **Section aisles:** Visual stair runs are fitted to gaps between neighboring section centroids. Each ray is checked against existing chair positions and discarded if it conflicts with more than three modeled chairs. No extra selectable seats are introduced.
- **Facade:** Modular neutral cladding, glazing courses, columns and a crown following the upper deck perimeter, rather than one opaque under-seat backing sheet.
- **Plinth:** Existing thin, separately drawn presentation base remains below the playing surface.
- **Interior equipment:** The basketball court, scorer's area, video board and spectator-view interior are retained. Overhead roof structure and hangers appear only in enclosed human view.

The new independent geometry lives in `src/next/schottensteinArchitecture.mjs`. `src/next/venuePlan.mjs` includes it in Schottenstein chart previews, and `src/next/webgl.js` renders each layer through native WebGL2 as separate meshes. This path is not applied to generic schools, Ohio Stadium, or imported layouts without reconstructed seating rows.

## Source integrity

The model uses schematic section contours and the existing Schottenstein Center basketball configuration. The **19,049-seat demo count** is retained and independently checked. Matching a published capacity does not verify each seat's location, row numbering, sightline, wheelchair inventory or ticket availability. The reference basketball and press/band/accessible gaps are preserved. Imported ticket identifiers and XYZ data remain separate.

The architectural and seating contours may be deliberately regularized for clarity. Finite-geometry, triangle winding, facade bounds, first-person cutaway, capacity and unaffected-venue behavior are validated in `tests/full-architecture.test.mjs`.

## Run and verify

```bash
npm run verify
npm start
```

Open the development server and select **Schottenstein Center**. Orbit, overhead and section views display the reconstructed architecture. Selecting a seat switches to spectator view, which hides the external architectural facade and uses the existing interior deck geometry. Geometry and CI validation are not substitutes for checking GPU rendering and sightlines on the target device.
