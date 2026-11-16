# FiledMaker | Canvas-first workspace and extensible modeling tools

## Why the interface changed

The earlier workspace showed three stacked navigation layers, a very narrow
scrolling form and a tiny arena in an oversized 3D viewport. The new editor
prioritizes a well-framed model and exposes only the current object tools.

## Interface contract

- Main canvas first. Fit, overhead, focus-section, zoom, PNG capture and an
  optional collapsible tool panel are available without changing the project.
- Model-stage tools are grouped into Rows, Seats, Batch and Scene.
- Section position, perimeter and elevations remain in Calibrate.
- Source identity and documented seat counts remain distinct from estimates.
- Every individual staff edit is provisional until reviewed against evidence.

## Available modeling tools

| Group | Capabilities |
| --- | --- |
| Navigation | Fit, top view, section focus, zoom, image capture, panel collapse |
| Sections | Drag contour, calibration, section movement, width, pitch and rise |
| Rows | Add, delete, reorder, edit count, names, nonsequential labels, direction |
| Clearances | Aisles, row end margins, row depth offsets and elevations |
| Seats | Click or select seat ID, adjust bounded XYZ offsets, reset overrides |
| Batch | Edit entire section seat style or end margins in one atomic transaction |
| Audit | Original source metadata, staff edit ledger, geometry and count warnings |
| Export | Editable project JSON, seat coordinate CSV, quality report, offline HTML |

Bulk editing is limited to 200 source rows per section. It never adds seats,
changes original seat IDs or invents new source measurements. QA validates
the entire update and rejects it atomically on blocking geometry.

Keyboard shortcuts outside editable fields: F fits the model, T selects the
overhead view, V shows the 2D plan. Standard undo/redo remains available.

## Further modules planned, not yet implemented

Geometry and structures: regular and curved bank templates, mezzanines,
wheelchair platforms, handrails, doors, scoreboards, circulation routes,
press gaps and accessible seating structures.

Editing: box and multi-selection, constrained alignment, duplication and
reflection with explicit provenance, snap guides and before/after diffs.

Evidence: side-by-side PDF and 3D matching, staff confirmation for each
bank/row, provenance-linked dimensions and multi-person review.

Seat experience: section preview, sightline calculations based on confirmed
geometry, camera presets, optional roof and cutaway display.

Delivery: reusable templates, project library, institution review controls
and embeddable school websites. No professional compliance certification
is claimed without physical measurements and appropriate review.

## Acceptance criteria

Chrome WebGL2 should show the modeled gym at a usable screen proportion
instead of a tiny speck. Tests cover fit and camera tools, tool switching,
batch invariants, invalid geometry rejection, source preservation and
existing OSU, PDF and real-school case workflows.

## Unified command bar

The former three high-level navigation rows are now one compact command bar.
It contains the FiledMaker link, project name and concise status, four
workflow steps, undo/redo, project review and a single overflow menu.
The 2D/3D tabs, camera controls and optional tools collapse share one
canvas toolbar. Source-case notes float over the stage and no longer
take permanent vertical space from the model.

## Generic structure component library

Seven types are available in the Build tool: accessible platforms, stair
flights, rails, partitions, entrance frames, generic scoreboards and
press/staff desks. Staff may add, update, rotate, duplicate, delete, select
on the 3D view, place on the calibrated 2D plan and drag a selected
component on the plan.

Each component is represented by editable dimensions, placement,
orientation, a stable ID and an unverified source note. The object
contract is bounded to 200 elements and exported as part of the project.
WebGL2 renders real box-based 3D primitives, rather than static 2D icons.
Placement never removes seats. Candidate edits that collide with
existing seat positions are rejected; remaining accessibility and
safety considerations still require independent staff or professional
review. The models are *generic placeholders*, not architectural as-builts.
