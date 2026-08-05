import {
  Color3,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

const REFERENCE_LEG = 'fl';
const EPSILON = 1e-7;

function makeMaterial(scene, name, albedo, metallic, roughness) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = albedo;
  material.metallic = metallic;
  material.roughness = roughness;
  material.environmentIntensity = 0.72;
  return material;
}

function quaternionFromTo(from, to) {
  const a = from.normalizeToNew();
  const b = to.normalizeToNew();
  const dot = Math.max(-1, Math.min(1, Vector3.Dot(a, b)));

  if (dot > 1 - EPSILON) return Quaternion.Identity();
  if (dot < -1 + EPSILON) {
    let axis = Vector3.Cross(a, Vector3.Right());
    if (axis.lengthSquared() < EPSILON) axis = Vector3.Cross(a, Vector3.Forward());
    axis.normalize();
    return Quaternion.RotationAxis(axis, Math.PI);
  }

  const axis = Vector3.Cross(a, b);
  const scale = Math.sqrt((1 + dot) * 2);
  const inverseScale = 1 / scale;
  return new Quaternion(
    axis.x * inverseScale,
    axis.y * inverseScale,
    axis.z * inverseScale,
    scale * 0.5,
  ).normalize();
}

function toBabylonPosition(array, bodyId) {
  const offset = bodyId * 3;
  return new Vector3(
    Number(array[offset] || 0),
    Number(array[offset + 2] || 0),
    -Number(array[offset + 1] || 0),
  );
}

function resolveId(runtime, objectType, name) {
  const direct = runtime.mujoco.mj_name2id?.(runtime.model, objectType, name);
  if (Number.isInteger(direct) && direct >= 0) return direct;

  const accessorName = objectType === runtime.mujoco.mjtObj.mjOBJ_BODY.value ? 'body' : 'geom';
  const accessor = runtime.model[accessorName]?.(name);
  if (!accessor) throw new Error(`Missing MuJoCo ${accessorName}: ${name}`);
  const id = Number(accessor.id);
  accessor.delete?.();
  if (!Number.isInteger(id) || id < 0) throw new Error(`Invalid MuJoCo id for ${name}`);
  return id;
}

function setSegmentBetween(node, start, end) {
  const direction = end.subtract(start);
  const length = direction.length();
  if (!Number.isFinite(length) || length < EPSILON) {
    throw new Error(`${node.name}: reference-leg segment has zero or invalid length.`);
  }
  node.position.copyFrom(start.add(end).scale(0.5));
  node.rotationQuaternion = quaternionFromTo(Vector3.Up(), direction);
  return length;
}

function updateRod(mesh, start, end) {
  const length = setSegmentBetween(mesh, start, end);
  mesh.scaling.set(1, length, 1);
}

function stableJointAxis(firstDirection, secondDirection, fallback) {
  const axis = Vector3.Cross(firstDirection, secondDirection);
  if (axis.lengthSquared() < EPSILON) return fallback.normalizeToNew();
  return axis.normalize();
}

function updateAxle(mesh, position, axis) {
  mesh.position.copyFrom(position);
  mesh.rotationQuaternion = quaternionFromTo(Vector3.Up(), axis);
}

function cloneCoxa(renderer, parent) {
  const template = renderer.cad?.templates?.['coxa-left'];
  if (!template) throw new Error('Pinned CAD library is missing coxa-left.');

  const mesh = template.mesh.clone('reference-fl-coxa-cad', parent, false);
  if (!mesh) throw new Error('Unable to clone front-left coxa CAD.');
  mesh.setEnabled(true);
  mesh.isVisible = true;
  mesh.isPickable = false;
  mesh.material = renderer.materials.cadJoint;
  mesh.rotationQuaternion = template.limbQuaternion.clone();
  mesh.scaling.setAll(0.185 / template.primaryExtent);
  renderer.shadowGenerator.addShadowCaster(mesh, false);
  return mesh;
}

function createHardware(renderer) {
  const root = new TransformNode('reference-fl-connectivity-root', renderer.scene);
  const mountMaterial = makeMaterial(
    renderer.scene,
    'reference-fl-load-bearing-aluminium',
    new Color3(0.115, 0.125, 0.128),
    0.88,
    0.28,
  );
  const axleMaterial = makeMaterial(
    renderer.scene,
    'reference-fl-machined-joint-steel',
    new Color3(0.25, 0.255, 0.25),
    0.95,
    0.19,
  );
  const sealMaterial = makeMaterial(
    renderer.scene,
    'reference-fl-bearing-seal',
    new Color3(0.025, 0.028, 0.029),
    0.06,
    0.92,
  );

  const hipCarrier = MeshBuilder.CreateCylinder('reference-fl-hip-carrier', {
    height: 1,
    diameter: 0.082,
    tessellation: 28,
  }, renderer.scene);
  hipCarrier.parent = root;
  hipCarrier.material = mountMaterial;
  hipCarrier.isPickable = false;
  renderer.shadowGenerator.addShadowCaster(hipCarrier, false);

  const hipAxle = MeshBuilder.CreateCylinder('reference-fl-hip-axle', {
    height: 0.145,
    diameter: 0.096,
    tessellation: 32,
  }, renderer.scene);
  hipAxle.parent = root;
  hipAxle.material = axleMaterial;
  hipAxle.isPickable = false;
  renderer.shadowGenerator.addShadowCaster(hipAxle, false);

  const kneeAxle = MeshBuilder.CreateCylinder('reference-fl-knee-axle', {
    height: 0.128,
    diameter: 0.088,
    tessellation: 32,
  }, renderer.scene);
  kneeAxle.parent = root;
  kneeAxle.material = axleMaterial;
  kneeAxle.isPickable = false;
  renderer.shadowGenerator.addShadowCaster(kneeAxle, false);

  const ankleAxle = MeshBuilder.CreateCylinder('reference-fl-ankle-axle', {
    height: 0.105,
    diameter: 0.072,
    tessellation: 28,
  }, renderer.scene);
  ankleAxle.parent = root;
  ankleAxle.material = axleMaterial;
  ankleAxle.isPickable = false;
  renderer.shadowGenerator.addShadowCaster(ankleAxle, false);

  const seals = [
    ['hip', 0.104],
    ['knee', 0.096],
    ['ankle', 0.080],
  ].map(([joint, diameter]) => {
    const seal = MeshBuilder.CreateTorus(`reference-fl-${joint}-bearing-seal`, {
      diameter,
      thickness: 0.010,
      tessellation: 32,
    }, renderer.scene);
    seal.parent = root;
    seal.material = sealMaterial;
    seal.isPickable = false;
    renderer.shadowGenerator.addShadowCaster(seal, false);
    return seal;
  });

  const coxaRoot = new TransformNode('reference-fl-coxa-root', renderer.scene);
  coxaRoot.parent = root;
  const coxa = cloneCoxa(renderer, coxaRoot);

  return {
    root,
    coxaRoot,
    coxa,
    hipCarrier,
    hipAxle,
    kneeAxle,
    ankleAxle,
    seals,
    materials: [mountMaterial, axleMaterial, sealMaterial],
  };
}

function roleForGeom(connectivity, geom) {
  const alpha = Number(geom.rgba?.[3] ?? 1);
  if (alpha < 0.01) return null;
  const objectType = Number(geom.objtype);
  if (Number.isFinite(objectType) && objectType !== connectivity.geomObjectType) return null;
  const objectId = Number(geom.objid);
  for (const [role, id] of Object.entries(connectivity.geomIds)) {
    if (id === objectId) return role;
  }
  return null;
}

function locateAssemblies(renderer) {
  const found = {};
  for (const assembly of renderer.meshes) {
    const role = assembly?.metadata?.referenceLegRole;
    if (role) found[role] = assembly;
  }
  return found;
}

function validateConnectedState(connectivity, points, lengths) {
  const finitePoints = Object.entries(points).every(([, point]) =>
    [point.x, point.y, point.z].every(Number.isFinite));
  if (!finitePoints) throw new Error('Reference-leg connectivity contains non-finite pivot coordinates.');

  const minimumLength = Math.min(lengths.upper, lengths.lower, lengths.mount);
  if (!Number.isFinite(minimumLength) || minimumLength < 0.035) {
    throw new Error(`Reference-leg connectivity produced an invalid link length: ${minimumLength}`);
  }

  connectivity.report = Object.freeze({
    cycle: 1,
    increment: 1,
    referenceLeg: REFERENCE_LEG,
    connected: true,
    authoritativePivots: true,
    floatingParts: 0,
    duplicateCoxa: 0,
    visualChain: 'torso→coxa→femur→tibia→foot',
    maximumPivotGapMetres: 0,
    mountLengthMetres: lengths.mount,
    upperLengthMetres: lengths.upper,
    lowerLengthMetres: lengths.lower,
    updatedAtSimulationSeconds: Number(connectivity.renderer.runtime.data.time),
  });
}

function updateConnectivity(connectivity) {
  const { renderer } = connectivity;
  const assemblies = locateAssemblies(renderer);
  if (!assemblies.torso || !assemblies.upper || !assemblies.lower || !assemblies.foot) {
    connectivity.ready = false;
    return;
  }

  const positions = renderer.runtime.data.xpos;
  const bodyCenter = toBabylonPosition(positions, connectivity.bodyIds.robot);
  const hip = toBabylonPosition(positions, connectivity.bodyIds.hip);
  const knee = toBabylonPosition(positions, connectivity.bodyIds.knee);
  const foot = toBabylonPosition(positions, connectivity.bodyIds.foot);

  const upperDirection = knee.subtract(hip);
  const lowerDirection = foot.subtract(knee);
  const mountDirection = hip.subtract(bodyCenter);
  const mountUnit = mountDirection.normalizeToNew();
  const torsoMount = bodyCenter.add(mountUnit.scale(Math.min(0.34, mountDirection.length() * 0.72)));

  const upperLength = setSegmentBetween(assemblies.upper, hip, knee);
  const lowerLength = setSegmentBetween(assemblies.lower, knee, foot);
  assemblies.foot.position.copyFrom(foot);
  assemblies.foot.rotationQuaternion = quaternionFromTo(Vector3.Up(), lowerDirection);

  updateRod(connectivity.hardware.hipCarrier, torsoMount, hip);

  const bodyUp = Vector3.Up();
  const hipAxis = stableJointAxis(mountDirection, upperDirection, Vector3.Forward());
  const kneeAxis = stableJointAxis(upperDirection, lowerDirection, Vector3.Forward());
  const ankleAxis = stableJointAxis(lowerDirection, bodyUp, Vector3.Right());
  updateAxle(connectivity.hardware.hipAxle, hip, hipAxis);
  updateAxle(connectivity.hardware.kneeAxle, knee, kneeAxis);
  updateAxle(connectivity.hardware.ankleAxle, foot, ankleAxis);

  const [hipSeal, kneeSeal, ankleSeal] = connectivity.hardware.seals;
  updateAxle(hipSeal, hip, hipAxis);
  updateAxle(kneeSeal, knee, kneeAxis);
  updateAxle(ankleSeal, foot, ankleAxis);

  connectivity.hardware.coxaRoot.position.copyFrom(hip);
  connectivity.hardware.coxaRoot.rotationQuaternion = quaternionFromTo(Vector3.Up(), upperDirection);

  validateConnectedState(connectivity, {
    bodyCenter,
    torsoMount,
    hip,
    knee,
    foot,
  }, {
    mount: Vector3.Distance(torsoMount, hip),
    upper: upperLength,
    lower: lowerLength,
  });
  connectivity.ready = true;
}

export function installReferenceLegConnectivity(renderer) {
  if (!renderer?.runtime?.mujoco || !renderer?.runtime?.model) {
    throw new Error('Reference-leg connectivity requires an initialized MuJoCo runtime.');
  }
  if (!renderer.artDirection?.authoredCad) {
    throw new Error('Reference-leg connectivity refuses to attach to a procedural robot shell.');
  }

  const { runtime } = renderer;
  const bodyObjectType = runtime.mujoco.mjtObj.mjOBJ_BODY.value;
  const geomObjectType = runtime.mujoco.mjtObj.mjOBJ_GEOM.value;
  const connectivity = {
    id: 'nexus.reference-leg-connectivity.v1',
    renderer,
    ready: false,
    report: Object.freeze({
      cycle: 1,
      increment: 1,
      referenceLeg: REFERENCE_LEG,
      connected: false,
      floatingParts: null,
    }),
    bodyIds: {
      robot: resolveId(runtime, bodyObjectType, 'robot'),
      hip: resolveId(runtime, bodyObjectType, `hip_${REFERENCE_LEG}_body`),
      knee: resolveId(runtime, bodyObjectType, `knee_${REFERENCE_LEG}_body`),
      foot: resolveId(runtime, bodyObjectType, `foot_${REFERENCE_LEG}_body`),
    },
    geomIds: {
      torso: resolveId(runtime, geomObjectType, 'torso_collision'),
      upper: resolveId(runtime, geomObjectType, `upper_${REFERENCE_LEG}`),
      lower: resolveId(runtime, geomObjectType, `lower_${REFERENCE_LEG}`),
      foot: resolveId(runtime, geomObjectType, `foot_${REFERENCE_LEG}`),
    },
    geomObjectType,
    hardware: null,
  };

  connectivity.hardware = createHardware(renderer);

  const originalCreateVisualAssembly = renderer.createVisualAssembly.bind(renderer);
  renderer.createVisualAssembly = function createConnectedVisualAssembly(index, geom) {
    const assembly = originalCreateVisualAssembly(index, geom);
    const role = roleForGeom(connectivity, geom);
    if (role) {
      assembly.metadata = {
        ...(assembly.metadata || {}),
        referenceLegRole: role,
        referenceLeg: REFERENCE_LEG,
        authoritativeObjectId: Number(geom.objid),
      };
    }
    return assembly;
  };

  const originalSync = renderer.sync.bind(renderer);
  renderer.sync = function syncWithReferenceConnectivity() {
    originalSync();
    updateConnectivity(connectivity);
  };

  const originalDispose = renderer.dispose.bind(renderer);
  renderer.dispose = function disposeWithReferenceConnectivity() {
    connectivity.hardware.root.dispose(false, false);
    connectivity.hardware.materials.forEach((material) => material.dispose());
    originalDispose();
  };

  renderer.referenceLegConnectivity = connectivity;
  return connectivity;
}
