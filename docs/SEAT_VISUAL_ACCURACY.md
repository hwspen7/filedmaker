# Seat visual fidelity and publication gate

A recognizable playing field does not make a named arena an accurate virtual venue.

## Required evidence for a real school venue

1. Venue and event configuration, with dated capacity source.
2. Source-authorized section/row/seat inventory and numbering convention.
3. An aligned 2D chart or measured stadium seat coordinates, including aisle and tier bounds.
4. Per-tier seat types. Do not render all university football seating as folding chairs.
5. At least three photo landmarks to validate orientation and image-space alignment for each structural zone.
6. Approved human-view screenshots checked against a real photo from the same section and approximate row.
7. No claimed real-time availability without an authorized ticketing provider integration.

## State of the OSU example

The Ohio Stadium example uses official facts and schematic sector geometries. It is NOT a real ticket manifest, so its ~62k model positions are not an official capacity or a set of selectable real tickets. The official capacity must be displayed independently. Obtain a licensed/corroborated manifest before publishing selectable seats.

## How the present renderer draws seats

The shared `seatPresentation.mjs` selects the presentation palette and bench/chair style. Named university football references use simplified bleacher-style proxy geometries by default. Model seat coordinates remain unchanged, no seat gets added to match a capacity number, and local row tangents determine seat direction. A school-supplied primary seat color overrides the generic tier blue where supplied.

## Acceptance test criteria

- No automatic folding chair backrests for university football bowl references.
- Row-facing angles locally normal to the seating curve.
- Same style/colors in Studio and standalone export.
- No invented ticket seats or padded model counts.
- No seat-level accuracy certification without surveyed geometry, in-person photos and documented verification.
- Full WebGL and GLB output need real browser visual QA; unit tests are necessary but not sufficient.
