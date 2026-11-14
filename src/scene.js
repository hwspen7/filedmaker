import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SURFACES, TAU, modelPerimeterPoint, modelPerimeterPath, pointAtDistance, seatingIntervals, resolveSectionTier } from './model.mjs';
import { VIEW_DEFAULTS, validateViewOptions, viewpoint, crowdCandidates, resolveEyeClearance } from './view.mjs';
import { addDetailedVenue } from './architecture.js';
import { seatAssetPlan } from './detailKit.mjs';
import { isOhioReference } from './venues.mjs';
import { treadEdgeCap } from './geometryIntegrity.mjs';

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
  // One-yard hash marks and field-side tick marks. NCAA hash spacing is approximate here.
  for (let i = 1; i < 100; i++) {
    const z = -play/2 + i * play/100;
    if (i%5===0)continue;
    for (const x of [-6.096,6.096])stripe(group,x-.29,z,x+.29,z,.09);
    for (const x of [-w/2+.7,w/2-.7])stripe(group,x-.24,z,x+.24,z,.075);
  }
  if (ohio) {
    const labelMat = new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true});
    function stamp(text, width, depth, x, z, rotation=0, color='#ffffff') {
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
      const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.font='bold 122px Arial, sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,128,1000);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(width,depth), new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
      m.rotation.x=-Math.PI/2;m.rotation.z=rotation;m.position.set(x,.115,z);group.add(m);
    }
    stamp('OHIO STATE',30,8,0,-l/2+endZone/2);
    stamp('BUCKEYES',30,8,0,l/2-endZone/2,Math.PI);
    stamp('O',11,12,0,0,0,'#b31f37');
    for(let yard=10;yard<=50;yard+=10){
      const zz=(yard-50)*play/100;
      for(const sign of [-1,1]){
        stamp(String(yard),4.2,2.2,-w*.33,sign*zz);
        stamp(String(yard),4.2,2.2,w*.33,sign*zz,Math.PI);
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
    const radius = surface.threePointRadiusM ?? 7.24;
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
      const shade = base.clone().lerp(new THREE.Color(0xb7b8b5),.89).multiplyScalar(.93 + (row % 2) * .06);
      const offset = vertices.length / 3;
      for (let i = 0; i <= spans; i++) {
        const angle = startAngle + (endAngle - startAngle) * i / spans;
        const near = modelPerimeterPoint(project, surface, angle, radial);
        const far = modelPerimeterPoint(project, surface, angle, radial + profile.depth);
        // Flat tread followed by a concrete riser: not a single smooth sloped sheet.
        vertices.push(near.x, y, near.z, far.x, y, far.z,
          far.x, y + profile.rise, far.z);
        for (let j = 0; j < 3; j++) {
          const fac = j === 2 ? .72 : 1;
          colors.push(shade.r * fac, shade.g * fac, shade.b * fac);
        }
        if (i < spans) {
          const k = offset + i * 3;
          indices.push(k, k+1, k+3, k+1, k+4, k+3);
          indices.push(k+1,k+2,k+4,k+2,k+5,k+4);
        }
      }
      // Seal exposed tread edges on both sides of aisle/vomitory cuts.
      // These edge skirts are part of the same terrace mesh, eliminating
      // background-colored "holes" produced by one-sided stepped sheets.
      for(const distance of [start,end]) {
        const corners=treadEdgeCap(project,surface,path,radial,profile.depth,y,distance);
        const k=vertices.length/3;
        for(const point of corners)vertices.push(point.x,point.y,point.z);
        const tone=shade.clone().multiplyScalar(.79);
        for(let j=0;j<4;j++)colors.push(tone.r,tone.g,tone.b);
        indices.push(k,k+1,k+2,k+1,k+3,k+2);
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
  mesh.userData.closedTreadCuts = true;
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

function createSeatMesh(seats, project) {
  // Seven draw calls irrespective of stadium capacity. The seat body is always
  // instance #0 so raycast instanceId continues to match model.seats[] exactly.
  const high=project.detailLevel==='high', dims=seatAssetPlan(project);
  const steel=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.52,metalness:.42});
  const upholstery=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.75,metalness:.06});
  const seatWidth=dims.seatWidth;
  // Round-edged, thinner seat and backrest remain instanced. Geometry is
  // shared by all seats, even in a 100k-capacity campus stadium.
  const seatBody=high ? new RoundedBoxGeometry(seatWidth,dims.seatThickness,dims.seatDepth,2,.018)
    : new THREE.BoxGeometry(seatWidth,dims.seatThickness,dims.seatDepth);
  const chairBack=high ? new RoundedBoxGeometry(seatWidth*.94,dims.backHeight,dims.backThickness,2,.018)
    : new THREE.BoxGeometry(seatWidth*.94,dims.backHeight,dims.backThickness);
  const defs=[
    [seatBody,upholstery],
    [new THREE.BoxGeometry(seatWidth*.88,.018,.028),upholstery],
    [chairBack,upholstery],
    [new THREE.BoxGeometry(dims.legThickness,.36,.035),steel],
    [new THREE.BoxGeometry(dims.legThickness,.36,.035),steel],
    [new THREE.BoxGeometry(dims.armThickness,.041,.27),steel],
    [new THREE.BoxGeometry(dims.armThickness,.041,.27),steel],
  ];
  const meshes=defs.map(([geometry,m])=>new THREE.InstancedMesh(geometry,m,seats.length));
  const colors=project.sections.map(v=>new THREE.Color(v.color));
  const o=new THREE.Object3D(), seatTint=new THREE.Color(), silver=new THREE.Color(0xaeb5b8);
  const steelTint=new THREE.Color(0x89949b);
  const position=(seat,index,i,dx,dy,dz,show=true,lean=0)=>{
    o.position.set(seat.x,seat.y+dy,seat.z);
    o.rotation.set(lean,seat.yaw||0,0);
    o.scale.setScalar(show?1:0);
    o.translateX(dx);o.translateZ(dz);
    o.updateMatrix();meshes[i].setMatrixAt(index,o.matrix);
  };
  seats.forEach((seat,index)=>{
    const chair=dims.styleForTier(seat.tier)==='chair';
    const base=colors[seat.sectionIndex]||new THREE.Color(0x87979b);
    seatTint.copy(base).lerp(silver,chair?.24:.82);
    seatTint.multiplyScalar(.965+(seat.row%3)*.012);
    position(seat,index,0,0,dims.seatHeight,0);
    position(seat,index,1,0,dims.seatHeight+.008,.187,high);
    position(seat,index,2,0,.74,-.185,chair,-.09);
    position(seat,index,3,-seatWidth*.38,.247,-.13,high);
    position(seat,index,4,seatWidth*.38,.247,-.13,high);
    position(seat,index,5,-seatWidth*.49,.625,.065,high && chair);
    position(seat,index,6,seatWidth*.49,.625,.065,high && chair);
    for(const i of [0,1,2]) meshes[i].setColorAt(index,seatTint);
    for(const i of [3,4,5,6]) meshes[i].setColorAt(index,steelTint);
  });
  meshes.forEach((mesh,i)=>{
    mesh.userData.originalMatrices = mesh.instanceMatrix.array.slice();
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.userData.architecturalQuality=i?'seat detail component':'primary seat picking surface';
  });
  meshes[0].userData.isSeat=true;
  meshes[2].userData.isSeat=true; // Backrest shares the seat instance index.
  return meshes;
}

// Architectural context is schematic, not a scanned/surveyed building model.
function addArchitecturalDetails(group, surface, project, tiers) {
  // Continuous parapet shells used to seal aisle gaps at the tier front.
  // Derive wall strips from the same row-level seating intervals so walkways
  // and open entrances remain open in both the model and the human-eye view.
  const vertices=[], indices=[];
  for (const tier of tiers) for(const section of project.sections){
    if(!section.enabled)continue;
    const p=resolveSectionTier(tier,section.id,project);
    if(!p.rows)continue;
    const edges=[
      {r:p.startOffset, row:1, y:p.startHeight, h:.62},
      {r:p.startOffset+p.rows*p.depth,row:p.rows,y:p.startHeight+p.rows*p.rise,h:.85},
    ];
    for(const e of edges){
      const path=modelPerimeterPath(project,surface,e.r,320);
      const strips=seatingIntervals(path,section,project,tier.id,e.row);
      for(const [start,end] of strips){
        const divisions=Math.max(1,Math.ceil((end-start)/2.5));
        for(let j=0;j<divisions;j++){
          const a=pointAtDistance(path,start+(end-start)*j/divisions);
          const b=pointAtDistance(path,start+(end-start)*(j+1)/divisions);
          const k=vertices.length/3;
          vertices.push(a.x,e.y,a.z,b.x,e.y,b.z,a.x,e.y+e.h,a.z,b.x,e.y+e.h,b.z);
          indices.push(k,k+1,k+2,k+1,k+3,k+2);
        }
      }
    }
  }
  if(vertices.length){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    const parapets=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xb8c2c5,roughness:.92,side:THREE.DoubleSide}));
    parapets.userData.architecturalQuality='aisle-clipped parapet';group.add(parapets);
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
    this.hiddenSeatIndex=-1;
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
    this.nearbySeats = this.model && seat ? crowdCandidates(this.model,seat,32) : [];
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
    const hit = this.raycaster.intersectObjects([this.seatMeshes[0], this.seatMeshes[2], ...this.terraces].filter(Boolean), false)[0];
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

  hideCurrentSeatForViewer(shouldHide) {
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
        const saved=mesh.userData.originalMatrices;
        if (saved) mesh.setMatrixAt(previous,restore.fromArray(saved,previous*16));
      }
      if (current >= 0) mesh.setMatrixAt(current,zero);
      mesh.instanceMatrix.needsUpdate=true;
    }
    this.hiddenSeatIndex=current;
  }

  applyEyeView() {
    if (!this.model || !this.selectedSeat) return;
    const p = viewpoint(this.selectedSeat,this.model.surface,this.viewOptions);
    this.controls.enabled=false;
    this.hideCurrentSeatForViewer(true);
    this.camera.near=.045;
    this.camera.up.set(0,1,0);
    // Do not let the camera enter a neighboring chair's rendered backrest.
    // The authored seat position and the viewer's gaze remain unchanged.
    const safe=resolveEyeClearance(this.selectedSeat,p.origin,this.nearbySeats||[]);
    this.camera.position.set(safe.origin.x,safe.origin.y,safe.origin.z);
    this.camera.lookAt(safe.origin.x+p.direction.x*30,safe.origin.y+p.direction.y*30,safe.origin.z+p.direction.z*30);
    this.camera.fov=p.fov;
    this.camera.updateProjectionMatrix();
    if (this.marker) this.marker.visible=false;
    return p;
  }

  setView(mode) {
    if (!this.model) return;
    this.mode = mode;
    if(mode!=='seat') { this.hideCurrentSeatForViewer(false);this.camera.near=.08; }
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
    const wasHumanView = this.mode === 'seat';
    this.hideCurrentSeatForViewer(false);
    const hidden = [];
    this.root.traverse(object => {
      if (object.userData.editorOnly && object.visible) { hidden.push(object); object.visible = false; }
    });
    const restore = () => {hidden.forEach(object => { object.visible = true; });if(wasHumanView) this.hideCurrentSeatForViewer(true);};
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
