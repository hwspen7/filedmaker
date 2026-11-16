# FiledMaker Venue Builder

An independent lightweight direct-editing prototype that keeps the
source-calibrated Workbench intact. Open /workbench/builder/ on the
feature/venue-builder-studio branch. No official arena data is required.

## Workflows

1. Choose one of five starters: basketball venue, concert, community event,
   three-court training gym, multi-sport complex.
2. Drag in any court, sports equipment, seating stand, production component
   or training apparatus; click an assembly for grouped one-click placement.
3. Select stands and switch Straight / Curved, tune total arc angle, row count,
   rake and seat spacing. Seats are generated on each actual row arc.
4. Move, rotate, resize, duplicate or delete objects directly in the scene.
5. Use Top view for multi-court planning, 3D view for geometry review,
   grid snapping for placement, and Undo/Redo for experiments.
6. Save locally and export or import a portable JSON project.

Curved stands regenerate the **row-by-row arc seating**, not only an
illustrative curved outline. Multi-court facilities include separate
basketball, volleyball, badminton, pickleball and indoor futsal surfaces,
with a training library of benches, mats, squat racks, treadmills, bikes,
ball racks, goals, nets, hoops, cones, dividers and other equipment.
Parametric components are adjustable and supported by JSON serialization.

## External asset libraries and user-imported 3D objects

This prototype imports **local, triangulated or simple polygon OBJ files**
up to 1 MB, 2,500 vertices and 2,800 triangles. The importer preserves
the normalized geometry in the editable project JSON. Position, color,
rotation and dimensions are editable. It does not import OBJ textures,
material files, animation, large or high-poly assets, GLB or glTF yet.

The asset source filename and the license designation selected by the
operator are included in the project. License selections are **user claims,
not automatically verified facts**. Confirm permissions and attribution
at the original asset source before distributing any model.

Potential source libraries to browse and download from:

- Kenney: https://kenney.nl/assets (verify individual CC0 pack license)
- Poly Haven: https://polyhaven.com/models (CC0 models and textures)
- Quaternius: https://quaternius.com (current QAL may prohibit standalone
  asset-pack redistribution: review the license attached to each download)
- Sketchfab: https://sketchfab.com (models vary by license; attribution and
  account authentication can be required)

The repository does not redistribute external model files. For assets
that are glTF/GLB-only, re-export a reduced-poly OBJ using a 3D modeling
tool before import; do not assume that a source format is supported.

## Run and test

    npm start

Open http://127.0.0.1:5174/workbench/builder/

    npm run test:builder
    node scripts/browser-builder.mjs

The old Workbench remains at /workbench/.

## Editor controls

Click to select. Drag selection to move. Drag white corner handles to
resize and the round side handle to rotate. Drag blank scene space to orbit.
Scroll to zoom. Drag library components or assemblies into the scene.
Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes.
Ctrl/Cmd+D duplicates, Delete removes, arrows nudge selections.

## Boundaries and non-goals

This is dependency-free 3D projection on Canvas 2D, not a CAD-quality
mesh editor, licensed asset marketplace or architect-certified planning
package. The court outlines are simplified and the procedural models
are lightweight approximations. The scene is intended for configuration,
layout planning and quick concept presentations. It is **not** verified for
ticket inventory, construction, structural loading, accessibility,
emergency egress or event safety compliance. Dedicated seat view, advanced
mesh editing, PBR textures and native glTF/GLB import remain out of scope.
