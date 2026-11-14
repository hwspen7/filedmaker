import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SURFACES, TAU, modelPerimeterPoint, modelPerimeterPath, pointAtDistance, seatingIntervals } from './model.mjs';

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
function football(group, surface) {
  const { width: w, length: l, endZone } = surface;
  box(group, w + 10, 0.26, l + 10, 0, -0.13, 0, mat(0x1a413c));
  box(group, w, 0.08, l, 0, 0.035, 0, mat(0x30784e));
  for (let i = 0; i < 12; i++) {
    if (i % 2 === 0) box(group, w, 0.004, l / 12, 0, 0.078, -l / 2 + l * (i + 0.5) / 12, mat(0x347c51));
  }
  for (const side of [-1, 1]) {
    box(group, w, 0.01, endZone, 0, 0.085, side * (l / 2 - endZone / 2), mat(side > 0 ? 0x214e75 : 0x1c655f));
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
    if (i % 2) for (const x of [-w * 0.28, w * 0.28]) stripe(group, x - 0.38, z + 0.65, x + 0.38, z + 0.65, 0.1);
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
  for (let row = 0; row < tier.rows; row++) {
    const radial = tier.startOffset + row * tier.depth;
    const y = tier.startHeight + row * tier.rise - 0.15;
    const path = modelPerimeterPath(project, surface, radial + tier.depth * 0.5);
    const strips = seatingIntervals(path, section, project, tier.id);
    for (const [start, end] of strips) {
      const startAngle = pointAtDistance(path, start).angle;
      const endAngle = pointAtDistance(path, end).angle;
      const spans = Math.max(1, Math.ceil((endAngle - startAngle) * 90 / Math.PI));
      const shade = base.clone().multiplyScalar(0.63 + (row % 2) * 0.045);
      const offset = vertices.length / 3;
      for (let i = 0; i <= spans; i++) {
        const angle = startAngle + (endAngle - startAngle) * i / spans;
        const near = modelPerimeterPoint(project, surface, angle, radial);
        const far = modelPerimeterPoint(project, surface, angle, radial + tier.depth);
        vertices.push(near.x, y, near.z, far.x, y + tier.rise, far.z);
        for (let j = 0; j < 2; j++) colors.push(shade.r, shade.g, shade.b);
        if (i < spans) {
          const k = offset + i * 2;
          indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
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
  const segments = 192, pts = [];
  const radial = tier.startOffset + tier.rows * tier.depth;
  for (let i = 0; i <= segments; i++) {
    const p = modelPerimeterPoint(project, surface, TAU * i / segments, radial);
    pts.push(p.x, tier.startHeight + tier.rows * tier.rise, p.z);
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: 0xc4e0df, transparent: true, opacity: 0.48 })));
}

function createSeatMesh(seats, project) {
  const cushion = new THREE.BoxGeometry(Math.min(0.49, project.seatPitch * 0.86), 0.14, 0.45);
  const back = new THREE.BoxGeometry(Math.min(0.49, project.seatPitch * 0.86), 0.56, 0.095);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.02 });
  const cushionMesh = new THREE.InstancedMesh(cushion, seatMat, seats.length);
  const backMesh = new THREE.InstancedMesh(back, seatMat.clone(), seats.length);
  cushionMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  backMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const object = new THREE.Object3D();
  const color = new THREE.Color();
  const colors = project.sections.map(s => new THREE.Color(s.color));
  seats.forEach((seat, i) => {
    const shade = colors[seat.sectionIndex];
    color.copy(shade).multiplyScalar(0.91 + (seat.row % 3) * 0.045);
    object.position.set(seat.x, seat.y + 0.45, seat.z);
    object.rotation.set(0, seat.yaw, 0);
    object.updateMatrix();
    cushionMesh.setMatrixAt(i, object.matrix);
    cushionMesh.setColorAt(i, color);
    // Local +Z points away from the pitch, opposite the occupant's gaze.
    object.translateZ(-0.2);
    object.position.y = seat.y + 0.75;
    object.updateMatrix();
    backMesh.setMatrixAt(i, object.matrix);
    backMesh.setColorAt(i, color.clone().multiplyScalar(0.8));
  });
  cushionMesh.instanceMatrix.needsUpdate = true;
  backMesh.instanceMatrix.needsUpdate = true;
  if (cushionMesh.instanceColor) cushionMesh.instanceColor.needsUpdate = true;
  if (backMesh.instanceColor) backMesh.instanceColor.needsUpdate = true;
  cushionMesh.userData.isSeat = true;
  return [cushionMesh, backMesh];
}

export class StadiumScene {
  constructor(canvas, onSeat, onSection) {
    this.canvas = canvas;
    this.onSeat = onSeat;
    this.onSection = onSection;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x101b29);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101b29);
    this.scene.fog = new THREE.Fog(0x101b29, 175, 550);
    this.scene.add(new THREE.HemisphereLight(0xcfedfb, 0x344459, 2.15));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
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
    this.selectedSeat = null;
    this.model = null;
    this.marker = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', e => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && this.mode !== 'seat') this.pick(e);
      down = null;
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
  }

  load(model, retainView = false) {
    const savedUid = this.selectedSeat?.uid;
    this.clear();
    this.model = model;
    const { project, surface, tiers, seats } = model;
    const floor = new THREE.Group();
    if (surface.sport === 'basketball') basketball(floor, surface);
    else if (surface.sport === 'soccer') soccer(floor, surface);
    else football(floor, surface);
    this.root.add(floor);
    for (const tier of tiers) {
      for (const section of project.sections) {
        if (!section.enabled) continue;
        const stand = makeTerrace(section, surface, tier, project);
        this.terraces.push(stand);
        this.root.add(stand);
      }
      addConcourse(this.root, surface, project, tier);
    }
    const [bottom, back] = createSeatMesh(seats, project);
    this.seatMeshes = [bottom, back];
    this.root.add(bottom, back);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat(0x172a33));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.33;
    ground.userData.editorOnly = true;
    this.root.add(ground);
    const grid = new THREE.GridHelper(320, 32, 0x415869, 0x2d3d4c);
    grid.position.y = -0.31;
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    grid.userData.editorOnly = true;
    this.root.add(grid);
    if (project.roof) this.addRoof();
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.43, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffc46b, depthTest: false }));
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
    } else if (mode === 'seat' && this.selectedSeat) {
      this.controls.enabled = false;
      const seat = this.selectedSeat;
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(seat.x, seat.y + 1.17, seat.z);
      this.camera.lookAt(0, 1.4, 0);
      this.camera.fov = 72;
      this.camera.updateProjectionMatrix();
      if (this.marker) this.marker.visible = false;
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

  capture() { return this.canvas.toDataURL('image/png'); }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clear();
    this.renderer.dispose();
  }
}
