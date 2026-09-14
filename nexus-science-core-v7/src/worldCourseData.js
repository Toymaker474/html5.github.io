const freezeObstacle = (obstacle) => Object.freeze({
  ...obstacle,
  position: Object.freeze([...obstacle.position]),
  halfSize: Object.freeze([...obstacle.halfSize]),
  color: Object.freeze([...obstacle.color]),
});

export const WORLD_COURSE_SCHEMA = 'nexus.robot-world-course.v1';
export const MISSION_DISTANCE_METRES = 0.85;

export const WORLD_COURSE_OBSTACLES = Object.freeze([
  freezeObstacle({
    id: 'north-service-crate',
    position: [0.62, 0.48, 0.12],
    halfSize: [0.18, 0.16, 0.12],
    color: [0.28, 0.34, 0.31],
  }),
  freezeObstacle({
    id: 'south-service-crate',
    position: [0.76, -0.44, 0.10],
    halfSize: [0.16, 0.14, 0.10],
    color: [0.34, 0.26, 0.20],
  }),
  freezeObstacle({
    id: 'west-low-block',
    position: [-0.52, 0.56, 0.075],
    halfSize: [0.22, 0.12, 0.075],
    color: [0.22, 0.28, 0.34],
  }),
  freezeObstacle({
    id: 'east-inspection-block',
    position: [1.20, 0.08, 0.15],
    halfSize: [0.20, 0.19, 0.15],
    color: [0.33, 0.31, 0.20],
  }),
  freezeObstacle({
    id: 'rear-dock-stop',
    position: [-0.82, -0.18, 0.11],
    halfSize: [0.14, 0.28, 0.11],
    color: [0.24, 0.29, 0.26],
  }),
]);

const finiteTriplet = (values) => Array.isArray(values) &&
  values.length === 3 && values.every(Number.isFinite);

export function validateWorldCourse() {
  const errors = [];
  const ids = new Set();

  for (const obstacle of WORLD_COURSE_OBSTACLES) {
    if (!obstacle.id || ids.has(obstacle.id)) errors.push(`Duplicate or missing obstacle id: ${obstacle.id}`);
    ids.add(obstacle.id);
    if (!finiteTriplet(obstacle.position)) errors.push(`${obstacle.id}: invalid position.`);
    if (!finiteTriplet(obstacle.halfSize) || obstacle.halfSize.some((value) => value <= 0)) {
      errors.push(`${obstacle.id}: invalid half-size.`);
    }
    if (!finiteTriplet(obstacle.color) || obstacle.color.some((value) => value < 0 || value > 1)) {
      errors.push(`${obstacle.id}: invalid display color.`);
    }
    if (Math.abs(obstacle.position[2] - obstacle.halfSize[2]) > 1e-8) {
      errors.push(`${obstacle.id}: obstacle must rest exactly on the ground plane.`);
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    obstacleCount: WORLD_COURSE_OBSTACLES.length,
  });
}

export function compileWorldCourseMjcf() {
  const validation = validateWorldCourse();
  if (!validation.valid) {
    throw new Error(`Robot world course failed validation: ${validation.errors.join(' | ')}`);
  }

  return WORLD_COURSE_OBSTACLES.map((obstacle) => {
    const position = obstacle.position.join(' ');
    const size = obstacle.halfSize.join(' ');
    return `<geom name="course_${obstacle.id}" type="box" pos="${position}" size="${size}" friction="1.45 0.035 0.003" rgba="0.20 0.23 0.21 0.001" />`;
  }).join('\n    ');
}
