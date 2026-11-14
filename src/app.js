import { CURRENT_SCHEMA, SURFACES, TAU, createProject, makeSections, validateProject, generateSeats, sectionStats, deepCopy, createCustomOutline, modelPerimeterPoint, outlineAngle, validateOutline, resolveTiers } from './model.mjs';

const byId = id => document.getElementById(id);
const $all = selector => [...document.querySelectorAll(selector)];
const KEY_CURRENT = 'filedmaker.current.v1';
const KEY_LIBRARY = 'filedmaker.library.v1';
const num = value => Number(value).toLocaleString('en-US');
const safe = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const getStored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const putStored = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
let project;
try { project = validateProject(getStored(KEY_CURRENT, createProject())); }
catch { project = createProject(); }
let activeTab = 'bowl';
let activeSectionId = project.sections[0].id;
let outlineHandleIndex = 0;
let referenceUrl = '';
let referenceOpacity = 0.35;
let rendererFailed = false;
let model = null;
let stadium = null;
let renderVersion = 0;
let history = [], future = [];
let toastTimer;
let view = 'orbit';
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
    html += `<label class="toggle-row"><input data-project="roof" type="checkbox" ${project.roof ? 'checked' : ''} /> Show schematic roof canopy</label>`;
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
    html += `<div class="hint">Section boundaries are generated at equal angles. Edit the number of sections to rebuild the layout.</div></div>`;
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
  byId('viewportSubtitle').textContent = `${surface.label} · ${project.city || 'Custom venue'} · Parametric draft`;
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
  target.innerHTML = `<strong>${safe(section.label)} · Row ${seat.row}</strong><p>${safe(tier.label)} · Seat ${seat.number}<br />Section capacity ${num(stats.seats)} seats</p><code>X ${seat.x.toFixed(2)} · Y ${seat.y.toFixed(2)} · Z ${seat.z.toFixed(2)} m</code>`;
}
function updateStats() {
  if (!model) return;
  byId('capacityValue').textContent = num(model.capacity);
  byId('tierCount').textContent = model.tiers.length;
  byId('sectionCount').textContent = model.project.sections.filter(s => s.enabled).length;
  byId('fieldSize').textContent = `${model.surface.length.toFixed(0)}×${model.surface.width.toFixed(0)}`;
  byId('bottomStatus').textContent = `${num(model.capacity)} seats · ${model.project.sections.filter(s => s.enabled).length} active sections · ${model.tiers.length} tier(s)`;
  byId('modelVersion').textContent = `SCHEMA v${CURRENT_SCHEMA}`;
  showSelection();
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
    outlineHandleIndex = Math.min(outlineHandleIndex, project.outline.points.length - 1);
    renderTab(); updateHeader(); scheduleModel();
  } catch (error) { toast(error.message, true); renderTab(); }
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
  if (input.dataset.project) {
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
  } else if (input.id === 'sectionCountInput') {
    const count = Number(input.value);
    if (count === project.sections.length) return;
    if (confirm('Rebuild the section layout? Custom section names, colors and enabled states will be reset.')) {
      commit(next => { next.sections = makeSections(count); });
      activeSectionId = project.sections[0].id;
    } else renderTab();
  }
});
byId('tabContent').addEventListener('click', e => {
  const target = e.target.closest('button'); if (!target) return;
  if (target.dataset.addTier !== undefined) {
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
  }
});
$all('[data-tab]').forEach(button => button.addEventListener('click', () => { activeTab = button.dataset.tab; renderTab(); updateHeader(); }));
$all('[data-preset]').forEach(button => button.addEventListener('click', () => {
  const label = button.textContent.trim().replace(/\s+/g, ' ');
  if (confirm(`Start a new ${label} model? The current project will remain available if you saved a snapshot or downloaded JSON.`)) {
    activeTab = 'bowl'; replaceProject(createProject(button.dataset.preset));
  }
}));
$all('[data-view]').forEach(button => button.addEventListener('click', () => {
  view = button.dataset.view;
  $all('[data-view]').forEach(item => item.classList.toggle('active', item === button));
  syncOutlineVisibility();
  if (stadium) stadium.setView(view === 'outline' ? 'plan' : view);
  else if (view !== 'outline') toast('3D rendering not yet available.', true);
}));
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
  const margin = outer.startOffset + outer.rows * outer.depth + 15;
  const lim = Math.min(430, Math.max(surface.length / 2, surface.width / 2) + margin + 14);
  svg.setAttribute('viewBox', `${-lim} ${-lim} ${2 * lim} ${2 * lim}`);
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
  for (let i = tiers.length - 1; i >= 0; i--) {
    const tier = tiers[i];
    const outerMargin = tier.startOffset + tier.rows * tier.depth;
    html += `<path d="${svgPath(projectValue, surface, outerMargin)}" fill="#bfd0d2" fill-opacity=".32" stroke="${['#739e98','#8c9bb1','#caa880','#a4aab8'][i]}" stroke-width=".85"/>`;
    html += `<path d="${svgPath(projectValue, surface, tier.startOffset)}" fill="none" stroke="#96a5a8" stroke-width=".6" stroke-dasharray="2 2"/>`;
  }
  html += `<path d="${basePath}" fill="#e7eceb" stroke="#628980" stroke-width=".7"/>${field}`;
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
    if (file.size > 2_000_000) throw new Error('Project file too large (maximum 2 MB).');
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
  stadium = new StadiumScene(byId('stadiumCanvas'), seat => { showSelection(seat); }, sectionId => { showSection(sectionId); });
  if (model) { stadium.load(model); updateStats(); }
  rendererFailed = false;
  byId('renderError').hidden = true;
} catch (error) {
  console.error('Failed to initialize 3D renderer', error);
  rendererFailed = true;
  byId('renderErrorMessage').textContent = `Unable to load the 3D engine. Check internet access to the Three.js CDN, WebGL support, and browser developer console. ${error.message}`;
  byId('renderError').hidden = view === 'outline';
  byId('bottomStatus').textContent = '3D renderer unavailable — JSON and CSV editing still works';
}
