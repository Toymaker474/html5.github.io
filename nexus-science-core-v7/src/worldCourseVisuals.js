import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import {
  MISSION_DISTANCE_METRES,
  WORLD_COURSE_OBSTACLES,
  WORLD_COURSE_SCHEMA,
  validateWorldCourse,
} from './worldCourseData.js';

const installed = new WeakMap();

function material(scene, name, diffuse, emissive = null) {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = new Color3(...diffuse);
  value.specularColor = new Color3(0.12, 0.13, 0.13);
  value.specularPower = 18;
  value.emissiveColor = emissive ? new Color3(...emissive) : Color3.Black();
  value.freeze();
  return value;
}

function assertPhysicsObstacles(renderer) {
  const missing = [];
  const ids = [];
  for (const obstacle of WORLD_COURSE_OBSTACLES) {
    const geom = renderer.runtime.model.geom(`course_${obstacle.id}`);
    if (!geom) {
      missing.push(obstacle.id);
      continue;
    }
    ids.push(Number(geom.id));
    geom.delete?.();
  }
  if (missing.length) {
    throw new Error(`MuJoCo course geoms missing: ${missing.join(', ')}.`);
  }
  return ids;
}

export function installWorldCourseVisuals(renderer) {
  if (!renderer?.scene || !renderer?.runtime?.model) {
    throw new Error('Robot world course requires an initialized renderer and MuJoCo model.');
  }
  if (installed.has(renderer)) return installed.get(renderer);

  const validation = validateWorldCourse();
  if (!validation.valid) {
    throw new Error(`Robot world course is invalid: ${validation.errors.join(' | ')}`);
  }
  const physicsGeomIds = assertPhysicsObstacles(renderer);
  const root = new TransformNode('nexus-world-course-root', renderer.scene);
  const obstacleMeshes = [];

  for (const obstacle of WORLD_COURSE_OBSTACLES) {
    const [halfX, halfY, halfZ] = obstacle.halfSize;
    const mesh = MeshBuilder.CreateBox(`world-course-${obstacle.id}`, {
      width: halfX * 2,
      depth: halfY * 2,
      height: halfZ * 2,
    }, renderer.scene);
    mesh.parent = root;
    mesh.position.set(
      obstacle.position[0],
      obstacle.position[2],
      -obstacle.position[1],
    );
    mesh.material = material(
      renderer.scene,
      `world-course-material-${obstacle.id}`,
      obstacle.color,
    );
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.metadata = Object.freeze({
      schema: WORLD_COURSE_SCHEMA,
      obstacleId: obstacle.id,
      physicsGeomName: `course_${obstacle.id}`,
      authoritativeHalfSize: obstacle.halfSize,
      authoritativePosition: obstacle.position,
    });
    obstacleMeshes.push(mesh);
  }

  const startPlate = MeshBuilder.CreateCylinder('world-course-start-dock', {
    diameter: 0.68,
    height: 0.018,
    tessellation: 40,
  }, renderer.scene);
  startPlate.parent = root;
  startPlate.position.y = 0.009;
  startPlate.material = material(renderer.scene, 'world-course-start-material', [0.10, 0.13, 0.13]);
  startPlate.isPickable = false;

  const goalRing = MeshBuilder.CreateTorus('world-course-mission-ring', {
    diameter: MISSION_DISTANCE_METRES * 2,
    thickness: 0.018,
    tessellation: 72,
  }, renderer.scene);
  goalRing.parent = root;
  goalRing.position.y = 0.022;
  goalRing.material = material(
    renderer.scene,
    'world-course-goal-material',
    [0.22, 0.46, 0.39],
    [0.015, 0.055, 0.042],
  );
  goalRing.isPickable = false;

  const state = Object.freeze({
    schema: 'nexus.robot-world-course-visuals.v1',
    root,
    obstacleMeshes: Object.freeze(obstacleMeshes),
    startPlate,
    goalRing,
    report: Object.freeze({
      schema: WORLD_COURSE_SCHEMA,
      physicsObstacleCount: physicsGeomIds.length,
      visualObstacleCount: obstacleMeshes.length,
      physicsGeomIds: Object.freeze(physicsGeomIds),
      missionDistanceMetres: MISSION_DISTANCE_METRES,
      coordinateMapping: 'MuJoCo(x,y,z)→Babylon(x,z,-y)',
      fakeCollisionMeshes: 0,
      ready: physicsGeomIds.length === obstacleMeshes.length,
    }),
  });

  installed.set(renderer, state);
  renderer.worldCourse = state;
  return state;
}
