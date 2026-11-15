import { NCAA_BASKETBALL_VENUES } from '../venueCatalog.mjs';
import { buildSurveyPointPlan, readSeatSurvey } from '../officialSeatSurvey.mjs';
import { NativeVenueRenderer } from './webgl.js';

const $ = id => document.getElementById(id);
const venue = NCAA_BASKETBALL_VENUES['ohio-state-men'];
const chart = venue.seatingChart;
const sections = new Map(chart.sections.map(section => [section.id, section]));
const tabs = [...document.querySelectorAll('[data-mode]')];
const panels = {chart: $('chartPanel'), official: $('officialPanel'), survey: $('surveyPanel')};
const frame = $('officialFrame');
const image = $('seatChart');
const marker = $('sectionMarker');
const mapScroll = $('mapScroll');
const chartElement = $('chart');
const sectionPicker = $('section');
const format = new Intl.NumberFormat('en-US');
let renderer, zoom = 1, selectedSection = '', loadedSurveyCount = 0, importRevision = 0;

for (const [id, url] of Object.entries({
  launchOfficial: venue.virtualVenue.url,
  officialLink: venue.virtualVenue.url,
  selectionGuide: venue.virtualVenue.guide,
  chartFile: chart.image,
  capacitySource: venue.capacity.source,
  athleticsCharts: chart.source,
  boardSource: venue.videoBoard.source,
})) $(id).href = url;

$('venueName').textContent = venue.name;
$('venueSubtitle').textContent = `${venue.university} · ${venue.configuration}`;
$('venueLocation').textContent = `${venue.arena} · ${venue.city}`;
$('publishedCapacity').textContent = format.format(venue.capacity.value);

for (const id of [...sections.keys()].sort((a, b) => a.localeCompare(b, 'en', {numeric:true}))) {
  sectionPicker.add(new Option(id, id));
}

function show(mode) {
  for (const [id, panel] of Object.entries(panels)) panel.hidden = id !== mode;
  for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
  if (mode === 'official' && !frame.hasAttribute('src')) frame.src = venue.virtualVenue.url;
  if (mode === 'survey') renderer?.resize();
}

function updateChartSize() {
  if (chartElement.hidden || panels.chart.hidden) return;
  const fit = Math.min(mapScroll.clientWidth, mapScroll.clientHeight * chart.width / chart.height);
  chartElement.style.width = `${Math.round(fit * zoom)}px`;
  $('zoomOut').disabled = zoom === 1;
  $('zoomIn').disabled = zoom === 3;
}

function positionMarker(center = false) {
  const section = sections.get(selectedSection);
  marker.hidden = !section;
  $('chartStatus').textContent = section
    ? `Section ${section.id} · ${section.level} level`
    : 'Ohio State Athletics seating chart';
  if (!section) return;
  marker.textContent = section.id;
  marker.style.left = `${section.x / chart.width * 100}%`;
  marker.style.top = `${section.y / chart.height * 100}%`;
  if (!center || chartElement.hidden) return;
  const x = Math.max(0, (mapScroll.clientWidth - chartElement.clientWidth) / 2) + chartElement.clientWidth * section.x / chart.width;
  const y = chartElement.clientHeight * section.y / chart.height;
  mapScroll.scrollTo(x - mapScroll.clientWidth / 2, y - mapScroll.clientHeight / 2);
}

function setZoom(value) {
  zoom = Math.max(1, Math.min(3, value));
  updateChartSize();
  positionMarker(true);
}

for (const tab of tabs) tab.onclick = () => {
  show(tab.dataset.mode);
  if (tab.dataset.mode === 'chart') updateChartSize();
};
$('zoomOut').onclick = () => setZoom(zoom - .5);
$('zoomIn').onclick = () => setZoom(zoom + .5);
$('resetChart').onclick = () => {
  setZoom(1);
  mapScroll.scrollTo(0, 0);
};
sectionPicker.onchange = () => {
  selectedSection = sectionPicker.value;
  positionMarker(true);
};
image.addEventListener('click', event => {
  const rect = image.getBoundingClientRect();
  const x = (event.clientX - rect.left) * chart.width / rect.width;
  const y = (event.clientY - rect.top) * chart.height / rect.height;
  let best = null, distance = 27;
  for (const section of sections.values()) {
    const d = Math.hypot(x - section.x, y - section.y);
    if (d < distance) { best = section; distance = d; }
  }
  if (!best) return;
  sectionPicker.value = selectedSection = best.id;
  positionMarker();
});
image.addEventListener('load', () => {
  chartElement.hidden = false;
  $('mapMessage').hidden = true;
  updateChartSize();
  positionMarker(true);
});
image.addEventListener('error', () => {
  $('mapMessage').textContent = 'The chart is unavailable here. Use the full-size chart link or the Ohio State seating charts page.';
});
image.src = chart.image;
new ResizeObserver(updateChartSize).observe(mapScroll);

$('surveyFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const revision = ++importRevision;
  event.target.value = '';
  try {
    if (file.size > 32_000_000) throw new Error('The CSV exceeds 32 MB.');
    const seats = readSeatSurvey(await file.text());
    if (revision !== importRevision) return;
    const plan = buildSurveyPointPlan(seats, venue.surface);
    renderer ??= new NativeVenueRenderer($('surveyCanvas'), seat => {
      renderer.highlight(seat);
      $('surveyResult').textContent = `Section ${seat.sectionId} · Row ${seat.row} · Seat ${seat.number} · ${seat.x} m, ${seat.y} m, ${seat.z} m`;
    });
    renderer.load(plan);
    loadedSurveyCount = seats.length;
    tabs.find(tab => tab.dataset.mode === 'survey').hidden = false;
    $('surveyStatus').textContent = `${format.format(seats.length)} points loaded from ${file.name}.`;
    $('surveyResult').textContent = 'Drag to orbit, scroll to zoom, or select a point for its supplied seat identity.';
    show('survey');
  } catch (error) {
    if (revision !== importRevision) return;
    $('surveyStatus').textContent = loadedSurveyCount
      ? `${error.message} The current survey stays loaded.`
      : error.message;
  }
});
