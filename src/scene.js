import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SURFACES, TAU, modelPerimeterPoint, modelPerimeterPath, pointAtDistance, seatingIntervals, resolveSectionTier } from './model.mjs';
import { VIEW_DEFAULTS, validateViewOptions, viewpoint, crowdCandidates } from './view.mjs';
import { addDetailedVenue } from './architecture.js';
import { isOhioReference } from './venues.mjs';

const white = 0xf2f6ef;
const mat = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.06 });
const fieldLine = new THREE.MeshBasicMaterial({ color: white, toneMapped: false });

function box(group, width, height, depth, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}
function stripe(group, x1, z1, x2, z2, width = 0.1, y = 0.112) {
  const length = Math.hypot(x2 - x1, z2 - z1);
  const mesh = box(group, length, 0.012, width, (x1 + x2) / 2, y, (z1 + z2) / 2, fieldLine);
  mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
}
function outline(group, x, z, width, length, thickness = 0.11) {
  stripe(group, x - width / 2, z - length / 2, x + width / 2, z - length / 2, thickness);
  stripe(group, x - width / 2, z + length / 2, x + width / 2, z + length / 2, thickness);
  stripe(group, x - width / 2, z - length / 2, x - width / 2, z + length / 2, thickness);
  stripe(group, x + width / 2, z - length / 2, x + width / 2, z + length / 2, thickness);
}
function circleLine(group, x, z, radius, start = 0, end = TAU, height = 0.12, segments = 80) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + (end - start) * i / segments;
    pts.push(x + radius * Math.cos(a), height, z + radius * Math.sin(a));
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: white })));
}
function pole(group, start, end, radius, color) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const dir = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 8), mat(color, 0.45));
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  group.add(mesh);
}
function football(group, surface, project) {
  const { width: w, length: l, endZone } = surface;
  const ohio = isOhioReference(project);
  box(group, w + 10, 0.26, l + 10, 0, -0.13, 0, mat(0x1a413c));
  box(group, w, 0.08, l, 0, 0.035, 0, mat(0x30784e));
  for (let i = 0; i < 12; i++) {
    if (i % 2 === 0) box(group, w, 0.004, l / 12, 0, 0.078, -l / 2 + l * (i + 0.5) / 12, mat(0x347c51));
  }
  for (const side of [-1, 1]) {
    box(group, w, 0.01, endZone, 0, 0.085, side * (l / 2 - endZone / 2), mat(ohio ? 0xb11f35 : side > 0 ? 0x214e75 : 0x1c655f));
    stripe(group, -w / 2, side * (l / 2 - endZone), w / 2, side * (l / 2 - endZone), 0.16);
    const z = side * (l / 2 + 0.5);
    pole(group, [0, 0, z], [0, 3.05, z], 0.085, 0xffd56c);
    pole(group, [-2.82, 3.05, z], [2.82, 3.05, z], 0.075, 0xffd56c);
    pole(group, [-2.82, 3.05, z], [-2.82, 8.7, z], 0.07, 0xffd56c);
    pole(group, [2.82, 3.05, z], [2.82, 8.7, z], 0.07, 0xffd56c);
  }
  outline(group, 0, 0, w, l, 0.15);
  const play = l - endZone * 2;
  for (let i = 1; i < 20; i++) {
    const z = -play / 2 + i * play / 20;
    stripe(group, -w / 2, z, w / 2, z, i === 10 ? 0.18 : 0.08);
  }
  for(let i=1;i<100;i++){
    if(i%5===0)continue;
    const z=-play/2+i*play/100;
    for(const x of [-6.096,6.096])stripe(group,x-.29,z,x+.29,z,.09);
    for(const x of [-w/2+.7,w/2-.7])stripe(group,x-.24,z,x+.24,z,.075);
  }
  if(ohio){
    function paintText(text,width,depth,x,z,rotation=0,color='#ffffff'){
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
      const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.font='bold 122px Arial,sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,128,1000);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
      mesh.rotation.x=-Math.PI/2;mesh.rotation.z=rotation;mesh.position.set(x,.115,z);group.add(mesh);
    }
    paintText('OHIO STATE',30,8,0,-l/2+endZone/2);
    paintText('BUCKEYES',30,8,0,l/2-endZone/2,Math.PI);
    paintText('O',11,12,0,0,0,'#b31f37');
    for(let yard=10;yard<=50;yard+=10){
      const zz=(yard-50)*play/100;
      for(const sign of [-1,1]){
        paintText(String(yard),4.2,2.2,-w*.33,sign*zz);
        paintText(String(yard),4.2,2.2,w*.33,sign*zz,Math.PI);
      }
    }
  }
}
function soccer(group, surface) {
  const { width: w, length: l } = surface;
  box(group, w + 10, 0.25, l + 10, 0, -0.125, 0, mat(0x17443d));
  box(group, w, 0.08, l, 0, 0.04, 0, mat(0x367c50));
  for (let i = 0; i < 10; i++) {
    if (i % 2) box(group, w, 0.003, l / 10, 0, 0.081, -l / 2 + l * (i + 0.5) / 10, mat(0x3c8657));
  }
  outline(group, 0, 0, w, l);
  stripe(group, -w / 2, 0, w / 2, 0);
  circleLine(group, 0, 0, 9.15);
  for (const sign of [-1, 1]) {
    const end = sign * l / 2;
    const goal = end - sign * 5.5, penalty = end - sign * 16.5;
    stripe(group, -9.16, end, -9.16, goal); stripe(group, 9.16, end, 9.16, goal);
    stripe(group, -9.16, goal, 9.16, goal);
    stripe(group, -20.16, end, -20.16, penalty); stripe(group, 20.16, end, 20.16, penalty);
    stripe(group, -20.16, penalty, 20.16, penalty);
    pole(group, [-3.66, 0, end], [-3.66, 2.44, end], 0.065, white);
    pole(group, [3.66, 0, end], [3.66, 2.44, end], 0.065, white);
    pole(group, [-3.66, 2.44, end], [3.66, 2.44, end], 0.065, white);
  }
}
function basketball(group, surface) {
  const { width: w, length: l } = surface;
  box(group, w + 9, 0.22, l + 10, 0, -0.11, 0, mat(0x29434e));
  box(group, w, 0.09, l, 0, 0.045, 0, mat(0xd4b486));
  for (let i = 0; i < 16; i++) {
    if (i % 2) box(group, w / 16, 0.003, l, -w / 2 + w * (i + 0.5) / 16, 0.092, 0, mat(0xc8a676));
  }
  outline(group, 0, 0, w, l, 0.065);
  stripe(group, -w / 2, 0, w / 2, 0, 0.065);
  circleLine(group, 0, 0, 1.83);
  for (const sign of [-1, 1]) {
    const baseline = sign * l / 2, freeThrow = baseline - sign * 5.79;
    stripe(group, -2.45, baseline, -2.45, freeThrow, 0.07);
    stripe(group, 2.45, baseline, 2.45, freeThrow, 0.07);
    stripe(group, -2.45, freeThrow, 2.45, freeThrow, 0.07);
    circleLine(group, 0, freeThrow, 1.83);
    const board = baseline - sign * 1.22;
    box(group, 1.8, 1.08, 0.08, 0, 3.08, board, mat(0xe5e9ea));
    pole(group, [0, 3.08, board], [0, 3.65, baseline + sign * 1.65], 0.09, 0x53636e);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.2286, 0.024, 8, 30), mat(0xe27b41, 0.5));
    hoop.position.set(0, 3.05, baseline - sign * 1.58);
    hoop.rotation.x = Math.PI / 2;
    group.add(hoop);
    // Simplified 3-point line, intentionally schematic rather than surveyed court artwork.
    const radius = surface.label.includes('NCAA') ? 6.75 : 7.24;
    const bound = Math.min(w / 2 - 0.9, 6.65);
    const extension = Math.sqrt(Math.max(0, radius * radius - bound * bound));
    const arcZ = baseline - sign * 1.58;
    stripe(group, -bound, baseline, -bound, arcZ - sign * extension, 0.065);
    stripe(group, bound, baseline, bound, arcZ - sign * extension, 0.065);
    if (sign > 0) circleLine(group, 0, arcZ, radius, Math.PI + Math.acos(bound / radius), 2 * Math.PI - Math.acos(bound / radius));
    else circleLine(group, 0, arcZ, radius, Math.acos(bound / radius), Math.PI - Math.acos(bound / radius));
  }
}

function makeTerrace(section, surface, tier, project) {
  const vertices = [], colors = [], indices = [];
  const base = new THREE.Color(section.color);
  const profile = resolveSectionTier(tier, section.id, project);
  for (let row = 0; row < profile.rows; row++) {
    const radial = profile.startOffset + row * profile.depth;
    const y = profile.startHeight + row * profile.rise - 0.15;
    const path = modelPerimeterPath(project, surface, radial + profile.depth * 0.5);
    const strips = seatingIntervals(path, section, project, tier.id, row + 1);
    for (const [start, end] of strips) {
      const startAngle = pointAtDistance(path, start).angle;
      const endAngle = pointAtDistance(path, end).angle;
      const spans = Math.max(1, Math.ceil((endAngle - startAngle) * 90 / Math.PI));
      const shade = base.clone().lerp(new THREE.Color(0xb7b8b5),.89).multiplyScalar(.93 + (row % 2)*.06);
      const offset = vertices.length / 3;
      for (let i = 0; i <= spans; i++) {
        const angle = startAngle + (endAngle - startAngle) * i / spans;
        const near = modelPerimeterPoint(project, surface, angle, radial);
        const far = modelPerimeterPoint(project, surface, angle, radial + profile.depth);
        // Flat tread followed by a concrete riser, not a sloped sheet.
        vertices.push(near.x,y,near.z,far.x,y,far.z,far.x,y+profile.rise,far.z);
        for(let j=0;j<3;j++){const fac=j===2?.72:1;colors.push(shade.r*fac,shade.g*fac,shade.b*fac);}
        if(i<spans){
          const k=offset+i*3;
          indices.push(k,k+1,k+3,k+1,k+4,k+3);
          indices.push(k+1,k+2,k+4,k+2,k+5,k+4);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 }));
  mesh.userData.sectionId = section.id;
  return mesh;
}

function addConcourse(group, surface, project, tier) {
  // A section's concourse follows its independently edited terrace footprint.
  for (const section of project.sections) {
    if (!section.enabled) continue;
    const geometry = resolveSectionTier(tier, section.id, project);
    if (geometry.rows === 0) continue;
    const radial = geometry.startOffset + geometry.rows * geometry.depth;
    const y = geometry.startHeight + geometry.rows * geometry.rise;
    const segments = Math.max(3, Math.ceil((section.end - section.start) * 0.4)), pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (section.start + (section.end - section.start) * i / segments) * Math.PI / 180;
      const p = modelPerimeterPoint(project, surface, a, radial);
      pts.push(p.x, y, p.z);
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: 0x849c98, transparent: true, opacity: 0.52 })));
  }
}

function createSeatMesh(seats,project) {
  const high=project.detailLevel==='high',bleachers=isOhioReference(project);
  const w=Math.min(.49,project.seatPitch*.86);
  const geometries=[new THREE.BoxGeometry(w,.115,.4),new THREE.BoxGeometry(w,bleachers?.14:.60,.095)];
  if(high)geometries.push(new THREE.BoxGeometry(.055,.42,.065));
  const base=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.67,metalness:bleachers?.42:.07});
  const meshes=geometries.map(g=>new THREE.InstancedMesh(g,base.clone(),seats.length));
  const shades=project.sections.map(s=>new THREE.Color(s.color)),o=new THREE.Object3D(),c=new THREE.Color();
  seats.forEach((seat,i)=>{
    c.copy(shades[seat.sectionIndex]||new THREE.Color(0x8a9296)).lerp(new THREE.Color(bleachers?0xa8abad:0xffffff),bleachers?.62:.06);
    c.multiplyScalar(.93+seat.row%4*.021);
    o.rotation.set(0,seat.yaw,0);o.scale.set(1,1,1);
    o.position.set(seat.x,seat.y+.44,seat.z);o.updateMatrix();
    meshes[0].setMatrixAt(i,o.matrix);meshes[0].setColorAt(i,c);
    o.position.set(seat.x,seat.y+(bleachers?.61:.76),seat.z);o.translateZ(-.2);o.updateMatrix();
    meshes[1].setMatrixAt(i,o.matrix);meshes[1].setColorAt(i,c.clone().multiplyScalar(.84));
    if(high){o.position.set(seat.x,seat.y+.37,seat.z);o.translateZ(.17);o.updateMatrix();meshes[2].setMatrixAt(i,o.matrix);meshes[2].setColorAt(i,new THREE.Color(0x858b89));}
  });
  meshes.forEach(m=>{m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.instanceMatrix.setUsage(THREE.StaticDrawUsage);});
  meshes[0].userData.isSeat=true;
  return meshes;
}

// Architectural context is schematic, not a scanned/surveyed building model.
function addArchitecturalDetails(group, surface, project, tiers) {
  const metal = mat(0x859399, .5), concrete = mat(0xb8c2c5);
  const lines = [], shellVertices = [], shellIndices = [];
  for (const tier of tiers) {
    for (const section of project.sections) {
      if (!section.enabled) continue;
      const profile = resolveSectionTier(tier, section.id, project);
      if (!profile.rows) continue;
      const angleSpan = (section.end - section.start) * Math.PI / 180;
      const segments = Math.max(3, Math.ceil(angleSpan / .075));
      const innerR = profile.startOffset;
      const outerR = profile.startOffset + profile.rows * profile.depth;
      const innerH = profile.startHeight, outerH = profile.startHeight + profile.rows * profile.rise;
      for (const edge of [{r:innerR,y:innerH},{r:outerR,y:outerH}]) {
        for (let i = 0; i < segments; i++) {
          const a = (section.start*Math.PI/180) + i*angleSpan/segments;
          const b = a+angleSpan/segments;
          const p = modelPerimeterPoint(project,surface,a,edge.r);
          const q = modelPerimeterPoint(project,surface,b,edge.r);
          // The lower parapet is opaque and can block line-of-sight in first-person view.
          const h = edge.r===innerR ? .65 : .9;
          const k = shellVertices.length/3;
          shellVertices.push(p.x,edge.y,p.z, q.x,edge.y,q.z, p.x,edge.y+h,p.z, q.x,edge.y+h,q.z);
          shellIndices.push(k,k+1,k+2,k+1,k+3,k+2);
          const rail = edge.y+h+.28;
          lines.push(p.x,rail,p.z,q.x,rail,q.z);
          if (i%3===0) lines.push(p.x,edge.y+h,p.z,p.x,rail,p.z);
        }
      }
    }
  }
  if (shellVertices.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(shellVertices,3));g.setIndex(shellIndices);g.computeVertexNormals();
    group.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xb8c2c5,roughness:.92,side:THREE.DoubleSide})));
  }
  if (lines.length) {
    const g = new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    group.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x667b83})));
  }
}

// Obstacles imported or measured by the user are part of the authored venue model,
// unlike temporary spectator proxies. Do not infer any barriers not explicitly entered.
function addSurveyObstacles(root, survey) {
  const materials={rail:mat(0xb2a398,.47), parapet:mat(0x9aa3a9), wall:mat(0xadb4ba), column:mat(0x8c9b9e), screen:mat(0x4c535e)};
  for (const o of survey?.obstacles || []) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(o.width,o.height,o.depth), materials[o.type] || mat(0x9ea8ad));
    m.position.set(o.x,o.y,o.z);m.rotation.y=o.yaw*Math.PI/180;
    m.userData.obstructionId=o.id;
    root.add(m);
  }
}

function makeLocalCrowd(model, seat, mode) {
  const group = new THREE.Group();
  group.userData.editorOnly = true;
  if (!seat || mode === 'empty') return group;
  const neighbors = crowdCandidates(model,seat,90);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.115,9,7), mat(0x917764),neighbors.length);
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.16,.27,3,6),mat(0x647786),neighbors.length);
  const o = new THREE.Object3D();
  for(let i=0;i<neighbors.length;i++){
    const s=neighbors[i], standing=mode==='standing';
    o.position.set(s.x,s.y+(standing ? 1.60 : 1.17),s.z);o.scale.set(1,1,1);o.rotation.set(0,0,0);o.updateMatrix();heads.setMatrixAt(i,o.matrix);
    o.position.y=s.y+(standing ? 1.07:.75);o.scale.set(1,standing ? 1.25:.84,1);o.rotation.y=s.yaw;o.updateMatrix();bodies.setMatrixAt(i,o.matrix);
  }
  heads.instanceMatrix.needsUpdate=true;bodies.instanceMatrix.needsUpdate=true;
  group.add(heads,bodies);return group;
}

export class StadiumScene {
  constructor(canvas, onSeat, onSection) {
    this.canvas = canvas;
    this.onSeat = onSeat;
    this.onSection = onSection;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0xf5f6f6);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f6f6);
    this.scene.fog = new THREE.Fog(0xf5f6f6, 195, 560);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb1babe, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 2.25);
    sun.position.set(-90, 140, 75);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.08, 1000);
    this.camera.position.set(110, 95, 115);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 420;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.seatMeshes = [];
    this.terraces = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.mode = 'orbit';
    this.viewOptions = { ...VIEW_DEFAULTS };
    this.crowdGroup = null;
    this.seatDrag = null;
    this.selectedSeat = null;
    this.model = null;
    this.marker = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    let down = null;
    canvas.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY };
      if (this.mode === 'seat' && e.button === 0) { this.seatDrag = {x:e.clientX,y:e.clientY,yaw:this.viewOptions.yaw,pitch:this.viewOptions.pitch}; canvas.setPointerCapture(e.pointerId); }
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.seatDrag || this.mode !== 'seat') return;
      this.setViewOptions({ yaw: this.seatDrag.yaw - (e.clientX-this.seatDrag.x)*.17, pitch: this.seatDrag.pitch + (e.clientY-this.seatDrag.y)*.15 });
    });
    canvas.addEventListener('pointercancel', () => { this.seatDrag = null; });
    canvas.addEventListener('wheel', e => {
      if (this.mode !== 'seat') return;
      e.preventDefault();
      this.setViewOptions({zoom:this.viewOptions.zoom * (e.deltaY>0 ? .92 : 1.087)});
    }, {passive:false});
    canvas.addEventListener('pointerup', e => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && this.mode !== 'seat') this.pick(e);
      down = null;
      this.seatDrag = null;
    });
    this.animate = () => {
      this.frame = requestAnimationFrame(this.animate);
      if (this.mode !== 'seat') this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.resize();
    this.animate();
  }

  resize() {
    const w = Math.max(1, this.canvas.parentElement.clientWidth);
    const h = Math.max(1, this.canvas.parentElement.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    this.root.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
    });
    this.root.clear();
    this.seatMeshes = [];
    this.terraces = [];
    this.marker = null;
    this.crowdGroup = null;
  }

  load(model, retainView = false) {
    const savedUid = this.selectedSeat?.uid;
    this.clear();
    this.model = model;
    const { project, surface, tiers, seats } = model;
    const floor = new THREE.Group();
    if (surface.sport === 'basketball') basketball(floor, surface);
    else if (surface.sport === 'soccer') soccer(floor, surface);
    else football(floor, surface, project);
    this.root.add(floor);
    // Schematic terraces are not displayed under imported seats: they have no surveyed provenance.
    if (model.seatOrigin !== 'imported') for (const tier of tiers) {
      for (const section of project.sections) {
        if (!section.enabled) continue;
        const stand = makeTerrace(section, surface, tier, project);
        this.terraces.push(stand);
        this.root.add(stand);
      }
      addConcourse(this.root, surface, project, tier);
    }
    this.seatMeshes = createSeatMesh(seats, project);
    this.root.add(...this.seatMeshes);
    if (model.seatOrigin !== 'imported') {
      addArchitecturalDetails(this.root,surface,project,tiers);
      addDetailedVenue(this.root,model);
    }
    addSurveyObstacles(this.root,project.survey);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat(0xeff1f1));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.33;
    ground.userData.editorOnly = true;
    this.root.add(ground);
    const grid = new THREE.GridHelper(320, 32, 0xc6cbcc, 0xdde0e0);
    grid.position.y = -0.31;
    grid.material.transparent = true;
    grid.material.opacity = 0.43;
    grid.userData.editorOnly = true;
    this.root.add(grid);
    if (project.roof && model.seatOrigin !== 'imported') this.addRoof();
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.43, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd08035, depthTest: false }));
    this.marker.renderOrder = 10;
    this.marker.userData.editorOnly = true;
    this.root.add(this.marker);
    this.selectedSeat = seats.find(s => s.uid === savedUid) || seats.find(s => s.tier === 0 && s.row === 7) || seats[0] || null;
    this.highlight(this.selectedSeat);
    if (!retainView) this.setView('orbit');
    else if (this.mode === 'seat') this.setView('seat');
  }

  addRoof() {
    const { project, surface, tiers } = this.model;
    const last = tiers[tiers.length - 1];
    const radial = last.startOffset + last.rows * last.depth + 5;
    const height = last.startHeight + last.rows * last.rise + 12;
    const segments = 96, ring = [];
    for (let i = 0; i <= segments; i++) {
      const a = i * TAU / segments;
      const p = modelPerimeterPoint(project, surface, a, radial);
      ring.push(new THREE.Vector3(p.x, height, p.z));
    }
    const vertices = [], indices = [];
    for (let i = 0; i < segments; i++) {
      const a = ring[i], b = ring[i + 1];
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, a.x * 0.82, height + 4, a.z * 0.82, b.x * 0.82, height + 4, b.z * 0.82);
      const j = i * 4;
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8aa1ae, side: THREE.DoubleSide, opacity: 0.22, transparent: true, metalness: 0.65, roughness: 0.3, depthWrite: false })));
  }

  highlight(seat) {
    this.selectedSeat = seat || null;
    if (this.model) this.refreshCrowd();
    if (!this.marker) return;
    this.marker.visible = Boolean(seat);
    if (seat) this.marker.position.set(seat.x, seat.y + 1.42, seat.z);
  }

  pick(event) {
    if (!this.model) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.seatMeshes.slice(0, 1), ...this.terraces], false)[0];
    if (!hit) return;
    if (hit.object.userData.isSeat && Number.isInteger(hit.instanceId)) {
      const seat = this.model.seats[hit.instanceId];
      if (seat) {
        this.highlight(seat);
        this.onSeat(seat);
      }
    } else if (hit.object.userData.sectionId) {
      this.onSection(hit.object.userData.sectionId);
    }
  }

  refreshCrowd() {
    if (this.crowdGroup) {
      this.root.remove(this.crowdGroup);
      this.crowdGroup.traverse(obj=>{ obj.geometry?.dispose(); if(obj.material) obj.material.dispose(); });
    }
    this.crowdGroup = makeLocalCrowd(this.model,this.selectedSeat,this.viewOptions.crowd);
    this.root.add(this.crowdGroup);
  }

  setViewOptions(next) {
    const oldCrowd = this.viewOptions.crowd;
    this.viewOptions = validateViewOptions({...this.viewOptions,...next});
    if (this.viewOptions.crowd !== oldCrowd && this.model) this.refreshCrowd();
    if (this.mode === 'seat') this.applyEyeView();
    return this.viewOptions;
  }

  applyEyeView() {
    if (!this.model || !this.selectedSeat) return;
    const p = viewpoint(this.selectedSeat,this.model.surface,this.viewOptions);
    this.controls.enabled=false;
    this.camera.up.set(0,1,0);
    this.camera.position.set(p.origin.x,p.origin.y,p.origin.z);
    this.camera.lookAt(p.origin.x+p.direction.x*30,p.origin.y+p.direction.y*30,p.origin.z+p.direction.z*30);
    this.camera.fov=p.fov;
    this.camera.updateProjectionMatrix();
    if (this.marker) this.marker.visible=false;
    return p;
  }

  setView(mode) {
    if (!this.model) return;
    this.mode = mode;
    const { surface, tiers } = this.model;
    const span = Math.max(surface.length, surface.width) + tiers.at(-1).startOffset * 2 + 40;
    if (mode === 'orbit') {
      this.controls.enabled = true;
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(span * 0.65, span * 0.57, span * 0.72);
      this.controls.target.set(0, 6, 0);
      this.camera.fov = 52;
      this.camera.updateProjectionMatrix();
      this.controls.update();
    } else if (mode === 'plan') {
      this.controls.enabled = true;
      this.camera.up.set(0, 0, -1);
      this.camera.position.set(0.001, span * 1.18, 0);
      this.controls.target.set(0, 0, 0);
      this.camera.fov = 46;
      this.camera.updateProjectionMatrix();
      this.controls.update();
    } else if (mode === 'section' && this.selectedSeat) {
      this.controls.enabled = true;
      this.camera.up.set(0,1,0);
      const seat = this.selectedSeat, radius = Math.max(1, Math.hypot(seat.x,seat.z));
      this.controls.target.set(seat.x,seat.y+2,seat.z);
      this.camera.position.set(seat.x + seat.x/radius*23,seat.y+18,seat.z + seat.z/radius*23);
      this.camera.fov=51;this.camera.updateProjectionMatrix();this.controls.update();
    } else if (mode === 'seat' && this.selectedSeat) {
      this.applyEyeView();
    }
    if (mode !== 'seat' && this.marker && this.selectedSeat) this.marker.visible = true;
  }

  async exportGLB() {
    if (!this.model) throw new Error('Generate a stadium before exporting.');
    const exporter = new GLTFExporter();
    const hidden = [];
    this.root.traverse(object => {
      if (object.userData.editorOnly && object.visible) { hidden.push(object); object.visible = false; }
    });
    const restore = () => hidden.forEach(object => { object.visible = true; });
    return new Promise((resolve, reject) => {
      try {
        exporter.parse(this.root, result => {
          restore();
          resolve(new Blob([result], { type: 'model/gltf-binary' }));
        }, error => { restore(); reject(error); }, { binary: true, onlyVisible: true, trs: true });
      } catch (error) { restore(); reject(error); }
    });
  }

  capture() { this.renderer.render(this.scene, this.camera); return this.canvas.toDataURL('image/png'); }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clear();
    this.renderer.dispose();
  }
}
