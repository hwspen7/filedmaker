import { CURRENT_SCHEMA, SURFACES, TAU, createProject, makeSections, validateProject, generateSeats, sectionStats, deepCopy, createCustomOutline, modelPerimeterPoint, outlineAngle, validateOutline, resolveTiers, resolveSectionTier } from './model.mjs';
import { parseSvgPlan, planPoint, tracePlanOutline } from './plan.mjs';
import { VIEW_DEFAULTS, validateViewOptions, viewpoint, sightlineNote, nearbySeat, seatDescriptor } from './view.mjs';
import { parseSeatCSV, fitPlanRegistration, seatRegistration, obstructionReport, demoSurveyRows } from './survey.mjs';
import { fieldLandmarks, fitPhotoView } from './photo.mjs';
import { createOhioStadiumProject, OHIO_STADIUM, isOhioReference } from './venues.mjs';

const byId = id => document.getElementById(id);
const $all = selector => [...document.querySelectorAll(selector)];
const KEY_CURRENT = 'filedmaker.current.v1';
const KEY_LIBRARY = 'filedmaker.library.v1';
const num = value => Number(value).toLocaleString('en-US');
const safe = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const getStored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const putStored = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
let project;
try { project = validateProject(getStored(KEY_CURRENT, createOhioStadiumProject())); }
catch { project = createOhioStadiumProject(); }
let activeTab = 'bowl';
let activeSectionId = project.sections[0].id;
let outlineHandleIndex = 0;
let referenceUrl = '';
let referenceOpacity = 0.35;
let selectedPlanPath = 0;
let focusImported2D = false;
let rendererFailed = false;
let model = null;
let stadium = null;
let renderVersion = 0;
let history = [], future = [];
let toastTimer;
let view = 'orbit';
let viewOptions = validateViewOptions(getStored('filedmaker.view.v1', VIEW_DEFAULTS));
let comparison = [];
let localPhotos = [];
let calibrationPhoto = null;
let calibrationPoints = [];
let lastPhotoFit = null;
let bookmarks = getStored('filedmaker.bookmarks.v1', []);
if (!Array.isArray(bookmarks)) bookmarks = [];

const toast = (message, error = false) => {
  const element = byId('toast');
  element.textContent = message;
  element.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = 'toast'; }, 3500);
};

const field = (label, content) => `<div class="field"><label>${safe(label)}</label>${content}</div>`;
const fieldText = (label, key, value, type = 'text', rest = '') => field(label, `<input data-project="${key}" type="${type}" value="${safe(value)}" ${rest} />`);
const optionList = (selected, arr) => arr.map(([key, value]) => `<option value="${key}"${key === selected ? ' selected' : ''}>${safe(value)}</option>`).join('');
const fieldSelect = (label, key, value, options) => field(label, `<select data-project="${key}">${optionList(value, options)}</select>`);
const tierNumber = (tierIndex, prop, label, value, min, max, step) => field(label, `<input type="number" data-tier="${tierIndex}" data-prop="${prop}" min="${min}" max="${max}" step="${step}" value="${value}" />`);
const sectionInput = (prop, type, value) => `<input type="${type}" data-section-prop="${prop}" ${type === 'checkbox' ? (value ? 'checked' : '') : `value="${safe(value)}"`} />`;

function renderTab() {
  let html = '';
  if (activeTab === 'bowl') {
    html = fieldSelect('Playing surface', 'surface', project.surface, Object.entries(SURFACES).map(([key, v]) => [key, v.label]));
    html += `<div class="two-fields">${fieldText('Bowl squareness', 'shape', project.shape, 'number', 'min="2" max="8" step="0.1"')}${fieldText('Seat pitch (m)', 'seatPitch', project.seatPitch, 'number', 'min="0.4" max="1.1" step="0.01"')}</div>`;
    html += fieldText('Aisle gap at each section boundary (m)', 'aisleWidth', project.aisleWidth, 'number', 'min="0" max="5" step="0.1"');
    html += `<div class="subheading">ARCHITECTURAL DETAIL <span class="pill">SPORTS VENUES</span></div>`;
    html += fieldSelect('Scene detail','detailLevel',project.detailLevel,[['draft','Draft · light editing'],['standard','Standard · architecture'],['high','High · terraces and fixtures']]);
    html += `<label class="toggle-row"><input data-project="showExterior" type="checkbox" ${project.showExterior?'checked':''} /> Facades, stadium structures and concourses</label>`;
    html += `<label class="toggle-row"><input data-project="showFixtures" type="checkbox" ${project.showFixtures?'checked':''} /> Sports equipment and field fixtures</label>`;
    html += `<label class="toggle-row"><input data-project="roof" type="checkbox" ${project.roof?'checked':''} /> Show schematic roof canopy</label>`;
    html += `<div class="subheading">REAL STADIUM REFERENCE</div><button class="full-outline" data-build-ohio-stadium>Build Ohio Stadium reference <span>↗</span></button>`;
    html += `<p class="hint">Uses verified Ohio State stadium facts and an approximated horseshoe, South Stands and west press-box structure. Exact seats and aisle positions are NOT surveyed.</p>`;
    if(isOhioReference(project))html += `<div class="venue-facts"><strong>Ohio Stadium · Columbus</strong><span>Official outer dimensions ${OHIO_STADIUM.lengthM.toFixed(1)} × ${OHIO_STADIUM.widthM.toFixed(1)} m</span><span>Official capacity ${num(OHIO_STADIUM.publishedCapacity)} · generated seats are NOT official</span><span>Separate South Stands · western press-box · north rotunda</span><a href="${OHIO_STADIUM.sources[0]}" target="_blank" rel="noopener noreferrer">Ohio State stadium facts ↗</a></div>`;
    html += `<p class="hint">Bowl squareness controls the superellipse contour. Adjust seat pitch and aisle gaps to recalculate every seat in all tiers.</p>`;
    html += `<div class="subheading">MODEL SYSTEM <span class="pill">METRIC COORDINATES</span></div><p class="hint">All seat positions use meters. The pitch is centered on (0, 0, 0), with its long axis along Z.</p>`;
  } else if (activeTab === 'tiers') {
    html = `<p class="hint">Tiers build outward from the field. Each tier's gap and height gap determine the following tier's start position.</p>`;
    project.tiers.forEach((tier, index) => {
      html += `<div class="tier-card"><div class="tier-header"><strong>${safe(tier.label)}</strong><button data-remove-tier="${index}" ${project.tiers.length === 1 ? 'disabled' : ''}>Remove</button></div>`;
      html += field(`Tier name`, `<input type="text" data-tier="${index}" data-prop="label" value="${safe(tier.label)}" />`);
      html += `<div class="two-fields">${tierNumber(index, 'rows', 'Rows', tier.rows, 1, 75, 1)}${tierNumber(index, 'depth', 'Row depth (m)', tier.depth, 0.65, 1.8, 0.01)}</div>`;
      html += `<div class="two-fields">${tierNumber(index, 'rise', 'Row rise (m)', tier.rise, 0.12, 0.75, 0.01)}${tierNumber(index, 'gap', 'Gap after (m)', tier.gap, 0, 30, 0.1)}</div>`;
      html += `<div class="two-fields">${tierNumber(index, 'heightGap', 'Height gap (m)', tier.heightGap, 0, 15, 0.1)}${index === 0 ? tierNumber(index, 'offset', 'Front offset (m)', tier.offset, 1, 60, 0.1) : '<div></div>'}</div>`;
      if (index === 0) html += tierNumber(index, 'height', 'First-row height (m)', tier.height, 0.4, 30, 0.1);
      html += `</div>`;
    });
    html += `<button data-add-tier class="full-outline" ${project.tiers.length === 4 ? 'disabled' : ''}>＋ Add another tier <span>MAX 4</span></button>`;
  } else if (activeTab === 'sections') {
    const section = project.sections.find(item => item.id === activeSectionId) || project.sections[0];
    html = field('Number of radial sections', `<input type="number" id="sectionCountInput" min="4" max="36" step="1" value="${project.sections.length}" />`);
    html += `<div class="section-list">` + project.sections.map(item => `<button class="section-item ${item.id === section.id ? 'active' : ''} ${item.enabled ? '' : 'off'}" data-pick-section="${safe(item.id)}"><span class="section-swatch" style="background:${item.color}"></span><span>${safe(item.label)}</span><em>${item.enabled ? 'ON' : 'OFF'}</em></button>`).join('') + `</div>`;
    html += `<div class="section-card"><div class="section-header"><strong>Edit ${safe(section.id)}</strong><span class="pill">${section.start.toFixed(0)}°–${section.end.toFixed(0)}°</span></div>`;
    html += field('Section label', sectionInput('label', 'text', section.label));
    html += field('Seat color', sectionInput('color', 'color', section.color));
    html += `<div class="two-fields">${field('Start angle (°)', sectionInput('start', 'number', section.start))}${field('End angle (°)', sectionInput('end', 'number', section.end))}</div>`;
    html += `<label class="toggle-row">${sectionInput('enabled', 'checkbox', section.enabled)} Section accepts seats</label>`;
    html += `<div class="hint">Edit section bounds above, or customize the seating footprint separately on each level below.</div></div>`;
    const tiers = resolveTiers(project);
    html += `<div class="subheading">SECTION × TIER GEOMETRY</div><p class="hint">Overrides affect this section only. Empty (0-row) profiles become gaps in the 3D model and seat CSV.</p>`;
    for (const tier of tiers) {
      const profile = project.sectionProfiles.find(p => p.sectionId === section.id && p.tierId === tier.id);
      html += `<div class="tier-card section-profile"><div class="tier-header"><strong>${safe(tier.label)}</strong><button data-toggle-profile="${tier.id}">${profile ? 'Reset to tier' : 'Customize'}</button></div>`;
      if (profile) {
        const input = (prop,label,value,min,max,step) => field(label, `<input type="number" data-profile-tier="${tier.id}" data-profile-prop="${prop}" min="${min}" max="${max}" step="${step}" value="${value}" />`);
        html += `<div class="two-fields">${input('rows','Rows',profile.rows,0,75,1)}${input('frontShift','Front shift (m)',profile.frontShift,-4,40,.1)}</div>`;
        html += `<div class="two-fields">${input('heightShift','Elevation shift (m)',profile.heightShift,-8,30,.1)}${input('rise','Row rise (m)',profile.rise,.12,.75,.01)}</div>`;
        html += input('depth','Row depth (m)',profile.depth,.65,1.8,.01);
      } else html += `<p class="hint">Inherits ${tier.rows} rows · ${tier.startHeight.toFixed(1)} m base elevation.</p>`;
      html += `</div>`;
    }
  } else if (activeTab === 'outline') {
    const custom = project.outline.mode === 'custom';
    html = `<p class="hint">Outline is a closed radial polygon. Drag its control points in the 2D editor to shape an irregular seating bowl. Invalid geometry is rejected automatically.</p>`;
    if (!custom) {
      html += `<div class="outline-stat">The bowl is using its standard parametric superellipse.</div><div class="outline-controls"><button data-enable-outline>Create editable outline</button><button data-open-editor>Open 2D editor</button></div>`;
    } else {
      outlineHandleIndex = Math.max(0, Math.min(outlineHandleIndex, project.outline.points.length - 1));
      const point = project.outline.points[outlineHandleIndex];
      html += `<div class="outline-stat">${project.outline.points.length} anchors · closed curve · 1.5 m minimum pitch clearance</div>`;
      html += `<div class="outline-controls"><button data-open-editor>Open 2D editor</button><button data-add-point ${project.outline.points.length >= 64 ? 'disabled' : ''}>Add point</button><button data-delete-point ${project.outline.points.length <= 8 ? 'disabled' : ''}>Remove point</button></div>`;
      html += field('Selected control point', `<select id="outlineHandleSelect">${project.outline.points.map((_, i) => `<option value="${i}" ${i === outlineHandleIndex ? 'selected' : ''}>Anchor ${i + 1}</option>`).join('')}</select>`);
      html += `<div class="two-fields">${field('X coordinate (m)', `<input type="number" step="0.1" data-outline-coordinate="x" value="${point.x.toFixed(2)}" />`)}${field('Z coordinate (m)', `<input type="number" step="0.1" data-outline-coordinate="z" value="${point.z.toFixed(2)}" />`)}</div>`;
      html += `<button data-reset-outline class="full-outline">Return to parametric outline <span>↶</span></button><p class="hint">Double-click an outline edge in the 2D workspace to insert another anchor. Click any anchor to edit its coordinates.</p>`;
    }
  } else if (activeTab === 'aisles') {
    html = `<p class="hint">Create radial circulation aisles independently of section borders. Each aisle removes seating and the corresponding terrace strip from the chosen level.</p>`;
    html += `<button data-add-aisle class="full-outline" ${project.aisles.length >= 32 ? 'disabled' : ''}>＋ Add radial aisle <span>${project.aisles.length}/32</span></button>`;
    if (!project.aisles.length) html += `<div class="outline-stat">No independent aisles yet. Section boundaries still have the standard aisle spacing.</div>`;
    project.aisles.forEach((aisle, i) => {
      html += `<div class="aisle-card"><div class="aisle-card-header"><strong>${safe(aisle.id)}</strong><button data-remove-aisle="${i}" aria-label="Remove ${safe(aisle.id)}">Remove</button></div>`;
      html += `<div class="two-fields">${field('Angle (°)', `<input type="number" min="0" max="359.99" step="0.5" data-aisle-index="${i}" data-aisle-prop="angle" value="${aisle.angle}" />`)}${field('Width (m)', `<input type="number" min="0.8" max="10" step="0.1" data-aisle-index="${i}" data-aisle-prop="width" value="${aisle.width}" />`)}</div>`;
      html += field('Affected levels', `<select data-aisle-index="${i}" data-aisle-prop="tier">${optionList(aisle.tier, [['all','All tiers'], ...project.tiers.map(t => [t.id,t.label])])}</select>`);
      html += `</div>`;
    });
    html += `<div class="subheading">ENTRANCES / VOMITORIES</div><p class="hint">Unlike full-length aisles, entrances cut through selected rows in one seating tier.</p>`;
    html += `<button data-add-portal class="full-outline" ${project.portals.length >= 40 ? 'disabled' : ''}>＋ Add entrance opening <span>${project.portals.length}/40</span></button>`;
    project.portals.forEach((portal, i) => {
      const tier = project.tiers.find(t => t.id === portal.tierId);
      html += `<div class="aisle-card"><div class="aisle-card-header"><strong>${safe(portal.id)}</strong><button data-remove-portal="${i}">Remove</button></div>`;
      html += field('Tier', `<select data-portal-index="${i}" data-portal-prop="tierId">${optionList(portal.tierId, project.tiers.map(t => [t.id,t.label]))}</select>`);
      html += `<div class="two-fields">${field('Angle (°)', `<input type="number" min="0" max="359.99" step="0.5" data-portal-index="${i}" data-portal-prop="angle" value="${portal.angle}" />`)}${field('Width (m)', `<input type="number" min="0.8" max="18" step="0.1" data-portal-index="${i}" data-portal-prop="width" value="${portal.width}" />`)}</div>`;
      html += `<div class="two-fields">${field('Start row', `<input type="number" min="1" max="75" step="1" data-portal-index="${i}" data-portal-prop="firstRow" value="${portal.firstRow}" />`)}${field('End row', `<input type="number" min="1" max="75" step="1" data-portal-index="${i}" data-portal-prop="lastRow" value="${portal.lastRow}" />`)}</div>`;
      html += `<p class="hint">${safe(tier?.label || 'Tier')} · seat and terrace cutout</p></div>`;
    });
  } else if (activeTab === 'plan') {
    html = `<p class="hint">Import a vector seating plan (SVG). Its shapes become inert geometry guides, not executable SVG. Set scale, offset, and rotation before tracing a closed stadium contour.</p>`;
    html += `<button data-import-plan class="full-outline">Import SVG drawing <span>↑</span></button>`;
    if (project.plan) {
      const plan = project.plan;
      selectedPlanPath = Math.max(0, Math.min(selectedPlanPath, plan.paths.length - 1));
      const closed = plan.paths.filter(p => p.closed).length;
      html += `<div class="outline-stat"><strong>${safe(plan.name)}</strong><p>${plan.paths.length} vector paths · ${closed} closed · units need calibration</p></div>`;
      html += field('Drawing width represented (m)', `<input type="number" id="planWidth" min="1" max="10000" step="0.5" value="${(plan.viewBox[2] * plan.scale).toFixed(2)}" />`);
      html += `<div class="two-fields">${field('X offset (m)', `<input type="number" data-plan-prop="offsetX" value="${plan.offsetX}" step="0.5" />`)}${field('Z offset (m)', `<input type="number" data-plan-prop="offsetZ" value="${plan.offsetZ}" step="0.5" />`)}</div>`;
      html += field('Rotation (°)', `<input type="number" data-plan-prop="rotation" value="${plan.rotation}" step="1" min="-360" max="360" />`);
      html += `<label class="toggle-row"><input type="checkbox" data-plan-prop="visible" ${plan.visible ? 'checked' : ''} /> Show SVG guides in 2D editor</label>`;
      html += field('Selected vector path', `<select id="planPathSelect">${optionList(String(selectedPlanPath), plan.paths.map((p, i) => [String(i), `${p.closed ? '◯' : '—'} ${p.name} (${p.points.length} pts)`]))}</select>`);
      html += `<div class="outline-controls"><button data-trace-plan ${!plan.paths[selectedPlanPath]?.closed ? 'disabled' : ''}>Trace selected closed contour</button><button data-open-editor>2D editor</button></div>`;
      html += `<button data-remove-plan class="full-outline">Remove SVG reference <span>×</span></button>`;
      html += `<p class="hint">Only the vector geometry is saved in project JSON. Native DWG/DXF and external SVG assets are not imported. Tracing requires one closed contour around the field center.</p>`;
    } else html += `<div class="outline-stat">No vector plan imported. You can continue drawing an outline manually, or import an SVG to trace.</div>`;
  } else if (activeTab === 'survey') {
    const s = project.survey;
    const anchorField=(i,prop,label,value)=>field(label,`<input type="number" data-control="${i}" data-control-prop="${prop}" step="any" value="${value}" />`);
    const obsField=(i,prop,label,value)=>field(label,`<input type="${['type','source'].includes(prop)?'text':'number'}" data-obstacle="${i}" data-obstacle-prop="${prop}" step="any" value="${safe(value)}" />`);
    html=`<div class="outline-stat"><strong>Real-world calibration pipeline</strong><p>Import official or independently measured positions; do not treat generated stadium seats as surveyed data.</p></div>`;
    html+=`<div class="outline-controls"><button data-ohio-stadium>Ohio Stadium reference</button><button data-import-seat-csv>Import seat CSV</button></div>`;
    html+=`<div class="two-fields">${field('Seat source',`<select data-survey-prop="mode">${optionList(s.mode,[['generated','Generated illustration'],['imported','Imported coordinates']])}</select>`)}${field('Plan X/Z units',`<select data-survey-prop="inputUnit">${optionList(s.inputUnit,[['m','Meters'],['ft','Feet'],['drawing','Unscaled drawing units']])}</select>`)}</div>`;
    html+=`<div class="two-fields">${field('Elevation units',`<select data-survey-prop="yUnit">${optionList(s.yUnit,[['m','Meters'],['ft','Feet']])}</select>`)}${field('Elevation offset (m)',`<input type="number" data-survey-prop="heightOffset" step="0.01" value="${s.heightOffset}"/>`)}</div>`;
    html+=field('Venue name',`<input type="text" data-survey-prop="venue" value="${safe(s.venue)}"/>`);
    html+=field('Coordinate source / measurement note',`<input type="text" data-survey-prop="source" value="${safe(s.source)}"/>`);
    html+=field('Public source URL (optional HTTPS)',`<input type="url" data-survey-prop="sourceUrl" value="${safe(s.sourceUrl)}" placeholder="https://..."/>`);
    html+=`<div class="outline-stat">${num(s.seats.length)} imported seats · ${s.seats.filter(p=>p.y!==null).length} with supplied elevation · ${s.anchors.length} matched landmarks</div>`;
    html+=`<div class="outline-controls"><button data-demo-seat-csv>Load fictional 24-seat fixture</button><button data-clear-seat-csv ${s.seats.length?'':'disabled'}>Clear imported seats</button></div>`;
    html+=`<p class="hint">CSV requires seat_id, section, row, seat, x, z and optional tier, y. Source units apply to X/Z; elevations use the separately chosen unit. Use raw drawing X/Z with at least two matched control points. Imported mode hides schematic terraces rather than suggesting they match the real seat measurements.</p>`;
    html+=`<div class="subheading">LANDMARK REGISTRATION</div><p class="hint">For each control point enter the X/Z in your original CSV (source), and the corresponding known X/Z in this stadium frame (target, meters). Stadium center is X=0, Z=0. Minimum 2 matches, recommended 3+ for residual testing.</p>`;
    if(s.anchors.length>=2){try{const fit=fitPlanRegistration(s.anchors);html+=`<div class="outline-stat"><strong>RMS ${fit.rms.toFixed(3)} m · Max ${fit.maxError.toFixed(3)} m</strong><p>Scale ${fit.scale.toFixed(6)} m/unit · Angle ${(fit.angle*180/Math.PI).toFixed(2)}° · ${fit.count} controls. Two-point fit has zero independent residual check.</p></div>`}catch(e){html+=`<p class="hint error-note">${safe(e.message)}</p>`;}}
    s.anchors.forEach((a,i)=>{html+=`<div class="tier-card"><div class="tier-header"><strong>${safe(a.id)}</strong><button data-remove-control="${i}">Remove</button></div><div class="two-fields">${anchorField(i,'srcX','Source X',a.srcX)}${anchorField(i,'srcZ','Source Z',a.srcZ)}</div><div class="two-fields">${anchorField(i,'dstX','Target X (m)',a.dstX)}${anchorField(i,'dstZ','Target Z (m)',a.dstZ)}</div></div>`;});
    html+=`<button data-add-control class="full-outline" ${s.anchors.length>=32?'disabled':''}>＋ Add calibration landmark</button>`;
    html+=`<div class="subheading">MEASURED / MODELED OBSTRUCTIONS</div><p class="hint">Manually add rails, parapets, columns or screens as oriented boxes. The sightline check tests only these boxes; source notes and sizes must be verified for real-world conclusions.</p>`;
    s.obstacles.forEach((o,i)=>{html+=`<div class="tier-card"><div class="tier-header"><strong>${safe(o.type)} · ${safe(o.id)}</strong><button data-remove-obstacle="${i}">Remove</button></div>${obsField(i,'type','Type',o.type)}${obsField(i,'source','Source note',o.source)}<div class="two-fields">${obsField(i,'x','Center X (m)',o.x)}${obsField(i,'z','Center Z (m)',o.z)}</div><div class="two-fields">${obsField(i,'y','Center Y (m)',o.y)}${obsField(i,'yaw','Yaw (°)',o.yaw)}</div><div class="two-fields">${obsField(i,'width','Width (m)',o.width)}${obsField(i,'height','Height (m)',o.height)}</div>${obsField(i,'depth','Depth (m)',o.depth)}</div>`;});
    html+=`<button data-add-obstacle class="full-outline">＋ Add barrier near selected seat</button>`;
    html+=`<button data-export-survey-report class="full-outline">↓ Export calibration QA report</button>`;
  } else {
    html = fieldText('Project name', 'title', project.title);
    html += fieldText('City', 'city', project.city);
    html += fieldSelect('Country', 'country', project.country, [['United States', 'United States'], ['Canada', 'Canada']]);
    html += `<div class="subheading">WORKFLOW</div><p class="hint">Save a named local snapshot, import a JSON project, or download the editable project. You can export a GLB model and a CSV containing every seat's 3D coordinates.</p>`;
    html += `<p class="hint">Local projects remain in this browser. Download a JSON backup before clearing site data or moving to another device.</p>`;
  }
  byId('tabContent').innerHTML = html;
}

function updateHeader() {
  const surface = SURFACES[project.surface];
  byId('projectNameSmall').textContent = project.title;
  byId('breadcrumbTitle').textContent = project.title;
  byId('viewportTitle').textContent = project.title;
  byId('projectSubline').textContent = `${project.country} · ${surface.label}`;
  byId('viewportSubtitle').textContent = `${surface.label} · ${project.city || 'Custom venue'} · ${isOhioReference(project)?'Ohio Stadium architectural reference / estimated seats':project.survey.mode==='imported'?'Imported unverified positions':'Parametric draft'}`;
  $all('[data-preset]').forEach(button => button.classList.toggle('active', (button.dataset.preset === 'nfl' && ['nfl', 'cfl', 'cfl27'].includes(project.surface)) || (button.dataset.preset === 'nba' && ['nba', 'ncaa'].includes(project.surface)) || button.dataset.preset === project.surface));
  $all('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === activeTab));
  byId('undoBtn').disabled = !history.length;
  byId('redoBtn').disabled = !future.length;
}

function showSelection(seat = stadium?.selectedSeat) {
  if (!model) return;
  const target = byId('selectionInfo');
  if (!seat) { target.innerHTML = `<div class="empty-selection">Click a seat or seating section to inspect its position.</div>`; return; }
  const tier = model.tiers[seat.tier];
  const section = model.project.sections[seat.sectionIndex];
  const stats = sectionStats(model, seat.sectionId);
  const sectionLabel=model.seatOrigin==='imported'?seat.sectionId:section.label;
  target.innerHTML = `<strong>${safe(sectionLabel)} · Row ${safe(seat.row)}</strong><p>${safe(model.seatOrigin==='imported'?seat.tierLabel||'Imported deck':tier.label)} · Seat ${safe(seat.number)}<br />Section count ${num(stats.seats)} seats</p><code>X ${seat.x.toFixed(2)} · Y ${seat.y.toFixed(2)} · Z ${seat.z.toFixed(2)} m${seat.elevationKnown===false?' · ELEVATION UNKNOWN':''}</code>`;
}
function updateStats() {
  if (!model) return;
  byId('capacityValue').textContent = num(model.capacity);
  byId('seatSourceLabel').textContent=model.seatOrigin==='imported'?'imported, not independently verified':isOhioReference(project)?'reconstructed sectors · NOT official seat count':'parametrically generated seats';
  byId('tierCount').textContent = model.tiers.length;
  byId('sectionCount').textContent = model.project.sections.filter(s => s.enabled).length;
  byId('fieldSize').textContent = `${model.surface.length.toFixed(0)}×${model.surface.width.toFixed(0)}`;
  byId('bottomStatus').textContent = `${num(model.capacity)} seats · ${model.project.sections.filter(s => s.enabled).length} active sections · ${model.tiers.length} tier(s)`;
  byId('modelVersion').textContent = `SCHEMA v${CURRENT_SCHEMA}`;
  showSelection();
  refreshViewPanel();
}

function showSection(sectionId) {
  activeSectionId = sectionId;
  activeTab = 'sections';
  renderTab();
  updateHeader();
  const section = model?.project.sections.find(s => s.id === sectionId);
  if (section && model) {
    const stats = sectionStats(model, section.id);
    byId('selectionInfo').innerHTML = `<strong>${safe(section.label)}</strong><p>${section.start.toFixed(1)}° to ${section.end.toFixed(1)}°<br />${num(stats.seats)} seats · ${stats.rows} rows across tiers</p><code>${safe(section.id)} · ${section.enabled ? 'ACTIVE' : 'DISABLED'}</code>`;
  }
}

function scheduleModel() {
  const current = ++renderVersion;
  byId('loadingState').hidden = false;
  byId('bottomStatus').textContent = 'Generating seats and model…';
  setTimeout(() => {
    if (current !== renderVersion) return;
    try {
      model = generateSeats(project);
      if (stadium) {
        stadium.load(model, true);
        if (view === 'seat') stadium.setView('seat');
      }
      updateStats();
      refreshViewPanel();
      renderOutlineSvg();
      byId('loadingState').hidden = true;
      byId('saveStatus').textContent = putStored(KEY_CURRENT, project) ? 'Auto-saved in this browser' : 'Local storage unavailable — export JSON';
    } catch (error) {
      byId('loadingState').hidden = true;
      toast(`Could not generate model: ${error.message}`, true);
      byId('bottomStatus').textContent = 'Model generation failed';
    }
  }, 15);
}

function commit(callback) {
  const previous = JSON.stringify(project);
  const next = deepCopy(project);
  try {
    callback(next);
    const validated = validateProject(next);
    if (JSON.stringify(validated) === previous) return;
    history.push(previous);
    if (history.length > 50) history.shift();
    future = [];
    project = validated;
    if (!project.sections.some(s => s.id === activeSectionId)) activeSectionId = project.sections[0].id;
    if (project.plan) selectedPlanPath = Math.min(selectedPlanPath, project.plan.paths.length - 1);
    outlineHandleIndex = Math.min(outlineHandleIndex, project.outline.points.length - 1);
    renderTab(); updateHeader(); scheduleModel();
    return true;
  } catch (error) { toast(error.message, true); renderTab(); return false; }
}
function replaceProject(next) {
  try {
    const validated = validateProject(next);
    history.push(JSON.stringify(project));
    if (history.length > 50) history.shift();
    future = [];
    project = validated;
    activeSectionId = project.sections[0].id;
    outlineHandleIndex = 0;
    selectedPlanPath = 0;
    view = 'orbit';
    $all('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    syncOutlineVisibility();
    renderTab(); updateHeader(); scheduleModel();
    return true;
  } catch (error) { toast(`Invalid project: ${error.message}`, true); return false; }
}
function travel(which) {
  const from = which === 'undo' ? history : future;
  const other = which === 'undo' ? future : history;
  if (!from.length) return;
  other.push(JSON.stringify(project));
  project = validateProject(JSON.parse(from.pop()));
  activeSectionId = project.sections[0].id;
  outlineHandleIndex = 0;
  renderTab(); updateHeader(); scheduleModel();
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const slug = () => (project.title || 'stadium').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'stadium';
function exportProject() {
  downloadBlob(new Blob([JSON.stringify({ format: 'filedmaker-project', project }, null, 2)], { type: 'application/json' }), `${slug()}.filedmaker.json`);
  toast('Editable project downloaded.');
}
function csvCell(value) { const text = String(value); return /^[=+@-]/.test(text) && !/^-?\d+(?:\.\d+)?$/.test(text) ? `"'${text.replace(/"/g, '""')}"` : `"${text.replace(/"/g, '""')}"`; }
function exportSeats() {
  if (!model) return toast('Model not ready', true);
  const columns = ['seat_id', 'tier', 'section', 'row', 'seat', 'x_m', 'y_m', 'z_m', 'yaw_rad'];
  const rows = [columns.join(',')];
  for (const seat of model.seats) {
    rows.push([seat.uid, model.tiers[seat.tier].label, seat.sectionId, seat.row, seat.number, seat.x.toFixed(4), seat.y.toFixed(4), seat.z.toFixed(4), seat.yaw.toFixed(6)].map(csvCell).join(','));
  }
  downloadBlob(new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${slug()}-seats.csv`);
  toast(`${num(model.capacity)} seat coordinates downloaded.`);
}

async function exportGlb() {
  if (!stadium) return toast('3D engine unavailable', true);
  const button = byId('exportGlb');
  const before = button.textContent;
  button.disabled = true; button.textContent = 'Exporting model…';
  try {
    const blob = await stadium.exportGLB();
    downloadBlob(blob, `${slug()}.glb`);
    toast('3D model downloaded as GLB.');
  } catch (error) { toast(`GLB export failed: ${error.message}`, true); }
  finally { button.disabled = false; button.textContent = before; }
}
function exportSurveyQA(){
  const survey=project.survey;
  let fit=null,warning=null;
  try{fit=seatRegistration(survey);}catch(err){warning=err.message;}
  const result={schema:'filedmaker-calibration-report.v1',venue:survey.venue,source:survey.source,url:survey.sourceUrl,
    generatedAt:new Date().toISOString(),seatMode:survey.mode,importedSeats:survey.seats.length,
    elevatedSeats:survey.seats.filter(seat=>seat.y!==null).length,controlPoints:survey.anchors.length,
    registration:fit,warning,modeledObstacles:survey.obstacles,
    photoCalibration:project.survey.photoCheck||null,
    caution:'Not certified surveyed data. Residuals evaluate only entered landmarks; sightline checks include only manually modeled obstruction boxes.'};
  downloadBlob(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),`${slug()}-calibration-QA.json`);
  toast('Coordinate registration and provenance report exported.');
}
function saveSlot() {
  const library = getStored(KEY_LIBRARY, {});
  const id = slug();
  library[id] = { name: project.title, saved: new Date().toISOString(), project: deepCopy(project) };
  if (putStored(KEY_LIBRARY, library)) toast('Project saved to the local library.');
  else toast('Storage quota exceeded. Download a JSON backup.', true);
}
function drawLibrary() {
  const library = getStored(KEY_LIBRARY, {});
  const entries = Object.entries(library).sort((a, b) => b[1].saved.localeCompare(a[1].saved));
  byId('savedProjects').innerHTML = entries.length ? entries.map(([key, value]) => `<div class="saved-entry"><div><strong>${safe(value.name)}</strong><small>${safe(new Date(value.saved).toLocaleString())}</small></div><div><button type="button" data-load-slot="${safe(key)}">Open</button><button type="button" class="delete" data-delete-slot="${safe(key)}" aria-label="Delete project">×</button></div></div>`).join('') : '<p class="hint">No saved snapshots yet. Use “Save locally” in the sidebar, or import an existing project.</p>';
}

byId('tabContent').addEventListener('change', e => {
  const input = e.target;
  if(input.dataset.surveyProp){
    const key=input.dataset.surveyProp;
    commit(next=>{next.survey[key]=input.type==='number'?Number(input.value):input.value;});
  } else if(input.dataset.controlProp){
    const i=Number(input.dataset.control),key=input.dataset.controlProp;
    commit(next=>{next.survey.anchors[i][key]=Number(input.value);});
  } else if(input.dataset.obstacleProp){
    const i=Number(input.dataset.obstacle),key=input.dataset.obstacleProp;
    commit(next=>{next.survey.obstacles[i][key]=input.type==='number'?Number(input.value):input.value;});
  } else if (input.dataset.project) {
    const key = input.dataset.project;
    commit(next => { next[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value; });
  } else if (input.dataset.tier !== undefined) {
    const index = Number(input.dataset.tier), key = input.dataset.prop;
    commit(next => { next.tiers[index][key] = input.type === 'number' ? Number(input.value) : input.value; });
  } else if (input.dataset.sectionProp) {
    const id = activeSectionId, key = input.dataset.sectionProp;
    commit(next => { const section = next.sections.find(s => s.id === id); section[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value; });
  } else if (input.id === 'outlineHandleSelect') {
    outlineHandleIndex = Number(input.value); renderTab(); renderOutlineSvg();
  } else if (input.dataset.outlineCoordinate) {
    const index = outlineHandleIndex, axis = input.dataset.outlineCoordinate;
    commit(next => { next.outline.points[index][axis] = Number(input.value); });
  } else if (input.dataset.aisleProp) {
    const index = Number(input.dataset.aisleIndex), prop = input.dataset.aisleProp;
    commit(next => { next.aisles[index][prop] = input.type === 'number' ? Number(input.value) : input.value; });
  } else if (input.dataset.profileProp) {
    const sectionId = activeSectionId, tierId = input.dataset.profileTier, prop = input.dataset.profileProp;
    commit(next => { const item = next.sectionProfiles.find(p => p.sectionId === sectionId && p.tierId === tierId); if (item) item[prop] = Number(input.value); });
  } else if (input.dataset.portalProp) {
    const i = Number(input.dataset.portalIndex), prop = input.dataset.portalProp;
    commit(next => { next.portals[i][prop] = input.type === 'number' ? Number(input.value) : input.value; });
  } else if (input.dataset.planProp) {
    const prop = input.dataset.planProp;
    commit(next => { if (next.plan) next.plan[prop] = input.type === 'checkbox' ? input.checked : Number(input.value); });
  } else if (input.id === 'planWidth') {
    commit(next => { next.plan.scale = Number(input.value) / next.plan.viewBox[2]; });
  } else if (input.id === 'planPathSelect') {
    selectedPlanPath = Number(input.value);
    renderTab(); renderOutlineSvg();
  } else if (input.id === 'sectionCountInput') {
    const count = Number(input.value);
    if (count === project.sections.length) return;
    if (confirm('Rebuild the section layout? Custom section names, colors and enabled states will be reset.')) {
      commit(next => { next.sections = makeSections(count); next.sectionProfiles = []; });
      activeSectionId = project.sections[0].id;
    } else renderTab();
  }
});
byId('tabContent').addEventListener('click', e => {
  const target = e.target.closest('button'); if (!target) return;
  if(target.hasAttribute('data-build-ohio-stadium')){
    if(confirm('Load Ohio Stadium architectural reference? Unsaved edits will be replaced. This is NOT a surveyed seat map.')){
      activeTab='bowl';replaceProject(createOhioStadiumProject());
      toast('Ohio Stadium loaded. All seat positions remain estimates.');
    }
  }
  else if(target.hasAttribute('data-import-seat-csv')) byId('seatCsvUpload').click();
  else if(target.hasAttribute('data-ohio-stadium')){
    if(confirm('Load Ohio Stadium architectural reference? Unsaved edits will be replaced.')){
      activeTab='bowl';replaceProject(createOhioStadiumProject());
      toast('Ohio Stadium loaded. Generated seats remain approximate.');
    }
  }
  else if(target.hasAttribute('data-demo-seat-csv')){
    commit(next=>{next.survey.seats=parseSeatCSV(demoSurveyRows());next.survey.mode='imported';next.survey.inputUnit='m';next.survey.yUnit='m';next.survey.anchors=[];next.survey.source='Fictional calibration fixture — not an actual venue';});
    focusImported2D=true;
    toast('Loaded 24 fictional test seats. This is not real stadium data.');
  }
  else if(target.hasAttribute('data-clear-seat-csv'))commit(next=>{next.survey.seats=[];next.survey.mode='generated';next.survey.anchors=[];});
  else if(target.hasAttribute('data-add-control'))commit(next=>{const n=next.survey.anchors.length+1;next.survey.anchors.push({id:`CP${n}`,srcX:n*10,srcZ:0,dstX:n*10,dstZ:0});});
  else if(target.hasAttribute('data-remove-control'))commit(next=>{const i=Number(target.dataset.removeControl);next.survey.anchors.splice(i,1);if(next.survey.mode==='imported'&&next.survey.inputUnit==='drawing'&&next.survey.anchors.length<2)next.survey.mode='generated';});
  else if(target.hasAttribute('data-add-obstacle')){
    const seat=currentSeat();
    const a=seat?.yaw??0,offset=seat?1.2:0;
    commit(next=>{const n=next.survey.obstacles.length+1;next.survey.obstacles.push({id:`OBS${Date.now().toString(36)}-${n}`,type:'rail',source:'Unverified manual model',x:(seat?.x??0)-Math.sin(a)*offset,y:(seat?.y??1.4)+1,z:(seat?.z??0)-Math.cos(a)*offset,width:1.5,height:.9,depth:.12,yaw:a*180/Math.PI});});
  }
  else if(target.hasAttribute('data-remove-obstacle'))commit(next=>{next.survey.obstacles.splice(Number(target.dataset.removeObstacle),1);});
  else if(target.hasAttribute('data-export-survey-report'))exportSurveyQA();
  else if (target.dataset.addTier !== undefined) {
    commit(next => {
      const prev = next.tiers.at(-1);
      next.tiers.push({ id: `T${next.tiers.length + 1}`, label: `Tier ${next.tiers.length + 1}`, rows: 18, depth: prev.depth, rise: prev.rise, offset: 0, height: 0, gap: 0, heightGap: 0 });
    });
  } else if (target.dataset.removeTier !== undefined) {
    const index = Number(target.dataset.removeTier);
    if (confirm(`Remove ${project.tiers[index].label}?`)) commit(next => {
      const removed = next.tiers[index].id;
      next.tiers.splice(index, 1);
      next.aisles = next.aisles.filter(a => a.tier !== removed);
      next.aisles.forEach(a => { if (a.tier !== 'all' && Number(a.tier.slice(1)) > index + 1) a.tier = `T${Number(a.tier.slice(1)) - 1}`; });
      next.sectionProfiles = next.sectionProfiles.filter(p => p.tierId !== removed);
      next.sectionProfiles.forEach(p => { if (Number(p.tierId.slice(1)) > index + 1) p.tierId = `T${Number(p.tierId.slice(1)) - 1}`; });
      next.portals = next.portals.filter(p => p.tierId !== removed);
      next.portals.forEach(p => { if (Number(p.tierId.slice(1)) > index + 1) p.tierId = `T${Number(p.tierId.slice(1)) - 1}`; });
    });
  } else if (target.dataset.toggleProfile) {
    const tierId = target.dataset.toggleProfile, sectionId = activeSectionId;
    commit(next => {
      const i = next.sectionProfiles.findIndex(p => p.sectionId === sectionId && p.tierId === tierId);
      if (i >= 0) next.sectionProfiles.splice(i, 1);
      else { const tier = next.tiers.find(t => t.id === tierId);
        next.sectionProfiles.push({ sectionId, tierId, rows: tier.rows, frontShift: 0, heightShift: 0, depth: tier.depth, rise: tier.rise }); }
    });
  } else if (target.dataset.pickSection) showSection(target.dataset.pickSection);
  else if (target.hasAttribute('data-enable-outline')) {
    commit(next => { next.outline = createCustomOutline(next); });
    show2DEditor();
  } else if (target.hasAttribute('data-reset-outline')) {
    commit(next => { next.outline = { mode: 'parametric', points: [] }; });
  } else if (target.hasAttribute('data-open-editor')) show2DEditor();
  else if (target.hasAttribute('data-add-point')) {
    const index = outlineHandleIndex;
    commit(next => {
      const points = next.outline.points;
      const a = outlineAngle(points[index]), b = outlineAngle(points[(index + 1) % points.length]);
      const angle = (a + ((b <= a ? b + TAU : b) - a) / 2) % TAU;
      const position = modelPerimeterPoint(next, SURFACES[next.surface], angle);
      points.splice(index + 1, 0, position);
    });
    outlineHandleIndex = index + 1; renderTab(); renderOutlineSvg();
  } else if (target.hasAttribute('data-delete-point')) {
    const index = outlineHandleIndex;
    commit(next => { next.outline.points.splice(index, 1); });
    outlineHandleIndex = Math.max(0, index - 1); renderTab(); renderOutlineSvg();
  } else if (target.hasAttribute('data-add-aisle')) {
    commit(next => {
      const used = new Set(next.aisles.map(a => a.id));
      let id = 1; while (used.has(`A${id}`)) id++;
      next.aisles.push({ id: `A${id}`, angle: (25 + next.aisles.length * 52) % 360, width: 1.6, tier: 'all' });
    });
  } else if (target.hasAttribute('data-remove-aisle')) {
    commit(next => { next.aisles.splice(Number(target.dataset.removeAisle), 1); });
  } else if (target.hasAttribute('data-add-portal')) {
    commit(next => {
      const used = new Set(next.portals.map(p => p.id)); let i = 1; while (used.has(`P${i}`)) i++;
      next.portals.push({id:`P${i}`, tierId:'T1', angle:45, width:4, firstRow:8, lastRow:12});
    });
  } else if (target.hasAttribute('data-remove-portal')) {
    commit(next => { next.portals.splice(Number(target.dataset.removePortal), 1); });
  } else if (target.hasAttribute('data-import-plan')) {
    byId('planUpload').click();
  } else if (target.hasAttribute('data-remove-plan')) {
    commit(next => { next.plan = null; }); selectedPlanPath = 0;
  } else if (target.hasAttribute('data-trace-plan')) {
    try {
      const outline = tracePlanOutline(project.plan, selectedPlanPath, SURFACES[project.surface]);
      const draft = deepCopy(project); draft.outline = outline;
      validateOutline(outline.points, SURFACES[project.surface]);
      commit(next => { next.outline = outline; }); show2DEditor(); toast('Closed SVG contour converted to an editable seating outline.');
    } catch (error) { toast(`Trace failed: ${error.message}`, true); }
  }
});
$all('[data-tab]').forEach(button => button.addEventListener('click', () => { activeTab = button.dataset.tab; renderTab(); updateHeader(); }));
$all('[data-preset]').forEach(button => button.addEventListener('click', () => {
  const label = button.textContent.trim().replace(/\s+/g, ' ');
  if (confirm(`Start a new ${label} model? The current project will remain available if you saved a snapshot or downloaded JSON.`)) {
    activeTab = 'bowl'; replaceProject(createProject(button.dataset.preset));
  }
}));
function switchView(mode) {
  view = mode;
  $all('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === mode));
  syncOutlineVisibility();
  if (stadium) stadium.setView(mode === 'outline' ? 'plan' : mode);
  else if (mode !== 'outline') toast('3D rendering not yet available.', true);
  refreshViewPanel();
}
$all('[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
// The SVG editor is independent of WebGL. Changes flow through the same project,
// geometry validation, history stack and 3D rendering pipeline as numeric edits.
function syncOutlineVisibility() {
  byId('outlineEditor').hidden = view !== 'outline';
  byId('stadiumCanvas').style.pointerEvents = view === 'outline' ? 'none' : 'auto';
  byId('renderError').hidden = view === 'outline' || !rendererFailed;
  if (view === 'outline') renderOutlineSvg();
}
function show2DEditor() {
  view = 'outline';
  $all('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  if (stadium) stadium.setView('plan');
  syncOutlineVisibility();
}
function svgPath(projectValue, surface, margin, samples = 256) {
  let d = '';
  for (let i = 0; i <= samples; i++) {
    const angle = i * TAU / samples;
    const pos = modelPerimeterPoint(projectValue, surface, angle, margin);
    d += `${i ? 'L' : 'M'}${pos.x.toFixed(3)},${pos.z.toFixed(3)} `;
  }
  return d + 'Z';
}
function renderOutlineSvg(projectValue = project) {
  const svg = byId('outlineSvg');
  if (!svg) return;
  const surface = SURFACES[projectValue.surface];
  const tiers = resolveTiers(projectValue);
  const outer = tiers.at(-1);
  const margin = outer.startOffset + outer.rows * outer.depth + 60;
  const imported=model?.seatOrigin==='imported' && projectValue===project && model.seats.length;
  const importedRange=imported?model.seats.reduce((m,seat)=>Math.max(m,Math.abs(seat.x),Math.abs(seat.z)),0)+24:0;
  const lim = Math.min(2000,Math.max(importedRange,Math.max(surface.length / 2, surface.width / 2) + margin + 14));
  if(focusImported2D && imported){
    let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
    for(const seat of model.seats){minX=Math.min(minX,seat.x);maxX=Math.max(maxX,seat.x);minZ=Math.min(minZ,seat.z);maxZ=Math.max(maxZ,seat.z);}
    const size=Math.max(15,maxX-minX+12,maxZ-minZ+12);
    svg.setAttribute('viewBox', `${((minX+maxX)/2-size/2).toFixed(2)} ${((minZ+maxZ)/2-size/2).toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}`);
  }else svg.setAttribute('viewBox', `${-lim} ${-lim} ${2 * lim} ${2 * lim}`);
  byId('focusImportedSeats').disabled=!imported;
  byId('focusImportedSeats').textContent=focusImported2D?'Full field':'Focus seats';
  const backSize = lim * 1.8;
  const field = `<rect x="${-surface.width / 2}" y="${-surface.length / 2}" width="${surface.width}" height="${surface.length}" fill="${surface.sport === 'basketball' ? '#a48963' : '#2a7659'}" stroke="#b8eee2" stroke-width=".5"/><path d="M${-surface.width / 2},0 H${surface.width / 2} M0,${-surface.length / 2} V${surface.length / 2}" stroke="#d5f2e5" stroke-width=".35" opacity=".5"/>`;
  const basePath = svgPath(projectValue, surface, 0);
  const reference = referenceUrl ? `<image href="${safe(referenceUrl)}" x="${-backSize / 2}" y="${-backSize / 2}" width="${backSize}" height="${backSize}" opacity="${referenceOpacity}" preserveAspectRatio="xMidYMid meet"/>` : '';
  let html = `<rect x="${-lim}" y="${-lim}" width="${2 * lim}" height="${2 * lim}" fill="#f7f8f8"/>`;
  const gridStep = lim > 130 ? 25 : 10;
  for (let pos = -Math.floor(lim / gridStep) * gridStep; pos <= lim; pos += gridStep) {
    html += `<path d="M${pos} ${-lim}V${lim} M${-lim} ${pos}H${lim}" stroke="#d8dddd" stroke-width=".28" opacity=".65"/>`;
  }
  html += reference;
  if(projectValue.survey?.mode!=='imported') for (let i = tiers.length - 1; i >= 0; i--) {
    const tier = tiers[i];
    for (const section of projectValue.sections) {
      if (!section.enabled) continue;
      const g = resolveSectionTier(tier, section.id, projectValue);
      if (!g.rows) continue;
      const start = section.start * Math.PI / 180, end = section.end * Math.PI / 180;
      const segments = Math.max(3, Math.ceil((section.end - section.start) / 2.0));
      let d = '';
      for (let j = 0; j <= segments; j++) {
        const angle = start + (end - start) * j / segments;
        const pos = modelPerimeterPoint(projectValue, surface, angle, g.startOffset + g.rows * g.depth);
        d += `${j ? 'L' : 'M'}${pos.x.toFixed(2)},${pos.z.toFixed(2)} `;
      }
      for (let j = segments; j >= 0; j--) {
        const angle = start + (end - start) * j / segments;
        const pos = modelPerimeterPoint(projectValue, surface, angle, g.startOffset);
        d += `L${pos.x.toFixed(2)},${pos.z.toFixed(2)} `;
      }
      html += `<path d="${d}Z" fill="${['#d4e0dc','#dce3ed','#f1e8d6','#e2dce7'][i]}" fill-opacity=".76" stroke="${['#739e98','#8c9bb1','#caa880','#a4aab8'][i]}" stroke-width=".65"/>`;
    }
  }
  html += projectValue.survey?.mode==='imported' ? field : `<path d="${basePath}" fill="#e7eceb" stroke="#628980" stroke-width=".7"/>${field}`;
  if(imported){
    const sample=Math.max(1,Math.ceil(model.seats.length/4500));
    const selected=currentSeat()?.uid;
    for(let i=0;i<model.seats.length;i+=sample){
      const seat=model.seats[i];
      html+=`<circle data-real-seat="${safe(seat.uid)}" cx="${seat.x.toFixed(3)}" cy="${seat.z.toFixed(3)}" r="${(focusImported2D?Math.max(.15,projectValue.seatPitch*.4):Math.max(.8,lim/240)).toFixed(2)}" fill="${seat.uid===selected?'#d28b30':'#215c72'}" fill-opacity=".85" stroke="#fff" stroke-width=".12"><title>${safe(seat.uid)} · ${safe(seat.sectionId)} · row ${safe(seat.row)} · seat ${safe(seat.number)}</title></circle>`;
    }
    if(selected && !model.seats.some((p,i)=>p.uid===selected&&i%sample===0)){
      const seat=model.seats.find(p=>p.uid===selected);
      if(seat)html+=`<circle data-real-seat="${safe(seat.uid)}" cx="${seat.x}" cy="${seat.z}" r="${(focusImported2D?.34:Math.max(1.5,lim/190)).toFixed(2)}" fill="#d28b30"/>`;
    }
  }
  for(const o of projectValue.survey?.obstacles||[]){
    html+=`<rect x="${o.x-o.width/2}" y="${o.z-o.depth/2}" width="${o.width}" height="${o.depth}" fill="#c47844" stroke="#a95020" stroke-width=".3" transform="rotate(${-o.yaw} ${o.x} ${o.z})"><title>${safe(o.id)} · ${safe(o.type)}</title></rect>`;
  }
  // Aisle directions are drawn as translucent corridors, matching the seating cutouts.
  for (const aisle of projectValue.aisles) {
    const angle = aisle.angle * Math.PI / 180;
    for (const tier of tiers) {
      if (aisle.tier !== 'all' && aisle.tier !== tier.id) continue;
      const near = modelPerimeterPoint(projectValue, surface, angle, tier.startOffset);
      const far = modelPerimeterPoint(projectValue, surface, angle, tier.startOffset + tier.rows * tier.depth);
      html += `<line x1="${near.x}" y1="${near.z}" x2="${far.x}" y2="${far.z}" stroke="#eab766" stroke-width="${aisle.width}" stroke-opacity=".65" stroke-linecap="butt"/>`;
    }
  }
  // Vector plans are converted to geometry, never inserted as active SVG markup.
  if (projectValue.plan?.visible) {
    const plan = projectValue.plan;
    plan.paths.forEach((path, i) => {
      const points = path.points.map(p => planPoint(plan, p));
      if (!points.length) return;
      const selected = i === selectedPlanPath;
      const d = points.map((p, j) => `${j ? 'L' : 'M'}${p.x.toFixed(2)},${p.z.toFixed(2)}`).join(' ') + (path.closed ? ' Z' : '');
      html += `<path d="${d}" fill="none" stroke="${selected ? '#1e70ab' : '#617c9a'}" stroke-opacity="${selected ? '.95' : '.48'}" stroke-width="${selected ? '1.2' : '.45'}" stroke-dasharray="${selected ? 'none' : '1.4 1.4'}" pointer-events="none"/>`;
    });
  }
  for (const portal of projectValue.portals || []) {
    const tier = tiers.find(t => t.id === portal.tierId);
    if (!tier) continue;
    const at = portal.angle * Math.PI / 180;
    const section = projectValue.sections.find(s => s.enabled && portal.angle >= s.start && portal.angle < s.end);
    const g = section ? resolveSectionTier(tier, section.id, projectValue) : tier;
    const front = modelPerimeterPoint(projectValue, surface, at, g.startOffset + (portal.firstRow - 1) * g.depth);
    const back = modelPerimeterPoint(projectValue, surface, at, g.startOffset + Math.min(g.rows, portal.lastRow) * g.depth);
    html += `<line x1="${front.x}" y1="${front.z}" x2="${back.x}" y2="${back.z}" stroke="#b96e32" stroke-width="${portal.width}" stroke-opacity=".75"/>`;
  }
  if (projectValue.outline.mode === 'custom') {
    const size = Math.max(2.1, lim * .017);
    projectValue.outline.points.forEach((p, i) => {
      const selected = i === outlineHandleIndex;
      html += `<circle data-handle="${i}" cx="${p.x}" cy="${p.z}" r="${size * (selected ? 1.3 : 1)}" fill="${selected ? '#fbc87b' : '#3f9b91'}" stroke="#ffffff" stroke-width=".85"/>`;
      if (selected) html += `<text x="${p.x + size * 1.6}" y="${p.z - size * 1.6}" fill="#61431b" font-size="${size * 2.4}" font-weight="bold">${i + 1}</text>`;
    });
  }
  svg.innerHTML = html;
  byId('outlineHint').textContent = projectValue.outline.mode === 'custom' ? `${projectValue.outline.points.length} editable anchors · double-click near boundary to insert` : 'Select Outline → Create editable outline to draw.';
}
const svg = byId('outlineSvg');
const positionFromPointer = event => {
  const point = svg.createSVGPoint();
  point.x = event.clientX; point.y = event.clientY;
  const transform = svg.getScreenCTM();
  if (!transform) return null;
  const local = point.matrixTransform(transform.inverse());
  return { x: Math.round(local.x * 10) / 10, z: Math.round(local.y * 10) / 10 };
};
let outlineDrag = null;
svg.addEventListener('click',event=>{
  const dot=event.target.closest('[data-real-seat]');if(!dot||!model)return;
  const seat=model.seats.find(p=>p.uid===dot.getAttribute('data-real-seat'));
  if(!seat)return;
  if(stadium){activateSeat(seat);}
  else{showSelection(seat);toast('Selected imported seat. A working 3D renderer is needed for eye view.');}
});
svg.addEventListener('pointerdown', event => {
  const handle = event.target.closest('[data-handle]');
  if (!handle || project.outline.mode !== 'custom') return;
  outlineHandleIndex = Number(handle.dataset.handle);
  outlineDrag = { pointerId: event.pointerId, index: outlineHandleIndex, valid: null };
  svg.setPointerCapture(event.pointerId);
  activeTab = 'outline'; renderTab(); renderOutlineSvg();
});
svg.addEventListener('pointermove', event => {
  if (!outlineDrag || event.pointerId !== outlineDrag.pointerId) return;
  const pos = positionFromPointer(event);
  if (!pos) return;
  const draft = deepCopy(project);
  draft.outline.points[outlineDrag.index] = pos;
  try {
    validateOutline(draft.outline.points, SURFACES[draft.surface]);
    outlineDrag.valid = pos;
    renderOutlineSvg(draft);
  } catch {
    byId('outlineHint').textContent = 'Invalid position: anchors must stay ordered and outside the pitch.';
  }
});
function finishOutlineDrag(event) {
  if (!outlineDrag || event.pointerId !== outlineDrag.pointerId) return;
  const { index, valid } = outlineDrag;
  outlineDrag = null;
  if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
  if (valid) commit(next => { next.outline.points[index] = valid; });
  else { renderTab(); renderOutlineSvg(); }
}
svg.addEventListener('pointerup', finishOutlineDrag);
svg.addEventListener('pointercancel', finishOutlineDrag);
svg.addEventListener('dblclick', event => {
  if (project.outline.mode !== 'custom' || project.outline.points.length >= 64) return;
  const position = positionFromPointer(event);
  if (!position) return;
  const angle = outlineAngle(position);
  const points = project.outline.points;
  let index = points.findIndex(p => outlineAngle(p) > angle);
  if (index < 0) index = points.length;
  // Insert a point on the current perimeter at the cursor bearing.
  const projected = modelPerimeterPoint(project, SURFACES[project.surface], angle, 0);
  commit(next => { next.outline.points.splice(index, 0, projected); });
  outlineHandleIndex = index; renderTab(); renderOutlineSvg();
});
byId('showOutlineTab').addEventListener('click', () => { activeTab = 'outline'; renderTab(); updateHeader(); });
byId('showAislesTab').addEventListener('click', () => { activeTab = 'aisles'; renderTab(); updateHeader(); });
byId('showPlanTab').addEventListener('click', () => { activeTab = 'plan'; renderTab(); updateHeader(); });
byId('focusImportedSeats').addEventListener('click',()=>{focusImported2D=!focusImported2D;renderOutlineSvg();});
byId('planUpload').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1_500_000 || !file.name.toLowerCase().endsWith('.svg')) throw new Error('Choose an SVG document below 1.5 MB.');
    const plan = parseSvgPlan(await file.text());
    plan.name = file.name.slice(0,80);
    const surface = SURFACES[project.surface];
    plan.scale = Number(((Math.max(surface.length, surface.width) + 70) / Math.max(plan.viewBox[2], plan.viewBox[3])).toFixed(5));
    commit(next => { next.plan = plan; });
    activeTab = 'plan'; selectedPlanPath = 0; renderTab(); show2DEditor();
    toast(`${plan.paths.length} SVG paths imported. Calibrate drawing width before tracing.`);
  } catch (error) { toast(`SVG import failed: ${error.message}`, true); }
  e.target.value = '';
});
byId('seatCsvUpload').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    if(file.size>32_000_000||!file.name.toLowerCase().endsWith('.csv'))throw new Error('Choose a UTF-8 CSV under 32 MB.');
    const rows=parseSeatCSV(await file.text());
    focusImported2D=true;
    if(!commit(next=>{next.survey.seats=rows;next.survey.mode='imported';next.survey.source=file.name.slice(0,150);}))return;
    activeTab='survey';renderTab();toast(`${num(rows.length)} seat rows loaded. Verify coordinate units and alignment.`);
  }catch(err){toast(`CSV import failed: ${err.message}`,true);}
  e.target.value='';
});
byId('referenceUpload').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 8_000_000) return toast('Reference must be a PNG/JPEG/WebP image up to 8 MB.', true);
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = URL.createObjectURL(file);
  renderOutlineSvg();
  toast('Reference added for visual tracing. It is not saved with the project.');
  e.target.value = '';
});
byId('referenceOpacity').addEventListener('input', e => { referenceOpacity = Number(e.target.value); renderOutlineSvg(); });
byId('clearReference').addEventListener('click', () => {
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = ''; renderOutlineSvg();
});

byId('newProject').addEventListener('click', () => { if (confirm('Create a new blank NFL stadium project?')) replaceProject(createProject()); });
byId('ohioVenueShortcut').addEventListener('click',()=>{if(confirm('Load Ohio Stadium reference? Unsaved edits will be replaced.')){activeTab='bowl';replaceProject(createOhioStadiumProject());toast('Ohio Stadium architectural reference loaded. Seat coordinates are estimated.');}});
byId('saveProject').addEventListener('click', saveSlot);
byId('openProject').addEventListener('click', () => { drawLibrary(); byId('projectDialog').showModal(); });
byId('projectDialog').addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button) return;
  const library = getStored(KEY_LIBRARY, {});
  if (button.dataset.loadSlot) {
    const entry = library[button.dataset.loadSlot];
    if (entry && replaceProject(entry.project)) { byId('projectDialog').close(); toast('Project opened.'); }
  } else if (button.dataset.deleteSlot) {
    if (confirm('Delete this saved snapshot?')) { delete library[button.dataset.deleteSlot]; putStored(KEY_LIBRARY, library); drawLibrary(); }
  }
});
byId('jsonImport').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    if (file.size > 32_000_000) throw new Error('Project file too large (maximum 32 MB).');
    const data = JSON.parse(await file.text());
    if (replaceProject(data.project || data)) { byId('projectDialog').close(); toast('Project imported.'); }
  } catch (error) { toast(`Import failed: ${error.message}`, true); }
  event.target.value = '';
});
byId('exportJson').addEventListener('click', exportProject);
byId('exportProjectAlt').addEventListener('click', exportProject);
byId('exportCsv').addEventListener('click', exportSeats);
byId('exportGlb').addEventListener('click', exportGlb);
byId('undoBtn').addEventListener('click', () => travel('undo'));
byId('redoBtn').addEventListener('click', () => travel('redo'));
function changeSeat(step) {
  if (!stadium || !model?.seats.length) return;
  const index = model.seats.indexOf(stadium.selectedSeat);
  const seat = model.seats[(index + step + model.seats.length) % model.seats.length];
  stadium.highlight(seat);
  if (view === 'seat') stadium.setView('seat');
  showSelection(seat);
}
byId('prevSeat').addEventListener('click', () => changeSeat(-1));
byId('nextSeat').addEventListener('click', () => changeSeat(1));
byId('screenshot').addEventListener('click', () => {
  if (!stadium) return toast('Renderer unavailable.', true);
  const anchor = document.createElement('a');
  anchor.download = `${slug()}-preview.png`;
  anchor.href = stadium.capture();
  anchor.click(); toast('Viewport screenshot downloaded.');
});
// Seat view operations intentionally remain local to a model. We do not claim
// simulated geometry is surveyed, and photos are never sent to a server.
function currentSeat() { return stadium?.selectedSeat || model?.seats[0] || null; }
function updateEyeOptions(patch) {
  viewOptions = validateViewOptions({...viewOptions,...patch});
  putStored('filedmaker.view.v1',viewOptions);
  if (stadium) stadium.setViewOptions(viewOptions);
  refreshViewPanel();
}
function activateSeat(seat, enterView = true) {
  if (!seat || !stadium) { toast('Seat unavailable or 3D engine is not running.',true);return; }
  stadium.highlight(seat);
  showSelection(seat);
  if (enterView) switchView('seat');
  refreshViewPanel();
}
function refreshBookmarks() {
  const select = byId('favoritesSelect');
  const selected = select.value;
  const filtered = bookmarks.filter(b=>b.project === project.title && b.surface === project.surface);
  select.replaceChildren(new Option('Choose a favorite',''));
  for(const b of filtered){select.add(new Option(b.title,b.uid));}
  if (filtered.some(b=>b.uid===selected)) select.value=selected;
}
function refreshViewPanel() {
  const seat = currentSeat();
  const info = byId('viewDiagnostics');
  if (!info) return;
  byId('humanViewHud').hidden = view !== 'seat' || !stadium;
  byId('phoneFrame').hidden = view !== 'seat' || viewOptions.optic !== 'phone' || !stadium;
  $all('[data-posture]').forEach(btn=>btn.classList.toggle('chosen',btn.dataset.posture===viewOptions.posture));
  $all('[data-optic]').forEach(btn=>btn.classList.toggle('chosen',btn.dataset.optic===viewOptions.optic));
  byId('zoomSlider').value=String(viewOptions.zoom);
  byId('zoomValue').textContent=`${viewOptions.zoom.toFixed(1)}×`;
  byId('viewTarget').value=viewOptions.target;
  byId('crowdMode').value=viewOptions.crowd;
  if (seat && model) {
    const p=viewpoint(seat,model.surface,viewOptions);
    const values=sightlineNote(seat,model.surface,viewOptions.posture);
    info.innerHTML=`<strong>${safe(seatDescriptor(seat))}</strong><br />Eye Y ${p.origin.y.toFixed(2)} m · target distance ≈ ${values.distance.toFixed(1)} m<br />Look-down angle ≈ ${values.downwardAngle.toFixed(1)}° · vertical FOV ${p.fov.toFixed(1)}°<br /><em>${safe(values.status)}</em>`;
    byId('hudSeat').textContent=seatDescriptor(seat);
    byId('hudPosition').textContent=`${viewOptions.posture} · ${viewOptions.optic} · ${viewOptions.zoom.toFixed(1)}× · ${values.distance.toFixed(1)} m`;
  } else {info.textContent='Select a seat to inspect the estimated eye position and playing-field distance.';}
  const s=project.survey,report=byId('surveyDiagnostics');
  let residual='No matched control landmarks';
  if(s.anchors.length>=2){try{const f=fitPlanRegistration(s.anchors);residual=`Landmark RMS ${f.rms.toFixed(2)} m · max ${f.maxError.toFixed(2)} m · ${f.count} points${f.count===2?' (no validation holdout)':''}`;}catch(e){residual=e.message;}}
  let block='Select a seat to evaluate modeled obstructions';
  if(seat&&model){const v=viewpoint(seat,model.surface,viewOptions);const o=obstructionReport(v.origin,v.target,s.obstacles);
    block=o.blocked?`Modeled sightline intersects ${o.nearest.type} (${o.nearest.obstacleId}) at ${o.nearest.distance.toFixed(1)} m`:'No manually modeled barrier intersects the target (NOT a certified clear view)';
  }
  report.textContent=`${model?.seatOrigin==='imported'?`${num(s.seats.length)} imported unverified seats`:'Illustrative generated seating'} · ${s.seats.filter(p=>p.y!==null).length} measured-elevation entries. ${residual}. ${block}.`;
  const bookmarked=seat&&bookmarks.some(b=>b.project===project.title&&b.surface===project.surface&&b.uid===seat.uid);
  byId('hudFavorite').textContent=bookmarked?'★ Saved':'☆ Save seat';
  byId('favoriteSeat').textContent=bookmarked?'★ Remove favorite':'☆ Favorite';
  refreshBookmarks();
}
function lookupSeat(query) {
  if (!model) return null;
  const text=String(query||'').trim().toUpperCase();
  const direct=model.seats.find(s=>s.uid.toUpperCase()===text); if(direct)return direct;
  if(model.seatOrigin==='imported'){
    const match=text.match(/^(.+?)\s+(?:ROW\s*)?([\w-]+)\s+(?:SEAT\s*)?([\w-]+)$/);
    if(match)return model.seats.find(s=>s.sectionId.toUpperCase()===match[1]&&String(s.row).toUpperCase()===match[2]&&String(s.number).toUpperCase()===match[3])||null;
  }
  const section=text.match(/\b([A-Z]{1,3}[-]?\d{1,3})\b/);
  const tier=text.match(/\bT([1-4])\b/);
  const row=text.match(/\b(?:ROW|R)\s*(\d+)\b/);
  const seat=text.match(/\b(?:SEAT|NO|NUMBER)\s*(\d+)\b/);
  const nums=(text.replace(/\b(?:S\d+|T\d+)\b/g,'').match(/\b\d+\b/g)||[]).map(Number);
  const sectionId=section?.[1] || currentSeat()?.sectionId;
  const rowNum=Number(row?.[1]??nums[0]);
  const seatNum=Number(seat?.[1]??nums[1]);
  const tierIndex=tier ? Number(tier[1])-1 : undefined;
  if(!sectionId || !Number.isInteger(rowNum) || !Number.isInteger(seatNum)) return null;
  return model.seats.find(s=>s.sectionId.toUpperCase()===sectionId && s.row===rowNum && s.number===seatNum && (tierIndex===undefined||s.tier===tierIndex))||null;
}
function findSeatFromForm(){
  const found=lookupSeat(byId('seatSearch').value);
  byId('seatSearchResult').textContent=found?seatDescriptor(found):'Seat not found. Example: S01 row 8 seat 12';
  if (found) activateSeat(found);
  else toast('Exact seat not found in this generated model.',true);
}
function favoriteSeat(){
  const seat=currentSeat();if(!seat)return toast('Select a seat first.',true);
  const key=b=>b.uid===seat.uid&&b.project===project.title&&b.surface===project.surface;
  if(bookmarks.some(key))bookmarks=bookmarks.filter(b=>!key(b));
  else bookmarks.push({uid:seat.uid,title:seatDescriptor(seat),project:project.title,surface:project.surface});
  bookmarks=bookmarks.slice(-75);
  putStored('filedmaker.bookmarks.v1',bookmarks);
  refreshViewPanel();
  toast(bookmarks.some(key)?'Seat saved in this browser.':'Favorite removed.');
}
function compareSeat(){
  if(!stadium||!model)return toast('3D renderer is required for view comparisons.',true);
  const seat=currentSeat();if(!seat)return toast('Select a seat first.',true);
  switchView('seat');
  // capture forces one rendered frame, even if animation has not yet repainted.
  comparison.push({title:seatDescriptor(seat),meta:`${viewOptions.posture} · ${viewOptions.optic} · ${viewOptions.zoom.toFixed(1)}×`,image:stadium.capture()});
  if(comparison.length>2)comparison.shift();
  toast(`Captured viewpoint ${comparison.length}/2. Open A / B to compare.`);
}
function renderComparison(){
  const target=byId('comparisonSlots');target.replaceChildren();
  for(let i=0;i<2;i++){
    const slot=comparison[i],card=document.createElement('section');card.className='compare-slot';
    if(slot){
      const img=document.createElement('img');img.src=slot.image;img.alt=`Captured view ${i+1}`;card.append(img);
      const h=document.createElement('h3');h.textContent=`${i?'B':'A'} · ${slot.title}`;card.append(h);
      const p=document.createElement('p');p.textContent=slot.meta;card.append(p);
    }else{const empty=document.createElement('div');empty.className='compare-empty';empty.textContent=`${i?'B':'A'} · Capture a seat view or select a local photo`;card.append(empty);}
    target.append(card);
  }
}
function addPhoto(file){
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>10*1024*1024) throw new Error('Choose PNG/JPEG/WebP images under 10 MB.');
  const url=URL.createObjectURL(file);
  localPhotos.push({url,name:file.name,seat:currentSeat()?seatDescriptor(currentSeat()):'Unassigned'});
  if(localPhotos.length>12)URL.revokeObjectURL(localPhotos.shift().url);
  renderPhotos();
}
function renderPhotos(){
  const el=byId('photoList');el.replaceChildren();
  if(!localPhotos.length){el.textContent='No reference photos uploaded';return;}
  localPhotos.forEach((photo,i)=>{
    const b=document.createElement('button');b.className='photo-button';b.title=`${photo.name} — ${photo.seat} · click to compare`;
    const im=document.createElement('img');im.src=photo.url;im.alt=`Photo reference ${i+1}`;b.append(im);
    b.addEventListener('click',()=>{comparison.push({image:photo.url,title:photo.name,meta:`Reference photograph · ${photo.seat} · unverified`});if(comparison.length>2)comparison.shift();renderComparison();byId('comparisonDialog').showModal();});
    el.append(b);
  });
}
byId('jumpSeatView').addEventListener('click',()=>{if(!stadium)return toast('3D engine unavailable.',true);switchView('seat');});
byId('focusSection').addEventListener('click',()=>{if(!stadium)return toast('3D engine unavailable.',true);switchView('section');});
byId('toggleInspector').addEventListener('click',()=>document.querySelector('.inspector').classList.toggle('inspector-open')); 
byId('hudReset').addEventListener('click',()=>updateEyeOptions({yaw:0,pitch:0,zoom:1}));
byId('hudCompare').addEventListener('click',compareSeat);
byId('hudFavorite').addEventListener('click',favoriteSeat);
byId('findSeat').addEventListener('click',findSeatFromForm);
byId('seatSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();findSeatFromForm();}});
byId('zoomSlider').addEventListener('input',e=>updateEyeOptions({zoom:Number(e.target.value)}));
byId('viewTarget').addEventListener('change',e=>updateEyeOptions({target:e.target.value,yaw:0,pitch:0}));
byId('crowdMode').addEventListener('change',e=>updateEyeOptions({crowd:e.target.value}));
$all('[data-posture]').forEach(b=>b.addEventListener('click',()=>updateEyeOptions({posture:b.dataset.posture})));
$all('[data-optic]').forEach(b=>b.addEventListener('click',()=>updateEyeOptions({optic:b.dataset.optic})));
$all('[data-seat-move]').forEach(b=>b.addEventListener('click',()=>{
  const next=nearbySeat(model,currentSeat(),b.dataset.seatMove);
  if(next)activateSeat(next);else toast('There is no seat in that direction within this section.',true);
}));
byId('favoriteSeat').addEventListener('click',favoriteSeat);
byId('favoritesSelect').addEventListener('change',e=>{const seat=model?.seats.find(s=>s.uid===e.target.value);if(seat)activateSeat(seat);});
byId('addComparison').addEventListener('click',compareSeat);
byId('openCompare').addEventListener('click',()=>{renderComparison();byId('comparisonDialog').showModal();});
byId('closeComparison').addEventListener('click',()=>byId('comparisonDialog').close());
byId('swapComparison').addEventListener('click',()=>{comparison.reverse();renderComparison();});
byId('clearComparison').addEventListener('click',()=>{comparison=[];renderComparison();});
byId('shareSeat').addEventListener('click',async()=>{
  const seat=currentSeat();if(!seat)return toast('Select a seat first.',true);
  const url=new URL(location.href);
  url.hash=new URLSearchParams({seat:seat.uid,posture:viewOptions.posture,optic:viewOptions.optic,zoom:String(viewOptions.zoom)}).toString();
  try {await navigator.clipboard.writeText(url.href);toast('Local model seat link copied. Requires the same project/browser.');}
  catch {window.prompt('Copy local model seat link (same browser/project only):',url.href);}
});
byId('viewPhotoUpload').addEventListener('change',event=>{
  try{for(const f of [...event.target.files].slice(0,12))addPhoto(f);toast(`${localPhotos.length} local photo(s) available for comparison.`);}
  catch(error){toast(error.message,true);}
  event.target.value='';
});
function applySeatLink(){
  const params=new URLSearchParams(location.hash.slice(1));
  if(!params.has('seat')||!model||!stadium)return;
  const seat=model.seats.find(s=>s.uid===params.get('seat'));
  if(seat){activateSeat(seat);updateEyeOptions({posture:params.get('posture')||'seated',optic:params.get('optic')||'human',zoom:Number(params.get('zoom')||1)});}
}
// Local photograph registration. Only calibration correspondences are persisted.
function refreshCalibrationDialog(){
  const list=fieldLandmarks(SURFACES[project.surface]);
  const select=byId('calibrationLandmark'),previous=select.value;
  select.innerHTML=list.map(l=>`<option value="${safe(l.id)}">${safe(l.name)}</option>`).join('');
  if(list.some(l=>l.id===previous)) select.value=previous;
  const marks=byId('calibrationMarks');marks.replaceChildren();
  const photo=byId('calibrationPhoto');
  if(calibrationPhoto){photo.src=calibrationPhoto.url;photo.hidden=false;byId('calibrationEmpty').hidden=true;}
  else {photo.hidden=true;byId('calibrationEmpty').hidden=false;}
  for(const [i,point] of calibrationPoints.entries()){
    const div=document.createElement('span');div.className='calibration-marker';div.style.left=`${point.x*100}%`;div.style.top=`${point.y*100}%`;
    div.title=`${point.id} (${(point.x*100).toFixed(1)}%, ${(point.y*100).toFixed(1)}%)`;
    div.textContent=String(i+1);marks.append(div);
  }
  byId('calibrationPoints').textContent=`${calibrationPoints.length} distinct field landmark${calibrationPoints.length===1?'':'s'} selected`;
}
byId('openPhotoCalibration').addEventListener('click',()=>{
  const seat=currentSeat();if(!seat)return toast('Choose a seat before calibrating its camera.',true);
  calibrationPoints=[];lastPhotoFit=null;
  refreshCalibrationDialog();byId('photoCalibrationDialog').showModal();
});
byId('editSurvey').addEventListener('click',()=>{activeTab='survey';renderTab();updateHeader();document.querySelector('.sidebar-scroll')?.scrollTo({top:1000,behavior:'smooth'});});
byId('closePhotoCalibration').addEventListener('click',()=>byId('photoCalibrationDialog').close());
byId('calibrationPhotoInput').addEventListener('change',event=>{
  const f=event.target.files?.[0];if(!f)return;
  if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>12_000_000){toast('Use a PNG, JPEG or WebP photo under 12 MB.',true);return;}
  if(calibrationPhoto?.url)URL.revokeObjectURL(calibrationPhoto.url);
  const url=URL.createObjectURL(f);
  const img=new Image();img.onload=()=>{calibrationPhoto={url,width:img.naturalWidth,height:img.naturalHeight,name:f.name};calibrationPoints=[];refreshCalibrationDialog();};
  img.onerror=()=>{URL.revokeObjectURL(url);toast('Photo could not be decoded.',true);};
  img.src=url;event.target.value='';
});
byId('calibrationPhoto').addEventListener('click',event=>{
  if(!calibrationPhoto)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
  if(x<0||x>1||y<0||y>1)return;
  const id=byId('calibrationLandmark').value;
  calibrationPoints=calibrationPoints.filter(p=>p.id!==id);
  calibrationPoints.push({id,x,y});
  lastPhotoFit=null;
  byId('calibrationResult').textContent=`Marked ${id}. Set the next landmark and click its position.`;
  refreshCalibrationDialog();
});
byId('clearCalibrationMarks').addEventListener('click',()=>{calibrationPoints=[];lastPhotoFit=null;refreshCalibrationDialog();byId('calibrationResult').textContent='Photo markers cleared.';});
byId('fitCalibrationCamera').addEventListener('click',()=>{
  try{
    if(!calibrationPhoto)throw new Error('Load a reference photo first.');
    if(!currentSeat()||!model)throw new Error('Select a seat first.');
    if(model.seatOrigin==='imported' && currentSeat().elevationKnown===false)throw new Error('This imported seat has no measured elevation. Camera calibration requires a known seat height.');
    const f=fitPhotoView({points:calibrationPoints,width:calibrationPhoto.width,height:calibrationPhoto.height,seat:currentSeat(),surface:model.surface,posture:viewOptions.posture,target:viewOptions.target,
      initial:{yaw:viewOptions.yaw,pitch:viewOptions.pitch,fov:67/viewOptions.zoom}});
    lastPhotoFit=f;
    if(f.rmsPx>Math.max(12,calibrationPhoto.height*0.02)){
      byId('calibrationResult').textContent=`Calibration rejected: RMS reprojection ${f.rmsPx.toFixed(1)} px across ${f.marks} landmarks. Recheck landmark identities, click coordinates, photo crop, seat coordinates and camera model. No camera or saved project values were changed.`;
      return;
    }
    byId('calibrationResult').textContent=`Estimated yaw ${f.yaw.toFixed(2)}°, pitch ${f.pitch.toFixed(2)}°, vertical FOV ${f.fov.toFixed(2)}°. RMS reprojection ${f.rmsPx.toFixed(1)} px; worst ${f.maxErrorPx.toFixed(1)} px. ${f.status}. ${f.rmsPx>20?'High residual: check seat coordinates and selected landmarks.':'Compare against additional photographs before trusting this estimate.'}`;
    const selectedId=currentSeat().uid;
    commit(next=>{next.survey.photoCheck={seatId:selectedId,points:calibrationPoints.map(p=>({...p})),width:calibrationPhoto.width,height:calibrationPhoto.height,yaw:f.yaw,pitch:f.pitch,fov:f.fov,rmsPx:f.rmsPx,maxErrorPx:f.maxErrorPx};});
    updateEyeOptions({optic:'phone',yaw:f.yaw,pitch:f.pitch,zoom:f.zoom});
    switchView('seat');
    toast('Camera view aligned to photo landmarks. This does not certify seat coordinates.');
  }catch(err){byId('calibrationResult').textContent=err.message;toast(err.message,true);}
});
byId('retryRender').addEventListener('click', () => location.reload());
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const key = e.key.toLowerCase();
  if (key === 'z') { e.preventDefault(); travel(e.shiftKey ? 'redo' : 'undo'); }
  else if (key === 'y') { e.preventDefault(); travel('redo'); }
  else if (key === 's') { e.preventDefault(); saveSlot(); }
});
renderTab(); updateHeader(); scheduleModel(); syncOutlineVisibility();
try {
  const { StadiumScene } = await import('./scene.js');
  stadium = new StadiumScene(byId('stadiumCanvas'), seat => { showSelection(seat); refreshViewPanel(); }, sectionId => { showSection(sectionId); });
  stadium.setViewOptions(viewOptions);
  if (model) { stadium.load(model); updateStats(); applySeatLink(); }
  refreshViewPanel();
  rendererFailed = false;
  byId('renderError').hidden = true;
} catch (error) {
  console.error('Failed to initialize 3D renderer', error);
  rendererFailed = true;
  byId('renderErrorMessage').textContent = `Unable to load the 3D engine. Check internet access to the Three.js CDN, WebGL support, and browser developer console. ${error.message}`;
  byId('renderError').hidden = view === 'outline';
  byId('bottomStatus').textContent = '3D renderer unavailable — JSON and CSV editing still works';
}
