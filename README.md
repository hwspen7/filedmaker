# FiledMaker

A browser-based **parametric 3D stadium and arena modeling studio** for the United States and Canada. Create editable football stadiums, soccer stadiums and basketball arenas with repeatable geometry rather than placing every seat manually.

![CI](https://github.com/hwspen7/filedmaker/actions/workflows/quality.yml/badge.svg)

## What you can build

- **Football:** NFL-sized, CFL 2026-sized and CFL 2027-sized schematic playing surfaces.
- **Soccer:** 105 × 68 m football pitches with field lines and simplified goals.
- **Basketball:** NBA and NCAA court presets with hoops, markings and an indoor-style seating bowl.
- **Bowl editor:** adjust overall contour, seat pitch, aisle gaps and a schematic canopy.
- **Tier editor:** add or remove tiers (up to four), tune row counts, depth, rise, front offset, elevation and inter-tier gaps.
- **Section editor:** choose up to 36 radial sections, edit each one's angle interval and label, enable/disable its seating, change its color.
- **Live 3D:** orbit, zoom, plan view, per-seat view, ray-pick seats and click terrace sections.
- **Exports:** editable `.filedmaker.json`, per-seat coordinates `.csv`, full `.glb` geometry and `.png` viewport screenshots.
- **Project management:** automatic browser-local recovery, named local snapshots, undo/redo and JSON import.

The **capacity number is a model-generated seat estimate**, not the officially licensed capacity of a real venue. Field markings, bowl curvature, the roof and seat units are schematic until calibrated against engineering or survey data.

## Start on Windows (no Python or Node.js required)

1. Clone the repository as a **separate folder**, for example `E:\Personal_Project\filedmaker`.
2. Double-click `start-windows.bat`.
3. The site opens at **http://127.0.0.1:5174/**. Keep the terminal open during use.

```powershell
git clone https://github.com/hwspen7/filedmaker.git "E:\Personal_Project\filedmaker"
cd "E:\Personal_Project\filedmaker"
.\start-windows.bat
```

The application uses the Three.js ES modules served from jsDelivr CDN. **Internet access is required for first-time 3D rendering and for 3D rendering on subsequent runs unless the library is cached.** If Three.js is blocked, editable geometry and JSON/CSV export can still operate, but the 3D viewport/GLB export will be unavailable. A server is still needed because modern browsers block ES modules over `file://`.

The app uses port **5174**, so it does not collide with the existing Stadium View prototype on port 5173.

### Other environments

Node.js 20+ (no `npm install` necessary):

```sh
npm start
```

macOS / Linux: `./start-unix.sh` (uses Node.js or Python 3).

## Modeling workflow

1. Select **Football**, **Soccer** or **Arena** to start from a useful preset.
2. Open **Bowl** to edit the shape exponent, pitch, aisle gaps and roof.
3. Open **Tiers** to add levels and tune each level's seating slope and depth.
4. Open **Sections** to define angular sectors, toggle disabled sections, and assign visible colors.
5. Click a seat in the viewport or use **Previous / Next** in the inspector. Select **Seat view** to inspect the virtual spectator viewpoint.
6. Name your project and use **Save locally** for a browser snapshot, or **Export JSON** for a portable editable file.
7. Export `.glb` for a 3D pipeline or `.csv` with every seat's coordinates and IDs. Export GLB may take extra time for large stadiums.

### File formats

An editable JSON document follows this envelope:

```json
{
  "format": "filedmaker-project",
  "project": {
    "schemaVersion": 1,
    "title": "My Stadium",
    "country": "United States",
    "city": "Columbus",
    "surface": "nfl",
    "shape": 4.5,
    "seatPitch": 0.52,
    "aisleWidth": 1.55,
    "roof": false,
    "tiers": [],
    "sections": []
  }
}
```

`tiers` and `sections` must contain validated definitions. Export an existing project to get a complete example. Each seat CSV record includes a stable project-specific seat UID, tier, section, row, seat number, position in meters and orientation in radians. The model uses a **Y-up** coordinate system with its playing surface centered at the origin and long axis aligned to Z.

The GLB export is intended for interchange with other 3D tools. Some software may not support GPU instancing extensions and may need to expand or convert the instanced seats after importing.

## Architecture

```text
filedmaker/
├── index.html                     # HTML editor shell and import map
├── styles.css                     # Responsive studio theme
├── src/
│   ├── model.mjs                  # Pure parameter validation / geometry / seats
│   ├── scene.js                   # Three.js renderer, picking, 3D exports
│   └── app.js                     # Browser editor, local storage, import / export
├── scripts/server.mjs             # Optional dependency-free Node static server
├── tests/                         # Pure-geometry and HTTP smoke tests
├── serve-windows.ps1              # Windows native static server
├── start-windows.bat              # Windows launcher
└── .github/workflows/quality.yml  # Automated syntax, geometry & server tests
```

The geometry engine deliberately has **no 3D or browser dependencies**. It deterministically generates seats from a superelliptic perimeter, samples each seating row by arc length, creates section-relative seat IDs and derives successive tier offsets and elevations. The renderer uses GPU-instanced seats instead of thousands of independent mesh objects.

## Development and verification

No dependencies are needed for the included test suite:

```sh
npm run verify
```

This executes Node's syntax checks and the geometry/server test suites. GitHub Actions executes the same command on pushes and pull requests against `main`.

## Known boundaries

- This is an **editor for schematic parametric stadiums**, not a ready-made catalog of surveyed NFL/NBA/MLS venues.
- Detailed architectural façades, signage, accurately modeled roofs and verified obstructions need separately licensed reference data or manual modeling in a DCC/CAD tool.
- First-person seat views use the modeled eye point and aim at field center. They are illustrative, not validated real-world sightline predictions.
- Imported projects are schema validated but are not an authoritative source of physical measurements.
- Local snapshots are stored in browser `localStorage`; export JSON for backups.

## License

MIT. See [LICENSE](LICENSE).