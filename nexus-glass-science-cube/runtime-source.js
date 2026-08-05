import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

await RAPIER.init();

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
  name: 'MACHINE-ORGANISM-A',
  parts: { core: 1, battery: 2, wheel: 0, leg: 4, sensor: 2, cargo: 1, builder: 1, repair: 0, weapon: 0, solar: 1, armor: 1 },
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
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090c0a);
scene.fog = new THREE.FogExp2(0x111712, 0.022);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 160);
camera.position.set(9.4, 6.6, 12.8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, .82, .45);
controls.enableDamping = true;
controls.dampingFactor = .07;
controls.minDistance = 5.5;
controls.maxDistance = 34;
controls.maxPolarAngle = Math.PI * .48;
controls.screenSpacePanning = false;
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

scene.add(new THREE.HemisphereLight(0xc7d5c9, 0x17130e, 1.28));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(8, 18, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -24;
keyLight.shadow.camera.right = 24;
keyLight.shadow.camera.top = 24;
keyLight.shadow.camera.bottom = -24;
scene.add(keyLight);
const cyanLight = new THREE.PointLight(0xb9cfc2, 13, 26, 2);
cyanLight.position.set(-10, 8, -8);
scene.add(cyanLight);
const magentaLight = new THREE.PointLight(0xd08d42, 11, 22, 2);
magentaLight.position.set(10, 6, 9);
scene.add(magentaLight);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const physics = new RAPIER.World({ x: 0, y: state.gravity, z: 0 });
physics.timestep = 1 / 60;

const floorGeometry = new THREE.PlaneGeometry(36, 36, 40, 40);
const floorPositions = floorGeometry.attributes.position;
const floorColors = [];
const floorColor = new THREE.Color();
for (let index = 0; index < floorPositions.count; index++) {
  const x = floorPositions.getX(index);
  const y = floorPositions.getY(index);
  const edge = Math.max(Math.abs(x), Math.abs(y)) / 18;
  const ripple = Math.sin(x * .43) * Math.cos(y * .37) * .055 + Math.sin((x + y) * .18) * .035;
  floorPositions.setZ(index, ripple - edge * .025);
  const mineral = .13 + .035 * Math.sin(x * .31 + y * .19);
  floorColor.setRGB(mineral * .76, mineral * .88, mineral * .71);
  floorColors.push(floorColor.r, floorColor.g, floorColor.b);
}
floorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(floorColors, 3));
floorGeometry.computeVertexNormals();
const floorMesh = new THREE.Mesh(
  floorGeometry,
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .08, roughness: .96 })
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.y = .006;
floorMesh.receiveShadow = true;
floorMesh.userData.ground = true;
worldGroup.add(floorMesh);
const floorBody = physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -.2, 0));
physics.createCollider(RAPIER.ColliderDesc.cuboid(18, .175, 18).setFriction(1), floorBody);

const grid = new THREE.GridHelper(36, 36, 0x3ddfff, 0x16384a);
grid.position.y = .001;
grid.material.opacity = .075;
grid.material.transparent = true;
grid.position.y = .012;
worldGroup.add(grid);

const cubeEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(36, 18, 36)),
  new THREE.LineBasicMaterial({ color: 0x65eaff, transparent: true, opacity: .36 })
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

const habitatGroup = new THREE.Group();
worldGroup.add(habitatGroup);
const habitatRockMat = new THREE.MeshStandardMaterial({ color: 0x252b24, roughness: .94, metalness: .04 });
const habitatMineralMat = new THREE.MeshStandardMaterial({ color: 0x5d6d5e, roughness: .72, metalness: .18 });
for (let index = 0; index < 24; index++) {
  const angle = index * 2.399963 + .3;
  const radius = 7.5 + (index % 6) * 1.55;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  if (Math.abs(x + 10) < 4.8 && Math.abs(z - 9) < 4.1) continue;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(.25 + (index % 5) * .08, 0),
    index % 4 === 0 ? habitatMineralMat : habitatRockMat
  );
  rock.position.set(x, .12 + (index % 3) * .035, z);
  rock.scale.set(1.25 + (index % 2) * .5, .55 + (index % 4) * .12, .8 + (index % 3) * .22);
  rock.rotation.set(index * .17, angle, index * .11);
  rock.castShadow = true;
  rock.receiveShadow = true;
  habitatGroup.add(rock);
}
for (let index = 0; index < 7; index++) {
  const vent = new THREE.Group();
  const angle = index / 7 * Math.PI * 2 + .42;
  const radius = 12.5 + (index % 2) * 1.8;
  vent.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(.42, .55, .18, 12),
    new THREE.MeshStandardMaterial({ color: 0x30352f, metalness: .55, roughness: .62 })
  );
  collar.position.y = .09;
  vent.add(collar);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(.27, 16),
    new THREE.MeshBasicMaterial({ color: index % 2 ? 0xb4773a : 0x748e7e, transparent: true, opacity: .34 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = .185;
  vent.add(glow);
  habitatGroup.add(vent);
}

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

function organismRoleProfile(role, parts) {
  const profiles = {
    scout: { body: [.78, .34, 1.05], head: [.34, .23, .40], abdomen: [.48, .32, .55], posture: .92, gait: 1.08 },
    constructor: { body: [.92, .40, 1.12], head: [.38, .25, .44], abdomen: [.58, .40, .62], posture: 1.02, gait: .82 },
    medic: { body: [.82, .35, 1.05], head: [.36, .24, .42], abdomen: [.50, .35, .58], posture: .98, gait: .96 },
    sentinel: { body: [.88, .38, 1.10], head: [.40, .25, .46], abdomen: [.50, .35, .56], posture: 1.06, gait: 1.12 },
    hauler: { body: [1.02, .43, 1.25], head: [.35, .23, .42], abdomen: [.70, .48, .78], posture: 1.00, gait: .76 }
  };
  const profile = { ...profiles[role] };
  profile.legCount = parts.leg > 0 ? Math.min(6, Math.max(4, parts.leg + 2)) : 0;
  profile.wheelCount = parts.wheel > 0 ? Math.min(6, Math.max(4, parts.wheel)) : 0;
  return profile;
}

const ORGANISM_PALETTES = {
  scout: { shell: 0x596b65, ceramic: 0xa6b7ae, tissue: 0x29332e, signal: 0x8eb9a1, tool: 0xc49a55 },
  constructor: { shell: 0x6f633f, ceramic: 0xb8aa78, tissue: 0x353024, signal: 0xd4a64e, tool: 0xd6b35f },
  medic: { shell: 0x607261, ceramic: 0xb5c2b4, tissue: 0x29342c, signal: 0x94c5a4, tool: 0xd7ddd4 },
  sentinel: { shell: 0x65453e, ceramic: 0xaf8173, tissue: 0x342522, signal: 0xd36e58, tool: 0xd8a071 },
  hauler: { shell: 0x665f4e, ceramic: 0xb4aa8d, tissue: 0x312e27, signal: 0xbda56e, tool: 0xd0bc82 }
};

function organismMaterial(color, metalness = .42, roughness = .58, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function organismEllipsoid(scale, material, segments = 24) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(12, Math.floor(segments * .62))), material);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function organismBone(length, topRadius, bottomRadius, material, radial = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, length, radial), material);
  mesh.position.y = -length * .5;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function organismJoint(radius, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 9), material);
  mesh.castShadow = true;
  return mesh;
}

function createOrganismLeg(side, z, phase, profile, materials, index) {
  const root = new THREE.Group();
  root.position.set(side * profile.body[0] * .78, profile.posture, z);

  const hip = organismJoint(.14, materials.ceramic);
  root.add(hip);

  const coxa = new THREE.Group();
  coxa.rotation.z = side * -.72;
  root.add(coxa);
  coxa.add(organismBone(.52, .075, .105, materials.frame));

  const femur = new THREE.Group();
  femur.position.y = -.52;
  coxa.add(femur);
  femur.add(organismJoint(.115, materials.signal));
  const femurLength = .68 + (index % 2) * .07;
  femur.add(organismBone(femurLength, .072, .105, materials.ceramic));

  const tibia = new THREE.Group();
  tibia.position.y = -femurLength;
  femur.add(tibia);
  tibia.add(organismJoint(.095, materials.frame));
  const tibiaLength = .62 + ((index + 1) % 2) * .06;
  tibia.add(organismBone(tibiaLength, .045, .078, materials.frame));

  const ankle = new THREE.Group();
  ankle.position.y = -tibiaLength;
  tibia.add(ankle);
  ankle.add(organismJoint(.07, materials.signal));
  const foot = organismEllipsoid([.18, .055, .34], materials.pad, 14);
  foot.position.set(0, -.08, -.13);
  ankle.add(foot);

  return { root, coxa, femur, tibia, ankle, foot, phase, side, z, contact: 0 };
}

function createOrganismWheelLimb(side, z, phase, profile, materials, index) {
  const root = new THREE.Group();
  root.position.set(side * profile.body[0] * .78, profile.posture * .86, z);
  root.add(organismJoint(.14, materials.ceramic));

  const arm = new THREE.Group();
  arm.rotation.z = side * -.64;
  root.add(arm);
  arm.add(organismBone(.42, .075, .11, materials.frame));

  const knuckle = new THREE.Group();
  knuckle.position.y = -.42;
  arm.add(knuckle);
  knuckle.add(organismJoint(.11, materials.signal));

  const wheelSpin = new THREE.Group();
  wheelSpin.rotation.z = Math.PI / 2;
  knuckle.add(wheelSpin);
  const radius = .27 + (index % 2) * .025;
  const tire = new THREE.Mesh(new THREE.TorusGeometry(radius, .085, 10, 24), materials.pad);
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  wheelSpin.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .16, 14), materials.ceramic);
  hub.castShadow = true;
  wheelSpin.add(hub);
  const iris = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .17, 10), materials.signal);
  wheelSpin.add(iris);

  return { root, arm, knuckle, wheelSpin, phase, side, z, radius };
}

function createOrganismManipulator(side, kind, profile, materials) {
  const root = new THREE.Group();
  root.position.set(side * profile.body[0] * .62, profile.posture + .42, -.28);
  root.add(organismJoint(.13, materials.ceramic));

  const upper = new THREE.Group();
  upper.rotation.z = side * -.38;
  root.add(upper);
  upper.add(organismBone(.46, .065, .095, materials.frame));

  const elbow = new THREE.Group();
  elbow.position.y = -.46;
  upper.add(elbow);
  elbow.add(organismJoint(.105, materials.signal));
  elbow.add(organismBone(.38, .045, .075, materials.ceramic));

  const wrist = new THREE.Group();
  wrist.position.y = -.38;
  elbow.add(wrist);
  wrist.add(organismJoint(.075, materials.frame));

  if (kind === 'builder') {
    const palm = organismEllipsoid([.16, .09, .20], materials.tool, 12);
    palm.position.z = -.11;
    wrist.add(palm);
    for (const fingerSide of [-1, 1]) {
      const finger = organismBone(.26, .025, .045, materials.ceramic, 8);
      finger.rotation.x = -.8;
      finger.rotation.z = fingerSide * .34;
      finger.position.set(fingerSide * .09, -.03, -.17);
      wrist.add(finger);
    }
  } else if (kind === 'repair') {
    const probe = new THREE.Mesh(new THREE.ConeGeometry(.12, .46, 10), materials.tool);
    probe.rotation.x = -Math.PI / 2;
    probe.position.z = -.23;
    wrist.add(probe);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(.14, .025, 8, 18), materials.signal);
    halo.position.z = -.34;
    wrist.add(halo);
  } else {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(.12, .62, 8), materials.tool);
    blade.rotation.x = -Math.PI / 2;
    blade.position.z = -.31;
    wrist.add(blade);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(.14, .035, 8, 18), materials.frame);
    guard.position.z = -.05;
    wrist.add(guard);
  }
  return { root, upper, elbow, wrist, kind, side };
}

function createOrganismTail(profile, materials, role) {
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, profile.posture + .18, profile.body[2] * .72);
  const segments = [];
  let parent = tailRoot;
  const count = role === 'sentinel' ? 6 : 4;
  for (let index = 0; index < count; index++) {
    const segment = new THREE.Group();
    const length = .30 - index * .022;
    segment.add(organismBone(length, .07 - index * .006, .10 - index * .007, index % 2 ? materials.frame : materials.ceramic, 9));
    segment.rotation.x = -.32;
    parent.add(segment);
    segments.push(segment);
    const next = new THREE.Group();
    next.position.y = -length;
    segment.add(next);
    next.add(organismJoint(.085 - index * .007, materials.signal));
    parent = next;
  }
  if (role === 'sentinel') {
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(.12, .52, 9), materials.tool);
    stinger.position.y = -.28;
    parent.add(stinger);
  } else {
    const antenna = organismEllipsoid([.09, .18, .09], materials.signal, 12);
    antenna.position.y = -.14;
    parent.add(antenna);
  }
  return { root: tailRoot, segments };
}

function createNeuralVein(points, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .018, 6, false), material);
  mesh.castShadow = false;
  return mesh;
}

function robotVisual(robot) {
  const p = robot.blueprint.parts;
  const role = robotRole(p);
  const profile = organismRoleProfile(role, p);
  const palette = ORGANISM_PALETTES[role];
  const group = new THREE.Group();
  group.name = `R-${robot.id}-${role}-machine-organism`;
  robot.color = new THREE.Color(palette.shell);

  const materials = {
    shell: organismMaterial(palette.shell, .44, .52),
    ceramic: organismMaterial(palette.ceramic, .56, .36),
    tissue: organismMaterial(palette.tissue, .18, .72),
    frame: organismMaterial(0x202622, .74, .45),
    pad: organismMaterial(0x0b0d0b, .04, .94),
    signal: new THREE.MeshStandardMaterial({ color: palette.signal, emissive: palette.signal, emissiveIntensity: 1.1, metalness: .22, roughness: .28 }),
    tool: organismMaterial(palette.tool, .58, .34),
    core: new THREE.MeshStandardMaterial({ color: 0xcab16e, emissive: 0xb77a2d, emissiveIntensity: 1.8, metalness: .24, roughness: .22 }),
    membrane: new THREE.MeshPhysicalMaterial({ color: palette.shell, transparent: true, opacity: .22, transmission: .18, roughness: .18, metalness: .08, depthWrite: false }),
    damage: organismMaterial(0x251b17, .24, .82)
  };

  const locomotionRoot = new THREE.Group();
  const bodyRoot = new THREE.Group();
  locomotionRoot.add(bodyRoot);
  group.add(locomotionRoot);

  const thorax = organismEllipsoid(profile.body, materials.tissue, 28);
  thorax.position.y = profile.posture + .22;
  bodyRoot.add(thorax);

  const underside = organismEllipsoid([profile.body[0] * .66, profile.body[1] * .48, profile.body[2] * .74], materials.frame, 22);
  underside.position.set(0, profile.posture - .04, .02);
  bodyRoot.add(underside);

  const abdomen = organismEllipsoid(profile.abdomen, role === 'hauler' ? materials.ceramic : materials.shell, 26);
  abdomen.position.set(0, profile.posture + .24, profile.body[2] * .66);
  abdomen.rotation.x = -.10;
  bodyRoot.add(abdomen);

  const neck = new THREE.Group();
  neck.position.set(0, profile.posture + .29, -profile.body[2] * .72);
  bodyRoot.add(neck);
  neck.add(organismJoint(.20, materials.frame));

  const headRoot = new THREE.Group();
  headRoot.position.z = -.22;
  neck.add(headRoot);
  const head = organismEllipsoid(profile.head, materials.ceramic, 24);
  head.rotation.x = .08;
  headRoot.add(head);

  const face = organismEllipsoid([profile.head[0] * .76, profile.head[1] * .58, .14], materials.tissue, 18);
  face.position.z = -profile.head[2] * .84;
  headRoot.add(face);

  const lensCount = Math.min(4, Math.max(2, p.sensor));
  const lenses = [];
  for (let index = 0; index < lensCount; index++) {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 9), materials.signal);
    const offset = (index - (lensCount - 1) / 2) * .16;
    lens.position.set(offset, index % 2 ? -.055 : .045, -profile.head[2] * .96);
    lens.scale.z = .44;
    headRoot.add(lens);
    lenses.push(lens);
  }

  const mandibles = [];
  for (const side of [-1, 1]) {
    const mandible = new THREE.Group();
    mandible.position.set(side * profile.head[0] * .52, -.08, -profile.head[2] * .70);
    const jaw = organismBone(.40, .035, .075, materials.frame, 8);
    jaw.rotation.x = -1.12;
    jaw.rotation.z = side * .22;
    mandible.add(jaw);
    headRoot.add(mandible);
    mandibles.push(mandible);
  }

  const brainCage = new THREE.Group();
  brainCage.position.set(0, profile.posture + .44, -.05);
  bodyRoot.add(brainCage);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.22, 2), materials.core);
  core.userData.core = true;
  brainCage.add(core);
  const coreShell = organismEllipsoid([.39, .27, .46], materials.membrane, 20);
  brainCage.add(coreShell);
  robot.coreMesh = core;

  const neuralMaterials = [];
  const neuralVeins = [];
  for (const side of [-1, 1]) {
    const material = new THREE.MeshStandardMaterial({ color: palette.signal, emissive: palette.signal, emissiveIntensity: .85, metalness: .05, roughness: .36 });
    neuralMaterials.push(material);
    const vein = createNeuralVein([
      [0, profile.posture + .44, -.05],
      [side * .30, profile.posture + .37, -.28],
      [side * profile.body[0] * .52, profile.posture + .18, -.10],
      [side * profile.body[0] * .72, profile.posture + .02, .20]
    ], material);
    bodyRoot.add(vein);
    neuralVeins.push(vein);
  }
  const dorsalMaterial = neuralMaterials[0].clone();
  neuralMaterials.push(dorsalMaterial);
  const dorsalVein = createNeuralVein([
    [0, profile.posture + .46, -.20],
    [0, profile.posture + profile.body[1] * .92, .18],
    [0, profile.posture + profile.body[1] * .84, profile.body[2] * .72]
  ], dorsalMaterial);
  bodyRoot.add(dorsalVein);
  neuralVeins.push(dorsalVein);

  const plates = [];
  for (let index = 0; index < 4; index++) {
    const plate = organismEllipsoid([profile.body[0] * (.92 - index * .07), profile.body[1] * .34, profile.body[2] * .20], index % 2 ? materials.ceramic : materials.shell, 18);
    plate.position.set(0, profile.posture + profile.body[1] * .56, -profile.body[2] * .48 + index * profile.body[2] * .32);
    plate.rotation.x = -.08 + index * .035;
    bodyRoot.add(plate);
    plates.push(plate);
  }

  const legs = [];
  if (profile.legCount) {
    for (let index = 0; index < profile.legCount; index++) {
      const side = index % 2 === 0 ? -1 : 1;
      const pair = Math.floor(index / 2);
      const pairs = Math.ceil(profile.legCount / 2);
      const z = pairs === 1 ? 0 : THREE.MathUtils.lerp(-profile.body[2] * .52, profile.body[2] * .52, pair / (pairs - 1));
      const leg = createOrganismLeg(side, z, pair * Math.PI + (side > 0 ? Math.PI : 0), profile, materials, index);
      locomotionRoot.add(leg.root);
      legs.push(leg);
    }
  }

  const wheelLimbs = [];
  if (profile.wheelCount) {
    for (let index = 0; index < profile.wheelCount; index++) {
      const side = index % 2 === 0 ? -1 : 1;
      const pair = Math.floor(index / 2);
      const pairs = Math.ceil(profile.wheelCount / 2);
      const z = pairs === 1 ? 0 : THREE.MathUtils.lerp(-profile.body[2] * .48, profile.body[2] * .48, pair / (pairs - 1));
      const limb = createOrganismWheelLimb(side, z, index * Math.PI * .5, profile, materials, index);
      locomotionRoot.add(limb.root);
      wheelLimbs.push(limb);
    }
  }

  const manipulators = [];
  if (p.builder > 0) {
    const manipulator = createOrganismManipulator(1, 'builder', profile, materials);
    bodyRoot.add(manipulator.root);
    manipulators.push(manipulator);
  }
  if (p.repair > 0) {
    const manipulator = createOrganismManipulator(-1, 'repair', profile, materials);
    bodyRoot.add(manipulator.root);
    manipulators.push(manipulator);
  }
  if (p.weapon > 0) {
    const manipulator = createOrganismManipulator(1, 'weapon', profile, materials);
    manipulator.root.position.z = -.56;
    bodyRoot.add(manipulator.root);
    manipulators.push(manipulator);
  }

  if (role === 'hauler' || p.cargo > 1) {
    const cargoCavity = organismEllipsoid([profile.abdomen[0] * .72, profile.abdomen[1] * .48, profile.abdomen[2] * .70], materials.tissue, 20);
    cargoCavity.position.copy(abdomen.position);
    cargoCavity.position.y += .14;
    bodyRoot.add(cargoCavity);
    const cargoNodes = [];
    for (let index = 0; index < Math.min(4, Math.max(2, p.cargo)); index++) {
      const node = organismEllipsoid([.18, .14, .24], materials.signal, 12);
      node.position.set((index % 2 ? 1 : -1) * .28, profile.posture + .56 + Math.floor(index / 2) * .22, profile.body[2] * .70);
      bodyRoot.add(node);
      cargoNodes.push(node);
    }
  }

  if (p.solar > 0) {
    const finRoot = new THREE.Group();
    finRoot.position.set(0, profile.posture + profile.body[1] * 1.10, .35);
    bodyRoot.add(finRoot);
    for (let index = 0; index < Math.min(3, p.solar); index++) {
      const fin = organismEllipsoid([.12, .48, .36], organismMaterial(0x263a36, .12, .28), 16);
      fin.position.set((index - (Math.min(3, p.solar) - 1) / 2) * .28, .18, 0);
      fin.rotation.z = (index - 1) * .16;
      finRoot.add(fin);
    }
  }

  const tail = createOrganismTail(profile, materials, role);
  bodyRoot.add(tail.root);

  const damageIndicators = [];
  for (let index = 0; index < 3; index++) {
    const wound = organismEllipsoid([.15 + index * .025, .045, .24], materials.damage, 12);
    wound.position.set(index % 2 ? .34 : -.36, profile.posture + profile.body[1] * .78, -.28 + index * .34);
    wound.rotation.set(.28, index * .7, .16);
    wound.visible = false;
    bodyRoot.add(wound);
    damageIndicators.push(wound);
  }

  const sensorCone = new THREE.Mesh(
    new THREE.ConeGeometry(Math.min(3.3, robot.stats.sensor * .23), Math.min(7.5, robot.stats.sensor), 24, 1, true),
    new THREE.MeshBasicMaterial({ color: palette.signal, transparent: true, opacity: .025, side: THREE.DoubleSide, depthWrite: false })
  );
  sensorCone.rotation.x = Math.PI / 2;
  sensorCone.position.set(0, profile.posture + .38, -robot.stats.sensor * .48);
  sensorCone.visible = false;
  group.add(sensorCone);
  robot.sensorCone = sensorCone;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.08, 1.13, 48),
    new THREE.MeshBasicMaterial({ color: palette.signal, transparent: true, opacity: .58, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .025;
  ring.visible = false;
  group.add(ring);
  robot.selectionRing = ring;

  robot.visualRig = {
    version: 5,
    role,
    profile,
    locomotionRoot,
    bodyRoot,
    thorax,
    abdomen,
    neck,
    headRoot,
    mandibles,
    brainCage,
    plates,
    lenses,
    neuralMaterials,
    legs,
    wheelLimbs,
    manipulators,
    tail,
    damageIndicators,
    motionPhase: robot.id * .83,
    lastTime: state.time,
    lean: 0,
    roll: 0,
    collapse: 0,
    scanPhase: robot.id * 1.71,
    baseY: 1.08
  };

  group.userData.entity = robot;
  group.traverse(object => {
    if (object.isMesh) {
      object.userData.entity = robot;
      interactive.push(object);
    }
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
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x313b33, roughness: .88, metalness: .12 });
  const veinMat = new THREE.MeshStandardMaterial({ color: 0x7fa092, emissive: 0x5f8372, emissiveIntensity: 1.1, roughness: .42, metalness: .24 });
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(.58, .78, .15, 9), stoneMat);
  bed.position.y = .08;
  bed.scale.z = 1.25;
  bed.castShadow = true;
  group.add(bed);
  const shards = 3 + (res.id % 3);
  for (let index = 0; index < shards; index++) {
    const height = .34 + (index % 3) * .16 + amount * .0025;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(.12 + index * .025, height, 6), index % 2 ? stoneMat : veinMat);
    shard.position.set((index - (shards - 1) / 2) * .20, .15 + height * .46, (index % 2 ? .16 : -.12));
    shard.rotation.z = (index - 1) * .13;
    shard.castShadow = true;
    group.add(shard);
  }
  const pulse = new THREE.Mesh(new THREE.RingGeometry(.58, .64, 24), new THREE.MeshBasicMaterial({ color: 0x769887, transparent: true, opacity: .22, side: THREE.DoubleSide }));
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = .17;
  group.add(pulse);
  res.pulse = pulse;
  group.position.set(position.x, 0, position.z);
  group.userData.entity = res;
  group.traverse(object => { if (object.isMesh) { object.userData.entity = res; interactive.push(object); } });
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
  const dark = new THREE.MeshStandardMaterial({ color: 0x232a25, metalness: .58, roughness: .62 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0x69786d, metalness: .42, roughness: .48 });
  const signal = new THREE.MeshStandardMaterial({ color: 0xb49054, emissive: 0x9d6524, emissiveIntensity: 1.4, metalness: .18, roughness: .30 });

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.05, .34, 28), dark);
  pad.position.y = .17;
  pad.castShadow = true;
  pad.receiveShadow = true;
  group.add(pad);

  const nest = new THREE.Mesh(new THREE.TorusGeometry(1.65, .24, 12, 36), ceramic);
  nest.rotation.x = Math.PI / 2;
  nest.position.y = .42;
  nest.castShadow = true;
  group.add(nest);

  const rotor = new THREE.Group();
  rotor.position.y = .62;
  group.add(rotor);
  for (let index = 0; index < 5; index++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(.76 + index * .075, .032, 8, 30, Math.PI * 1.35), index % 2 ? ceramic : dark);
    rib.rotation.set(Math.PI / 2, index * .48, index * .33);
    rotor.add(rib);
  }
  const brain = new THREE.Mesh(new THREE.IcosahedronGeometry(.48, 2), signal);
  brain.scale.y = .72;
  rotor.add(brain);
  s.orb = rotor;

  for (let index = 0; index < 6; index++) {
    const pylon = new THREE.Group();
    const angle = index / 6 * Math.PI * 2;
    pylon.position.set(Math.cos(angle) * 2.22, .34, Math.sin(angle) * 2.22);
    pylon.rotation.y = -angle;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.09, .15, .72, 10), dark);
    stem.position.y = .36;
    pylon.add(stem);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 8), signal);
    eye.position.set(0, .77, -.02);
    pylon.add(eye);
    group.add(pylon);
  }

  group.userData.entity = s;
  group.traverse(object => { if (object.isMesh) { object.userData.entity = s; interactive.push(object); } });
  s.mesh = group;
  worldGroup.add(group);
  const body = physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, .3, 0));
  s.body = body;
  s.collider = physics.createCollider(RAPIER.ColliderDesc.cylinder(.3, 2.8), body);
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
  for (const robot of state.robots) {
    const position = robot.body.translation();
    const rotation = robot.body.rotation();
    const velocity = robot.body.linvel();
    const angular = robot.body.angvel();
    const rig = robot.visualRig;
    const visualDt = rig ? clamp(state.time - rig.lastTime, 0, .06) : 0;
    const planarSpeed = Math.hypot(velocity.x, velocity.z);

    robot.mesh.position.set(position.x, position.y - .48, position.z);
    robot.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    if (rig?.version === 5) {
      rig.lastTime = state.time;
      const active = !robot.disabled && robot.health > 0 && robot.energy > 0;
      const moving = active && planarSpeed > .10;
      const speedRatio = clamp(planarSpeed / Math.max(1.5, robot.stats.speed), 0, 1.4);
      if (moving) rig.motionPhase += planarSpeed * visualDt * 3.0 * rig.profile.gait;
      else rig.motionPhase += visualDt * .35;

      rig.collapse = lerp(rig.collapse, active ? 0 : 1, active ? .08 : .035);
      rig.lean = lerp(rig.lean, moving ? speedRatio * .11 : 0, .11);
      rig.roll = lerp(rig.roll, active ? clamp(-angular.y * .05, -.10, .10) : .16, .09);

      const breathing = active ? Math.sin(state.time * 2.1 + robot.id) * .018 : 0;
      const gaitBob = moving ? Math.abs(Math.sin(rig.motionPhase * 2)) * .045 : 0;
      rig.bodyRoot.position.y = breathing + gaitBob - rig.collapse * .28;
      rig.bodyRoot.rotation.x = -rig.lean + rig.collapse * .34;
      rig.bodyRoot.rotation.z = rig.roll + rig.collapse * (robot.id % 2 ? -.38 : .38);
      rig.thorax.scale.y = rig.profile.body[1] * (1 + breathing * .35);
      rig.abdomen.rotation.x = -.10 + Math.sin(state.time * 1.35 + robot.id) * .025 - rig.collapse * .18;

      const targetPosition = robot.target ? positionOf(robot.target) : null;
      let targetYaw = Math.sin(state.time * .55 + rig.scanPhase) * .28;
      if (targetPosition) {
        const localTarget = new THREE.Vector3(targetPosition.x - position.x, 0, targetPosition.z - position.z);
        const worldYaw = Math.atan2(localTarget.x, localTarget.z);
        const bodyYaw = 2 * Math.atan2(rotation.y, rotation.w);
        targetYaw = clamp(worldYaw - bodyYaw, -.72, .72);
      }
      rig.headRoot.rotation.y = lerp(rig.headRoot.rotation.y, targetYaw, .085);
      rig.headRoot.rotation.x = .03 + Math.sin(state.time * 1.8 + robot.id) * .035 + rig.collapse * .25;
      rig.neck.rotation.x = Math.sin(state.time * 1.1 + robot.id) * .018;

      const energyRatio = clamp(robot.energy / robot.stats.maxEnergy, 0, 1);
      const healthRatio = clamp(robot.health / robot.stats.maxHealth, 0, 1);
      const neuralPulse = active ? .75 + energyRatio * 1.35 + Math.sin(state.time * 5.2 + robot.id) * .35 : .05;
      for (let index = 0; index < rig.neuralMaterials.length; index++) {
        rig.neuralMaterials[index].emissiveIntensity = neuralPulse * (1 - index * .08);
      }
      for (let index = 0; index < rig.lenses.length; index++) {
        rig.lenses[index].material.emissiveIntensity = active ? .75 + Math.sin(state.time * 3.4 + index + robot.id) * .22 : .04;
      }
      robot.coreMesh.material.emissiveIntensity = active ? 1.1 + energyRatio * 2.2 + Math.sin(state.time * 4.7 + robot.id) * .35 : .035;
      rig.brainCage.rotation.y += visualDt * (active ? .42 : .05);

      for (let index = 0; index < rig.damageIndicators.length; index++) {
        rig.damageIndicators[index].visible = healthRatio < .78 - index * .22;
      }

      for (let index = 0; index < rig.legs.length; index++) {
        const leg = rig.legs[index];
        const phase = rig.motionPhase + leg.phase;
        const swing = moving ? Math.sin(phase) : Math.sin(state.time * .75 + leg.phase) * .08;
        const lift = moving ? Math.max(0, Math.sin(phase)) : 0;
        leg.root.rotation.y = swing * .28 * (leg.side > 0 ? -1 : 1);
        leg.coxa.rotation.x = -.08 + swing * .32 - rig.collapse * .55;
        leg.femur.rotation.x = -.48 - lift * .52 + Math.max(0, -swing) * .18 + rig.collapse * .72;
        leg.tibia.rotation.x = .82 + lift * .72 - rig.collapse * .32;
        leg.ankle.rotation.x = -.31 - lift * .25;
        leg.root.position.y = rig.profile.posture - (moving ? lift * .045 : 0) - rig.collapse * .18;
      }

      for (const limb of rig.wheelLimbs) {
        limb.wheelSpin.rotation.x -= planarSpeed * visualDt / Math.max(.08, limb.radius);
        const compression = moving ? Math.sin(rig.motionPhase + limb.phase) * .035 : Math.sin(state.time * .8 + limb.phase) * .012;
        limb.arm.rotation.x = -.10 + compression - rig.collapse * .38;
        limb.knuckle.position.y = -.42 + compression;
      }

      for (let index = 0; index < rig.tail.segments.length; index++) {
        const segment = rig.tail.segments[index];
        segment.rotation.z = Math.sin(state.time * 1.55 + index * .55 + robot.id) * (.10 + index * .018);
        segment.rotation.x = -.32 + Math.sin(state.time * 1.2 + index * .4) * .035 - rig.collapse * .12;
      }

      for (const mandible of rig.mandibles) {
        const working = ['GATHER', 'BUILD', 'ATTACK', 'REPAIR_ALLY'].includes(robot.state);
        const bite = working ? Math.sin(state.time * 7.4 + robot.id) * .20 : .035;
        mandible.rotation.y = mandible.position.x > 0 ? -bite : bite;
      }

      for (const arm of rig.manipulators) {
        let reach = 0;
        let cadence = 1.6;
        if (arm.kind === 'builder' && robot.state === 'BUILD') { reach = .70; cadence = 5.2; }
        if (arm.kind === 'repair' && ['SEEK_REPAIR', 'REPAIR_ALLY'].includes(robot.state)) { reach = .62; cadence = 4.4; }
        if (arm.kind === 'weapon' && robot.state === 'ATTACK') { reach = .78; cadence = 7.4; }
        const action = reach ? Math.max(0, Math.sin(state.time * cadence + robot.id)) : 0;
        arm.upper.rotation.x = -.20 - reach * .56 - action * .22;
        arm.upper.rotation.z = arm.side * (-.38 + reach * .18);
        arm.elbow.rotation.x = .52 + reach * .38 + action * .28;
        arm.wrist.rotation.y = Math.sin(state.time * cadence * .68 + robot.id) * (reach ? .30 : .06);
      }

      robot.selectionRing.visible = state.selected === robot;
      robot.sensorCone.visible = state.selected === robot;
    } else {
      robot.selectionRing.visible = state.selected === robot;
      robot.sensorCone.visible = state.selected === robot;
    }
  }

  for (const drone of state.drones) {
    if (!drone.body || drone.disabled) continue;
    const position = drone.body.translation();
    const rotation = drone.body.rotation();
    drone.mesh.position.set(position.x, position.y, position.z);
    drone.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    drone.mesh.rotation.y += .02;
  }
  for (const detached of state.detached) {
    const position = detached.body.translation();
    const rotation = detached.body.rotation();
    detached.mesh.position.set(position.x, position.y, position.z);
    detached.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }
  for (const resource of state.resources) {
    if (resource.pulse) {
      resource.pulse.rotation.z += .003;
      resource.pulse.material.opacity = .15 + Math.sin(state.time * 2.6 + resource.id) * .07;
    }
  }
  for (const structure of state.structures) if (structure.orb) structure.orb.rotation.y += .004;
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
  state.matter = 220;
  state.time = 0;
  state.tick = 0;
  state.objective = 'running';
  state.nextRobotId = 1;
  state.nextStructureId = 1;
  state.nextResourceId = 1;
  state.nextDroneId = 1;
  if (!state.structures.length) createBase();
  for (const p of [
    { x: -8, z: -6 }, { x: 8, z: -7 }, { x: -12, z: 2 }, { x: 11, z: 5 }, { x: -4, z: 12 }, { x: 7, z: 12 }
  ]) createResource(p, rng.range(30, 52));
  createStructure('charger', { x: 5.4, z: 1.4 });
  createStructure('repair', { x: -5.2, z: 1.2 });
  createHazard({ x: 8, z: -3 }, 'gas');
  createHazard({ x: -10, z: -8 }, 'fire');
  createDrone({ x: 14, z: -12 });

  const constructor = structuredClone(DEFAULT_BLUEPRINT);
  constructor.name = 'MANTIS-CONSTRUCTOR';
  constructor.parts.wheel = 0;
  constructor.parts.leg = 4;
  constructor.parts.builder = 1;
  constructor.parts.repair = 0;
  constructor.parts.weapon = 0;
  constructor.parts.cargo = 1;
  constructor.traits.cooperation = .86;

  const medic = structuredClone(DEFAULT_BLUEPRINT);
  medic.name = 'ARACHNID-MEDIC';
  medic.parts.wheel = 0;
  medic.parts.leg = 4;
  medic.parts.builder = 0;
  medic.parts.repair = 1;
  medic.parts.weapon = 0;
  medic.traits.cooperation = .94;
  medic.traits.caution = .58;

  const sentinel = structuredClone(DEFAULT_BLUEPRINT);
  sentinel.name = 'SCORPION-SENTINEL';
  sentinel.parts.wheel = 0;
  sentinel.parts.leg = 4;
  sentinel.parts.builder = 0;
  sentinel.parts.repair = 0;
  sentinel.parts.weapon = 1;
  sentinel.parts.cargo = 0;
  sentinel.parts.armor = 2;
  sentinel.traits.aggression = .76;

  spawnRobot(constructor, { x: 3.0, y: 1.2, z: 3.8 });
  spawnRobot(medic, { x: -3.1, y: 1.2, z: 3.2 });
  spawnRobot(sentinel, { x: .2, y: 1.2, z: -4.8 });
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
