# FiledMaker NBA Real Arena Pipeline (2026–27)

## What is now available

The **30 current NBA home venues** are included as an identity directory, with their current name, home team and location. The five initial source-backed arena profiles are:

- New York Knicks — Madison Square Garden: official map distinguishes 100s, 200s, 300s/Hyundai Bridge and 400s.
- Golden State Warriors — Chase Center: official interactive seating reference, 100- and 200-level seating and clubs.
- Los Angeles Lakers — Crypto.com Arena: distinct public 100/200/300 seating and suite levels A/B/C.
- Chicago Bulls — United Center: 100/200/300 bowl distinctions.
- Los Angeles Clippers — Intuit Dome: official 51-row Wall, double-sided Halo Board and terrace level.

All generated rows, tier heights, section curves, seats, tunnels, railings and feature locations remain **illustrative and non-surveyed**. They are not official seat layouts. The 25 other NBA venues currently have a catalog entry and a **clearly labeled generic 3D preview**, not a validated arena reconstruction.

## Provenance standard

A reference pack distinguishes:

| Level | Data | Meaning |
| --- | --- | --- |
| Documented | Venue identity and officially described physical features | Confirmed by venue or league public source |
| Reconstructed | Drawings / seat section polygons, properly calibrated | Derived from reviewed source dimensions; not independently surveyed |
| Estimated | Generated bowl radii, seat rows, aisle widths, elevations, device positions | Adjustable geometry for previews; cannot be advertised as actual seats |
| Surveyed | Seat coordinates, heights and obstacles supported by approved survey or as-built data | Needed for measured seat-level sightlines |

The app never silently promotes an estimated seat to a surveyed seat. The existing **Real data** CSV and landmark registration pipeline is where verified coordinates can be imported. Building a named arena preview does **not** import verified seats.

## Arena acceptance protocol

1. Record operator/league identity and official seating map URL. Record its date and game configuration.
2. Calibrate plan coordinates against an independently sourced physical dimension (the NBA court is 94 ft × 50 ft).
3. Trace the **actual** section geometry, numbered entrances and distinct decks; avoid substituting evenly spaced fictitious sections.
4. Locate measured stair landings, portals, rails, suite fronts, upper decks, center display and arena walls.
5. Import seat-row identifiers and three-dimensional centers only from approved source data.
6. Compare at least three positions per deck with photos at known locations. Record image FOV, camera posture and reprojection residual.
7. Publish only after acceptance, differentiating official capacity from modeled seat count and avoiding a claim of certified unobstructed views.

## Verified public references

- League venue directory (updated 2026-10-28): https://www.nba.com/news/all-30-nba-arenas-by-team
- NBA playing court rules: https://official.nba.com/rule-no-1-court-dimensions-equipment/
- MSG official seating tiers: https://www.msg.com/madison-square-garden/seating/msg-knicks
- Chase Center via Warriors: https://www.nba.com/warriors/tickets/season
- Crypto.com Arena concourses: https://www.cryptoarena.com/arena-information/a-z-guide
- Crypto.com Arena vital stats: https://www.cryptoarena.com/arena-info/vital-stats
- Intuit Dome press features: https://intuitdome.com/press
- Intuit Dome seat maps: https://www.intuitdome.com/events/seating-charts
- United Center official home: https://www.unitedcenter.com/
- Philadelphia naming by operator: https://comcastspectacor.com/news/2025/05/xfinity-mobile-arena-new-name/

## Licensing and compliance

Official seating maps and photographs are references; do not copy operators' map assets, 3D models, logos, player artwork, or ticketing data without permission. Use original procedural geometry and clearly disclose its estimated status. CSVs with real ticket seat identifiers must have rights and an explicit source.

## Human-eye viewer note

Seat center is not eye center. An eye origin is offset forward of the backrest with standing and leaning options, and the currently occupied chair is suppressed **only in the viewer**; it is restored in other views and during GLB export. This eliminates an important source of self-occlusion but is **not** a guarantee against barriers or surrounding spectators. Those require real seat-to-rail geometry and validation.
