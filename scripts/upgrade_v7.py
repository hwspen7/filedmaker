from pathlib import Path
root=Path('/mnt/data/filedmaker')

def replace(path,a,b):
 p=root/path;s=p.read_text();assert a in s,(path,a[:80]);p.write_text(s.replace(a,b,1))
replace('src/model.mjs',"import { createSurvey, validateSurvey, importedSeats } from './survey.mjs';", "import { createSurvey, validateSurvey, importedSeats } from './survey.mjs';\nimport { getNBAArena } from './nbaCatalog.mjs';")
replace('src/model.mjs',"""    if (project.venueReference?.id !== 'ohio-stadium') throw new Error('Unknown venue reference.');
    project.venueReference = {
      id:'ohio-stadium', dataLevel:'documented-architecture/estimated-seating',
      seatNumbering:'synthetic',
      measurementNotice:'Architectural reference only. Exact section boundaries, seat locations and risers require survey.'
    };""","""    const referenceId = String(project.venueReference?.id || '');
    if (referenceId === 'ohio-stadium') {
      project.venueReference = {
        id:'ohio-stadium', dataLevel:'documented-architecture/estimated-seating',
        seatNumbering:'synthetic',
        measurementNotice:'Architectural reference only. Exact section boundaries, seat locations and risers require survey.'
      };
    } else if (referenceId.startsWith('nba:') && project.surface === 'nba' && getNBAArena(referenceId.slice(4))) {
      const arena = getNBAArena(referenceId.slice(4));
      project.venueReference = {
        id:referenceId,
        dataLevel: arena.modelStatus === 'identity-only' ? 'official-venue-identity-only' : 'official-identified-features/estimated-seating',
        seatNumbering:'synthetic',
        measurementNotice:'Arena identity and cited public features are documented. Bowl layout, row counts and seat coordinates are inferred and have not been verified.'
      };
    } else throw new Error('Unknown venue reference.');""")
# extend view posture with lean and clearance
p=root/'src/view.mjs';s=p.read_text();s=s.replace("export const POSTURE_HEIGHT = Object.freeze({ seated: 1.17, standing: 1.60 });", "export const POSTURE_HEIGHT = Object.freeze({ seated: 1.17, standing: 1.60, leaning: 1.23 });")
s=s.replace("export function eyePosition(seat, posture = 'seated') {\n  const eye = POSTURE_HEIGHT[posture] || POSTURE_HEIGHT.seated;\n  return { x: seat.x, y: seat.y + eye, z: seat.z };\n}", """// Seat coordinates are row/seat references, NOT eye anchors. The spectator's
// eyes are slightly forward of the chair centre, away from the backrest.
// A viewer-only local clearance also prevents intersecting their own seat mesh.
export function eyePosition(seat, posture = 'seated') {
  const eye = POSTURE_HEIGHT[posture] || POSTURE_HEIGHT.seated;
  const forward = posture === 'leaning' ? 0.38 : posture === 'standing' ? .20 : .23;
  const yaw = Number.isFinite(seat.yaw) ? seat.yaw : Math.atan2(-seat.x,-seat.z);
  return {
    x: seat.x + Math.sin(yaw)*forward,
    y: seat.y + eye,
    z: seat.z + Math.cos(yaw)*forward,
  };
}
export function spectatorSeatClearance(seat, eye, width=.48) {
  // Pure geometry sanity check for the chair's own volume in local coordinates.
  const yaw=Number.isFinite(seat.yaw)?seat.yaw:Math.atan2(-seat.x,-seat.z);
  const dx=eye.x-seat.x,dz=eye.z-seat.z;
  const forward=dx*Math.sin(yaw)+dz*Math.cos(yaw);
  const lateral=dx*Math.cos(yaw)-dz*Math.sin(yaw);
  const height=eye.y-seat.y;
  return {forward,lateral,height,insideBackrest:Math.abs(lateral)<width/2 && forward<-.10 && height<1.05};
}""")
s=s.replace("if (!['center', 'near', 'far', 'left', 'right'].includes(o.target))", "if (!['center', 'near', 'far', 'left', 'right', 'near-rim','far-rim','scoreboard'].includes(o.target))")
s=s.replace("  switch(target) {", "  switch(target) {\n    case 'near-rim': return { x:0, y:3.05, z: surface.length/2-1.6 };\n    case 'far-rim': return { x:0, y:3.05, z:-surface.length/2+1.6 };\n    case 'scoreboard': return { x:0, y:15.5, z:0 };")
p.write_text(s)
# take selected chair out in human view, re-add in overview. Does not alter exported 3D scene permanently.
p=root/'src/scene.js';s=p.read_text();s=s.replace("    this.marker = null;\n  }\n\n  load(model", "    this.marker = null;\n    this.hiddenSeatIndex = -1;\n  }\n\n  load(model",1)
# seat geometry local transform repeat, use seat picking and changing own chair only
pos=s.index('  applyEyeView() {');s=s[:pos]+"""  hideCurrentSeatForViewer(shouldHide) {
    if (!this.model || !this.seatMeshes?.length) return;
    const previous = this.hiddenSeatIndex ?? -1;
    const current = shouldHide && this.selectedSeat ? this.model.seats.findIndex(s=>s.uid===this.selectedSeat.uid) : -1;
    if (current === previous) return;
    const zero = new THREE.Matrix4().makeScale(0,0,0);
    const restore = new THREE.Matrix4();
    // This only affects rendering the currently occupied chair. Other rows are
    // kept visible to preserve realistic foreground occlusion.
    for (let component=0;component<this.seatMeshes.length;component++) {
      const mesh=this.seatMeshes[component];
      if (!mesh || !mesh.count) continue;
      if (previous >= 0) {
        // Restore from the authoritative matrix cached at seat-mesh creation.
        const saved=mesh.userData.originalMatrices?.[previous];
        if (saved) mesh.setMatrixAt(previous,restore.fromArray(saved));
      }
      if (current >= 0) mesh.setMatrixAt(current,zero);
      mesh.instanceMatrix.needsUpdate=true;
    }
    this.hiddenSeatIndex=current;
  }

"""+s[pos:]
s=s.replace("    this.controls.enabled=false;\n    this.camera.up.set(0,1,0);", "    this.controls.enabled=false;\n    this.hideCurrentSeatForViewer(true);\n    this.camera.near=.045;\n    this.camera.up.set(0,1,0);")
s=s.replace("    this.mode = mode;\n    const { surface, tiers } = this.model;", "    this.mode = mode;\n    if(mode!=='seat') { this.hideCurrentSeatForViewer(false);this.camera.near=.08; }\n    const { surface, tiers } = this.model;")
# save matrices only for occupied seat? all could be ~40k*7*16 = 4.5mb, okay but not needed repeat with matrix creation; simple Float32Array per mesh, modest. store 7 * count arrays as float32
s=s.replace("    mesh.instanceMatrix.needsUpdate=true;\n    if(mesh.instanceColor)", "    mesh.userData.originalMatrices = Array.from({length:seats.length},(_,idx)=>Array.from(mesh.instanceMatrix.array.slice(idx*16,idx*16+16)));\n    mesh.instanceMatrix.needsUpdate=true;\n    if(mesh.instanceColor)")
# performance better use typed whole Float32 buffer instead arrays: change next
s=s.replace("mesh.userData.originalMatrices = Array.from({length:seats.length},(_,idx)=>Array.from(mesh.instanceMatrix.array.slice(idx*16,idx*16+16)));", "mesh.userData.originalMatrices = mesh.instanceMatrix.array.slice();")
s=s.replace("const saved=mesh.userData.originalMatrices?.[previous];\n        if (saved) mesh.setMatrixAt(previous,restore.fromArray(saved));", "const saved=mesh.userData.originalMatrices;\n        if (saved) mesh.setMatrixAt(previous,restore.fromArray(saved,previous*16));")
# set hidden seat index reset on load
s=s.replace("    this.seatMeshes = createSeatMesh(seats, project);", "    this.seatMeshes = createSeatMesh(seats, project);\n    this.hiddenSeatIndex=-1;")
# GLB export must show all seats, then rehide after exporting
s=s.replace("    const exporter = new GLTFExporter();", "    const exporter = new GLTFExporter();\n    const wasHumanView = this.mode === 'seat';\n    this.hideCurrentSeatForViewer(false);")
s=s.replace("    const restore = () => hidden.forEach(object => { object.visible = true; });", "    const restore = () => {hidden.forEach(object => { object.visible = true; });if(wasHumanView) this.hideCurrentSeatForViewer(true);};")
p.write_text(s)
# UI
p=root/'src/app.js';s=p.read_text();s=s.replace("import { stadiumProvenance } from './stadiumDetails.mjs';", "import { stadiumProvenance } from './stadiumDetails.mjs';\nimport { NBA_CATALOG, createNBAArenaProject, nbaArenaReport } from './nbaArenas.mjs';")
s=s.replace("    html += `<div class=\"subheading\">REAL STADIUM REFERENCE</div>", """    html += `<div class="subheading">NBA ARENA RECONSTRUCTION <span class="pill">2026–27 · 30 TEAMS</span></div>`;
    const currentNBA = String(project.venueReference?.id || '').replace(/^nba:/,'');
    html += `<div class="field"><label for="nbaArenaSelect">Select official NBA home arena</label><select id="nbaArenaSelect"><option value="">Select a real arena…</option>${NBA_CATALOG.map(item=>`<option value="${item.id}" ${currentNBA===item.id?'selected':''}>${safe(item.arena)} — ${safe(item.team)}</option>`).join('')}</select></div>`;
    html += `<button data-build-nba-arena class="full-outline strong-button">Load arena reference →</button>`;
    if(currentNBA && NBA_CATALOG.some(item=>item.id===currentNBA)) {
      const report=nbaArenaReport(currentNBA);
      html += `<div class="venue-facts"><strong>${safe(report.name)}</strong><span>${safe(report.team)} · ${safe(report.modelStatus)}</span><span>Exact bowl and seats: not surveyed · project seats synthetic</span>${report.claims.map(claim=>`<span>• ${safe(claim)}</span>`).join('')}${report.sources.map(source=>`<a href="${safe(source.url)}" target="_blank" rel="noopener noreferrer">Reference: ${safe(source.claim)} ↗</a>`).join('')}</div>`;
    }
    html += `<p class="hint">Five priority arenas include sourced architectural features. The remaining 25 are identity-only previews. Every generated seat remains illustrative until a verified plan/survey is imported.</p>`;
    html += `<div class="subheading">REAL STADIUM REFERENCE</div>""")
s=s.replace("  if(target.hasAttribute('data-build-ohio-stadium')){", """  if(target.hasAttribute('data-build-nba-arena')){
    const id=byId('nbaArenaSelect')?.value;
    if(!id){toast('Choose an NBA arena first.',true);return;}
    const arena=NBA_CATALOG.find(item=>item.id===id);
    if(confirm(`Load ${arena.arena} reference? Current unsaved edits will be replaced. Geometry is illustrative, not surveyed.`)){
      activeTab='bowl';replaceProject(createNBAArenaProject(id));
      toast(`${arena.arena} loaded · only verified venue facts are treated as real.`);
    }
  }
  else if(target.hasAttribute('data-build-ohio-stadium')){""")
s=s.replace("  byId('viewTarget').value=viewOptions.target;", "  byId('viewTarget').value=viewOptions.target;")
s=s.replace("  if (seat && model) {\n    const p=viewpoint", "  if (seat && model) {\n    const p=viewpoint",1)
p.write_text(s)
p=root/'index.html';s=p.read_text();s=s.replace('<option value="right">Right touchline</option>', '<option value="right">Right touchline</option><option value="near-rim">Near basket (NBA)</option><option value="far-rim">Far basket (NBA)</option><option value="scoreboard">Center scoreboard (NBA)</option>')
s=s.replace('<button data-posture="standing">Standing · 1.60 m</button>', '<button data-posture="standing">Standing · 1.60 m</button><button data-posture="leaning">Lean forward · 1.23 m</button>')
s=s.replace('<small>Verified stadium facts · estimated row geometry</small>', '<small>NBA arenas available under Bowl → NBA Arena Reconstruction · estimated geometry clearly identified</small>')
p.write_text(s)
p=root/'package.json';s=p.read_text().replace('"version": "6.1.0"','"version": "7.0.0"').replace('node --check src/detailKit.mjs','node --check src/nbaCatalog.mjs && node --check src/nbaArenas.mjs && node --check src/detailKit.mjs');p.write_text(s)
