import {
  Color3,
  Color4,
  DirectionalLight,
  Matrix,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  SceneLoader,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/STL/stlFileLoader.js';

const EXPECTED_CAD_COMMIT = '7d8fc8034d715d1c9373f48281ecfa500c994d8b';

function makeMaterial(scene, name, albedo, metallic, roughness, emissive = null) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = albedo;
  material.metallic = metallic;
  material.roughness = roughness;
  material.emissiveColor = emissive || Color3.Black();
  material.environmentIntensity = 0.68;
  return material;
}

function installMaterials(renderer) {
  const { scene } = renderer;
  Object.assign(renderer.materials, {
    cadFrame: makeMaterial(scene, 'cad-frame-anodized-aluminium', new Color3(0.105, 0.118, 0.122), 0.88, 0.27),
    cadShell: makeMaterial(scene, 'cad-shell-coated-polymer', new Color3(0.44, 0.45, 0.43), 0.16, 0.62),
    cadShellDark: makeMaterial(scene, 'cad-shell-dark-polymer', new Color3(0.047, 0.052, 0.055), 0.12, 0.72),
    cadJoint: makeMaterial(scene, 'cad-joint-machined-steel', new Color3(0.20, 0.21, 0.21), 0.92, 0.23),
    cadFoot: makeMaterial(scene, 'cad-foot-elastomer', new Color3(0.014, 0.016, 0.017), 0.01, 0.97),
    cadSignal: makeMaterial(
      scene,
      'cad-status-optic',
      new Color3(0.12, 0.018, 0.009),
      0.18,
      0.18,
      new Color3(0.09, 0.006, 0.002),
    ),
    plinth: makeMaterial(scene, 'specimen-plinth-material', new Color3(0.040, 0.043, 0.043), 0.08, 0.94),
    marking: makeMaterial(scene, 'specimen-measurement-marking', new Color3(0.22, 0.225, 0.218), 0.24, 0.72),
  });
}

function disposePrototypeState(renderer) {
  renderer.architecture?.grid?.dispose?.();
  renderer.architecture?.chamber?.dispose?.();
  renderer.architecture?.edges?.forEach?.((edge) => edge.dispose());
  renderer.architecture?.plinth?.dispose?.();
  renderer.architecture?.outerRing?.dispose?.();
  renderer.architecture?.innerRing?.dispose?.();
  renderer.architecture?.ticks?.forEach?.((tick) => tick.dispose());

  renderer.meshes.forEach((node) => node?.dispose?.(false, false));
  renderer.meshes.length = 0;
  renderer.signatures.length = 0;
}

function createSpecimenPlinth(renderer) {
  const plinth = MeshBuilder.CreateCylinder('cad-specimen-plinth', {
    diameter: 3.20,
    height: 0.055,
    tessellation: 72,
  }, renderer.scene);
  plinth.position.y = -0.047;
  plinth.material = renderer.materials.plinth;
  plinth.receiveShadows = true;
  plinth.isPickable = false;

  const ring = MeshBuilder.CreateTorus('cad-specimen-reference-ring', {
    diameter: 2.72,
    thickness: 0.006,
    tessellation: 96,
  }, renderer.scene);
  ring.position.y = -0.017;
  ring.material = renderer.materials.marking;
  ring.isPickable = false;

  const ticks = [];
  for (let index = 0; index < 36; index += 1) {
    const angle = index / 36 * Math.PI * 2;
    const major = index % 6 === 0;
    const tick = MeshBuilder.CreateBox(`cad-plinth-tick-${index}`, {
      width: major ? 0.14 : 0.055,
      height: 0.0025,
      depth: major ? 0.009 : 0.005,
    }, renderer.scene);
    tick.position.set(Math.cos(angle) * 1.30, -0.017, Math.sin(angle) * 1.30);
    tick.rotation.y = -angle;
    tick.material = renderer.materials.marking;
    tick.isPickable = false;
    ticks.push(tick);
  }
  renderer.architecture = { plinth, ring, ticks };
}

function installLightingAndCamera(renderer) {
  renderer.scene.clearColor = new Color4(0.008, 0.010, 0.011, 1);
  renderer.scene.imageProcessingConfiguration.contrast = 1.22;
  renderer.scene.imageProcessingConfiguration.exposure = 1.08;

  const ambient = renderer.scene.getLightByName('ambient-lab');
  if (ambient) {
    ambient.intensity = 0.54;
    ambient.diffuse = new Color3(0.72, 0.75, 0.76);
    ambient.groundColor = new Color3(0.010, 0.012, 0.013);
  }

  if (renderer.keyLight) {
    renderer.keyLight.direction = new Vector3(-0.58, -1, 0.24);
    renderer.keyLight.position = new Vector3(3.8, 5.7, -3.5);
    renderer.keyLight.intensity = 2.95;
    renderer.keyLight.diffuse = new Color3(1.0, 0.95, 0.88);
  }

  const rim = new DirectionalLight('cad-rim-light', new Vector3(0.54, -0.38, -0.70), renderer.scene);
  rim.position = new Vector3(-4.2, 3.9, 4.7);
  rim.intensity = 1.30;
  rim.diffuse = new Color3(0.38, 0.47, 0.54);

  renderer.camera.alpha = -1.96;
  renderer.camera.beta = 1.12;
  renderer.camera.radius = 4.72;
  renderer.camera.lowerRadiusLimit = 3.15;
  renderer.camera.upperRadiusLimit = 7.2;
  renderer.camera.fov = 0.78;
  renderer.camera.inertia = 0.54;
  renderer.camera.wheelPrecision = 72;
  renderer.camera.pinchPrecision = 96;
}

function permutationQuaternion(size, targetLayout) {
  const source = [
    { axis: 0, size: size.x },
    { axis: 1, size: size.y },
    { axis: 2, size: size.z },
  ].sort((a, b) => b.size - a.size);

  const sourceForTarget = {
    primary: source[0].axis,
    middle: source[1].axis,
    thin: source[2].axis,
  };
  const targetVectors = targetLayout === 'limb'
    ? {
        [sourceForTarget.primary]: new Vector3(0, 1, 0),
        [sourceForTarget.thin]: new Vector3(1, 0, 0),
        [sourceForTarget.middle]: new Vector3(0, 0, 1),
      }
    : {
        [sourceForTarget.primary]: new Vector3(1, 0, 0),
        [sourceForTarget.thin]: new Vector3(0, 1, 0),
        [sourceForTarget.middle]: new Vector3(0, 0, 1),
      };

  const columns = [targetVectors[0], targetVectors[1], targetVectors[2]];
  const determinant = Vector3.Dot(columns[0], Vector3.Cross(columns[1], columns[2]));
  if (determinant < 0) columns[sourceForTarget.middle].scaleInPlace(-1);

  const matrix = Matrix.FromValues(
    columns[0].x, columns[1].x, columns[2].x, 0,
    columns[0].y, columns[1].y, columns[2].y, 0,
    columns[0].z, columns[1].z, columns[2].z, 0,
    0, 0, 0, 1,
  );
  return Object.freeze({
    quaternion: Quaternion.FromRotationMatrix(matrix),
    source,
  });
}

function centreMeshGeometry(mesh) {
  mesh.rotationQuaternion = null;
  mesh.rotation.set(0, 0, 0);
  mesh.position.set(0, 0, 0);
  mesh.scaling.set(1, 1, 1);
  mesh.computeWorldMatrix(true);
  const bounds = mesh.getBoundingInfo().boundingBox;
  const center = bounds.center.clone();
  mesh.bakeTransformIntoVertices(Matrix.Translation(-center.x, -center.y, -center.z));
  mesh.refreshBoundingInfo(true);
  mesh.computeWorldMatrix(true);
  const normalized = mesh.getBoundingInfo().boundingBox.extendSize.scale(2);
  if (![normalized.x, normalized.y, normalized.z].every((value) => Number.isFinite(value) && value > 1e-6)) {
    throw new Error(`${mesh.name}: CAD mesh has invalid bounds.`);
  }
  return normalized;
}

async function loadCadTemplate(scene, rootUrl, asset) {
  const result = await SceneLoader.ImportMeshAsync(null, rootUrl, asset.file, scene);
  const mesh = result.meshes.find((candidate) => candidate.getTotalVertices?.() > 0);
  if (!mesh) throw new Error(`${asset.id}: STL loader returned no renderable mesh.`);

  for (const candidate of result.meshes) {
    if (candidate !== mesh) candidate.dispose(false, false);
  }
  mesh.name = `cad-template-${asset.id}`;
  const size = centreMeshGeometry(mesh);
  const torsoFit = permutationQuaternion(size, 'torso');
  const limbFit = permutationQuaternion(size, 'limb');
  mesh.isPickable = false;
  mesh.isVisible = false;
  mesh.setEnabled(false);

  return Object.freeze({
    id: asset.id,
    mesh,
    size,
    torsoQuaternion: torsoFit.quaternion,
    limbQuaternion: limbFit.quaternion,
    primaryExtent: Math.max(size.x, size.y, size.z),
    sha256: asset.sha256,
  });
}

async function loadCadLibrary(renderer) {
  const rootUrl = new URL('cad/', document.baseURI).href;
  const manifestResponse = await fetch(new URL('manifest.json', rootUrl), { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error(`CAD manifest unavailable: HTTP ${manifestResponse.status}.`);
  const manifest = await manifestResponse.json();
  if (manifest.schema !== 'nexus.cad-asset-manifest.v1') throw new Error('Unsupported CAD manifest schema.');
  if (manifest.sourceCommit !== EXPECTED_CAD_COMMIT) {
    throw new Error(`CAD source moved: expected ${EXPECTED_CAD_COMMIT}, received ${manifest.sourceCommit}.`);
  }
  if (manifest.license !== 'MIT' || !Array.isArray(manifest.assets) || manifest.assets.length < 10) {
    throw new Error('CAD manifest failed attribution or completeness requirements.');
  }

  const entries = await Promise.all(manifest.assets.map((asset) => loadCadTemplate(renderer.scene, rootUrl, asset)));
  return Object.freeze({
    manifest,
    templates: Object.freeze(Object.fromEntries(entries.map((entry) => [entry.id, entry]))),
  });
}

function cloneCad(renderer, templateId, name, parent, material, {
  targetPrimary,
  layout = 'limb',
  localPosition = Vector3.Zero(),
  localRotation = Quaternion.Identity(),
  scaleMultiplier = 1,
  castsShadow = true,
} = {}) {
  const template = renderer.cad.templates[templateId];
  if (!template) throw new Error(`Missing CAD template ${templateId}.`);
  const clone = template.mesh.clone(name, parent, false);
  if (!clone) throw new Error(`Unable to clone CAD template ${templateId}.`);

  clone.setEnabled(true);
  clone.isVisible = true;
  clone.isPickable = false;
  clone.material = material;
  clone.position.copyFrom(localPosition);
  const orientation = layout === 'torso' ? template.torsoQuaternion : template.limbQuaternion;
  clone.rotationQuaternion = localRotation.multiply(orientation);
  const scale = targetPrimary / template.primaryExtent * scaleMultiplier;
  clone.scaling.setAll(scale);
  if (castsShadow) renderer.shadowGenerator.addShadowCaster(clone, false);
  return clone;
}

function installCadAssemblies(renderer) {
  renderer.createTorsoAssembly = function createTorsoAssembly(index, size) {
    const root = new TransformNode(`cad-torso-root-${index}`, this.scene);
    const length = size[0] * 2;
    const height = size[2] * 2;

    cloneCad(this, 'frame', `cad-frame-instance-${index}`, root, this.materials.cadFrame, {
      targetPrimary: length * 0.90,
      layout: 'torso',
    });
    cloneCad(this, 'top-cover', `cad-top-cover-instance-${index}`, root, this.materials.cadShell, {
      targetPrimary: length * 0.89,
      layout: 'torso',
      localPosition: new Vector3(0, height * 0.10, 0),
    });
    cloneCad(this, 'bottom-cover', `cad-bottom-cover-instance-${index}`, root, this.materials.cadShellDark, {
      targetPrimary: length * 0.88,
      layout: 'torso',
      localPosition: new Vector3(0, -height * 0.14, 0),
    });
    return root;
  };

  renderer.createCoreAssembly = function createCoreAssembly(index) {
    const root = new TransformNode(`cad-core-hidden-${index}`, this.scene);
    root.setEnabled(false);
    return root;
  };

  renderer.createLimbAssembly = function createLimbAssembly(index, size) {
    const root = new TransformNode(`cad-limb-root-${index}`, this.scene);
    const radius = size[0];
    const targetLength = size[2] * 2 + radius * 2;
    const upper = radius >= 0.041;
    const left = index % 2 === 0;
    const segmentId = upper
      ? (left ? 'femur-left' : 'femur-right')
      : (left ? 'tibia-left' : 'tibia-right');

    cloneCad(this, segmentId, `cad-${upper ? 'femur' : 'tibia'}-instance-${index}`, root, upper ? this.materials.cadShell : this.materials.cadShellDark, {
      targetPrimary: targetLength * 1.055,
      layout: 'limb',
    });
    return root;
  };

  renderer.createFootAssembly = function createFootAssembly(index, radius) {
    const root = new TransformNode(`cad-foot-root-${index}`, this.scene);
    cloneCad(this, 'foot-tip', `cad-foot-tip-instance-${index}`, root, this.materials.cadFoot, {
      targetPrimary: radius * 1.70,
      layout: 'torso',
      localRotation: Quaternion.FromEulerAngles(0, 0, -Math.PI * 0.5),
      localPosition: new Vector3(0, -radius * 0.08, 0),
    });
    return root;
  };

  renderer.createSensorAssembly = function createSensorAssembly(index) {
    const root = new TransformNode(`cad-sensor-hidden-${index}`, this.scene);
    root.setEnabled(false);
    return root;
  };

  renderer.updateFollowCamera = function updateFollowCamera() {
    const position = this.runtime.rootPosition;
    const authoritativeTarget = new Vector3(
      position.x,
      Math.max(0.18, position.z - 0.12),
      -position.y,
    );
    this.followTarget = Vector3.Lerp(this.followTarget, authoritativeTarget, 0.09);
    this.camera.setTarget(this.followTarget);
  };

  renderer.updateStateMaterials = function updateStateMaterials() {
    const observation = this.runtime.buildObservation();
    const contactRatio = observation.footContacts.filter((force) => force > 0.001).length / 6;
    const power = Math.min(1, this.runtime.lastPowerWatts / 300);
    this.materials.cadSignal.emissiveColor.set(0.05 + power * 0.26, 0.003 + contactRatio * 0.015, 0.001);
  };
}

export async function applyProductionArtDirection(renderer) {
  installMaterials(renderer);
  disposePrototypeState(renderer);
  createSpecimenPlinth(renderer);
  installLightingAndCamera(renderer);
  renderer.cad = await loadCadLibrary(renderer);
  installCadAssemblies(renderer);
  renderer.artDirection = Object.freeze({
    id: 'nexus.cad-authored-hexapod.v1',
    presentationRevision: 2,
    authoredCad: true,
    proceduralRobotShells: false,
    colliderVisibility: false,
    offlineAssetBundle: true,
    fullBodyFraming: true,
    sourceRepository: renderer.cad.manifest.sourceRepository,
    sourceCommit: renderer.cad.manifest.sourceCommit,
    assetCount: renderer.cad.manifest.assets.length,
  });
}
