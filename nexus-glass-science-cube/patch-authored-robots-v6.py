from pathlib import Path

path = Path('nexus-glass-science-cube/runtime-source.js')
source = path.read_text(encoding='utf-8')

imports_old = "import * as THREE from 'three';\nimport { OrbitControls } from 'three/addons/controls/OrbitControls.js';\nimport RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';"
imports_new = "import * as THREE from 'three';\nimport { OrbitControls } from 'three/addons/controls/OrbitControls.js';\nimport { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\nimport * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';\nimport RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';"
if imports_old not in source:
    raise RuntimeError('Could not find runtime import block')
source = source.replace(imports_old, imports_new, 1)

init_marker = "await RAPIER.init();\n"
asset_loader = r'''

const authoredLoader = new GLTFLoader();
const AUTHORED_ASSET_URLS = {
  trilobite: './assets/quaternius-scifi/Enemy_Trilobite/Enemy_Trilobite.gltf',
  quadShell: './assets/quaternius-scifi/Enemy_QuadShell/Enemy_QuadShell.gltf',
  eyeDrone: './assets/quaternius-scifi/Enemy_EyeDrone/Enemy_EyeDrone.gltf'
};
const AUTHORED_ASSETS = Object.fromEntries(await Promise.all(
  Object.entries(AUTHORED_ASSET_URLS).map(async ([key, url]) => [key, await authoredLoader.loadAsync(url)])
));
'''
if init_marker not in source:
    raise RuntimeError('Could not find Rapier initialization marker')
source = source.replace(init_marker, init_marker + asset_loader, 1)

start = source.index('function robotVisual(robot) {')
end = source.index('function removeRobotInteractive(robot) {', start)
robot_block = r'''const AUTHORED_ROLE_STYLE = {
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

'''
source = source[:start] + robot_block + source[end:]

sync_start = source.index('function syncVisuals() {')
sync_end = source.index('function chooseTool(tool) {', sync_start)
sync_block = r'''function syncVisuals() {
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

'''
source = source[:sync_start] + sync_block + source[sync_end:]

path.write_text(source, encoding='utf-8')
print(f'Installed authored robot V6 runtime ({len(source):,} characters)')
