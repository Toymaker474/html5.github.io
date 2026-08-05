import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

await RAPIER.init();


const authoredLoader = new GLTFLoader();
const AUTHORED_ASSET_URLS = {
  trilobite: './assets/quaternius-scifi/Enemy_Trilobite/Enemy_Trilobite.gltf',
  quadShell: './assets/quaternius-scifi/Enemy_QuadShell/Enemy_QuadShell.gltf',
  eyeDrone: './assets/quaternius-scifi/Enemy_EyeDrone/Enemy_EyeDrone.gltf'
};
const AUTHORED_ASSETS = Object.fromEntries(await Promise.all(
  Object.entries(AUTHORED_ASSET_URLS).map(async ([key, url]) => [key, await authoredLoader.loadAsync(url)])
));

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const distance = (a, b) => Math.sqrt(dist2(a, b));
const now = () => performance.now() * 0.001;

class RNG {
  constructor(seed = 728173) { this.seed = seed >>> 0; }
  next() { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}

const SEED = 684219;
const rng = new RNG(SEED);

const PARTS = {
  core: { name: 'CORE', cost: 22, mass: 3, health: 50, required: true, max: 1, desc: 'brain + control bus' },
  battery: { name: 'BATTERY', cost: 12, mass: 1.3, health: 18, max: 4, energy: 45, desc: '+45 energy' },
  wheel: { name: 'WHEEL', cost: 8, mass: .55, health: 12, max: 6, motor: 1, desc: 'locomotion motor' },
  leg: { name: 'SERVO LEG', cost: 11, mass: .9, health: 16, max: 4, motor: 1.25, terrain: .18, desc: 'strong terrain motor' },
  sensor: { name: 'SENSOR EYE', cost: 10, mass: .35, health: 10, max: 4, sensor: 5.5, desc: '+sensing range' },
  cargo: { name: 'CARGO BIN', cost: 10, mass: .8, health: 14, max: 3, cargo: 10, desc: '+10 carrying' },
  builder: { name: 'BUILD ARM', cost: 17, mass: 1.1, health: 16, max: 2, builder: 1, desc: 'constructs structures' },
  repair: { name: 'REPAIR ARM', cost: 17, mass: 1.0, health: 16, max: 2, repair: 1, desc: 'repairs robots' },
  weapon: { name: 'CUTTER', cost: 18, mass: 1.1, health: 14, max: 2, weapon: 1, desc: 'defends colony' },
  solar: { name: 'SOLAR PANEL', cost: 14, mass: .6, health: 10, max: 3, solar: 1, desc: 'slow passive charge' },
  armor: { name: 'ARMOR', cost: 9, mass: 1.4, health: 32, max: 4, armor: 1, desc: '+durability, +mass' }
};

const STRUCTURES = {
  charger: { name: 'CHARGER', cost: 45, color: 0x2ee5ff, size: [2.4, .55, 2.4], desc: 'restores robot energy' },
  repair: { name: 'REPAIR STATION', cost: 60, color: 0x6dff9d, size: [2.8, .6, 2.8], desc: 'repairs damaged robots' },
  wall: { name: 'WALL', cost: 24, color: 0x6d7d99, size: [4, 1.5, .45], desc: 'blocks drones and robots' },
  generator: { name: 'GENERATOR', cost: 75, color: 0xffc95c, size: [2, 2.2, 2], desc: 'powers nearby structures' },
  reproduction: { name: 'REPRODUCTION LAB', cost: 95, color: 0xd27cff, size: [3.2, .7, 3.2], desc: 'combines traits into offspring' },
  beacon: { name: 'RESEARCH BEACON', cost: 180, color: 0xffffff, size: [2.6, 5.5, 2.6], desc: 'colony victory structure' }
};

const DEFAULT_BLUEPRINT = {
  name: 'FORAGER-A',
  parts: { core: 1, battery: 2, wheel: 4, leg: 0, sensor: 2, cargo: 1, builder: 1, repair: 0, weapon: 0, solar: 1, armor: 1 },
  traits: { curiosity: .65, caution: .35, aggression: .18, cooperation: .78, efficiency: .72, mutation: .11 }
};

const state = {
  tick: 0,
  time: 0,
  matter: 190,
  paused: false,
  speed: 1,
  gravity: -9.8,
  ambientTemp: 22,
  quality: 'medium',
  activeTool: 'inspect',
  selected: null,
  selectedBuild: null,
  blueprint: structuredClone(DEFAULT_BLUEPRINT),
  robots: [],
  resources: [],
  structures: [],
  jobs: [],
  hazards: [],
  drones: [],
  detached: [],
  snapshots: [],
  messages: [],
  magnetPulse: null,
  objective: 'running',
  nextRobotId: 1,
  nextStructureId: 1,
  nextResourceId: 1,
  nextDroneId: 1,
  lastReproduction: -999,
  autosaveClock: 0
};

const canvas = $('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b08);
scene.fog = new THREE.FogExp2(0x11160f, 0.013);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 160);
camera.position.set(7.4, 4.8, 11.8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, .72, 3.25);
controls.enableDamping = true;
controls.dampingFactor = .07;
controls.minDistance = 4.2;
controls.maxDistance = 48;
controls.maxPolarAngle = Math.PI * .48;
controls.screenSpacePanning = false;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

scene.add(new THREE.HemisphereLight(0xe8eee5, 0x171a14, 2.8));
const keyLight = new THREE.DirectionalLight(0xffe8c8, 4.4);
keyLight.position.set(8, 18, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -24;
keyLight.shadow.camera.right = 24;
keyLight.shadow.camera.top = 24;
keyLight.shadow.camera.bottom = -24;
scene.add(keyLight);
const cyanLight = new THREE.PointLight(0xa9c1b4, 38, 30, 2);
cyanLight.position.set(-10, 8, -8);
scene.add(cyanLight);
const magentaLight = new THREE.PointLight(0xd0a15f, 30, 26, 2);
magentaLight.position.set(10, 6, 9);
scene.add(magentaLight);
const frontFill = new THREE.DirectionalLight(0xdde7dc, 2.7);
frontFill.position.set(0, 5, 13);
scene.add(frontFill);
const lowFill = new THREE.PointLight(0xb99b6a, 18, 18, 2);
lowFill.position.set(0, 1.7, 6);
scene.add(lowFill);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const physics = new RAPIER.World({ x: 0, y: state.gravity, z: 0 });
physics.timestep = 1 / 60;

const floorMesh = new THREE.Mesh(
  new THREE.BoxGeometry(36, .35, 36),
  new THREE.MeshStandardMaterial({ color: 0x252a21, metalness: .18, roughness: .74 })
);
floorMesh.position.y = -.2;
floorMesh.receiveShadow = true;
floorMesh.userData.ground = true;
worldGroup.add(floorMesh);
const floorBody = physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -.2, 0));
physics.createCollider(RAPIER.ColliderDesc.cuboid(18, .175, 18).setFriction(1), floorBody);

const grid = new THREE.GridHelper(36, 36, 0x69705f, 0x292e26);
grid.position.y = .001;
grid.material.opacity = .16;
grid.material.transparent = true;
worldGroup.add(grid);

const cubeEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(36, 18, 36)),
  new THREE.LineBasicMaterial({ color: 0x829183, transparent: true, opacity: .22 })
);
cubeEdges.position.y = 8.8;
worldGroup.add(cubeEdges);
const glassCube = new THREE.Mesh(
  new THREE.BoxGeometry(36, 18, 36),
  new THREE.MeshPhysicalMaterial({ color: 0x79eaff, transparent: true, opacity: .025, roughness: .05, metalness: .05, transmission: .3, side: THREE.BackSide, depthWrite: false })
);
glassCube.position.y = 8.8;
worldGroup.add(glassCube);

const liquidZone = new THREE.Mesh(
  new THREE.BoxGeometry(8, 1.2, 7),
  new THREE.MeshPhysicalMaterial({ color: 0x1677ff, transparent: true, opacity: .22, transmission: .42, roughness: .12, depthWrite: false })
);
liquidZone.position.set(-10, .55, 9);
liquidZone.userData.zone = 'liquid';
worldGroup.add(liquidZone);

const interactive = [];
const tempVec = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();

function vibrate(pattern = 18) {
  try { navigator.vibrate?.(pattern); } catch { /* iOS may ignore */ }
}

function toast(text, seconds = 2.2) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), seconds * 1000);
}

function hslColor(h, s = .8, l = .55) {
  const c = new THREE.Color();
  c.setHSL(h, s, l);
  return c;
}

function makeGlow(color, intensity = 1.6) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, metalness: .35, roughness: .22 });
}

function aggregateBlueprint(bp) {
  const p = bp.parts;
  let cost = 0, mass = 0, maxHealth = 0, maxEnergy = 25, motor = 0, sensor = 3.5, cargo = 4, builder = 0, repair = 0, weapon = 0, solar = 0, armor = 0;
  for (const [k, count] of Object.entries(p)) {
    const def = PARTS[k];
    if (!def) continue;
    cost += def.cost * count;
    mass += def.mass * count;
    maxHealth += def.health * count;
    maxEnergy += (def.energy || 0) * count;
    motor += (def.motor || 0) * count;
    sensor += (def.sensor || 0) * count;
    cargo += (def.cargo || 0) * count;
    builder += (def.builder || 0) * count;
    repair += (def.repair || 0) * count;
    weapon += (def.weapon || 0) * count;
    solar += (def.solar || 0) * count;
    armor += (def.armor || 0) * count;
  }
  const locomotion = p.wheel + p.leg;
  const valid = p.core === 1 && locomotion >= 2 && p.battery >= 1 && p.sensor >= 1;
  const speed = valid ? clamp((motor * 2.7) / Math.max(3, mass * .34), 1.4, 8.5) : 0;
  return { cost, mass, maxHealth, maxEnergy, speed, sensor, cargo, builder, repair, weapon, solar, armor, valid };
}

function robotRole(parts) {
  if (parts.weapon > 0) return 'sentinel';
  if (parts.builder > 0) return 'constructor';
  if (parts.repair > 0) return 'medic';
  if (parts.cargo > 1) return 'hauler';
  return 'scout';
}

const ROBOT_ROLE_PALETTE = {
  scout: { paint: 0x6f7f82, accent: 0x9fc7c8, mark: 0xc6a45d },
  constructor: { paint: 0x8b7040, accent: 0xd1a84d, mark: 0xe4c675 },
  medic: { paint: 0x6f806d, accent: 0xaac1a2, mark: 0xd8ded2 },
  sentinel: { paint: 0x74483f, accent: 0xb66c5b, mark: 0xd9a17e },
  hauler: { paint: 0x777160, accent: 0xb2a47f, mark: 0xd4c69d }
};

function robotMaterial(color, metalness = .62, roughness = .46, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function addCastShadow(object) {
  object.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
}

function boxPart(size, material, position = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinderPart(radius, length, material, radial = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radial), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function beamBetween(a, b, radius, material, radial = 10) {
  const start = new THREE.Vector3(a[0], a[1], a[2]);
  const end = new THREE.Vector3(b[0], b[1], b[2]);
  const direction = end.clone().sub(start);
  const mesh = cylinderPart(radius, direction.length(), material, radial);
  mesh.position.copy(start.add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createWheelAssembly(side, z, radius, materials) {
  const suspension = new THREE.Group();
  suspension.position.set(side * .82, .29, z);

  const upper = beamBetween([0, .34, 0], [side * .16, .02, 0], .055, materials.dark, 8);
  suspension.add(upper);

  const hubCarrier = new THREE.Group();
  hubCarrier.position.set(side * .18, 0, 0);
  suspension.add(hubCarrier);

  const spin = new THREE.Group();
  spin.rotation.z = Math.PI / 2;
  hubCarrier.add(spin);

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, .24, 18),
    materials.tire
  );
  tire.castShadow = true;
  spin.add(tire);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * .48, radius * .48, .265, 14),
    materials.accent
  );
  hub.castShadow = true;
  spin.add(hub);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * .18, radius * .18, .28, 12),
    materials.dark
  );
  spin.add(cap);

  return { root: suspension, carrier: hubCarrier, spin, radius, side, z };
}

function createLegAssembly(side, z, phase, materials) {
  const hip = new THREE.Group();
  hip.position.set(side * .72, 1.08, z);

  const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 8), materials.accent);
  hip.add(hipJoint);

  const upper = new THREE.Group();
  upper.position.y = -.04;
  hip.add(upper);
  upper.add(beamBetween([0, 0, 0], [side * .10, -.48, .05], .075, materials.frame, 8));

  const knee = new THREE.Group();
  knee.position.set(side * .10, -.48, .05);
  upper.add(knee);
  knee.add(new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), materials.accent));
  knee.add(beamBetween([0, 0, 0], [-side * .07, -.47, -.03], .065, materials.dark, 8));

  const ankle = new THREE.Group();
  ankle.position.set(-side * .07, -.47, -.03);
  knee.add(ankle);
  ankle.add(new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 7), materials.accent));

  const foot = boxPart([.28, .11, .43], materials.tire, [0, -.08, -.11]);
  ankle.add(foot);

  return { root: hip, upper, knee, ankle, foot, phase, side, z, baseY: 1.08 };
}

function createManipulator(side, kind, materials) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * .72, .93, .24);
  shoulder.add(new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 8), materials.accent));

  const upper = new THREE.Group();
  shoulder.add(upper);
  upper.add(beamBetween([0, 0, 0], [side * .14, .42, -.06], .07, materials.frame, 8));

  const elbow = new THREE.Group();
  elbow.position.set(side * .14, .42, -.06);
  upper.add(elbow);
  elbow.add(new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), materials.accent));
  elbow.add(beamBetween([0, 0, 0], [side * .10, .35, -.12], .055, materials.dark, 8));

  const wrist = new THREE.Group();
  wrist.position.set(side * .10, .35, -.12);
  elbow.add(wrist);

  if (kind === 'builder') {
    const clampBody = boxPart([.24, .16, .25], materials.accent, [side * .04, .04, -.08]);
    wrist.add(clampBody);
    const jawA = boxPart([.06, .22, .08], materials.tool, [side * .12, .03, -.18]);
    const jawB = jawA.clone();
    jawB.position.x *= -1;
    wrist.add(jawA, jawB);
  } else if (kind === 'repair') {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(.13, .18, .25, 10), materials.tool);
    head.rotation.x = Math.PI / 2;
    head.position.z = -.16;
    wrist.add(head);
    const needle = cylinderPart(.025, .34, materials.accent, 8);
    needle.rotation.x = Math.PI / 2;
    needle.position.z = -.32;
    wrist.add(needle);
  } else {
    const cutter = new THREE.Mesh(new THREE.ConeGeometry(.16, .54, 8), materials.tool);
    cutter.rotation.x = -Math.PI / 2;
    cutter.position.z = -.27;
    wrist.add(cutter);
  }

  return { root: shoulder, upper, elbow, wrist, kind, side };
}

const AUTHORED_ROLE_STYLE = {
  scout: { asset: 'eyeDrone', span: 1.35, core: 0xb9d7cd, mark: 0xd7b85f, y: .12 },
  constructor: { asset: 'trilobite', span: 1.92, core: 0xf0ba58, mark: 0xd59b38, y: 0 },
  medic: { asset: 'quadShell', span: 1.72, core: 0x9bd5bf, mark: 0xc8e4d6, y: 0 },
  sentinel: { asset: 'quadShell', span: 1.78, core: 0xe27e62, mark: 0xd46850, y: 0 },
  hauler: { asset: 'trilobite', span: 2.02, core: 0xc9a96a, mark: 0xb8924f, y: 0 }
};

function cloneAuthoredScene(asset) {
  const root = SkeletonUtils.clone(asset.scene);
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (Array.isArray(object.material)) object.material = object.material.map(material => material.clone());
    else if (object.material) object.material = object.material.clone();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach(material => {
      if (material.color) material.color.offsetHSL(0, -.04, .075);
      if ('roughness' in material) material.roughness = Math.max(.28, material.roughness * .86);
      if ('metalness' in material) material.metalness = Math.min(.82, Math.max(.34, material.metalness));
      if ('emissive' in material) {
        material.emissive.set(0x111610);
        material.emissiveIntensity = .28;
      }
    });
  });
  return root;
}

function hardwareMaterial(color, roughness = .42, metalness = .72) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function moduleBox(size, material, position) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function moduleCylinder(radius, length, material, position, rotation = [0, 0, 0], radial = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radial), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addAuthoredModules(robot, group, bounds, style) {
  const p = robot.blueprint.parts;
  const height = bounds.max.y - bounds.min.y;
  const width = bounds.max.x - bounds.min.x;
  const length = bounds.max.z - bounds.min.z;
  const top = bounds.max.y;
  const front = bounds.min.z;
  const dark = hardwareMaterial(0x171b18, .5, .84);
  const frame = hardwareMaterial(0x3a403a, .42, .8);
  const mark = hardwareMaterial(style.mark, .34, .68);
  const attachments = new THREE.Group();
  attachments.name = 'functional-modules';
  group.add(attachments);

  const coreCage = new THREE.Group();
  coreCage.position.set(0, top + .07, -length * .08);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: style.core,
    emissive: style.core,
    emissiveIntensity: 1.8,
    roughness: .18,
    metalness: .25,
    transparent: true,
    opacity: .92
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.14 + Math.min(.04, p.core * .02), 2), coreMaterial);
  core.castShadow = true;
  coreCage.add(core);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(.20 + i * .025, .012, 6, 24),
      new THREE.MeshStandardMaterial({ color: i === 1 ? style.mark : 0x667066, metalness: .84, roughness: .3 })
    );
    ring.rotation.set(i === 0 ? Math.PI / 2 : 0, i === 1 ? Math.PI / 2 : 0, i === 2 ? Math.PI / 2 : 0);
    coreCage.add(ring);
  }
  attachments.add(coreCage);

  const neuralLines = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * Math.PI * 2;
    const material = new THREE.LineBasicMaterial({ color: style.core, transparent: true, opacity: .48 });
    const points = [
      new THREE.Vector3(0, top + .05, -length * .08),
      new THREE.Vector3(Math.cos(angle) * width * .32, top - height * .18, Math.sin(angle) * length * .28)
    ];
    neuralLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }
  attachments.add(neuralLines);

  const batteryCount = Math.min(3, p.battery || 0);
  for (let i = 0; i < batteryCount; i++) {
    const x = (i - (batteryCount - 1) / 2) * .27;
    attachments.add(moduleCylinder(.075, .34, dark, [x, top + .02, length * .24], [Math.PI / 2, 0, 0], 10));
    attachments.add(moduleCylinder(.046, .35, mark, [x, top + .02, length * .24], [Math.PI / 2, 0, 0], 10));
  }

  if (p.cargo > 0) {
    const rack = new THREE.Group();
    rack.position.set(0, top + .02, length * .30);
    rack.add(moduleBox([Math.max(.62, width * .65), .09, Math.max(.42, length * .34)], dark, [0, 0, 0]));
    const crates = Math.min(3, p.cargo);
    for (let i = 0; i < crates; i++) {
      rack.add(moduleBox([.24, .20, .30], i % 2 ? frame : mark, [(i - (crates - 1) / 2) * .27, .14, 0]));
    }
    attachments.add(rack);
  }

  const toolMounts = [];
  const makeTool = (side, kind) => {
    const mount = new THREE.Group();
    mount.position.set(side * width * .48, top - height * .25, front + length * .20);
    mount.add(moduleCylinder(.065, .30, frame, [side * .08, .06, -.04], [0, 0, side * .55], 10));
    const head = new THREE.Group();
    head.position.set(side * .16, .16, -.13);
    if (kind === 'builder') {
      head.add(moduleBox([.18, .12, .20], mark, [0, 0, 0]));
      head.add(moduleBox([.035, .18, .07], dark, [-.075, -.02, -.13]));
      head.add(moduleBox([.035, .18, .07], dark, [.075, -.02, -.13]));
    } else if (kind === 'repair') {
      head.add(moduleCylinder(.10, .18, mark, [0, 0, -.06], [Math.PI / 2, 0, 0], 12));
      head.add(moduleCylinder(.018, .30, hardwareMaterial(style.core, .2, .3), [0, 0, -.25], [Math.PI / 2, 0, 0], 8));
    } else {
      const cutter = new THREE.Mesh(new THREE.ConeGeometry(.10, .42, 8), mark);
      cutter.rotation.x = -Math.PI / 2;
      cutter.position.z = -.20;
      cutter.castShadow = true;
      head.add(cutter);
    }
    mount.add(head);
    attachments.add(mount);
    toolMounts.push({ mount, head, kind, side });
  };
  if (p.builder > 0) makeTool(1, 'builder');
  if (p.repair > 0) makeTool(-1, 'repair');
  if (p.weapon > 0) makeTool(1, 'weapon');

  if (p.armor > 0) {
    const plateMaterial = hardwareMaterial(0x596057, .48, .8);
    attachments.add(moduleBox([Math.max(.52, width * .48), .055, Math.max(.36, length * .22)], plateMaterial, [0, top + .12, -length * .26]));
  }

  return { attachments, core, coreCage, neuralLines, toolMounts };
}

function findAuthoredClip(rig, candidates) {
  for (const name of candidates) {
    const clip = THREE.AnimationClip.findByName(rig.clips, name);
    if (clip) return clip;
  }
  return rig.clips[0] || null;
}

function playAuthoredClip(robot, candidates, fade = .16) {
  const rig = robot.visualRig;
  if (!rig?.mixer) return;
  const clip = findAuthoredClip(rig, candidates);
  if (!clip || rig.clipName === clip.name) return;
  const previous = rig.action;
  const next = rig.mixer.clipAction(clip);
  next.enabled = true;
  next.reset();
  next.setEffectiveTimeScale(1);
  next.setEffectiveWeight(1);
  if (clip.name === 'TurnOff') {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }
  next.play();
  if (previous && previous !== next) previous.crossFadeTo(next, fade, false);
  rig.action = next;
  rig.clipName = clip.name;
}

function authoredClipForRobot(robot, planarSpeed) {
  if (robot.disabled || robot.health <= 0) return ['TurnOff', 'Hit', 'Idle'];
  if (robot.state === 'ATTACK') return ['AttackAuto', 'Attack', 'Charge', 'BackFlip'];
  if (robot.state === 'BUILD') return ['AttackAuto', 'Charge', 'Attack', 'Look'];
  if (robot.state === 'REPAIR_ALLY' || robot.state === 'SEEK_REPAIR') return ['Look', 'Charging', 'Idle'];
  if (robot.state === 'FLEE') return ['Run', 'Walk', 'BackFlip'];
  if (planarSpeed > Math.max(1.4, robot.stats.speed * .42)) return ['Run', 'Walk', 'Idle'];
  if (planarSpeed > .14) return ['Walk', 'Run', 'Idle'];
  return ['Idle', 'Look', 'Hanging'];
}

function robotVisual(robot) {
  const p = robot.blueprint.parts;
  const role = robotRole(p);
  const style = AUTHORED_ROLE_STYLE[role] || AUTHORED_ROLE_STYLE.scout;
  const asset = AUTHORED_ASSETS[style.asset];
  const group = new THREE.Group();
  group.name = `R-${robot.id}-${role}-authored`;

  const authoredRoot = new THREE.Group();
  const model = cloneAuthoredScene(asset);
  authoredRoot.add(model);
  group.add(authoredRoot);

  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const scale = style.span / Math.max(rawSize.x, rawSize.z, .001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  model.position.set(-scaledCenter.x, -scaledBox.min.y + style.y, -scaledCenter.z);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);

  const modules = addAuthoredModules(robot, group, bounds, style);
  robot.color = new THREE.Color(style.mark);
  robot.coreMesh = modules.core;

  const sensorCone = new THREE.Mesh(
    new THREE.ConeGeometry(Math.min(3.7, robot.stats.sensor * .25), Math.min(8, robot.stats.sensor), 20, 1, true),
    new THREE.MeshBasicMaterial({ color: style.core, transparent: true, opacity: .035, side: THREE.DoubleSide, depthWrite: false })
  );
  sensorCone.rotation.x = Math.PI / 2;
  sensorCone.position.set(0, Math.max(.55, bounds.max.y * .58), -robot.stats.sensor * .46);
  sensorCone.visible = false;
  group.add(sensorCone);
  robot.sensorCone = sensorCone;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(.78, style.span * .47), Math.max(.84, style.span * .51), 40),
    new THREE.MeshBasicMaterial({ color: style.mark, transparent: true, opacity: .76, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .025;
  ring.visible = false;
  group.add(ring);
  robot.selectionRing = ring;

  const mixer = new THREE.AnimationMixer(model);
  robot.visualRig = {
    version: 6,
    role,
    style,
    authoredRoot,
    model,
    mixer,
    clips: asset.animations,
    action: null,
    clipName: '',
    lastTime: state.time,
    baseY: authoredRoot.position.y,
    modules,
    pulse: robot.id * .71,
    lean: 0,
    damage: 0
  };
  playAuthoredClip(robot, ['Idle', 'Look', 'Hanging'], 0);

  group.userData.entity = robot;
  group.traverse(object => {
    if (!object.isMesh) return;
    object.userData.entity = robot;
    interactive.push(object);
  });
  return group;
}

function removeRobotInteractive(robot) {
  for (let index = interactive.length - 1; index >= 0; index--) {
    if (interactive[index]?.userData?.entity === robot) interactive.splice(index, 1);
  }
}

function rebuildRobotVisual(robot) {
  if (!robot?.mesh) return;
  const old = robot.mesh;
  const position = old.position.clone();
  const quaternion = old.quaternion.clone();
  const visible = old.visible;
  removeRobotInteractive(robot);
  worldGroup.remove(old);
  robot.mesh = robotVisual(robot);
  robot.mesh.position.copy(position);
  robot.mesh.quaternion.copy(quaternion);
  robot.mesh.visible = visible;
  worldGroup.add(robot.mesh);
}

function spawnRobot(blueprint, position = { x: 0, y: 1.2, z: 0 }, lineage = {}) {
  const bp = structuredClone(blueprint);
  const stats = aggregateBlueprint(bp);
  if (!stats.valid) return null;
  const robot = {
    kind: 'robot',
    id: state.nextRobotId++,
    blueprint: bp,
    stats,
    traits: structuredClone(bp.traits || DEFAULT_BLUEPRINT.traits),
    generation: lineage.generation || 1,
    parents: lineage.parents || [],
    born: state.time,
    age: 0,
    health: stats.maxHealth,
    energy: stats.maxEnergy * .88,
    temperature: state.ambientTemp,
    cargo: 0,
    state: 'BOOT',
    stateTime: 0,
    target: null,
    manualTarget: null,
    disabled: false,
    attackCooldown: 0,
    repairCooldown: 0,
    decision: {},
    lastPosition: { x: position.x, z: position.z },
    stuckTime: 0
  };
  robot.mesh = robotVisual(robot);
  worldGroup.add(robot.mesh);
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z)
    .setLinearDamping(2.2)
    .setAngularDamping(4.8)
    .setCcdEnabled(true);
  robot.body = physics.createRigidBody(bodyDesc);
  const hx = .78 + stats.mass * .006;
  const hy = .52;
  const hz = .96 + stats.mass * .004;
  const collider = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setDensity(Math.max(.45, stats.mass / 6))
    .setFriction(1.15)
    .setRestitution(.05);
  robot.collider = physics.createCollider(collider, robot.body);
  state.robots.push(robot);
  toast(`Robot R-${robot.id} deployed`);
  return robot;
}

function createResource(position, amount = 38) {
  const res = { kind: 'resource', id: state.nextResourceId++, amount, maxAmount: amount, position: { ...position }, temperature: state.ambientTemp };
  const group = new THREE.Group();
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.48 + amount * .004, 1), makeGlow(0x56f4ff, 2.8));
  crystal.castShadow = true;
  crystal.rotation.z = .2;
  group.add(crystal);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.65, .035, 8, 28), new THREE.MeshBasicMaterial({ color: 0x8dfaff, transparent: true, opacity: .58 }));
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  group.position.set(position.x, .65, position.z);
  group.userData.entity = res;
  group.traverse(o => { if (o.isMesh) { o.userData.entity = res; interactive.push(o); } });
  res.mesh = group;
  worldGroup.add(group);
  state.resources.push(res);
  return res;
}

function createStructure(type, position, built = true) {
  const def = STRUCTURES[type];
  const s = { kind: 'structure', id: state.nextStructureId++, type, name: def.name, position: { ...position }, health: 100, maxHealth: 100, powered: type === 'base' || type === 'generator', built };
  const group = new THREE.Group();
  const [sx, sy, sz] = def.size;
  const mat = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: type === 'beacon' ? 1.5 : .28, metalness: .72, roughness: .25 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  base.position.y = sy / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  if (type === 'charger') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, .09, 10, 36), makeGlow(def.color, 3));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .65;
    group.add(ring);
  }
  if (type === 'repair') {
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, .18, .28), makeGlow(def.color, 2.2));
    const cross2 = cross1.clone();
    cross2.rotation.y = Math.PI / 2;
    cross1.position.y = .8; cross2.position.y = .8;
    group.add(cross1, cross2);
  }
  if (type === 'generator') {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(.55, 24, 16), makeGlow(def.color, 3.6));
    orb.position.y = 1.5;
    group.add(orb);
    s.orb = orb;
  }
  if (type === 'reproduction') {
    const tor = new THREE.Mesh(new THREE.TorusGeometry(1.1, .12, 12, 40), makeGlow(def.color, 2.7));
    tor.position.y = .85; tor.rotation.x = Math.PI / 2;
    group.add(tor);
  }
  if (type === 'beacon') {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.18, .5, 6.2, 16), makeGlow(def.color, 4));
    beam.position.y = 3.1;
    group.add(beam);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(.8, .08, 10, 40), makeGlow(0x68eaff, 4));
    crown.position.y = 5.5; crown.rotation.x = Math.PI / 2;
    group.add(crown);
  }
  group.position.set(position.x, 0, position.z);
  group.userData.entity = s;
  group.traverse(o => { if (o.isMesh) { o.userData.entity = s; interactive.push(o); } });
  s.mesh = group;
  worldGroup.add(group);
  const body = physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, sy / 2, position.z));
  const collider = physics.createCollider(RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setFriction(1), body);
  s.body = body; s.collider = collider;
  state.structures.push(s);
  return s;
}

function createBase() {
  const s = { kind: 'structure', id: state.nextStructureId++, type: 'base', name: 'COLONY CORE', position: { x: 0, z: 0 }, health: 500, maxHealth: 500, powered: true, built: true };
  const group = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.65, .42, 32), new THREE.MeshStandardMaterial({ color: 0x22281f, metalness: .52, roughness: .55 }));
  pad.position.y = .21; pad.castShadow = true; group.add(pad);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.48, 2), new THREE.MeshStandardMaterial({ color: 0xc8b47e, emissive: 0x5c4522, emissiveIntensity: .75, metalness: .38, roughness: .28 }));
  core.position.y = .88; group.add(core); s.orb = core;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.58, .055, 12, 48), new THREE.MeshStandardMaterial({ color: 0x71806f, emissive: 0x2e382d, emissiveIntensity: .42, metalness: .7, roughness: .34 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = .48; group.add(ring);
  group.userData.entity = s;
  group.traverse(o => { if (o.isMesh) { o.userData.entity = s; interactive.push(o); } });
  s.mesh = group; worldGroup.add(group);
  const body = physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, .3, 0));
  s.body = body; s.collider = physics.createCollider(RAPIER.ColliderDesc.cylinder(.3, 2.55), body);
  state.structures.push(s);
  return s;
}

function createHazard(position, type = 'gas') {
  const h = { kind: 'hazard', id: `H${state.hazards.length + 1}`, type, position: { ...position }, radius: type === 'fire' ? 2.5 : 3.2, heat: type === 'fire' ? 95 : 28, damage: type === 'fire' ? 7 : 3.4, age: 0, life: 70 };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(h.radius, 20, 14),
    new THREE.MeshBasicMaterial({ color: type === 'fire' ? 0xff5a24 : 0x7fea63, transparent: true, opacity: .12, depthWrite: false })
  );
  mesh.scale.y = .45; mesh.position.set(position.x, 1.2, position.z);
  mesh.userData.entity = h; interactive.push(mesh); h.mesh = mesh; worldGroup.add(mesh);
  state.hazards.push(h);
  return h;
}

function createDrone(position) {
  const d = { kind: 'drone', id: state.nextDroneId++, position: { ...position }, health: 75, maxHealth: 75, damage: 7, target: null, attackCooldown: 0, disabled: false };
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(.8, 1), new THREE.MeshStandardMaterial({ color: 0x751b33, emissive: 0xff244f, emissiveIntensity: 1.6, metalness: .8, roughness: .24 }));
  group.add(body);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, .12, .12), new THREE.MeshStandardMaterial({ color: 0x2d1420, metalness: .8 }));
    arm.rotation.y = i * Math.PI / 2; group.add(arm);
    const rotor = new THREE.Mesh(new THREE.TorusGeometry(.35, .045, 8, 24), makeGlow(0xff486b, 2.2));
    rotor.position.set(Math.cos(i * Math.PI / 2) * .68, 0, Math.sin(i * Math.PI / 2) * .68);
    rotor.rotation.x = Math.PI / 2; group.add(rotor);
  }
  group.userData.entity = d;
  group.traverse(o => { if (o.isMesh) { o.userData.entity = d; interactive.push(o); } });
  d.mesh = group; worldGroup.add(group);
  const rb = physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, 1.2, position.z).setLinearDamping(2.8).setAngularDamping(5).setGravityScale(.35, true));
  d.body = rb; d.collider = physics.createCollider(RAPIER.ColliderDesc.ball(.72).setDensity(1.2).setRestitution(.1), rb);
  state.drones.push(d);
  return d;
}

function positionOf(entity) {
  if (!entity) return { x: 0, y: 0, z: 0 };
  if (entity.body) return entity.body.translation();
  return entity.position || { x: 0, y: 0, z: 0 };
}

function nearest(list, pos, predicate = () => true) {
  let best = null, bestD = Infinity;
  for (const item of list) {
    if (!predicate(item)) continue;
    const p = positionOf(item);
    const d = dist2(pos, p);
    if (d < bestD) { bestD = d; best = item; }
  }
  return best ? { item: best, distance: Math.sqrt(bestD) } : null;
}

function poweredStructure(type) {
  return state.structures.find(s => s.type === type && s.health > 0 && (s.powered || type === 'base'));
}

function setRobotState(robot, next, target = null) {
  if (robot.state !== next) { robot.state = next; robot.stateTime = 0; }
  robot.target = target;
}

function moveRobot(robot, target, dt, speedScale = 1) {
  if (!target || robot.disabled) return;
  const pos = robot.body.translation();
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const len = Math.hypot(dx, dz) || 1;
  const heatPenalty = robot.temperature > 80 ? clamp(1 - (robot.temperature - 80) / 180, .25, 1) : 1;
  const coldPenalty = robot.temperature < -20 ? clamp(1 - (-20 - robot.temperature) / 100, .3, 1) : 1;
  const energyPenalty = robot.energy < 10 ? .45 : 1;
  const liquid = Math.abs(pos.x + 10) < 4 && Math.abs(pos.z - 9) < 3.5;
  const mediumPenalty = liquid ? .45 : 1;
  const desired = robot.stats.speed * heatPenalty * coldPenalty * energyPenalty * mediumPenalty * speedScale;
  const vel = robot.body.linvel();
  const tx = dx / len * desired;
  const tz = dz / len * desired;
  const response = clamp(4.5 * dt, 0, 1);
  robot.body.setLinvel({ x: lerp(vel.x, tx, response), y: vel.y, z: lerp(vel.z, tz, response) }, true);
  const yaw = Math.atan2(dx, dz);
  robot.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
  robot.energy = Math.max(0, robot.energy - dt * (.24 + robot.stats.mass * .006) / clamp(robot.traits.efficiency, .25, 1));
}

function applyDamage(entity, amount, heat = 0) {
  if (!entity || entity.health == null || entity.health <= 0) return;
  const armorScale = entity.kind === 'robot' ? 1 / (1 + entity.stats.armor * .13) : 1;
  entity.health = Math.max(0, entity.health - amount * armorScale);
  if (entity.temperature != null) entity.temperature += heat;
  if (entity.kind === 'robot' && entity.health <= 0) {
    entity.disabled = true;
    setRobotState(entity, 'DISABLED');
    toast(`R-${entity.id} disabled`);
  }
  if (entity.kind === 'drone' && entity.health <= 0) {
    entity.disabled = true;
    dropSalvage(entity);
  }
}

function dropSalvage(entity) {
  const p = positionOf(entity);
  createResource({ x: p.x, z: p.z }, 22);
  if (entity.mesh) entity.mesh.visible = false;
  if (entity.body) entity.body.setEnabled(false);
}

function recomputeRobot(robot) {
  robot.stats = aggregateBlueprint(robot.blueprint);
  robot.health = Math.min(robot.health, robot.stats.maxHealth);
  robot.energy = Math.min(robot.energy, robot.stats.maxEnergy);
}

function detachRandomPart(robot) {
  const candidates = Object.keys(robot.blueprint.parts).filter(k => k !== 'core' && robot.blueprint.parts[k] > 0);
  if (!candidates.length) return false;
  const key = rng.pick(candidates);
  robot.blueprint.parts[key]--;
  recomputeRobot(robot);
  rebuildRobotVisual(robot);
  const p = robot.body.translation();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.38, .25, .5), new THREE.MeshStandardMaterial({ color: robot.color, metalness: .7, roughness: .3 }));
  worldGroup.add(mesh);
  const body = physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x + rng.range(-.8, .8), p.y + 1, p.z + rng.range(-.8, .8)).setLinearDamping(.4));
  physics.createCollider(RAPIER.ColliderDesc.cuboid(.19, .125, .25).setDensity(.8), body);
  body.applyImpulse({ x: rng.range(-2, 2), y: 2.2, z: rng.range(-2, 2) }, true);
  state.detached.push({ mesh, body, age: 0, part: key });
  applyDamage(robot, 10);
  toast(`${PARTS[key].name} cut from R-${robot.id}`);
  return true;
}

function robotDecisions(robot) {
  const pos = robot.body.translation();
  const lowEnergy = 1 - robot.energy / robot.stats.maxEnergy;
  const damaged = 1 - robot.health / robot.stats.maxHealth;
  const resource = nearest(state.resources, pos, r => r.amount > .2);
  const drone = nearest(state.drones, pos, d => !d.disabled && d.health > 0);
  const hazard = nearest(state.hazards, pos, h => h.life > h.age);
  const charger = nearest(state.structures, pos, s => (s.type === 'charger' || s.type === 'base') && s.health > 0);
  const repair = nearest(state.structures, pos, s => (s.type === 'repair' || s.type === 'base') && s.health > 0);
  const job = state.jobs.find(j => !j.complete && !j.cancelled);
  const dangerScore = Math.max(
    drone && drone.distance < robot.stats.sensor ? (1 - drone.distance / robot.stats.sensor) * (1 - robot.traits.aggression) : 0,
    hazard && hazard.distance < hazard.item.radius + 4 ? (1 - hazard.distance / (hazard.item.radius + 4)) * robot.traits.caution : 0
  );
  const scores = {
    CHARGE: lowEnergy * 1.3,
    REPAIR: damaged * .95,
    RETURN: robot.cargo > 0 ? .65 + robot.cargo / robot.stats.cargo : 0,
    BUILD: job && robot.stats.builder > 0 ? .52 + robot.traits.cooperation * .3 : 0,
    ATTACK: drone && robot.stats.weapon > 0 && drone.distance < robot.stats.sensor ? robot.traits.aggression * .9 + .25 : 0,
    FLEE: dangerScore,
    GATHER: resource ? .38 + robot.traits.curiosity * .5 : 0,
    EXPLORE: .22 + robot.traits.curiosity * .32
  };
  if (robot.energy < 4) scores.CHARGE += 2;
  if (robot.health < robot.stats.maxHealth * .25) scores.REPAIR += 1.2;
  if (robot.cargo >= robot.stats.cargo * .9) scores.RETURN += 1.2;
  if (robot.manualTarget) scores.COMMAND = 2.5;
  robot.decision = scores;
  return { scores, resource, drone, hazard, charger, repair, job };
}

function updateRobot(robot, dt) {
  robot.age = state.time - robot.born;
  robot.stateTime += dt;
  robot.attackCooldown -= dt;
  robot.repairCooldown -= dt;
  if (robot.disabled || robot.health <= 0) {
    robot.energy = Math.max(0, robot.energy - dt * .03);
    return;
  }
  const pos = robot.body.translation();
  const inLiquid = Math.abs(pos.x + 10) < 4 && Math.abs(pos.z - 9) < 3.5 && pos.y < 2;
  const ambient = state.ambientTemp + (inLiquid ? -10 : 0);
  robot.temperature += (ambient - robot.temperature) * dt * (inLiquid ? .65 : .08);
  robot.energy = clamp(robot.energy + robot.stats.solar * dt * .16 - dt * .025, 0, robot.stats.maxEnergy);
  if (robot.temperature > 110) applyDamage(robot, dt * (robot.temperature - 100) * .035, 0);
  if (robot.temperature < -55) robot.energy = Math.max(0, robot.energy - dt * .8);
  if (robot.energy <= 0) { setRobotState(robot, 'POWER LOSS'); robot.body.setLinvel({ x: 0, y: robot.body.linvel().y, z: 0 }, true); return; }

  for (const h of state.hazards) {
    const d = distance(pos, h.position);
    if (d < h.radius) {
      robot.temperature += h.heat * dt * .16;
      applyDamage(robot, h.damage * dt, h.heat * dt * .05);
    }
  }

  const info = robotDecisions(robot);
  const best = Object.entries(info.scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'EXPLORE';
  if (best === 'COMMAND') setRobotState(robot, 'COMMAND', robot.manualTarget);
  else if (best === 'CHARGE') setRobotState(robot, 'SEEK_ENERGY', info.charger?.item || state.structures[0]);
  else if (best === 'REPAIR') setRobotState(robot, 'SEEK_REPAIR', info.repair?.item || state.structures[0]);
  else if (best === 'RETURN') setRobotState(robot, 'DELIVER', state.structures[0]);
  else if (best === 'BUILD') setRobotState(robot, 'BUILD', info.job);
  else if (best === 'ATTACK') setRobotState(robot, 'ATTACK', info.drone?.item);
  else if (best === 'FLEE') setRobotState(robot, 'FLEE', info.drone?.item || info.hazard?.item);
  else if (best === 'GATHER') setRobotState(robot, 'GATHER', info.resource?.item);
  else if (!robot.target || robot.stateTime > 5) {
    robot.wander = { x: clamp(pos.x + rng.range(-8, 8), -16, 16), z: clamp(pos.z + rng.range(-8, 8), -16, 16) };
    setRobotState(robot, 'EXPLORE', robot.wander);
  }

  if (robot.state === 'COMMAND') {
    moveRobot(robot, robot.manualTarget, dt, 1.15);
    if (distance(pos, robot.manualTarget) < 1.1) { robot.manualTarget = null; setRobotState(robot, 'IDLE'); }
  } else if (robot.state === 'SEEK_ENERGY') {
    const target = robot.target ? positionOf(robot.target) : { x: 0, z: 0 };
    moveRobot(robot, target, dt);
    if (distance(pos, target) < 2.4) {
      setRobotState(robot, 'CHARGING', robot.target);
      robot.energy = Math.min(robot.stats.maxEnergy, robot.energy + dt * 22);
    }
  } else if (robot.state === 'SEEK_REPAIR') {
    const target = robot.target ? positionOf(robot.target) : { x: 0, z: 0 };
    moveRobot(robot, target, dt);
    if (distance(pos, target) < 2.5 && state.matter > 0) {
      setRobotState(robot, 'REPAIRING');
      const amount = Math.min(dt * 8, robot.stats.maxHealth - robot.health, state.matter * .6);
      robot.health += amount;
      state.matter -= amount / .6;
    }
  } else if (robot.state === 'DELIVER') {
    const base = state.structures[0];
    moveRobot(robot, base.position, dt, 1.05);
    if (distance(pos, base.position) < 3.3) {
      state.matter += robot.cargo;
      if (robot.cargo > 0) toast(`R-${robot.id} delivered ${robot.cargo.toFixed(0)} matter`, 1.2);
      robot.cargo = 0;
      setRobotState(robot, 'IDLE');
    }
  } else if (robot.state === 'GATHER') {
    const res = robot.target;
    if (!res || res.amount <= 0) { setRobotState(robot, 'EXPLORE'); return; }
    moveRobot(robot, res.position, dt);
    if (distance(pos, res.position) < 1.25) {
      setRobotState(robot, 'MINING', res);
      const rate = Math.min(dt * (2.2 + robot.stats.builder * .5), res.amount, robot.stats.cargo - robot.cargo);
      res.amount -= rate;
      robot.cargo += rate;
      robot.energy = Math.max(0, robot.energy - dt * .55);
      res.mesh.scale.setScalar(.35 + .65 * res.amount / res.maxAmount);
      if (robot.cargo >= robot.stats.cargo - .1 || res.amount <= .1) setRobotState(robot, 'DELIVER', state.structures[0]);
    }
  } else if (robot.state === 'BUILD') {
    const job = robot.target;
    if (!job || job.complete || job.cancelled) { setRobotState(robot, 'IDLE'); return; }
    moveRobot(robot, job.position, dt, .9);
    if (distance(pos, job.position) < 1.8) {
      setRobotState(robot, 'CONSTRUCTING', job);
      job.progress += dt * (9 + robot.stats.builder * 7);
      robot.energy = Math.max(0, robot.energy - dt * .8);
      job.mesh.material.opacity = .16 + .5 * clamp(job.progress / 100, 0, 1);
      job.mesh.rotation.y += dt * .8;
      if (job.progress >= 100) completeJob(job);
    }
  } else if (robot.state === 'ATTACK') {
    const drone = robot.target;
    if (!drone || drone.disabled || drone.health <= 0) { setRobotState(robot, 'IDLE'); return; }
    const dp = positionOf(drone);
    moveRobot(robot, dp, dt, 1.15);
    if (distance(pos, dp) < 1.8 && robot.attackCooldown <= 0) {
      applyDamage(drone, 8 + robot.stats.weapon * 7);
      robot.attackCooldown = .7;
      robot.energy = Math.max(0, robot.energy - 2.4);
      sparkAt(dp, 0xff4d68);
    }
  } else if (robot.state === 'FLEE') {
    const threat = robot.target ? positionOf(robot.target) : { x: 0, z: 0 };
    const away = { x: clamp(pos.x + (pos.x - threat.x) * 2.5, -16, 16), z: clamp(pos.z + (pos.z - threat.z) * 2.5, -16, 16) };
    moveRobot(robot, away, dt, 1.2);
  } else if (robot.state === 'REPAIR_ALLY') {
    const ally = robot.target;
    if (!ally || ally.disabled) { setRobotState(robot, 'IDLE'); return; }
    const ap = positionOf(ally);
    moveRobot(robot, ap, dt);
    if (distance(pos, ap) < 1.5 && state.matter > 0) {
      const amount = Math.min(dt * robot.stats.repair * 8, ally.stats.maxHealth - ally.health, state.matter * .5);
      ally.health += amount; state.matter -= amount / .5;
    }
  } else {
    const target = robot.target?.position || robot.target || robot.wander;
    if (target) moveRobot(robot, target, dt, .72);
  }

  if (robot.stats.repair > 0 && robot.repairCooldown <= 0) {
    const ally = nearest(state.robots, pos, r => r !== robot && !r.disabled && r.health < r.stats.maxHealth * .62);
    if (ally && ally.distance < robot.stats.sensor * .7 && state.matter > 2) {
      robot.repairCooldown = 2;
      setRobotState(robot, 'REPAIR_ALLY', ally.item);
    }
  }

  const moved = Math.hypot(pos.x - robot.lastPosition.x, pos.z - robot.lastPosition.z);
  robot.stuckTime = moved < .02 ? robot.stuckTime + dt : 0;
  robot.lastPosition = { x: pos.x, z: pos.z };
  if (robot.stuckTime > 2.2) {
    robot.body.applyImpulse({ x: rng.range(-2.5, 2.5), y: 2.4, z: rng.range(-2.5, 2.5) }, true);
    robot.stuckTime = 0;
  }
}

function updateDrone(drone, dt) {
  if (drone.disabled || drone.health <= 0) return;
  drone.attackCooldown -= dt;
  const pos = drone.body.translation();
  const targetInfo = nearest(state.robots, pos, r => !r.disabled && r.health > 0);
  if (!targetInfo) return;
  drone.target = targetInfo.item;
  const tp = drone.target.body.translation();
  const dx = tp.x - pos.x, dz = tp.z - pos.z, len = Math.hypot(dx, dz) || 1;
  const vel = drone.body.linvel();
  drone.body.setLinvel({ x: lerp(vel.x, dx / len * 3.8, dt * 2.8), y: lerp(vel.y, (1.2 - pos.y) * 2, dt * 2.5), z: lerp(vel.z, dz / len * 3.8, dt * 2.8) }, true);
  if (targetInfo.distance < 1.65 && drone.attackCooldown <= 0) {
    applyDamage(drone.target, drone.damage, 8);
    drone.attackCooldown = 1.15;
    sparkAt(tp, 0xff385c);
  }
}

function completeJob(job) {
  if (job.complete) return;
  job.complete = true;
  createStructure(job.type, job.position, true);
  worldGroup.remove(job.mesh);
  toast(`${STRUCTURES[job.type].name} constructed`);
  vibrate([25, 30, 25]);
  if (job.type === 'beacon') state.objective = state.robots.filter(r => !r.disabled).length >= 10 ? 'success' : state.objective;
}

function queueConstruction(type, position) {
  const def = STRUCTURES[type];
  if (state.matter < def.cost) { toast(`Need ${def.cost} matter`); return false; }
  state.matter -= def.cost;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...def.size),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: .18, wireframe: true })
  );
  mesh.position.set(position.x, def.size[1] / 2, position.z);
  worldGroup.add(mesh);
  const job = { kind: 'job', type, position: { x: position.x, z: position.z }, progress: 0, complete: false, cancelled: false, mesh };
  state.jobs.push(job);
  toast(`${def.name} queued — builder robot required`);
  return true;
}

function reproduce(dt) {
  const lab = poweredStructure('reproduction');
  if (!lab || state.time - state.lastReproduction < 22 || state.matter < 70) return;
  const near = state.robots.filter(r => !r.disabled && r.age > 18 && distance(positionOf(r), lab.position) < 4 && r.energy > r.stats.maxEnergy * .5);
  if (near.length < 2) return;
  const a = near[0], b = near[1];
  state.matter -= 70;
  a.energy *= .78; b.energy *= .78;
  const child = structuredClone(rng.next() > .5 ? a.blueprint : b.blueprint);
  child.name = `GEN-${Math.max(a.generation, b.generation) + 1}`;
  child.traits = {};
  for (const key of Object.keys(DEFAULT_BLUEPRINT.traits)) {
    const base = (a.traits[key] + b.traits[key]) * .5;
    const mutation = (rng.next() * 2 - 1) * ((a.traits.mutation + b.traits.mutation) * .5);
    child.traits[key] = clamp(base + mutation, .05, .98);
  }
  const mutable = Object.keys(child.parts).filter(k => k !== 'core');
  if (rng.next() < child.traits.mutation) {
    const k = rng.pick(mutable);
    child.parts[k] = clamp(child.parts[k] + (rng.next() > .5 ? 1 : -1), k === 'battery' || k === 'sensor' ? 1 : 0, PARTS[k].max);
  }
  const p = lab.position;
  spawnRobot(child, { x: p.x + rng.range(-1.2, 1.2), y: 1.2, z: p.z + rng.range(-1.2, 1.2) }, { generation: Math.max(a.generation, b.generation) + 1, parents: [a.id, b.id] });
  state.lastReproduction = state.time;
  toast(`R-${a.id} + R-${b.id} produced a mutated offspring`);
}

function updateEnvironment(dt) {
  if (state.magnetPulse) {
    state.magnetPulse.time -= dt;
    const p = state.magnetPulse.position;
    for (const entity of [...state.robots, ...state.drones, ...state.detached]) {
      if (!entity.body || entity.disabled) continue;
      const ep = entity.body.translation();
      const dx = p.x - ep.x, dy = 1 - ep.y, dz = p.z - ep.z;
      const d2 = dx * dx + dy * dy + dz * dz + 1;
      const force = state.magnetPulse.strength / d2;
      entity.body.applyImpulse({ x: dx * force * dt, y: dy * force * dt, z: dz * force * dt }, true);
    }
    if (state.magnetPulse.time <= 0) state.magnetPulse = null;
  }
  for (const h of state.hazards) {
    h.age += dt;
    h.mesh.material.opacity = .08 + Math.sin(state.time * 3 + h.age) * .03;
    h.mesh.rotation.y += dt * .1;
  }
  for (const d of state.detached) d.age += dt;
  if (state.tick % 600 === 0 && state.drones.filter(d => !d.disabled).length < 3) createDrone({ x: rng.pick([-15, 15]), z: rng.range(-14, 14) });
}

function sparkAt(position, color = 0x7ffaff) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), new THREE.MeshBasicMaterial({ color }));
    m.position.set(position.x, (position.y || .8) + rng.range(-.4, .4), position.z);
    m.userData.vel = new THREE.Vector3(rng.range(-2, 2), rng.range(.5, 2.8), rng.range(-2, 2));
    g.add(m);
  }
  scene.add(g);
  const born = now();
  const animate = () => {
    const age = now() - born;
    if (age > .55) { scene.remove(g); return; }
    for (const m of g.children) { m.position.addScaledVector(m.userData.vel, .016); m.material.opacity = 1 - age / .55; m.material.transparent = true; }
    requestAnimationFrame(animate);
  };
  animate();
}

function syncVisuals() {
  for (const r of state.robots) {
    const p = r.body.translation();
    const q = r.body.rotation();
    const velocity = r.body.linvel();
    const rig = r.visualRig;
    const planarSpeed = Math.hypot(velocity.x, velocity.z);
    r.mesh.position.set(p.x, p.y - .48, p.z);
    r.mesh.quaternion.set(q.x, q.y, q.z, q.w);

    if (rig?.version === 6) {
      const visualDt = clamp(state.time - rig.lastTime, 0, .06);
      rig.lastTime = state.time;
      rig.mixer.update(visualDt);
      playAuthoredClip(r, authoredClipForRobot(r, planarSpeed));

      const active = !r.disabled && r.health > 0 && r.energy > 0;
      const bob = rig.style.asset === 'eyeDrone' && active ? Math.sin(state.time * 2.6 + rig.pulse) * .055 : 0;
      rig.authoredRoot.position.y = lerp(rig.authoredRoot.position.y, rig.baseY + bob, .12);
      const desiredLean = active && planarSpeed > .18 ? clamp(planarSpeed / Math.max(2, r.stats.speed), 0, 1) * .075 : 0;
      rig.lean = lerp(rig.lean, desiredLean, .12);
      rig.authoredRoot.rotation.x = -rig.lean;
      rig.authoredRoot.rotation.z = lerp(rig.authoredRoot.rotation.z, active ? 0 : .28, active ? .08 : .03);

      const energyRatio = clamp(r.energy / Math.max(1, r.stats.maxEnergy), 0, 1);
      rig.modules.core.material.emissiveIntensity = r.disabled ? .03 : 1.0 + energyRatio * 2.2 + Math.sin(state.time * 5 + rig.pulse) * .25;
      rig.modules.core.scale.setScalar(1 + Math.sin(state.time * 3.5 + rig.pulse) * .035);
      rig.modules.coreCage.rotation.y += visualDt * (active ? .8 : .08);
      rig.modules.neuralLines.children.forEach((line, index) => {
        line.material.opacity = r.disabled ? .03 : .22 + energyRatio * .34 + Math.sin(state.time * 3 + index) * .08;
      });

      const working = r.state === 'BUILD' || r.state === 'REPAIR_ALLY' || r.state === 'ATTACK';
      rig.modules.toolMounts.forEach((tool, index) => {
        const reach = working ? Math.sin(state.time * 7 + index) * .28 : 0;
        tool.mount.rotation.x = lerp(tool.mount.rotation.x, working ? -.35 : 0, .14);
        tool.head.rotation.y = reach;
      });

      const damage = 1 - clamp(r.health / Math.max(1, r.stats.maxHealth), 0, 1);
      if (Math.abs(damage - rig.damage) > .03) {
        rig.damage = damage;
        rig.model.traverse(object => {
          if (!object.isMesh || !object.material) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => {
            if (!material.color) return;
            material.roughness = clamp((material.userData.baseRoughness ??= material.roughness ?? .5) + damage * .28, 0, 1);
            material.emissiveIntensity = damage > .65 ? Math.sin(state.time * 12 + r.id) * .08 + .08 : 0;
          });
        });
      }
    } else if (r.coreMesh?.material) {
      r.coreMesh.material.emissiveIntensity = r.disabled ? .05 : 1.3 + 1.7 * (r.energy / r.stats.maxEnergy);
    }

    r.selectionRing.visible = state.selected === r;
    r.sensorCone.visible = state.selected === r;
  }
  for (const d of state.drones) {
    if (!d.body || d.disabled) continue;
    const p = d.body.translation(), q = d.body.rotation();
    d.mesh.position.set(p.x, p.y, p.z);
    d.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    d.mesh.rotation.y += .02;
  }
  for (const d of state.detached) {
    const p = d.body.translation(), q = d.body.rotation();
    d.mesh.position.set(p.x, p.y, p.z);
    d.mesh.quaternion.set(q.x, q.y, q.z, q.w);
  }
  for (const r of state.resources) r.mesh.rotation.y += .004;
  for (const s of state.structures) if (s.orb) s.orb.rotation.y += .01;
}

function chooseTool(tool) {
  state.activeTool = tool;
  document.querySelectorAll('#toolbelt [data-action]').forEach(b => b.classList.toggle('active', b.dataset.action === tool));
  if (tool === 'inspect') toast('Tap a robot or structure to inspect');
  if (tool === 'command' && !state.selected) toast('Inspect a robot first, then choose COMMAND');
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;
let grabbed = null;

function screenRay(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function pick(clientX, clientY) {
  screenRay(clientX, clientY);
  const hits = raycaster.intersectObjects(interactive, true);
  return hits.find(h => h.object.visible && h.object.userData.entity)?.object.userData.entity || null;
}

function groundPoint(clientX, clientY) {
  screenRay(clientX, clientY);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, p) ? { x: clamp(p.x, -16.5, 16.5), y: 0, z: clamp(p.z, -16.5, 16.5) } : null;
}

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch' && e.isPrimary === false) return;
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (state.activeTool === 'grab') {
    const entity = pick(e.clientX, e.clientY);
    if (entity?.body && (entity.kind === 'robot' || entity.kind === 'drone')) {
      grabbed = entity;
      controls.enabled = false;
      vibrate();
    }
  }
});

canvas.addEventListener('pointermove', e => {
  if (!grabbed) return;
  const p = groundPoint(e.clientX, e.clientY);
  if (!p) return;
  grabbed.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  grabbed.body.setTranslation({ x: p.x, y: 2.1, z: p.z }, true);
});

canvas.addEventListener('pointerup', e => {
  const moved = pointerDown ? Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) : 999;
  if (grabbed) { grabbed = null; controls.enabled = true; pointerDown = null; return; }
  if (moved > 14) { pointerDown = null; return; }
  handleTap(e.clientX, e.clientY);
  pointerDown = null;
});

function handleTap(x, y) {
  const entity = pick(x, y);
  const point = groundPoint(x, y);
  if (state.selectedBuild && point) {
    if (queueConstruction(state.selectedBuild, point)) {
      state.selectedBuild = null;
      $('construction').classList.add('hidden');
    }
    return;
  }
  if (state.activeTool === 'inspect') {
    if (entity) selectEntity(entity); else selectEntity(null);
  } else if (state.activeTool === 'command') {
    if (state.selected?.kind === 'robot' && point) {
      state.selected.manualTarget = point;
      toast(`R-${state.selected.id} commanded`);
      vibrate();
    } else toast('Select a robot with INSPECT first');
  } else if (state.activeTool === 'heat' && entity) {
    if (entity.temperature != null) entity.temperature += 90;
    applyDamage(entity, 4, 20); sparkAt(positionOf(entity), 0xff7a27); toast('Heat injected');
  } else if (state.activeTool === 'freeze' && entity) {
    if (entity.temperature != null) entity.temperature -= 100;
    sparkAt(positionOf(entity), 0x7adfff); toast('Target flash-frozen');
  } else if (state.activeTool === 'zap' && entity) {
    if (entity.energy != null) entity.energy = Math.max(0, entity.energy - 24);
    applyDamage(entity, 10, 16); sparkAt(positionOf(entity), 0xa6f6ff); toast('Conductive overload');
  } else if (state.activeTool === 'cut' && entity?.kind === 'robot') {
    detachRandomPart(entity); vibrate([18, 25, 18]);
  } else if (state.activeTool === 'repair' && entity?.kind === 'robot') {
    const need = entity.stats.maxHealth - entity.health;
    const spend = Math.min(state.matter, need * .45);
    entity.health += spend / .45; state.matter -= spend;
    toast(`R-${entity.id} repaired`);
  } else if (state.activeTool === 'hazard' && point) {
    createHazard(point, rng.next() > .45 ? 'gas' : 'fire'); toast('Reactive hazard placed');
  }
}

function selectEntity(entity) {
  if (state.selected?.kind === 'robot') state.selected.selectionRing.visible = false;
  state.selected = entity;
  if (!entity) { $('inspector').classList.add('hidden'); return; }
  $('inspector').classList.remove('hidden');
  renderInspector();
}

function renderInspector() {
  const e = state.selected;
  if (!e) return;
  if (e.kind === 'robot') {
    const healthPct = e.health / e.stats.maxHealth * 100;
    const energyPct = e.energy / e.stats.maxEnergy * 100;
    const decisions = Object.entries(e.decision || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
    $('inspectBody').innerHTML = `
      <h3>R-${e.id} · GEN ${e.generation}</h3>
      <p><span class="state-badge">${e.state}</span></p>
      <div class="inspect-grid">
        <div>HEALTH ${e.health.toFixed(0)}/${e.stats.maxHealth.toFixed(0)}<div class="meter"><i style="width:${healthPct}%"></i></div></div>
        <div>ENERGY ${e.energy.toFixed(0)}/${e.stats.maxEnergy.toFixed(0)}<div class="meter"><i style="width:${energyPct}%"></i></div></div>
        <div>CARGO <b>${e.cargo.toFixed(1)}/${e.stats.cargo}</b></div>
        <div>TEMP <b>${e.temperature.toFixed(0)}°C</b></div>
        <div>SENSOR <b>${e.stats.sensor.toFixed(1)}m</b></div>
        <div>SPEED <b>${e.stats.speed.toFixed(1)}</b></div>
        <div>AGE <b>${e.age.toFixed(0)}s</b></div>
        <div>PARENTS <b>${e.parents.length ? e.parents.join(' + ') : 'FOUNDER'}</b></div>
      </div>
      <div class="brain"><b>LIVE DECISION SCORES</b>${decisions.map(([k,v])=>`<div class="decision"><span>${k}</span><b>${v.toFixed(2)}</b></div>`).join('')}</div>
      <p class="small">Curiosity ${e.traits.curiosity.toFixed(2)} · Caution ${e.traits.caution.toFixed(2)} · Aggression ${e.traits.aggression.toFixed(2)} · Cooperation ${e.traits.cooperation.toFixed(2)} · Efficiency ${e.traits.efficiency.toFixed(2)}</p>`;
  } else if (e.kind === 'structure') {
    $('inspectBody').innerHTML = `<h3>${e.name}</h3><p>Health ${e.health.toFixed(0)}/${e.maxHealth}</p><p>Powered: ${e.powered ? 'YES' : 'NO'}</p><p class="small">${e.type === 'base' ? 'Stores colony matter and charges robots.' : STRUCTURES[e.type]?.desc || ''}</p>`;
  } else if (e.kind === 'resource') {
    $('inspectBody').innerHTML = `<h3>MINERAL NODE ${e.id}</h3><p>Remaining matter: <b>${e.amount.toFixed(1)}</b></p><p class="small">Robots must physically approach, mine and carry this material home.</p>`;
  } else if (e.kind === 'drone') {
    $('inspectBody').innerHTML = `<h3>HOSTILE DRONE D-${e.id}</h3><p>Health ${e.health.toFixed(0)}/${e.maxHealth}</p><p>Target: ${e.target ? `R-${e.target.id}` : 'none'}</p>`;
  } else if (e.kind === 'hazard') {
    $('inspectBody').innerHTML = `<h3>${e.type.toUpperCase()} HAZARD</h3><p>Radius ${e.radius.toFixed(1)}m · Damage ${e.damage.toFixed(1)}/s · Heat ${e.heat}°</p>`;
  }
}

function renderBuilder() {
  $('partRows').innerHTML = Object.entries(PARTS).map(([key, def]) => {
    const count = state.blueprint.parts[key] || 0;
    return `<div class="part-row"><span><b>${def.name}</b><small>${def.desc} · ${def.cost}M</small></span><button data-part="${key}" data-delta="-1">−</button><b>${count}</b><button data-part="${key}" data-delta="1">+</button></div>`;
  }).join('');
  const s = aggregateBlueprint(state.blueprint);
  $('buildStats').innerHTML = `<span>COST <b>${s.cost} matter</b></span><span>MASS <b>${s.mass.toFixed(1)}</b></span><span>HEALTH <b>${s.maxHealth.toFixed(0)}</b></span><span>ENERGY <b>${s.maxEnergy.toFixed(0)}</b></span><span>SPEED <b>${s.speed.toFixed(1)}</b></span><span>SENSOR <b>${s.sensor.toFixed(1)}m</b></span><span>CARGO <b>${s.cargo}</b></span><span>STATUS <b>${s.valid ? 'VALID' : 'INVALID'}</b></span>`;
}

function renderStructures() {
  $('structureButtons').innerHTML = Object.entries(STRUCTURES).map(([key, def]) => `<button data-structure="${key}"><b>${def.name}</b><small>${def.cost} matter · ${def.desc}</small></button>`).join('');
}

function updateUI() {
  $('matter').textContent = Math.floor(state.matter);
  const active = state.robots.filter(r => !r.disabled && r.health > 0).length;
  $('robotCount').textContent = active;
  const beacon = state.structures.some(s => s.type === 'beacon' && s.health > 0);
  $('beaconState').textContent = beacon ? 'ONLINE' : 'NO';
  $('tick').textContent = state.tick;
  $('bodies').textContent = state.robots.length + state.drones.length + state.detached.length + state.structures.length + 1;
  $('seed').textContent = SEED;
  if (state.selected) renderInspector();
  if (state.objective === 'running' && active >= 10 && beacon) state.objective = 'success';
  if (state.objective === 'running' && active === 0 && state.time > 20) state.objective = 'fail';
  const obj = $('objective');
  obj.classList.toggle('success', state.objective === 'success');
  obj.classList.toggle('fail', state.objective === 'fail');
  if (state.objective === 'success') $('objectiveText').textContent = 'MISSION COMPLETE — the evolved colony activated the Research Beacon.';
  else if (state.objective === 'fail') $('objectiveText').textContent = 'COLONY COLLAPSED — rewind, reload or reset to recover.';
  else $('objectiveText').textContent = `Keep the colony alive. ${active}/10 robots · Research Beacon ${beacon ? 'online' : 'not built'}.`;
}

function snapshot() {
  const snap = serialize();
  state.snapshots.push(snap);
  if (state.snapshots.length > 7) state.snapshots.shift();
}

function serialize() {
  return {
    version: 1,
    time: state.time,
    tick: state.tick,
    matter: state.matter,
    gravity: state.gravity,
    ambientTemp: state.ambientTemp,
    nextRobotId: state.nextRobotId,
    nextStructureId: state.nextStructureId,
    robots: state.robots.map(r => ({
      id: r.id, blueprint: r.blueprint, traits: r.traits, generation: r.generation, parents: r.parents, born: r.born,
      health: r.health, energy: r.energy, temperature: r.temperature, cargo: r.cargo, disabled: r.disabled,
      pos: r.body.translation(), rot: r.body.rotation(), vel: r.body.linvel()
    })),
    resources: state.resources.filter(r => r.amount > .1).map(r => ({ id: r.id, amount: r.amount, maxAmount: r.maxAmount, position: r.position })),
    structures: state.structures.filter(s => s.type !== 'base').map(s => ({ type: s.type, position: s.position, health: s.health })),
    hazards: state.hazards.map(h => ({ type: h.type, position: h.position, age: h.age })),
    drones: state.drones.filter(d => !d.disabled && d.health > 0).map(d => ({ id: d.id, health: d.health, pos: d.body.translation() })),
    jobs: state.jobs.filter(j => !j.complete && !j.cancelled).map(j => ({ type: j.type, position: j.position, progress: j.progress }))
  };
}

function clearDynamicWorld() {
  for (const r of state.robots) { worldGroup.remove(r.mesh); physics.removeRigidBody(r.body); }
  for (const r of state.resources) worldGroup.remove(r.mesh);
  for (const s of state.structures.slice(1)) { worldGroup.remove(s.mesh); physics.removeRigidBody(s.body); }
  for (const h of state.hazards) worldGroup.remove(h.mesh);
  for (const d of state.drones) { worldGroup.remove(d.mesh); physics.removeRigidBody(d.body); }
  for (const d of state.detached) { worldGroup.remove(d.mesh); physics.removeRigidBody(d.body); }
  for (const j of state.jobs) worldGroup.remove(j.mesh);
  state.robots = []; state.resources = []; state.structures = state.structures.slice(0, 1); state.hazards = []; state.drones = []; state.detached = []; state.jobs = [];
  state.selected = null;
}

function restore(snap) {
  if (!snap) return;
  clearDynamicWorld();
  state.time = snap.time || 0; state.tick = snap.tick || 0; state.matter = snap.matter ?? 150;
  state.gravity = snap.gravity ?? -9.8; state.ambientTemp = snap.ambientTemp ?? 22;
  physics.gravity.y = state.gravity;
  state.nextRobotId = snap.nextRobotId || 1; state.nextStructureId = snap.nextStructureId || 2;
  for (const r of snap.resources || []) { const res = createResource(r.position, r.maxAmount || r.amount); res.amount = r.amount; res.mesh.scale.setScalar(.35 + .65 * res.amount / res.maxAmount); }
  for (const s of snap.structures || []) { const st = createStructure(s.type, s.position); st.health = s.health; }
  for (const h of snap.hazards || []) { const hz = createHazard(h.position, h.type); hz.age = h.age || 0; }
  for (const r of snap.robots || []) {
    const robot = spawnRobot(r.blueprint, r.pos, { generation: r.generation, parents: r.parents });
    robot.id = r.id; robot.traits = r.traits; robot.born = r.born; robot.health = r.health; robot.energy = r.energy; robot.temperature = r.temperature; robot.cargo = r.cargo; robot.disabled = r.disabled;
    robot.body.setRotation(r.rot, true); robot.body.setLinvel(r.vel || { x: 0, y: 0, z: 0 }, true);
    if (robot.disabled) robot.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
  for (const d of snap.drones || []) { const drone = createDrone(d.pos); drone.id = d.id; drone.health = d.health; }
  for (const j of snap.jobs || []) { state.matter += STRUCTURES[j.type].cost; queueConstruction(j.type, j.position); const job = state.jobs.at(-1); job.progress = j.progress; }
  state.objective = 'running';
  updateUI();
}

function saveGame() {
  localStorage.setItem('nexus-cube-save-v1', JSON.stringify(serialize()));
  toast('Simulation saved locally');
}
function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem('nexus-cube-save-v1'));
    if (!data) throw new Error('No save');
    restore(data); toast('Simulation loaded');
  } catch { toast('No valid local save found'); }
}

function initializeScenario() {
  state.matter = 190; state.time = 0; state.tick = 0; state.objective = 'running'; state.nextRobotId = 1; state.nextStructureId = 1; state.nextResourceId = 1; state.nextDroneId = 1;
  if (!state.structures.length) createBase();
  for (const p of [
    { x: -8, z: -6 }, { x: 8, z: -7 }, { x: -12, z: 2 }, { x: 11, z: 5 }, { x: -4, z: 12 }, { x: 7, z: 12 }
  ]) createResource(p, rng.range(30, 52));
  createStructure('charger', { x: 4.8, z: 0 });
  createStructure('repair', { x: -4.8, z: 0 });
  createHazard({ x: 7, z: -1 }, 'gas');
  createHazard({ x: -9, z: -8 }, 'fire');
  createDrone({ x: 14, z: -12 });
  const founderA = structuredClone(DEFAULT_BLUEPRINT);
  const founderB = structuredClone(DEFAULT_BLUEPRINT); founderB.parts.builder = 0; founderB.parts.repair = 1; founderB.traits.cooperation = .9;
  const founderC = structuredClone(DEFAULT_BLUEPRINT); founderC.parts.builder = 0; founderC.parts.weapon = 1; founderC.parts.cargo = 0; founderC.traits.aggression = .72;
  const founderD = structuredClone(DEFAULT_BLUEPRINT);
  founderD.name = 'EYE-SCOUT';
  founderD.parts.builder = 0;
  founderD.parts.repair = 0;
  founderD.parts.weapon = 0;
  founderD.parts.cargo = 0;
  founderD.parts.armor = 0;
  founderD.parts.wheel = 2;
  founderD.parts.leg = 0;
  founderD.parts.sensor = 3;
  founderD.traits.curiosity = .92;
  founderD.traits.caution = .58;
  spawnRobot(founderA, { x: -2.7, y: 1.2, z: 4.2 });
  spawnRobot(founderB, { x: 0, y: 1.2, z: 4.7 });
  spawnRobot(founderC, { x: 2.7, y: 1.2, z: 4.0 });
  spawnRobot(founderD, { x: 0, y: 1.2, z: 6.4 });
  snapshot();
}

function hardReset() {
  clearDynamicWorld();
  if (!state.structures.length) createBase();
  initializeScenario();
  toast('Clean colony restored');
}

function applyQuality(q) {
  state.quality = q;
  const ratio = q === 'low' ? 1 : q === 'medium' ? Math.min(devicePixelRatio, 1.45) : Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = q !== 'low';
  scene.fog.density = q === 'high' ? .017 : q === 'medium' ? .014 : .01;
}

function openPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  $(id).classList.remove('hidden');
  if (id === 'builder') renderBuilder();
  if (id === 'construction') renderStructures();
}

document.querySelectorAll('[data-panel]').forEach(btn => btn.addEventListener('click', () => openPanel(btn.dataset.panel)));
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => $(btn.dataset.close).classList.add('hidden')));
document.querySelector('#partRows').addEventListener('click', e => {
  const b = e.target.closest('[data-part]'); if (!b) return;
  const key = b.dataset.part, delta = Number(b.dataset.delta), def = PARTS[key];
  const current = state.blueprint.parts[key] || 0;
  const min = def.required ? 1 : 0;
  state.blueprint.parts[key] = clamp(current + delta, min, def.max);
  renderBuilder(); vibrate(10);
});
$('saveBlueprint').addEventListener('click', () => { localStorage.setItem('nexus-blueprint-v1', JSON.stringify(state.blueprint)); toast('Blueprint saved'); });
$('deployRobot').addEventListener('click', () => {
  const stats = aggregateBlueprint(state.blueprint);
  if (!stats.valid) { toast('Invalid: needs 1 core, battery, sensor and at least 2 locomotion parts'); return; }
  if (state.matter < stats.cost) { toast(`Need ${stats.cost} matter`); return; }
  state.matter -= stats.cost;
  spawnRobot(state.blueprint, { x: rng.range(-2, 2), y: 1.2, z: rng.range(2.5, 5) });
  $('builder').classList.add('hidden');
});
$('structureButtons').addEventListener('click', e => {
  const b = e.target.closest('[data-structure]'); if (!b) return;
  state.selectedBuild = b.dataset.structure;
  toast(`Tap the floor to queue ${STRUCTURES[state.selectedBuild].name}`);
  vibrate();
});

document.querySelectorAll('#toolbelt [data-action]').forEach(btn => btn.addEventListener('click', () => {
  const action = btn.dataset.action;
  if (action === 'pause') { state.paused = !state.paused; btn.textContent = state.paused ? '▶' : 'Ⅱ'; toast(state.paused ? 'Simulation paused' : 'Simulation running'); return; }
  if (action === 'rewind') { const snap = state.snapshots.at(-2) || state.snapshots.at(-1); if (snap) { restore(snap); toast('Rewound to stable snapshot'); } return; }
  if (action === 'save') { saveGame(); return; }
  if (action === 'load') { loadGame(); return; }
  if (action === 'reset') { if (confirm('Reset the colony to a clean scenario?')) hardReset(); return; }
  chooseTool(action);
}));

$('gravity').addEventListener('input', e => { state.gravity = Number(e.target.value); physics.gravity.y = state.gravity; $('gravityOut').textContent = state.gravity.toFixed(1); });
$('ambientTemp').addEventListener('input', e => { state.ambientTemp = Number(e.target.value); $('tempOut').textContent = `${state.ambientTemp}°C`; });
$('simSpeed').addEventListener('input', e => { state.speed = Number(e.target.value); $('speedOut').textContent = `${state.speed}×`; });
$('quality').addEventListener('change', e => applyQuality(e.target.value));
$('magPulse').addEventListener('click', () => { state.magnetPulse = { position: { x: 0, y: 1, z: 0 }, strength: 120, time: 5 }; toast('Magnetic field engaged'); vibrate([20, 20, 20]); });
$('startBtn').addEventListener('click', () => { $('tutorial').classList.add('hidden'); vibrate(20); });

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false);
});
window.addEventListener('beforeunload', saveGame);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

try {
  const savedBlueprint = JSON.parse(localStorage.getItem('nexus-blueprint-v1'));
  if (savedBlueprint?.parts) state.blueprint = savedBlueprint;
} catch { /* ignore */ }

initializeScenario();
renderBuilder();
renderStructures();
applyQuality('medium');
updateUI();

let last = performance.now();
let accumulator = 0;
let fpsFrames = 0, fpsClock = 0;
const FIXED = 1 / 60;

function frame(t) {
  requestAnimationFrame(frame);
  const realDt = clamp((t - last) / 1000, 0, .05);
  last = t;
  fpsFrames++;
  fpsClock += realDt;
  if (fpsClock >= .5) { $('fps').textContent = Math.round(fpsFrames / fpsClock); fpsFrames = 0; fpsClock = 0; }

  if (!state.paused) {
    accumulator += realDt * state.speed;
    let steps = 0;
    while (accumulator >= FIXED && steps < 8) {
      state.time += FIXED;
      state.tick++;
      for (const r of state.robots) updateRobot(r, FIXED);
      for (const d of state.drones) updateDrone(d, FIXED);
      reproduce(FIXED);
      updateEnvironment(FIXED);
      physics.step();
      accumulator -= FIXED;
      steps++;
      state.autosaveClock += FIXED;
      if (state.autosaveClock >= 9) { snapshot(); state.autosaveClock = 0; }
    }
  }

  syncVisuals();
  controls.update();
  renderer.render(scene, camera);
  if (state.tick % 12 === 0) updateUI();
}
requestAnimationFrame(frame);
