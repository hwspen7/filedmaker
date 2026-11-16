# Operator-assisted venue modeling

This is a semi-automatic school venue modeling workbench, not an official
ticket inventory, autonomous CAD reconstruction or an as-built survey.

## Core workflow

Import the source plan and row schedule, register four court corners,
trace source sections in 2D and generate an editable 3D preview.
The fictional 1,500-seat gym is an end-to-end training case. Aiken has
documented aggregate bank totals, but all modeled row data is assumed.

## Section geometry

Select a bank and adjust its first-row height and rise per row. Open
Precise section positioning for X/Z translation and width scaling from
50 to 150 percent. Drag a section corner on the 2D plan; hold Shift for
10 cm snapping. Invalid polygons or blocked geometry revert automatically.
Manual section transformations clear obsolete image trace corner data.
The 2D calibration step also provides an optional two-point ruler. It reports
a plan-derived distance based on the current registration and is explicitly
not an independent architectural measurement. Changing the source drawing
or calibration invalidates its reading.

## Row editing

In the model stage select a section and source row. You can change row
seat count, first number, nonconsecutive seat labels, seat order, aisle
locations, seat type, start/end margins, row depth and measured/estimated
elevation. Extra tools insert, reorder or remove a row.

Aisles use AFTER:WIDTH_M, e.g. 12:1.2|20:1.0. Aisles and insets reserve
physical empty space rather than silently changing the source seat count.
Row depth offsets stay within the selected section. Changing a row that
has explicit seat labels requires a replacement list.

## Individual seat corrections

Enter a seat label or click the seat in the 3D view. Local X/Z coordinate
adjustments are limited to plus/minus one metre and Y to 0.75 metres.
The same seat ID and row total remain; the override can be cleared.
This is an unverified staff correction, not surveyed geometry.

## Evidence and history

Edits are transactional, deterministic and validated. Staff-edited rows
retain the original sourceSeat count when available, as well as editable
seat count, manual insets, seat offsets and clear provenance. A bounded
editLedger in the exported JSON records each accepted change. The existing
undo/redo state and source file SHA-256 manifests remain independent.

QA exposes row changes, official-count discrepancies, staff-added/deleted
rows, adjusted individual seats, overlapping positions and adjoining
stands with inconsistent elevations. No edit changes the certification
flag. Exported HTML is clearly a preview requiring school review.

The engine retains a 40,000-seat preview limit, rather than promising
unbounded geometry. Real school delivery still needs authenticated seat
IDs, accessibility/egress validation and measured sightline evidence.

## Validation

Run npm run verify and npm run test:workbench-browser. Automated
tests cover immutable geometry, source-preserving edits, row arrangement,
clearances, reversal, seat shifts, undo/redo and end-to-end Chrome WebGL2
rendering on a fictional 1,500-seat gym. The Aiken data exercise verifies
that unverified row geometry never becomes a certified seat map.

Future tasks include staff-led genuine school projects, multi-selection,
more detailed measurement tools and practical delivery integrations.


## Windows launcher and branch identity

The launcher never silently switches branches. First select the desired
branch yourself (main for the stable release or
feature/operator-geometry-editor for this review), fetch it and pull it.
Then run scripts/launch-workbench.ps1. The launcher checks the current
branch and verifies that the localhost server is serving the same commit,
rather than reusing an older tab. Local working-tree changes are allowed
and reported as a warning. The launcher never fetches, pulls, stashes,
resets or overwrites Git files; update the branch explicitly when desired.

## Generic venue structures

The Build tool has seven reusable component templates: platform,
stairs, rail, wall, entrance frame, scoreboard and desk. Select a type,
then create it using the current dimensions or click **Place on 2D plan**
to position it at a calibrated point. Existing components may be selected
and their X/Z, base elevation, width, depth, height and rotation adjusted.
2D dragging, duplication, 90-degree rotation and removal are available.

These components use estimated generic geometry. They have source notes
and form part of the editable project JSON. WebGL2 preview is updated
without altering any seat IDs or original row counts. A proposed
structure/seat overlap blocks the edit rather than silently deleting a
seat. Structural compliance, safe egress and accessible clearances are
not certified by this editor.


## Court and field editor

The Court tool offers eight one-click floor/field palettes and explicit
custom colors for the playing area, apron, lines and key/lane. The staff
may toggle markings and boards, move or rotate the playing surface and
set source-supported dimensions. Existing seats are unchanged. Width and
length edits raise a source re-registration warning.

The 2D plan exposes direct handles for center translation, playing width,
playing length and orientation. A source plan must be calibrated first.
Custom painted shapes (rectangle, circle/ellipse outline and stripe) can
be placed on the 2D plan, edited, copied and deleted. Painted zones are
bounded to the actual playing area, retained in JSON and included in
WebGL2 scene instances. They are not official logos or venue branding.

## Expanded searchable construction palette

The Build pane now offers 23 procedural components across access,
structure, seating and equipment groups. Staff can search by name,
repeatedly place a selected component, nudge it by 25 cm, or drag
2D handles to resize and rotate. Precise numeric controls remain
collapsed by default. Every edit is reversible and subject to seat
interference checks. Components are schematic shapes rather than
fully engineered building elements.

Tests must distinguish source-preserving preview edits from verified
construction measurements and accessibility compliance.

## Multi-component layout and repeated elements

The collapsed **Arrange multiple components** panel supports genuine
selection sets. Ctrl-click a component center on the 2D plan to toggle
membership, drag empty 2D plan space to select a rectangular group, or
select objects from the multiple-selection list. A regular click selects
one object; dragging an already selected member moves the whole group.
The component list also supports select-all and returning to one object.

Selected components can be translated together by documented offsets,
aligned to the first selected center, spaced evenly between the outer
centers, or mirrored about their shared X or Z centerline. Multi-object
duplication preserves internal spacing and assigns new component IDs.
A linear array creates one to twenty repeated copies at a specified
two-axis offset per repetition, allowing repeated railings, desks,
canopies or structural posts to be built without repeated manual clicks.

All group commands validate the whole proposed result against the
200-object limit, source seat positions and document geometry before
committing it. No partial changes survive a failed operation. Accepted
groups form one undo/redo step and one provisional audit event. These
schematic structures do not establish legal access, egress, load capacity
or measured construction geometry.

## Canvas framing and keyboard operations

The 2D canvas now includes the actual bounds of every placed component and
the translated or rotated playing surface. Component bounds remain stable
during a pointer drag so the camera scale does not move underneath the cursor.

With the Build tool active and focus outside inputs, arrow keys nudge the
selected item or selection by 25 cm. Holding Shift uses 5 cm increments.
Ctrl/Cmd+D duplicates a component or the whole selection, and Delete asks
before removing the selection. These shortcuts are disabled inside editable
form controls and do not replace the standard undo/redo commands.

The advanced arrangement tools remain closed until needed, so the scene
canvas retains the larger canvas-first layout.

## Quick-build venue assemblies

The Build pane includes six optional composite layouts. They are built
from the same editable and seat-safe geometry primitives as the standard
component catalog, rather than imported opaque meshes:

- Main entry and gates
- Accessible spectator access with a platform and schematic ramp
- Player tunnel and staging
- Terraced stand with an aisle
- Press and scorer station
- Covered concourse bay

Select a kit, provide its center X/Z, angle and scale, and insert it in
one operation. Alternatively click **Place on 2D plan** to position the
complete assembly using the calibrated drawing. All generated parts have
independent stable IDs and can subsequently be individually selected,
moved and resized or transformed as a group.

An assembly is an atomic staff edit with one edit-ledger entry and one
undo step. It never modifies source seat identities or capacity.
A placement near source seats is rejected rather than deleting them.
These templates illustrate approximate geometry only, not safe egress,
accessibility compliance, clearances, structural loading or the school
venue's actual architectural as-built measurements.
