// Standalone school seat-selection PREVIEW generator.
// No checkout, holds, inventory counts or booking claims. Local selection only.
import { generateSeats } from './model.mjs';
import { buildVenuePlan } from './next/venuePlan.mjs';
import { schoolReadiness } from './schoolPipeline.mjs';
import { BLUE_TIERS, ticketReconciliation } from './seatFirst.mjs';
import { seatColor, seatKind } from './seatPresentation.mjs';
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scriptJSON = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
export function buildSchoolViewerHTML(input) {
  const model=generateSeats(input),project=model.project;
  if(model.seats.length>40000) throw new Error('The standalone preview supports at most 40,000 seat locations. Use a hosted delivery for larger venues.');
  const readiness=schoolReadiness(project,model);
  const reconciliation=ticketReconciliation(project,model.seats.length);
  const payload={name:project.school?.venue||project.title,school:project.school?.school||'School venue',
    surface:model.surface,seatOrigin:readiness.sourceMethod,officialCapacity:reconciliation.officialCapacity,capacityStatus:reconciliation.status,tierColors:[0,1,2,3].map(t=>seatColor(project,t,0)),sections:project.sections.map(s=>({id:s.id,label:s.label})),
    seats:model.seats.map(s=>({id:String(s.uid),tier:Number(s.tier),section:String(s.sectionId),row:String(s.row),seat:String(s.number),x:Number(s.x.toFixed(3)),y:Number(s.y.toFixed(3)),z:Number(s.z.toFixed(3)),yaw:Number((s.yaw||0).toFixed(4)),style:seatKind(project,s),color:seatColor(project,s.tier,s.sectionIndex)}))};
  const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(payload.name)} | Seat Preview</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#242424;background:#f7f7f6;font-size:14px}*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button{cursor:pointer}header{padding:17px 24px;background:white;border-bottom:1px solid #e5e5e5;display:flex;justify-content:space-between;align-items:center;gap:12px}h1{font-size:19px;margin:2px 0}p{margin:0}.sub,.note{color:#666;font-size:12px}.pill{display:inline-flex;border:1px solid #ddd;border-radius:99px;padding:7px 10px;font-size:11px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;height:calc(100vh - 104px);min-height:450px}.viewport{background:#f1f5f9;position:relative;overflow:hidden}.map{width:100%;height:100%;display:block;touch-action:pan-x pan-y}.seat{cursor:pointer;stroke:#fff;stroke-width:.18;fill:#2875ae}.seat:hover,.seat.active{fill:#ed943d;stroke:#111;stroke-width:.65}.court{fill:#d8bf9b;stroke:#fff;stroke-width:.15}.field{fill:#468367;stroke:#fff;stroke-width:.18}.toolbar{position:absolute;left:14px;top:14px;display:flex;gap:8px;flex-wrap:wrap}button{border:1px solid #ddd;background:#fff;border-radius:10px;padding:9px 12px}button.selected{background:#242424;color:white}aside{padding:22px;border-left:1px solid #e0e0dd;background:white;overflow:auto}aside>*{margin-bottom:16px}label{display:block;font-size:12px;color:#606060;margin:0 0 6px}input,select{width:100%;height:40px;border:1px solid #ddd;border-radius:10px;padding:8px;background:white}strong.title{font-size:16px;display:block}.info{border-radius:12px;background:#f5f5f4;padding:14px;line-height:1.8;min-height:125px}.primary{background:#222;color:white;border-color:#222;width:100%}.warning{border:1px solid #e3d1b2;background:#fffaf1;border-radius:12px;padding:11px;color:#725431;font-size:12px;line-height:1.5}.bottom{padding:9px 22px;font-size:11px;color:#777;background:white;border-top:1px solid #ddd}#webgl{width:100%;height:100%;display:none}#loadError{position:absolute;left:15px;bottom:15px;max-width:520px;background:#fff;border:1px solid #ddd;padding:12px;border-radius:10px;display:none}.empty{fill:#767676}@media(max-width:800px){.layout{height:auto;display:flex;flex-direction:column}.viewport{height:55vh;min-height:300px}aside{border-left:0;border-top:1px solid #ddd}header{padding:14px}}
</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}</script>
</head><body><header><div><p class="sub" id="schoolName"></p><h1 id="venueName"></h1></div><span class="pill">Seat-selection preview · no sales</span></header>
<div class="layout"><div class="viewport"><svg id="map" class="map" role="img" aria-label="Interactive seating plan"></svg><div id="webgl"></div>
<div class="toolbar"><button id="mapBtn" class="selected">2D seats</button><button id="threeBtn">3D stadium</button><button id="eyeBtn">Human view</button></div><div id="loadError"></div></div>
<aside><strong class="title">Find your seat</strong><p class="note">Choose a section or search its exact seat identifier. Views and positions may be approximate.</p>
<div><label for="section">Section</label><select id="section"><option value="">All sections</option></select></div>
<div><label for="search">Seat ID, row or number</label><input id="search" placeholder="Example HOME-A-5"></div>
<div class="info" id="details">Select a dot on the map to inspect a seat.</div>
<button id="copyBtn" class="primary">Copy selected seat link</button><div class="warning">Venue preview only. This page has no real-time inventory, seat reservations, payments or checkout. The school must validate row numbering, accessibility, sightlines and geometry before public ticket sales.</div>
</aside></div><div class="bottom" id="footer"></div>
<script type="application/json" id="venue-data">${scriptJSON(payload)}</script>
<script type="module">
const data=JSON.parse(document.getElementById('venue-data').textContent),$=id=>document.getElementById(id);
$('schoolName').textContent=data.school;$('venueName').textContent=data.name;
$('footer').textContent=data.seats.length.toLocaleString()+' mapped seat locations · '+(data.officialCapacity===null?'official capacity not supplied':'published capacity '+data.officialCapacity.toLocaleString())+' · '+data.capacityStatus.replaceAll('_',' ').toLowerCase()+' · '+data.seatOrigin+' · preview only';
for(const s of data.sections){const o=document.createElement('option');o.value=s.id;o.textContent=s.label;$('section').append(o);}
const byId=new Map(data.seats.map((s,i)=>[s.id,i]));let selected=-1,mode='map',scene=null;
const xs=data.seats.map(s=>s.x),zs=data.seats.map(s=>s.z),cw=data.surface.width,cl=data.surface.length;
const maxX=Math.max(cw/2+10,...xs.map(Math.abs)),maxZ=Math.max(cl/2+10,...zs.map(Math.abs));
const svgNS='http://www.w3.org/2000/svg',svg=$('map');svg.setAttribute('viewBox',[-maxX-10,-maxZ-10,2*maxX+20,2*maxZ+20].join(' '));
function el(tag,attributes,parent=svg){const n=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attributes))n.setAttribute(k,v);parent.append(n);return n;}
el('rect',{x:-cw/2,y:-cl/2,width:cw,height:cl,class:data.surface.sport==='basketball'?'court':'field',rx:.2});
el('line',{x1:-cw/2,y1:0,x2:cw/2,y2:0,stroke:'white','stroke-width':.16});
const dots=new Array(data.seats.length);const layer=el('g',{});
for(let i=0;i<data.seats.length;i++){const s=data.seats[i];const c=el('circle',{cx:s.x,cy:s.z,r:Math.max(.17,Math.min(.36,maxZ/190)),class:'seat','data-index':i,fill:s.color||data.tierColors[Math.max(0,Math.min(3,s.tier))]},layer);dots[i]=c;}
function filtered(){const section=$('section').value,q=$('search').value.trim().toLowerCase();for(let i=0;i<data.seats.length;i++){const s=data.seats[i];dots[i].style.display=((!section||s.section===section)&&(!q||[s.id,s.row,s.seat].some(v=>v.toLowerCase().includes(q))))?'':'none';}}
$('section').onchange=filtered;$('search').oninput=filtered;
function choose(i,scroll=false){if(!(i>=0&&i<data.seats.length))return;if(selected>=0)dots[selected].classList.remove('active');selected=i;dots[i].classList.add('active');const s=data.seats[i];
$('details').replaceChildren();for(const line of ['Section '+s.section,'Row '+s.row+' · Seat '+s.seat,s.id,'3D coordinate (review needed) X '+s.x.toFixed(2)+' m · Y '+s.y.toFixed(2)+' m · Z '+s.z.toFixed(2)+' m']){const p=document.createElement('div');p.textContent=line;$('details').append(p);}if(scene&&mode==='eye')scene.seatView(s);}
layer.addEventListener('click',e=>{const n=e.target.closest('[data-index]');if(n)choose(Number(n.getAttribute('data-index')));});
$('search').addEventListener('keydown',e=>{if(e.key==='Enter'){const i=data.seats.findIndex(s=>s.id.toLowerCase()===$('search').value.trim().toLowerCase());if(i>=0){$('section').value='';$('search').value='';filtered();choose(i);}}});
const hash=decodeURIComponent(location.hash.replace(/^#seat=/,''));if(byId.has(hash))choose(byId.get(hash));
$('copyBtn').onclick=async()=>{if(selected<0){$('details').textContent='Choose a seat first.';return;}const link=location.href.split('#')[0]+'#seat='+encodeURIComponent(data.seats[selected].id);try{await navigator.clipboard.writeText(link);$('copyBtn').textContent='Link copied';}catch{$('details').textContent=link;}};
function display(which){mode=which;$('map').style.display=which==='map'?'block':'none';$('webgl').style.display=which==='map'?'none':'block';for(const [button,name] of [['mapBtn','map'],['threeBtn','three'],['eyeBtn','eye']])$(button).classList.toggle('selected',which===name);}
$('mapBtn').onclick=()=>display('map');
async function bootThree(){if(scene)return scene;try{const THREE=await import('three');const {OrbitControls}=await import('three/addons/controls/OrbitControls.js');
const root=$('webgl'),renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));root.append(renderer.domElement);
const world=new THREE.Scene();world.background=new THREE.Color(0xf2f3f1);world.add(new THREE.HemisphereLight(0xffffff,0x9daca9,2.4));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-30,70,40);world.add(light);
const camera=new THREE.PerspectiveCamera(53,1,.06,1500);camera.position.set(maxX*1.6,Math.max(20,maxZ*.75),maxZ*1.45);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,0,0);controls.update();
const floor=new THREE.Mesh(new THREE.BoxGeometry(cw,.15,cl),new THREE.MeshStandardMaterial({color:data.surface.sport==='basketball'?0xd0ab79:0x4e9272}));world.add(floor);
const geometry=new THREE.BoxGeometry(.42,.075,.36),back=new THREE.BoxGeometry(.40,.39,.055);const colors=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8});
const seatMesh=new THREE.InstancedMesh(geometry,colors,data.seats.length),backMesh=new THREE.InstancedMesh(back,colors,data.seats.length);
// Even a self-contained school preview needs structural treads, otherwise
// seat cushions look like disconnected colored stripes in empty space.
const support=new THREE.InstancedMesh(new THREE.BoxGeometry(.53,.29,.84),new THREE.MeshStandardMaterial({color:0xc6d1d9,roughness:.94}),data.seats.length);
const metal=new THREE.MeshStandardMaterial({color:0x8496a5,roughness:.56,metalness:.2});
const leg=new THREE.InstancedMesh(new THREE.BoxGeometry(.025,.48,.035),metal,data.seats.length);
const leg2=new THREE.InstancedMesh(new THREE.BoxGeometry(.025,.48,.035),metal,data.seats.length);
let obj=new THREE.Object3D();
for(let i=0;i<data.seats.length;i++){const s=data.seats[i];obj.position.set(s.x,s.y+(s.style==='bleacher'?.09:.45),s.z);obj.rotation.set(0,s.yaw,0);obj.scale.set(1,1,1);obj.updateMatrix();seatMesh.setMatrixAt(i,obj.matrix);seatMesh.setColorAt(i,new THREE.Color(s.color||data.tierColors[Math.min(3,Math.max(0,s.tier))]));
obj.position.set(s.x-Math.sin(s.yaw)*.17,s.y+.71,s.z-Math.cos(s.yaw)*.17);obj.scale.setScalar(s.style==='bleacher'?0:1);obj.updateMatrix();backMesh.setMatrixAt(i,obj.matrix);obj.scale.setScalar(1);
backMesh.setColorAt(i,new THREE.Color(s.color||data.tierColors[Math.min(3,Math.max(0,s.tier))]));
obj.position.set(s.x,s.y-.20,s.z);obj.updateMatrix();support.setMatrixAt(i,obj.matrix);
obj.position.set(s.x-Math.cos(s.yaw)*.16,s.y+.13,s.z+Math.sin(s.yaw)*.16);obj.updateMatrix();leg.setMatrixAt(i,obj.matrix);
obj.position.set(s.x+Math.cos(s.yaw)*.16,s.y+.13,s.z-Math.sin(s.yaw)*.16);obj.updateMatrix();leg2.setMatrixAt(i,obj.matrix);
}

world.add(support,leg,leg2,seatMesh,backMesh);const dim=new THREE.Vector2();let running=true;
function frame(){if(!running)return;requestAnimationFrame(frame);const w=root.clientWidth||300,h=root.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(mode!=='eye')controls.update();renderer.render(world,camera);}frame();
const clear=()=>{if(scene?.hiddenIndex!==undefined&&scene.hiddenIndex>=0){const i=scene.hiddenIndex;const s=data.seats[i];obj.scale.set(1,1,1);obj.rotation.set(0,s.yaw,0);obj.position.set(s.x,s.y+.36,s.z);obj.updateMatrix();seatMesh.setMatrixAt(i,obj.matrix);obj.position.set(s.x-Math.sin(s.yaw)*.17,s.y+.71,s.z-Math.cos(s.yaw)*.17);obj.scale.setScalar(s.style==='bleacher'?0:1);obj.updateMatrix();backMesh.setMatrixAt(i,obj.matrix);obj.scale.setScalar(1);seatMesh.instanceMatrix.needsUpdate=true;backMesh.instanceMatrix.needsUpdate=true;scene.hiddenIndex=-1;}};
scene={hiddenIndex:-1,orbit(){clear();controls.enabled=true;camera.fov=53;camera.position.set(maxX*1.6,Math.max(20,maxZ*.75),maxZ*1.45);controls.target.set(0,0,0);camera.updateProjectionMatrix();controls.update();},seatView(s){clear();controls.enabled=false;const i=byId.get(s.id);if(i!==undefined){obj.scale.set(0,0,0);obj.updateMatrix();seatMesh.setMatrixAt(i,obj.matrix);backMesh.setMatrixAt(i,obj.matrix);seatMesh.instanceMatrix.needsUpdate=true;backMesh.instanceMatrix.needsUpdate=true;scene.hiddenIndex=i;obj.scale.set(1,1,1);}
const forward=new THREE.Vector3(-s.x,0,-s.z).normalize();camera.position.set(s.x+forward.x*.22,s.y+1.17,s.z+forward.z*.22);camera.up.set(0,1,0);camera.lookAt(0,data.surface.sport==='basketball'?2.3:1.2,0);camera.fov=65;camera.updateProjectionMatrix();}};
return scene;}catch(e){$('loadError').style.display='block';$('loadError').textContent='3D preview requires internet access to load Three.js. 2D seat selection remains available. '+e.message;display('map');throw e;}}
$('threeBtn').onclick=async()=>{display('three');try{(await bootThree()).orbit();}catch{}};
$('eyeBtn').onclick=async()=>{if(selected<0){$('details').textContent='Select a seat on the 2D map first.';display('map');return;}display('eye');try{(await bootThree()).seatView(data.seats[selected]);}catch{}};
</script></body></html>`;
  return html;
}

// Standalone school preview with the exact same WebGL2 renderer as the studio.
// Renderer source is loaded from this installation at export time, then bundled
// into the HTML. The generated page requires no CDN, login, or remote server.
export function buildOfflineSchoolViewerHTML(input,rendererSource){
  if(typeof rendererSource!=='string'||!rendererSource.includes('class NativeVenueRenderer'))throw Error('Offline renderer source is missing.');
  const model=generateSeats(input),project=model.project;
  const plan=buildVenuePlan(model);
  const pack = data => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i+8192));
    return btoa(binary);
  };
  const payload={
    name:project.school?.venue||project.title,
    surface:model.surface,
    school:project.school?.school||'School venue',
    officialCapacity:plan.official.officialCapacity,
    verifiedTicketIDs:plan.hasRoster,
    coordinateQuality:project.ticketing?.coordinates||'estimated',
    seats:plan.seats.map(s=>({uid:String(s.uid),x:s.x,y:s.y,z:s.z,yaw:s.yaw,tier:s.tier,sectionId:String(s.sectionId),row:String(s.row),number:String(s.number)})),
    instanceCount:plan.instanceCount,
    roundedCount:plan.roundedCount,
    arenaInterior:plan.arenaInterior,
    scoreboardHeight:plan.scoreboardHeight,
    packedInstances:pack(plan.instanceData),
    packedDeck:plan.deckGeometry ? pack(plan.deckGeometry) : undefined,
    packedPedestal:plan.pedestalGeometry?.length ? pack(plan.pedestalGeometry) : undefined,
    packedPedestalTrim:plan.pedestalTrimGeometry?.length ? pack(plan.pedestalTrimGeometry) : undefined,
    packedArchitecture:plan.architectureGeometry ? Object.fromEntries(Object.entries(plan.architectureGeometry).map(([k,v])=>[k,pack(v)])) : undefined,
  };
  const safe=JSON.stringify(payload).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  const renderCode=rendererSource.replace(/\bexport class NativeVenueRenderer\b/,'class NativeVenueRenderer');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>School Seat Preview · FiledMaker</title><style>
*{box-sizing:border-box}body{font-family:system-ui,Segoe UI,Arial;margin:0;background:#f3f6f7;color:#253842}header{background:white;border-bottom:1px solid #e0e7ea;padding:18px 25px;display:flex;justify-content:space-between;gap:15px;align-items:center}header strong{font-size:18px}header small{display:block;margin-top:4px;color:#8796a0}.layout{display:grid;grid-template-columns:minmax(0,1fr) 275px;height:calc(100vh - 75px)}main{padding:20px;display:flex;flex-direction:column;min-width:0}.viewport{position:relative;flex:1;min-height:350px;border-radius:14px;border:1px solid #dce5e9;overflow:hidden;background:#eff4f6}canvas{width:100%;height:100%;display:block;touch-action:none}canvas[hidden]{display:none}.controls{display:flex;gap:7px;margin-bottom:12px}button{border:1px solid #d4dee3;background:white;color:#3a5261;border-radius:8px;padding:9px 13px;font-size:12px;cursor:pointer}button.active{background:#273e4c;border-color:#273e4c;color:white}.details{border-left:1px solid #dfe7eb;background:#fff;padding:22px;overflow:auto}h3{font-size:12px;letter-spacing:.7px;color:#778795}input{border:1px solid #d9e3e7;border-radius:8px;padding:11px;width:100%}.card{background:#f5f8fa;padding:14px;margin:14px 0;border-radius:10px;color:#5d7280;font-size:12px;line-height:1.5}.card strong{font-size:14px;color:#293d49}.disclaimer{font-size:11px;line-height:1.65;color:#8b6771;padding-top:10px}footer{padding:12px 2px;color:#8d9aa3;font-size:11px}@media(max-width:760px){.layout{display:block;height:auto}main{height:60vh}.details{border-left:0}}
</style></head><body><header><div><strong id="name"></strong><small id="school"></small></div><span style="font-size:12px;color:#8d6d44">Seat preview · Not live tickets</span></header><div class="layout"><main><div class="controls"><button class="active" id="two">2D Map</button><button id="three">3D Venue</button><button id="eye">Human View</button></div><div class="viewport"><canvas id="map"></canvas><canvas id="stage" hidden></canvas></div><footer id="note"></footer></main><aside class="details"><h3>SEAT SEARCH</h3><input id="search" placeholder="Section / Row / Seat ID"><button id="find" style="width:100%;margin-top:8px">Locate seat</button><div class="card" id="details">Select a seat on the 2D map to preview.</div><h3>CAPACITY</h3><div class="card" id="capacity"></div><div class="disclaimer">This page has no payment or live availability connection. School staff must verify the section mapping, exact seat coordinates, accessible seats and sightlines before selling tickets.</div></aside></div><script type="application/json" id="payload">${safe}</script><script>
${renderCode}
const data=JSON.parse(document.getElementById('payload').textContent),$=id=>document.getElementById(id),seats=data.seats;
$('name').textContent=data.name;$('school').textContent=data.school;$('capacity').textContent='Published capacity: '+(data.officialCapacity==null?'not supplied':data.officialCapacity.toLocaleString())+' · '+seats.length.toLocaleString()+' visual positions · '+(data.verifiedTicketIDs?'imported seat IDs':'synthetic seats only');
$('note').textContent=data.verifiedTicketIDs?'School-supplied seat IDs; XYZ may be estimated':'Illustrative positions only — no official seat inventory';
function unpack(encoded){const raw=atob(encoded),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Float32Array(bytes.buffer);}
const plan={seats,surface:data.surface,instanceCount:data.instanceCount,roundedCount:data.roundedCount,arenaInterior:data.arenaInterior,scoreboardHeight:data.scoreboardHeight,instanceData:unpack(data.packedInstances),deckGeometry:data.packedDeck?unpack(data.packedDeck):undefined,pedestalGeometry:data.packedPedestal?unpack(data.packedPedestal):undefined,pedestalTrimGeometry:data.packedPedestalTrim?unpack(data.packedPedestalTrim):undefined,architectureGeometry:data.packedArchitecture?Object.fromEntries(Object.entries(data.packedArchitecture).map(([k,v])=>[k,unpack(v)])):null};
const map=$('map'),ctx=map.getContext('2d');let chosen=null,renderer=null,mode='two';
let extent=Math.max(data.surface.width/2+5,data.surface.length/2+5);for(const s of seats)extent=Math.max(extent,Math.abs(s.x)+4,Math.abs(s.z)+4);
function draw(){const r=map.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);map.width=r.width*dpr;map.height=r.height*dpr;const w=map.width,h=map.height,scale=.44*Math.min(w,h)/extent,cx=w/2,cy=h/2;ctx.fillStyle='#eef3f6';ctx.fillRect(0,0,w,h);ctx.fillStyle=data.surface.sport==='basketball'?'#bdb2a2':'#397f55';ctx.fillRect(cx-data.surface.width*scale/2,cy-data.surface.length*scale/2,data.surface.width*scale,data.surface.length*scale);ctx.strokeStyle='white';ctx.lineWidth=1.6*dpr;ctx.strokeRect(cx-data.surface.width*scale/2,cy-data.surface.length*scale/2,data.surface.width*scale,data.surface.length*scale);
 const step=Math.max(1,Math.ceil(seats.length/10000));for(let i=0;i<seats.length;i+=step){const s=seats[i];ctx.fillStyle=['#466b80','#668ca1','#8faaba','#b1c4cf'][s.tier%4];ctx.fillRect(cx+s.x*scale-1.1,cy+s.z*scale-1.1,2.2,2.2);}if(chosen){ctx.fillStyle='#f2ac48';ctx.beginPath();ctx.arc(cx+chosen.x*scale,cy+chosen.z*scale,5*dpr,0,Math.PI*2);ctx.fill();}map._transform={cx,cy,scale,dpr};}
map.onclick=e=>{const r=map.getBoundingClientRect(),x=(e.clientX-r.left)*map.width/r.width,y=(e.clientY-r.top)*map.height/r.height;const {cx,cy,scale}=map._transform;let best=null,d=14*14*map.width/r.width;for(const s of seats){const dist=(cx+s.x*scale-x)**2+(cy+s.z*scale-y)**2;if(dist<d){d=dist;best=s;}}if(best)select(best);};
function select(s){chosen=s;renderer?.highlight(s);$('details').textContent='Section '+s.sectionId+' · Row '+s.row+' · Seat '+s.number+' · '+s.uid+(data.verifiedTicketIDs?' (imported ID)':' (illustrative ID)');if(mode==='two')draw();if(mode==='eye'&&renderer)renderer.view('human',s);}
$('find').onclick=()=>{const q=$('search').value.trim().toLowerCase();const s=seats.find(s=>s.uid.toLowerCase()===q)||seats.find(s=>s.uid.toLowerCase().includes(q));if(s)select(s);else $('details').textContent='No match found.';};
function scene(){if(!renderer){renderer=new NativeVenueRenderer($('stage'),s=>select(s));renderer.load(plan);}renderer.resize();return renderer;}
function setMode(which){if(which==='eye'&&!chosen){$('details').textContent='Select a seat on the 2D map first.';return;}mode=which;map.hidden=which!=='two';$('stage').hidden=which==='two';for(const id of ['two','three','eye'])$(id).classList.toggle('active',id===which);if(which==='two')draw();else{try{scene().view(which==='three'?'overview':'human',chosen);}catch(e){$('details').textContent='3D unavailable on this device: '+e.message;setMode('two');}}}
$('two').onclick=()=>setMode('two');$('three').onclick=()=>setMode('three');$('eye').onclick=()=>setMode('eye');window.addEventListener('resize',()=>{if(mode==='two')draw();else renderer?.resize();});setMode('two');
</script></body></html>`;
}
