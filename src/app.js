import { CURRENT_SCHEMA, SURFACES, createProject, makeSections, validateProject, generateSeats, sectionStats, deepCopy } from './model.mjs';

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
    view = 'orbit';
    $all('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
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
  byId('savedProjects').innerHTML = entries.length ? entries.map(([key, value]) => `<div class="saved-entry"><div><strong>${safe(value.name)}</strong><small>${safe(new Date(value.saved).toLocaleString())}</small></div><div><button data-load-slot="${safe(key)}">Open</button><button class="delete" data-delete-slot="${safe(key)}" aria-label="Delete project">×</button></div></div>`).join('') : '<p class="hint">No saved snapshots yet. Use “Save locally” in the sidebar, or import an existing project.</p>';
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
    if (confirm(`Remove ${project.tiers[index].label}?`)) commit(next => next.tiers.splice(index, 1));
  } else if (target.dataset.pickSection) showSection(target.dataset.pickSection);
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
  if (stadium) stadium.setView(view);
  else toast('3D rendering not yet available.', true);
}));
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
renderTab(); updateHeader(); scheduleModel();
try {
  const { StadiumScene } = await import('./scene.js');
  stadium = new StadiumScene(byId('stadiumCanvas'), seat => { showSelection(seat); }, sectionId => { showSection(sectionId); });
  if (model) { stadium.load(model); updateStats(); }
  byId('renderError').hidden = true;
} catch (error) {
  console.error('Failed to initialize 3D renderer', error);
  byId('renderErrorMessage').textContent = `Unable to load the 3D engine. Check internet access to the Three.js CDN, WebGL support, and browser developer console. ${error.message}`;
  byId('renderError').hidden = false;
  byId('bottomStatus').textContent = '3D renderer unavailable — JSON and CSV editing still works';
}
