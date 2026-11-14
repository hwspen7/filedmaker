# Geometry Integrity — Phase 1 (v7.2)

This release fixes geometry and seat-view defects in the school venue editor. It does **not** certify that the reconstructed Ohio Stadium or other school venues match surveyed construction documents.

## Bugs addressed

1. **Fake holes in Ohio Stadium.** Prior reference projects contained five manually guessed entrance cutouts. New Ohio Stadium projects no longer generate those cutouts. When loading an old project, the five untouched legacy cutouts are removed; any modified user openings are retained.
2. **Under-height portals.** A requested entrance now removes seats only when its section and tier are enabled, the requested rows exist, and the row rise provides at least 1.85 m of vertical relief. Otherwise the UI marks it as not cut, and seat, stair, facade and entrance planners agree.
3. **Unfinished entrance cutouts.** Valid entrances now create a floor, side cheek walls that follow the stepped stand, front threshold, upper lintel and visually recessed interior. These are **schematic** components, not measured real venue architecture.
4. **Open edges at terrace cuts.** Row segments now close their exposed left/right tread edges with skirt faces to reduce background-colored holes and open stair-step edges.
5. **Boxy seating.** High detail uses instanced rounded-edged cushion and backrest forms with thinner backs and metal supports. This retains seven instanced components regardless of capacity.
6. **Human view.** Seat, hip, eye and look anchors are now explicitly separate. The currently occupied seat remains hidden only during human view, and nearby-chair clearance adjustments are capped at 0.24 m. Authored seat coordinates are never changed to hide a collision.

## Quality control

Run `npm run verify`. This includes focused tests in `tests/geometry-integrity.test.mjs` covering previous failures and invalid portal cases. Geometry reports can be obtained through `entranceIntegrity(project)` in `src/geometryIntegrity.mjs`.

## Limitations and next validation

- The local automated browser in this environment blocks loopback access, so Three.js rendering and GLB export still require Windows browser verification.
- A rendering pass must review each regenerated Ohio Stadium level in orbit, plan and seated camera views.
- Placeholder dimensions do not establish real portal locations, certified clearances, building-code compliance, accessibility, seating inventory or safe occupancy.
- Geometry closure of the implemented tread-edge caps does not prove the entire stadium mesh is manifold. Detailed watertight CAD/engineering validation is a separate future task.
- The source measurements, locations and actual seats of real venues still need facility-provided CAD/survey data and on-site photographs.
