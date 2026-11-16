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
