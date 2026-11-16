# FiledMaker precision studio

The workbench is a drawing-first venue editor. It uses a compact navigation
bar and an optional right-hand project inspector. Staff can begin with an
uploaded reference drawing, authentic row inventory, or one of six
**completely fictional practice venues**.

## Operating the editor

1. Open **Start with a ready-to-edit venue** to study a generated stadium or
   court, or import actual source records.
2. In the model step open **Bowl** to create a parameterized spectator layout.
   Adjust the number of sectors, tiers, rows, rake, seat pitch, row depth
   and clearance. A source-backed project cannot be silently replaced
   with a fictional seating layout.
3. Use **Rows** to change an individual modeled row and **Seats** for
   bounded seat corrections. Use **Court** for playing surface colors,
   position, dimensions and paint zones.
4. Use **Build** for single objects or composite assemblies. Objects can be
   selected, duplicated, aligned, mirrored and arranged in repeated arrays.
   The right-hand tool details remain collapsible when not needed.
5. In **2D**, Grid and Snap show metric spacing. Red inference guides
   align to neighboring component centers/edges, section control points,
   or the playing surface center. The label displays the actual X/Z
   position in metres. Use Shift for 10 cm positioning and Alt to bypass
   snapping. The snap toggle is independent of grid visibility.
6. In **3D**, click an object to select it. While **Edit objects in 3D**
   is enabled, drag it to move in the floor plane. Alt-drag to change
   elevation. Drag empty space to orbit the camera and scroll to zoom.
   Disable object editing if the user needs unrestricted orbit.
   The color-coded X/Y/Z overlay is a visual frame of reference. An
   invalid edit is rolled back by the same transactional seat-clearance
   checks used by the 2D editor.
7. Use **Review & export** to inspect geometry, generated seat coordinates,
   original evidence, unverified changes and available previews.

## Parametric scene generation

Six starters make distinct, entirely synthetic examples: short end-stand
gym, four-sided fieldhouse, two-tier arena, three-tier arena, open-end
football bowl and separated sideline grandstands.

Generated tiers contain separate section IDs and actual row records.
Each bank has curved front and rear contours, outer rows expand to
reflect the wider perimeter, and sufficiently wide rows reserve a
measurable center aisle. Upper tiers have different horizontal setbacks
and default elevation rises. Contour points remain editable.

This demonstrates a **modeling workflow**, not reconstruction of Ohio
State University's official facility. The 3D OSU reference viewer and
real-school import cases remain distinct; the editor does not represent
fictional labels or elevations as official measurements. Visual accuracy
requires school architectural plans, row numbers, and review of aisles,
accessible positions, seat spacing, sightlines and physical safety.

## Integrity and testing

- All stage edits are documented and undoable.
- A structure cannot silently displace an existing seat.
- A synthetic draft never gains official-capacity status or sources.
- The editor retains the existing 40,000-seat preview and 200-object
  limits.
- Automated tests cover synthetic bowls, curved sections, true seat IDs,
  snapping, source limits, and browser navigation.
- Chrome acceptance exercises the venue gallery, real WebGL2 rendering,
  model editing, snapping controls and scene export.

Run `npm run verify` and `npm run test:workbench-browser` locally to
reproduce the checks. The Windows launcher verifies branch and server
identity, but never overwrites local work.
