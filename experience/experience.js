// FiledMaker Live: event/venue navigation around the shared seat renderer.
// All positions come from the rendered reference model, not a ticket API.
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const venue = q.get('venue') === 'ohio' ? 'ohio' : 'schott';
const layout = q.get('layout') === 'concert' ? 'concert' : 'sports';
$('venueChoice').value = venue;
$('eventChoice').value = layout;
const setRoute = (key, value) => {
  const next = new URL(location.href);
  next.searchParams.set(key, value);
  if (key === 'venue') next.hash = '';
  location.assign(next.href);
};
$('venueChoice').addEventListener('change', e => setRoute('venue', e.target.value));
$('eventChoice').addEventListener('change', e => setRoute('layout', e.target.value));
$('venueDisclaimer').textContent = venue === 'ohio'
  ? 'Ohio Stadium · 历史建筑参考，座椅与分区坐标为估算'
  : 'Schottenstein Center · 官方图纸参考，排座高度与视角为估算';
$('school').textContent = venue === 'ohio' ? 'COLUMBUS · OHIO STADIUM' : 'COLUMBUS · SCHOTTENSTEIN CENTER';

let app;
let photos = [];
let filter = 'all';

function reflectView(mode) {
  document.querySelectorAll('[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === mode);
  });
}
function renderGallery() {
  const selected = app?.selected();
  const visible = filter === 'section' ? photos.filter(photo => photo.section === selected?.sectionId) : photos;
  $('photoCount').textContent = photos.length + ' 张本地实拍';
  const holder = $('galleryList');
  holder.replaceChildren();
  if (!visible.length) {
    const blank = document.createElement('div');
    blank.className = 'empty-gallery';
    const heading = document.createElement('strong');
    heading.textContent = photos.length && filter === 'section' ? '当前分区没有实拍' : '还没有现场照片';
    const note = document.createElement('p');
    note.textContent = photos.length && filter === 'section'
      ? '切换到全部实拍，或上传当前分区的照片。'
      : '选择本地照片后可预览，与模拟视角比较。本站不会自动上传照片。';
    blank.append(heading, note);
    holder.append(blank);
    return;
  }
  for (const photo of visible) {
    const item = document.createElement('article');
    item.className = 'gallery-card';
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = 'User-provided local venue photo';
    const label = document.createElement('span');
    label.textContent = photo.section ? photo.section + ' · 本地照片' : '未选择分区 · 本地照片';
    item.append(image, label);
    holder.append(item);
  }
}
function refreshPosition() {
  const selected = app?.selected();
  if (!selected) return;
  const section = selected.sectionId;
  const seats = app.seats().filter(seat => seat.sectionId === section);
  if (!seats.length) return;
  const rows = new Map();
  for (const seat of seats) {
    const key = String(seat.row);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(seat);
  }
  const ordered = [...rows.entries()].sort((a,b) => {
    const radius = group => group[1].reduce((sum,s) => sum + Math.hypot(s.x,s.z),0)/group[1].length;
    return radius(a) - radius(b);
  });
  const rowIndex = Math.max(0,ordered.findIndex(([,group])=>group.some(s=>s.uid===selected.uid)));
  const peers = ordered[rowIndex]?.[1] || [];
  const horizontalX = (Math.max(...peers.map(s=>s.x))-Math.min(...peers.map(s=>s.x))) >
    (Math.max(...peers.map(s=>s.z))-Math.min(...peers.map(s=>s.z)));
  const orderedPeers = peers.slice().sort((a,b) => horizontalX ? a.x-b.x : a.z-b.z);
  const colIndex = Math.max(0,orderedPeers.findIndex(s=>s.uid===selected.uid));
  const depth = ordered.length > 1 ? Math.round(100*rowIndex/(ordered.length-1)) : 50;
  const lateral = orderedPeers.length > 1 ? Math.round(100*colIndex/(orderedPeers.length-1)) : 50;
  $('depthRange').value = String(depth);
  $('lateralRange').value = String(lateral);
  $('depthValue').textContent = depth + '%';
  $('lateralValue').textContent = lateral + '%';
  $('rowInput').value = String(selected.row);
  $('seatInput').value = String(selected.number);
  renderGallery();
}
function pickBySliders() {
  let section = $('section').value;
  if (!section || section === 'all') section = app.selected()?.sectionId || app.seats()[0]?.sectionId;
  const seats = app.seats().filter(seat => seat.sectionId === section);
  if (!seats.length) return;
  const rows = new Map();
  for (const seat of seats) {
    const key = String(seat.row);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(seat);
  }
  const ordered = [...rows.values()].sort((a,b)=>{
    const radius = group => group.reduce((sum,s)=>sum+Math.hypot(s.x,s.z),0)/group.length;
    return radius(a)-radius(b);
  });
  const row = ordered[Math.round((Number($('depthRange').value)/100)*(ordered.length-1))];
  if (!row?.length) return;
  const horizontalX = Math.max(...row.map(s=>s.x))-Math.min(...row.map(s=>s.x)) >
    Math.max(...row.map(s=>s.z))-Math.min(...row.map(s=>s.z));
  row.sort((a,b)=>horizontalX?a.x-b.x:a.z-b.z);
  const seat = row[Math.round(Number($('lateralRange').value)/100*(row.length-1))];
  if (seat) app.pick(seat.uid);
}
function locateEntry() {
  let section = $('section').value;
  if (!section || section === 'all') section = app.selected()?.sectionId || '';
  const row = $('rowInput').value.trim();
  const number = $('seatInput').value.trim();
  const list = app.seats().filter(s=>(!section||s.sectionId===section) &&
    (!row||String(s.row).toLowerCase()===row.toLowerCase()) &&
    (!number||String(s.number).toLowerCase()===number.toLowerCase()));
  if (!list.length) {
    $('lookupNote').textContent='未找到对应的排座。请核对当前模型的分区与座位编号。';
    return;
  }
  app.pick(list[Math.floor(list.length/2)].uid);
  $('lookupNote').textContent='已定位到对应位置。座位坐标仍为模拟估算。';
}
function init() {
  app = window.filedmakerExperience;
  if (!app) return;
  const levels = new Set(app.seats().map(seat=>String(seat.tier)));
  document.querySelectorAll('[data-level]').forEach(button=>{
    if (button.dataset.level !== 'all' && !levels.has(button.dataset.level)) {
      button.disabled = true;
      button.title = '此场馆没有这个看台层级';
    }
    button.addEventListener('click', () => {
      const tier = button.dataset.level;
      $('tier').value = tier;
      $('tier').dispatchEvent(new Event('change'));
      document.querySelectorAll('[data-level]').forEach(b=>b.classList.toggle('active',b===button));
    });
  });
  document.querySelectorAll('[data-view]').forEach(button=> {
    button.addEventListener('click',()=>reflectView(button.dataset.view));
  });
  $('section').addEventListener('change',()=>{
    $('rowInput').value = '';
    $('seatInput').value = '';
    renderGallery();
  });
  $('locatePosition').addEventListener('click',locateEntry);
  for (const id of ['rowInput','seatInput']) {
    $(id).addEventListener('keydown',event=>{if(event.key==='Enter')locateEntry();});
  }
  for (const id of ['depthRange','lateralRange']) {
    $(id).addEventListener('input',()=>{
      $('depthValue').textContent=$('depthRange').value+'%';
      $('lateralValue').textContent=$('lateralRange').value+'%';
    });
    $(id).addEventListener('change',pickBySliders);
  }
  $('openMap').addEventListener('click',()=>{
    app.view('map');
    reflectView('map');
    document.querySelector('.viewer-panel').scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.querySelectorAll('[data-photo-filter]').forEach(button=>button.addEventListener('click',()=>{
    filter=button.dataset.photoFilter;
    document.querySelectorAll('[data-photo-filter]').forEach(b=>b.classList.toggle('active',b===button));
    renderGallery();
  }));
  $('uploadPhoto').addEventListener('click',()=>$('photo').click());
  $('photo').addEventListener('change',event=>{
    const file=event.target.files?.[0];
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>10_000_000) return;
    const url=URL.createObjectURL(file);
    photos.push({url,section:app.selected()?.sectionId||''});
    renderGallery();
  });
  new MutationObserver(refreshPosition).observe($('selected'),{childList:true});
  const currentHash = new URLSearchParams(location.hash.slice(1));
  if (!currentHash.has('seat')) {
    const seats = app.seats();
    const initial = seats.find(s=>s.tier===0 && Number(s.row)===7) || seats.find(s=>s.tier===0) || seats[0];
    if (initial) app.pick(initial.uid);
  }
  renderGallery();
  if (window.innerWidth>700) {
    app.view('orbit');
    reflectView('orbit');
  }
}
if (window.filedmakerExperience) init();
else window.addEventListener('filedmaker:ready',init,{once:true});
