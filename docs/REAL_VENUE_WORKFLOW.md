# Real venue calibration workflow

This guide describes the local **seat-data → 2D/3D view → obstruction report → photo alignment** pipeline. It does **not** assert that the repository contains surveyed Ohio Stadium seats or any official ticketing data.

## Reference venue: Ohio Stadium (Columbus, Ohio, USA)

Official references for **visual interpretation and manually licensed source work**:

- [Ohio State Maps, Seating Charts & Services](https://ohiostatebuckeyes.com/sports/2023/9/14/maps-seating-charts-services)
- [Ohio State Football Virtual Venue](https://ohiostatebuckeyes.com/sports/2018/6/4/seat-selection-process)
- [Ohio Stadium accessibility information](https://ohiostatebuckeyes.com/sports/2018/6/5/ada-information-ohio-stadium)

In FiledMaker, choose **Real data → Ohio Stadium reference** to populate a *reference project*. It links the official seating chart but **does not import official geometry**, and its modeled bowl remains synthetic. Don't ship or republish copyrighted seating maps, imagery or Virtual Venue assets without permission.

## 1. Acquire the right measurements

For true venue-specific seat views, collect the following from authorized documents or your own lawful measurements:

1. An identifiable seat ID, official section, row and seat label.
2. X and Z location relative to a documented stadium origin, plus Y elevation for that seat's floor or eye-reference datum.
3. At least three *independently measured* plan control points distributed across the venue, with correspondence to this project's field coordinate system. Two only solve the four registration parameters and **cannot validate residual error**.
4. Dimensions, placement and orientation of railings, columns, screen edges, suite barriers and parapets.
5. A reference photograph with a known seat position and at least three identifiable field landmarks (four or more recommended).
6. Provenance: provider, coordinate reference, measurement date, accuracy and rights to use the data.

The model coordinate frame is **X across field, Y up, Z along field**, in meters. The playing surface is centered at X=0, Z=0. The local reference photo is not uploaded or stored in project JSON.

## 2. Import seat positions

Use a UTF-8 `.csv` with a header:

```csv
seat_id,section,tier,row,seat,x,y,z
S13A-R01-01,13A,T1,1,1,-34.25,2.35,-8.10
S13A-R01-02,13A,T1,1,2,-34.25,2.35,-7.58
```

**The two lines above are illustrative syntax, not actual Ohio Stadium measurements.** `x/z` are either drawing coordinates or measured lateral/longitudinal distances. `y` is optional but required for meaningful eye height/photo calibration. Units are configured in the **Real data** tab. Accepted labels include numeric and alphanumeric strings. `seat_id` must be unique, up to 150,000 seats per import; 32 MB maximum CSV size.

A ready-made, explicitly fictional test file is [examples/fictional-survey-seats.csv](../examples/fictional-survey-seats.csv).

Steps:

1. Go to **Real data**, click **Import seat CSV**.
2. Choose **Plan X/Z units** (`m`, `ft` or unscaled drawing) and **Elevation units** independently.
3. Supply the exact dataset name and HTTPS source link (if public).
4. With *unscaled drawing units*, configure at least two control points before attempting to activate imported mode. For an existing imported-meters project, adding control points turns on fitted registration as soon as a second point is entered.
5. The generated seat set is replaced with imported rows and the schematic terraces are hidden. The 2D editor shows the imported points; **Focus seats** zooms to the imported cluster.
6. Search by imported `seat_id` or `section row seat`, click a dot in 2D or select a seat in 3D to enter Human view.

The tool does not fabricate missing elevations or infer a true seating bowl from the point cloud. Synthetic terraces are hidden for imported seats. The nominal playing field remains visible.

## 3. Fit registration and inspect errors

Add matched **Source X/Z** and **Target X/Z (m)** control points. The solver estimates a 2D scale, rotation and translation by least squares.

- With two landmarks: a mathematical solution but no independent residual validation.
- With three or more: the report includes in-sample RMS and maximum Euclidean residual (meters).
- The reported RMS is *not* a global venue-accuracy claim. It cannot detect systematic errors shared by all controls.
- Mirrored drawings, nonuniform scale distortion and false landmark matches are not corrected by this four-parameter similarity fit. Repair the drawing or use an appropriate external GIS/CAD transform.

Click **Export calibration QA report** for a JSON record of provenance, unit choices, control-point results, missing elevations, obstacle definitions and photo-fit diagnostics.

## 4. Model and test a physical barrier

Use **Real data → Add barrier near selected seat**, and edit its type, X/Y/Z center, dimensions and yaw. Geometries are authored oriented boxes, and included in GLB export.

The **Survey & visibility** inspector checks a mathematical sightline segment from the selected eye point to the current field target. It reports the nearest intersecting authored barrier. If no intersection is detected, the report says **no modeled barrier hit**, *not* "unobstructed view". This is not a full collision test against unknown arena geometry, other spectators or dynamics.

## 5. Match a photo to the viewer camera

1. Select a seat with known height and click **Calibrate photo** in the inspector.
2. Load a local PNG, JPEG or WebP photograph (12 MB maximum).
3. Choose a landmark from the dropdown, then click its corresponding pixel location. Repeat for at least three distinct landmarks. Corners and midfield markings spread around the image work best.
4. Click **Fit camera to photo**. Only the selected seat's *camera yaw, pitch and vertical field-of-view* are fitted. The image is not used to reposition the seat or build walls.
5. The tool reports RMS and worst-case reprojection error in **photo pixels**. Fits with RMS greater than `max(12 px, 2% of image height)` are rejected without altering the project or camera.
6. If accepted, the project stores the seat ID, image dimensions, normalized landmark pixel coordinates, fitted camera parameters and residuals. The **photo pixels themselves are not stored**, and a different photo must be loaded after a reload.

A low training residual does not prove accuracy. Check separate photographs and landmarks not used during fitting. Differences in camera crop, phone lens distortion, seat height, image orientation and spectator posture can all invalidate the comparison.

## 6. Save and exchange

- Export **.filedmaker.json** to preserve survey data and photo-fit metadata. Schema v4 opens older v1–v3 projects.
- Export **seat CSV** for active (generated *or* imported/calibrated) metric world positions.
- Export **GLB** to include imported seat meshes and manually modeled obstructions when Three.js loads. It does not automatically include a complete surveyed stadium structure.
- The browser's `localStorage` is quota-limited; for stadium-scale CSV data, **download a project JSON backup**. A full production catalog needs a persistent database or chunked asset loading.

## Known limitations / next engineering stages

This is an operational local calibration pipeline, not an automatically validated Ohio Stadium replica or ticket inventory system. No licensed survey-grade Ohio Stadium seat coordinates, structural CAD, CCTV data, or official audience photos are bundled. The camera model is a pinhole approximation with no lens-distortion correction, pose optimization or stereo vision. A complete digital twin needs trustworthy geometry, independent photograph validation, source licensing, accessibility metadata and data-version management.
