# FiledMaker Venue Builder

This is an independent lightweight direct-editing prototype, kept separate from
the existing source-calibrated Workbench. Open /workbench/builder/ on the
feature/venue-builder-studio branch. No official arena data is required.

## Implemented in this first slice

- Basketball, concert, and community-event starter scenes
- Eight reusable components, inserted by click or canvas drag-and-drop
- Selection and direct repositioning in an orbitable 3D-style canvas
- Position, rotation, dimensions, stand-row, rise, and seat spacing controls
- Automatic regeneration of conceptual modeled seat positions and counts
- Undo, redo, duplicate, remove, grid snap and top-down view
- Local-browser saving and portable JSON export/import

The scene uses a dependency-free 3D spatial projection on Canvas 2D. It is not
a full CAD mesh editor or the existing detailed WebGL venue renderer. Seat view,
photorealistic rendering, formal collision validation, regulated egress/safety
certification, actual ticket-inventory integration and arbitrary mesh editing
are not implemented. Model coordinates and seat counts are illustrative, not
official seating or construction measurements.

## Start locally

From the repository root run:

    npm start

Open http://127.0.0.1:5174/workbench/builder/

Run model tests:

    node --test tests/builder-model.test.mjs

The older Workbench remains at /workbench/.

## Controls

Click to select and drag to move. Drag empty scene space to orbit.
Scroll to zoom. Drag an item from the component library into the scene.
Ctrl/Cmd+Z undoes. Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes.
Ctrl/Cmd+D duplicates, Delete removes, arrow keys nudge the selection.
