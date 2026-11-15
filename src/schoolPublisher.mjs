// Standalone school seat-selection PREVIEW generator.
// No checkout, holds, inventory counts or booking claims. Local selection only.
import { generateSeats } from './model.mjs';
import { schoolReadiness } from './schoolPipeline.mjs';
import { BLUE_TIERS, ticketReconciliation } from './seatFirst.mjs';
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scriptJSON = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
export function buildSchoolViewerHTML(input) {
  const model=generateSeats(input),project=model.project;
  if(model.seats.length>40000) throw new Error('The standalone preview supports at most 40,000 seat locations. Use a hosted delivery for larger venues.');
  const readiness=schoolReadiness(project,model);
  const reconciliation=ticketReconciliation(project,model.seats.length);
  const payload={name:project.school?.venue||project.title,school:project.school?.school||'School venue',
    surface:model.surface,seatOrigin:readiness.sourceMethod,officialCapacity:reconciliation.officialCapacity,capacityStatus:reconciliation.status,tierColors:project.blueTheme?BLUE_TIERS:null,sections:project.sections.map(s=>({id:s.id,label:s.label})),
    seats:model.seats.map(s=>({id:String(s.uid),tier:Number(s.tier),section:String(s.sectionId),row:String(s.row),seat:String(s.number),x:Number(s.x.toFixed(3)),y:Number(s.y.toFixed(3)),z:Number(s.z.toFixed(3)),yaw:Number((s.yaw||0).toFixed(4))}))};
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
for(let i=0;i<data.seats.length;i++){const s=data.seats[i];const c=el('circle',{cx:s.x,cy:s.z,r:Math.max(.17,Math.min(.36,maxZ/190)),class:'seat','data-index':i,fill:data.tierColors?data.tierColors[Math.max(0,Math.min(3,s.tier))]: '#2875ae'},layer);dots[i]=c;}
function filtered(){const section=$('section').value,q=$('search').value.trim().toLowerCase();for(let i=0;i<data.seats.length;i++){const s=data.seats[i];dots[i].style.display=((!section||s.section===section)&&(!q||[s.id,s.row,s.seat].some(v=>v.toLowerCase().includes(q))))?'':'none';}}
$('section').onchange=filtered;$('search').oninput=filtered;
function choose(i,scroll=false){if(!(i>=0&&i<data.seats.length))return;if(selected>=0)dots[selected].classList.remove('active');selected=i;dots[i].classList.add('active');const s=data.seats[i];
$('details').replaceChildren();for(const line of ['Section '+s.section,'Row '+s.row+' · Seat '+s.seat,s.id,'Position estimate X '+s.x.toFixed(2)+' m · Y '+s.y.toFixed(2)+' m · Z '+s.z.toFixed(2)+' m']){const p=document.createElement('div');p.textContent=line;$('details').append(p);}if(scene&&mode==='eye')scene.seatView(s);}
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
const geometry=new THREE.BoxGeometry(.42,.12,.36),back=new THREE.BoxGeometry(.42,.56,.08);const colors=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8});
const seatMesh=new THREE.InstancedMesh(geometry,colors,data.seats.length),backMesh=new THREE.InstancedMesh(back,colors,data.seats.length);
// Even a self-contained school preview needs structural treads, otherwise
// seat cushions look like disconnected colored stripes in empty space.
const support=new THREE.InstancedMesh(new THREE.BoxGeometry(.53,.29,.84),new THREE.MeshStandardMaterial({color:0xc6d1d9,roughness:.94}),data.seats.length);
const metal=new THREE.MeshStandardMaterial({color:0x8496a5,roughness:.56,metalness:.2});
const leg=new THREE.InstancedMesh(new THREE.BoxGeometry(.025,.48,.035),metal,data.seats.length);
const leg2=new THREE.InstancedMesh(new THREE.BoxGeometry(.025,.48,.035),metal,data.seats.length);
let obj=new THREE.Object3D();
for(let i=0;i<data.seats.length;i++){const s=data.seats[i];obj.position.set(s.x,s.y+.36,s.z);obj.rotation.set(0,s.yaw,0);obj.scale.set(1,1,1);obj.updateMatrix();seatMesh.setMatrixAt(i,obj.matrix);if(data.tierColors)seatMesh.setColorAt(i,new THREE.Color(data.tierColors[Math.min(3,Math.max(0,s.tier))]));
obj.position.set(s.x-Math.sin(s.yaw)*.17,s.y+.62,s.z-Math.cos(s.yaw)*.17);obj.updateMatrix();backMesh.setMatrixAt(i,obj.matrix);
if(data.tierColors)backMesh.setColorAt(i,new THREE.Color(data.tierColors[Math.min(3,Math.max(0,s.tier))]));
obj.position.set(s.x,s.y-.20,s.z);obj.updateMatrix();support.setMatrixAt(i,obj.matrix);
obj.position.set(s.x-Math.cos(s.yaw)*.16,s.y+.13,s.z+Math.sin(s.yaw)*.16);obj.updateMatrix();leg.setMatrixAt(i,obj.matrix);
obj.position.set(s.x+Math.cos(s.yaw)*.16,s.y+.13,s.z-Math.sin(s.yaw)*.16);obj.updateMatrix();leg2.setMatrixAt(i,obj.matrix);
}

world.add(support,leg,leg2,seatMesh,backMesh);const dim=new THREE.Vector2();let running=true;
function frame(){if(!running)return;requestAnimationFrame(frame);const w=root.clientWidth||300,h=root.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(mode!=='eye')controls.update();renderer.render(world,camera);}frame();
const clear=()=>{if(scene?.hiddenIndex!==undefined&&scene.hiddenIndex>=0){const i=scene.hiddenIndex;const s=data.seats[i];obj.scale.set(1,1,1);obj.rotation.set(0,s.yaw,0);obj.position.set(s.x,s.y+.36,s.z);obj.updateMatrix();seatMesh.setMatrixAt(i,obj.matrix);obj.position.set(s.x-Math.sin(s.yaw)*.17,s.y+.62,s.z-Math.cos(s.yaw)*.17);obj.updateMatrix();backMesh.setMatrixAt(i,obj.matrix);seatMesh.instanceMatrix.needsUpdate=true;backMesh.instanceMatrix.needsUpdate=true;scene.hiddenIndex=-1;}};
scene={hiddenIndex:-1,orbit(){clear();controls.enabled=true;camera.fov=53;camera.position.set(maxX*1.6,Math.max(20,maxZ*.75),maxZ*1.45);controls.target.set(0,0,0);camera.updateProjectionMatrix();controls.update();},seatView(s){clear();controls.enabled=false;const i=byId.get(s.id);if(i!==undefined){obj.scale.set(0,0,0);obj.updateMatrix();seatMesh.setMatrixAt(i,obj.matrix);backMesh.setMatrixAt(i,obj.matrix);seatMesh.instanceMatrix.needsUpdate=true;backMesh.instanceMatrix.needsUpdate=true;scene.hiddenIndex=i;obj.scale.set(1,1,1);}
const forward=new THREE.Vector3(-s.x,0,-s.z).normalize();camera.position.set(s.x+forward.x*.22,s.y+1.17,s.z+forward.z*.22);camera.up.set(0,1,0);camera.lookAt(0,data.surface.sport==='basketball'?2.3:1.2,0);camera.fov=65;camera.updateProjectionMatrix();}};
return scene;}catch(e){$('loadError').style.display='block';$('loadError').textContent='3D preview requires internet access to load Three.js. 2D seat selection remains available. '+e.message;display('map');throw e;}}
$('threeBtn').onclick=async()=>{display('three');try{(await bootThree()).orbit();}catch{}};
$('eyeBtn').onclick=async()=>{if(selected<0){$('details').textContent='Select a seat on the 2D map first.';display('map');return;}display('eye');try{(await bootThree()).seatView(data.seats[selected]);}catch{}};
</script></body></html>`;
  return html;
}
