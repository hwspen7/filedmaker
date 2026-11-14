# Stadium Detail Kit — v6.1

## Scope

This is an engineering visualization library for **football, soccer, and basketball**
venues. Physical sizes are in meters, and all currently generated venue details
other than officially sourced Ohio Stadium summary dimensions remain schematic.

## Renderer and source-of-truth contract

1. `model.mjs` defines the playing surface, section and tier geometry, seating
   intervals, per-seat IDs and optional imported survey coordinates.
2. `detailKit.mjs` creates **pure-data** plans: `entranceFramePlan`,
   `seatAssetPlan`, `guardrailPlan`, and `fieldEquipmentPlan`.
3. `architecture.js` instantiates the planned portals, handrails, exterior
   and sports furniture as Three.js objects.
4. `scene.js` instantiates the stadium seat components and clipping-aware
   concrete parapets. Picking always uses mesh #0, with each `instanceId`
   matching the original `model.seats` array index.
5. When survey seats are imported, schematic terraces and architectural context
   stay hidden rather than pretending to be surveyed.

## Fixes to v6.0 geometry

| Visible problem | New behavior | Remaining limitation |
|---|---|---|
| Suspended black cuboids at vomitory entrances | No solid box in opening; place jambs and a lintel at the upper edge of the removed-row strip | This is not yet a measured tunnel, fire exit or architectural door |
| Seats look like blocks | Thin seat pan, slim supports and optional chair back/armrest | Full curved injected-plastic shape and actual Ohio seating style require site photos and a mapped seat inventory |
| Guardrails cross walkways | Rail segments are clipped by the same aisle/portal intervals as seat rows | Survey-grade railing heights and code compliance are not asserted |
| Tier fascia hides stair gaps | Parapet strips are derived from valid row-level intervals | Building structure below the decks remains a schematic shell |
| Field equipment looks like colored cubes | Sport-specific kits for benches, carts, pylons, media platforms, team technical areas and scorer's tables | Positions are examples, not official game-day layouts |
| Scoreboard frame and face can become misaligned when rotated | Frame and display share one local transform | Screens are schematic placeholders, not a licensed video feed |

## Reuse for additional real venues

For a new stadium, load an official or licensed SVG plan and configure sections,
tiers, aisle widths, portal row ranges and venue reference facts. The Detail Kit
then generates those accessory structures for that geometry; it does **not**
automatically infer the geometry from an exterior photograph. Confirm measurements
and data rights before using the model to inform ticket purchases.

## Complexity management

- Chairs use **7 instanced component meshes**, rather than 7 meshes per seat.
- Railings use two instanced batches: posts and horizontal tubes.
- Entrance objects are constructed only for active sections with enough rows.
- Draft and Standard continue to avoid the highest-detail rail and stair visuals.
- Expect `High` detail mode to cost more GPU memory and loading time.
- Always test human-eye view, seat picking, event-day equipment and GLB export
  on a real target browser and GPU. Unit tests are not graphics tests.

## Commands

```sh
npm run verify
npm start
```

Windows users can continue using `start-windows.bat` at port 5174.
