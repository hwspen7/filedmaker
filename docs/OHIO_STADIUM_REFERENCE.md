# Ohio Stadium — architectural reference model

**Model classification:** Reference reconstruction, **NOT a surveyed seat-by-seat digital twin**.

This is the first named real sports venue in FiledMaker. It is grounded in public architectural facts and Ohio State's own stadium descriptions and seating maps. A named real venue does **not** make every point in its generated geometry a measured coordinate.

## Documented physical and historical facts

| Feature | Ohio State published value / description | Status |
|---|---|---|
| Location | Columbus, Ohio, United States | Official |
| Historic structure | 1922, distinct horseshoe configuration | Official |
| 1999–2001 renovation | Lowered playing field, new seating and permanent south-end stands | University Archives |
| Outer venue length | 919 ft = 280.1112 m | Official facts |
| Outer venue width | 679 ft = 206.9592 m | Official facts |
| Stadium height | 136 ft = 41.4528 m | Official facts |
| Press-box roof height | 183 ft = 55.7784 m above field | Official facts |
| Published capacity | 102,041 | Official stadium fact-page figure, date-dependent |
| 2012 main video board | 125 ft × 42 ft = 38.1 m × 12.8016 m | Official facts |
| Seating / premium functions | AA, A, B, C, D decks, west press/suite/club areas | Ohio State services map / seating chart |
| Field visual design | Scarlet end zones, block-O midfield, Ohio State and Buckeyes names, gray outer strokes | Official 2022 field design notice |

**Sources**

- [Ohio State Athletics — Ohio Stadium facts](https://ohiostatebuckeyes.com/sports/2023/6/2/ohio-stadium)
- [Ohio State Athletics — Stadium seating maps](https://ohiostatebuckeyes.com/sports/2022/8/17/maps)
- [Ohio State University Libraries — Renovations](https://library.osu.edu/a-walk-in-our-shoe/renovations)
- [Ohio State Athletics — FieldTurf design announcement](https://ohiostatebuckeyes.com/news/2022/2/7/new-ohio-stadium-field-turf-design-announced)
- [Ohio State University Historic Buildings records](https://library.osu.edu/documents/university-archives/subject_files/Buildings-%20OSU%20Historic.pdf)
- [Structural/precast renovation case study](https://www.pci.org/PCI_Docs/Publications/PCI%20Journal/2003/Jan-Feb/Architectural%20and%20Structural%20Precast%20Prestressed%20Concrete%20Renovates%20Landmark%20Ohio%20Stadium.pdf)

## Reconstructed geometry in FiledMaker v6

- **Footprint:** an editable 48-handle curved and straight-sided approximate bowl profile; its control points are *not* an architectural floor plan.
- **South end:** a separate lower-tier arrangement, with the uppermost horseshoe tier omitted at the south end, reflecting the distinction between the historic horseshoe and permanent South Stands.
- **Bowl verticality:** four editable tier interpretations labeled AA, A, B/club, and C. Deck names are supported by official maps, but their numbers of rows, front offsets, tread depths, heights and individual section boundaries are estimates.
- **Exterior:** repeated concrete arcade bays, simplified north rotunda arches and south terminal towers; the pattern, sizes and positions of individual bays are visual interpretations.
- **West press/suites:** stacked glazed premium structures with a roof height referenced to the published official dimension. Floor heights and glazing modules are illustrative.
- **Southern display:** a video board frame with official published *screen* dimensions, but its absolute position and mounting structure are approximate.
- **Sports interior:** scarlet end zones, simple synthetic text field markings, numbered yard lines, hashmarks, pylons, sideline benches, equipment and goalposts. No official crest or licensed broadcast art is embedded.
- **Seating:** approximately 60,000 **procedurally generated** reference positions. This number is model output, **NOT** Ohio Stadium's actual capacity, seat numbering, official sections or a survey.

## What has not been validated

- Individual ticketed section boundaries and true section numbers in 3D.
- Seat-center positions, bleacher dimensions, row rise, stairway geometry, or ADA seat positions.
- Exact location and height of railings, entrances, suites, video board supports, walls and roof structures.
- Observer eye height relative to each individual seat's measured coordinate.
- LIDAR/photogrammetry, aerial orthorectification or on-site view matching.

Because the current spatial features are interpretive, the line-of-sight analyzer must not be used to claim real ticket-view quality. Import independently surveyed seat coordinates and obstructions, then calibrate against photographs and an authoritative floor plan, before publishing seat-level visibility.

## Validation roadmap

1. Obtain licensed architectural CAD/BIM plans or a georeferenced floor plan with usage rights.
2. Register the plan against known control points around the field and north rotunda.
3. Digitize **actual** separate AA/A/B/C/D/club/press box footprints and tie tier-specific heights to verified elevations.
4. Import authoritative seat centers, row labels, section IDs and staircase/portal polygons.
5. Align an independently captured photo set using FiledMaker's landmark camera fitter. Record pixel RMS error and source for each comparison.
6. Manually survey critical barriers and sightline occluders, including rail top elevations.
7. Publish only validated seats and version the reference by season, event configuration and source license.

## Model data

`examples/ohio-stadium-reference.json` is an editable project. It is distinct from `examples/fictional-survey-seats.csv`, which remains an intentionally fictional test fixture and is never applied to this real venue template.
