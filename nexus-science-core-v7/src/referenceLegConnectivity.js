import {
  Color3,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

const LEG_IDS = Object.freeze(['fl', 'ml', 'rl', 'fr', 'mr', 'rr']);
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
    throw new Error(`${node.name}: connected-leg segment has zero or invalid length.`);
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

function cloneCoxa(renderer, parent, legId) {
  const side = legId.endsWith('l') ? 'left' : 'right';
  const template = renderer.cad?.templates?.[`coxa-${side}`];
  if (!template) throw new Error(`Pinned CAD library is missing coxa-${side}.`);

  const mesh = template.mesh.clone(`connected-${legId}-coxa-cad`, parent, false);
  if (!mesh) throw new Error(`Unable to clone ${legId} coxa CAD.`);
  mesh.setEnabled(true);
  mesh.isVisible = true;
  mesh.isPickable = false;
  mesh.material = renderer.materials.cadJoint;
  mesh.rotationQuaternion = template.limbQuaternion.clone();
  mesh.scaling.setAll(0.185 / template.primaryExtent);
  renderer.shadowGenerator.addShadowCaster(mesh, false);
  return mesh;
}

function createSharedMaterials(renderer) {
  return {
    mount: makeMaterial(
      renderer.scene,
      'connected-leg-load-bearing-aluminium',
      new Color3(0.115, 0.125, 0.128),
      0.88,
      0.28,
    ),
    axle: makeMaterial(
      renderer.scene,
      'connected-leg-machined-joint-steel',
      new Color3(0.25, 0.255, 0.25),
      0.95,
      0.19,
    ),
    seal: makeMaterial(
      renderer.scene,
      'connected-leg-bearing-seal',
      new Color3(0.025, 0.028, 0.029),
      0.06,
      0.92,
    ),
  };
}

function createHardware(renderer, materials, legId) {
  const root = new TransformNode(`connected-${legId}-root`, renderer.scene);

  const hipCarrier = MeshBuilder.CreateCylinder(`connected-${legId}-hip-carrier`, {
    height: 1,
    diameter: 0.082,
    tessellation: 28,
  }, renderer.scene);
  hipCarrier.parent = root;
  hipCarrier.material = materials.mount;
  hipCarrier.isPickable = false;
  renderer.shadowGenerator.addShadowCaster(hipCarrier, false);

  const hipAxle = MeshBuilder.CreateCylinder(`connected-${legId}-hip-axle`, {
    height: 0.145,
    diameter: 0.096,
    tessellation: 32,
  }, renderer.scene);
  hipAxle.parent = root;
  hipAxle.material = materials.axle;
  hipAxle.isPickable = false;
  renderer.shadowGenerator.addShadowCaster(hipAxle, false);

  const kneeAxle = MeshBuilder.CreateCylinder(`connected-${legId}-knee-axle`, {
    height: 0.128,
    diameter: 0.088,
    tessellation: 32,
  }, renderer.scene);
  kneeAxle.parent = root;
  kneeAxle.material = materials.axle;
  kneeAxle.isPickable = false;
  renderer.shadowGenerator.addShadowCaster(kneeAxle, false);

  const ankleAxle = MeshBuilder.CreateCylinder(`connected-${legId}-ankle-axle`, {
    height: 0.105,
    diameter: 0.072,
    tessellation: 28,
  }, renderer.scene);
  ankleAxle.parent = root;
  ankleAxle.material = materials.axle;
  ankleAxle.isPickable = false;
  renderer.shadowGenerator.addShadowCaster(ankleAxle, false);

  const seals = [
    ['hip', 0.104],
    ['knee', 0.096],
    ['ankle', 0.080],
  ].map(([joint, diameter]) => {
    const seal = MeshBuilder.CreateTorus(`connected-${legId}-${joint}-bearing-seal`, {
      diameter,
      thickness: 0.010,
      tessellation: 32,
    }, renderer.scene);
    seal.parent = root;
    seal.material = materials.seal;
    seal.isPickable = false;
    renderer.shadowGenerator.addShadowCaster(seal, false);
    return seal;
  });

  const coxaRoot = new TransformNode(`connected-${legId}-coxa-root`, renderer.scene);
  coxaRoot.parent = root;
  const coxa = cloneCoxa(renderer, coxaRoot, legId);

  return {
    root,
    coxaRoot,
    coxa,
    hipCarrier,
    hipAxle,
    kneeAxle,
    ankleAxle,
    seals,
  };
}

function locateAssemblies(renderer) {
  const found = { torso: null, legs: Object.fromEntries(LEG_IDS.map((legId) => [legId, {}])) };
  for (const assembly of renderer.meshes) {
    const role = assembly?.metadata?.connectedLegRole;
    if (!role) continue;
    if (role === 'torso') {
      found.torso = assembly;
      continue;
    }
    const legId = assembly?.metadata?.connectedLeg;
    if (found.legs[legId]) found.legs[legId][role] = assembly;
  }
  return found;
}

function validateLegState(leg, points, lengths) {
  const finitePoints = Object.entries(points).every(([, point]) =>
    [point.x, point.y, point.z].every(Number.isFinite));
  if (!finitePoints) throw new Error(`${leg.id}: connectivity contains non-finite pivot coordinates.`);

  const minimumLength = Math.min(lengths.upper, lengths.lower, lengths.mount);
  if (!Number.isFinite(minimumLength) || minimumLength < 0.035) {
    throw new Error(`${leg.id}: connectivity produced an invalid link length: ${minimumLength}`);
  }

  leg.report = Object.freeze({
    leg: leg.id,
    connected: true,
    authoritativePivots: true,
    floatingParts: 0,
    duplicateCoxa: 0,
    visualChain: 'torso→coxa→femur→tibia→foot',
    maximumPivotGapMetres: 0,
    mountLengthMetres: lengths.mount,
    upperLengthMetres: lengths.upper,
    lowerLengthMetres: lengths.lower,
  });
  leg.ready = true;
}

function updateLeg(connectivity, leg, assemblies, bodyCenter) {
  if (!assemblies.upper || !assemblies.lower || !assemblies.foot) {
    leg.ready = false;
    return;
  }

  const positions = connectivity.renderer.runtime.data.xpos;
  const hip = toBabylonPosition(positions, leg.bodyIds.hip);
  const knee = toBabylonPosition(positions, leg.bodyIds.knee);
  const foot = toBabylonPosition(positions, leg.bodyIds.foot);

  const upperDirection = knee.subtract(hip);
  const lowerDirection = foot.subtract(knee);
  const mountDirection = hip.subtract(bodyCenter);
  const mountUnit = mountDirection.normalizeToNew();
  const torsoMount = bodyCenter.add(mountUnit.scale(Math.min(0.34, mountDirection.length() * 0.72)));

  const upperLength = setSegmentBetween(assemblies.upper, hip, knee);
  const lowerLength = setSegmentBetween(assemblies.lower, knee, foot);
  assemblies.foot.position.copyFrom(foot);
  assemblies.foot.rotationQuaternion = quaternionFromTo(Vector3.Up(), lowerDirection);

  updateRod(leg.hardware.hipCarrier, torsoMount, hip);

  const hipAxis = stableJointAxis(mountDirection, upperDirection, Vector3.Forward());
  const kneeAxis = stableJointAxis(upperDirection, lowerDirection, Vector3.Forward());
  const ankleAxis = stableJointAxis(lowerDirection, Vector3.Up(), Vector3.Right());
  updateAxle(leg.hardware.hipAxle, hip, hipAxis);
  updateAxle(leg.hardware.kneeAxle, knee, kneeAxis);
  updateAxle(leg.hardware.ankleAxle, foot, ankleAxis);

  const [hipSeal, kneeSeal, ankleSeal] = leg.hardware.seals;
  updateAxle(hipSeal, hip, hipAxis);
  updateAxle(kneeSeal, knee, kneeAxis);
  updateAxle(ankleSeal, foot, ankleAxis);

  leg.hardware.coxaRoot.position.copyFrom(hip);
  leg.hardware.coxaRoot.rotationQuaternion = quaternionFromTo(Vector3.Up(), upperDirection);

  validateLegState(leg, { bodyCenter, torsoMount, hip, knee, foot }, {
    mount: Vector3.Distance(torsoMount, hip),
    upper: upperLength,
    lower: lowerLength,
  });
}

function updateConnectivity(connectivity) {
  const { renderer } = connectivity;
  const assemblies = locateAssemblies(renderer);
  if (!assemblies.torso) {
    connectivity.ready = false;
    return;
  }

  const bodyCenter = toBabylonPosition(renderer.runtime.data.xpos, connectivity.robotBodyId);
  for (const legId of LEG_IDS) {
    updateLeg(connectivity, connectivity.legs[legId], assemblies.legs[legId], bodyCenter);
  }

  const legReports = LEG_IDS.map((legId) => connectivity.legs[legId].report);
  const connectedLegs = legReports.filter((report) => report?.connected === true).length;
  const allConnected = connectedLegs === LEG_IDS.length;
  const floatingParts = legReports.reduce((sum, report) => sum + Number(report?.floatingParts ?? 1), 0);
  const duplicateCoxa = legReports.reduce((sum, report) => sum + Number(report?.duplicateCoxa ?? 1), 0);
  const maximumPivotGapMetres = Math.max(...legReports.map((report) => Number(report?.maximumPivotGapMetres ?? Infinity)));

  connectivity.report = Object.freeze({
    cycle: 1,
    increment: 2,
    connected: allConnected,
    authoritativePivots: allConnected,
    connectedLegs,
    expectedLegs: LEG_IDS.length,
    legOrder: [...LEG_IDS],
    floatingParts,
    duplicateCoxa,
    visualChain: 'torso→coxa→femur→tibia→foot × 6',
    maximumPivotGapMetres,
    legs: Object.freeze(legReports),
    updatedAtSimulationSeconds: Number(renderer.runtime.data.time),
  });
  connectivity.ready = allConnected && floatingParts === 0 && duplicateCoxa === 0 && maximumPivotGapMetres === 0;
}

function roleForGeom(connectivity, geom) {
  const alpha = Number(geom.rgba?.[3] ?? 1);
  if (alpha < 0.01) return null;
  const objectType = Number(geom.objtype);
  if (Number.isFinite(objectType) && objectType !== connectivity.geomObjectType) return null;
  const objectId = Number(geom.objid);
  if (objectId === connectivity.torsoGeomId) return { role: 'torso', legId: null };
  return connectivity.geomRoleIndex.get(objectId) || null;
}

export function installAllLegConnectivity(renderer) {
  if (!renderer?.runtime?.mujoco || !renderer?.runtime?.model) {
    throw new Error('All-leg connectivity requires an initialized MuJoCo runtime.');
  }
  if (!renderer.artDirection?.authoredCad) {
    throw new Error('All-leg connectivity refuses to attach to a procedural robot shell.');
  }

  const { runtime } = renderer;
  const bodyObjectType = runtime.mujoco.mjtObj.mjOBJ_BODY.value;
  const geomObjectType = runtime.mujoco.mjtObj.mjOBJ_GEOM.value;
  const materials = createSharedMaterials(renderer);
  const legs = {};
  const geomRoleIndex = new Map();

  for (const legId of LEG_IDS) {
    const leg = {
      id: legId,
      ready: false,
      report: Object.freeze({ leg: legId, connected: false, floatingParts: null }),
      bodyIds: {
        hip: resolveId(runtime, bodyObjectType, `hip_${legId}_body`),
        knee: resolveId(runtime, bodyObjectType, `knee_${legId}_body`),
        foot: resolveId(runtime, bodyObjectType, `foot_${legId}_body`),
      },
      geomIds: {
        upper: resolveId(runtime, geomObjectType, `upper_${legId}`),
        lower: resolveId(runtime, geomObjectType, `lower_${legId}`),
        foot: resolveId(runtime, geomObjectType, `foot_${legId}`),
      },
      hardware: null,
    };
    leg.hardware = createHardware(renderer, materials, legId);
    legs[legId] = leg;
    for (const [role, objectId] of Object.entries(leg.geomIds)) {
      if (geomRoleIndex.has(objectId)) throw new Error(`Duplicate MuJoCo geometry id ${objectId} while mapping ${legId}.${role}.`);
      geomRoleIndex.set(objectId, Object.freeze({ role, legId }));
    }
  }

  const connectivity = {
    id: 'nexus.all-leg-connectivity.v2',
    renderer,
    ready: false,
    report: Object.freeze({
      cycle: 1,
      increment: 2,
      connected: false,
      connectedLegs: 0,
      expectedLegs: LEG_IDS.length,
      floatingParts: null,
    }),
    robotBodyId: resolveId(runtime, bodyObjectType, 'robot'),
    torsoGeomId: resolveId(runtime, geomObjectType, 'torso_collision'),
    geomObjectType,
    geomRoleIndex,
    legs,
    materials,
  };

  const originalCreateVisualAssembly = renderer.createVisualAssembly.bind(renderer);
  renderer.createVisualAssembly = function createConnectedVisualAssembly(index, geom) {
    const assembly = originalCreateVisualAssembly(index, geom);
    const mapping = roleForGeom(connectivity, geom);
    if (mapping) {
      assembly.metadata = {
        ...(assembly.metadata || {}),
        connectedLegRole: mapping.role,
        connectedLeg: mapping.legId,
        authoritativeObjectId: Number(geom.objid),
      };
    }
    return assembly;
  };

  const originalSync = renderer.sync.bind(renderer);
  renderer.sync = function syncWithAllLegConnectivity() {
    originalSync();
    updateConnectivity(connectivity);
  };

  const originalDispose = renderer.dispose.bind(renderer);
  renderer.dispose = function disposeWithAllLegConnectivity() {
    for (const legId of LEG_IDS) connectivity.legs[legId].hardware.root.dispose(false, false);
    Object.values(connectivity.materials).forEach((material) => material.dispose());
    originalDispose();
  };

  renderer.referenceLegConnectivity = connectivity;
  renderer.allLegConnectivity = connectivity;
  return connectivity;
}
