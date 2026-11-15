# Programmatic arena exteriors

This is an **estimated architectural model**, not a scan, official building information model (BIM), or certified replica. Outer walls do not determine the coordinates of ticket inventory.

## What this branch changed

The Schottenstein Center's old repeated gray facade bands and uniformly spaced rotunda cylinders are replaced by a venue profile rendered with the **shared** `ExteriorEngine` (`src/next/engines/exterior.mjs`).

The public interface is:

```js
import { ExteriorEngine } from './src/next/engines/exterior.mjs';

const meshes=ExteriorEngine.build({
  footprint:angle=>({
    x:45*Math.cos(angle),
    z:56*Math.sin(angle)
  }),
  height:35,
  segments:128,
  profile:'metal-and-brick',
  entrances:[
    {angle:Math.PI/4,role:'primary'},
    {angle:5*Math.PI/4,role:'secondary'}
  ]
});
```

It emits standalone indexed-by-name triangle streams (world coordinates in metres, unit normals) for horizontal metal cladding, visible metal panel joints, brick entrance plinth and piers, recessed ground-floor windows, circular brick rotundas, punched tower glazing, masonry returns, structural lantern crowns and ribs, recessed glazed entry lobbies, mullions, projecting canopies, and entrance doors. Each structural element has real 3D geometry. No exterior architectural surface can insert or remove a seating position.

The existing `ArchitectureEngine` accepts the optional JSON property `exterior`, containing a `profile` and `entrances`. Three profile choices are implemented: `metal-and-brick`, `modern-glass`, and `masonry`. They generate different openings and cladding, not three aliases for the same facade. No exterior profile means existing generic venues keep their original geometry. The Schottenstein model provides its own documented config to the **same** `ExteriorEngine`.

## Visual references

- Schottenstein Center official [arena information photograph](https://www.schottensteincenter.com/arena-info) — brick cylindrical entrance tower, tall glazing, light metal exterior and canopy.
- [Columbus Sports Commission exterior view](https://www.columbussports.org/listing/schottenstein-center/415842/) — raised circular lantern and prominent brick entrance.
- [OSU Wexner exterior photograph](https://wexnermedical.osu.edu/our-stories/transforming-the-schottenstein-center) — brick-and-glass tower and metal-clad upper levels.
- [Aerial photograph of the Schottenstein Center](https://adventuresingreenbuildings.com/2019/11/25/ohio-state-university-schottenstein-center-north-addition-earns-leed-silver/) — overall arena volume, roof shape, multiple brick rotundas and adjacent low-rise additions.
- [Ohio State building guidelines](https://fod.osu.edu/sites/default/files/buildings-landscape.pdf) — brick and limestone language across campus.

Only visible architectural features guide the approximation. The four rotunda placements, widths, entry-door configurations, exact heights and panel pitch are **illustrative parameters**, not verified as-built dimensions.

## Model / visualization responsibilities

- `GeometryEngine`: controls the normalized outer perimeter for an arbitrary arena.
- `ArchitectureEngine`: combines the seating terraces, circulation geometry and optional external facade streams.
- `ExteriorEngine`: makes architectural materials, entrance towers, canopies, frames and perforated glazing surfaces from the perimeter and profile.
- `NativeVenueRenderer`: selects material treatments for independent mesh layers. **3D Overview now combines the full exterior, perimeter canopy, entrance rotundas, court and all seats in one view.** The separate Building tab is removed, and the central opaque roof is not generated. Section and seat views retain their focused viewing policies.
- `ValidationEngine`: audits every 3D triangle, normals and all generated seat IDs.

This deliberately does **not** fabricate a stadium exit inventory. No EXIT labels or numbered portals are generated. The user's 19,049-seat Schottenstein men’s basketball baseline remains unchanged. The official capacity should not be used as proof of exact seat coordinates.

## How to reuse

Edit `examples/procedural-arena.json`:

```json
"exterior": {
  "profile": "metal-and-brick",
  "entrances": [
    { "angle": 0.7853981633974483, "role": "primary" },
    { "angle": 3.9269908169872414, "role": "secondary" }
  ]
}
```

Angles are **radians** around the arena's modeled centre. The first profile is currently a demonstrative approximation, not a site-orientation calculator.

Generate and open a standalone view:

```bash
npm run generate:venue -- --input examples/procedural-arena.json --out build/arena --html
npm run verify
```

Review the `Schottenstein visual smoke` Action's browser-generated `osu-building.png` and `arena-building.png` screenshots. Those are actual WebGL2 frames, not AI-generated images.

## Known remaining limits

This branch is **not photogrammetry** and does not import survey meshes, BIM data or official construction drawings. The lighting, brick bond, window elevations, roof construction and landscaping remain approximations. A high-fidelity digital twin will require licensed architectural data and individual element-level calibration. Changes to one arena's profile must not change shared seat-placement algorithms.
