import { createGenome, NeuralCPGController } from '../src/controller.js';
import { compileMorphologyToMjcf, DEFAULT_MORPHOLOGY } from '../src/research/morphologyGenome.js';
import {
  WORLD_COURSE_OBSTACLES,
  WORLD_COURSE_SCHEMA,
  validateWorldCourse,
} from '../src/worldCourseData.js';

const fail = (message) => { throw new Error(message); };
const observation = Object.freeze({
  roll: 0,
  pitch: 0,
  footContacts: Object.freeze([0, 0, 0, 0, 0, 0]),
  batteryRatio: 1,
});

const courseValidation = validateWorldCourse();
if (!courseValidation.valid) fail(`Course validation failed: ${courseValidation.errors.join(' | ')}`);
if (courseValidation.obstacleCount !== 5) fail(`Expected 5 course obstacles, received ${courseValidation.obstacleCount}.`);

const mjcf = compileMorphologyToMjcf(DEFAULT_MORPHOLOGY);
const physicsObstacleNames = WORLD_COURSE_OBSTACLES.map((obstacle) => `course_${obstacle.id}`);
for (const name of physicsObstacleNames) {
  const occurrences = mjcf.split(`name="${name}"`).length - 1;
  if (occurrences !== 1) fail(`${name} occurs ${occurrences} times in compiled MJCF.`);
}
if (!mjcf.includes('rgba="0.20 0.23 0.21 0.001"')) {
  fail('Course collisions are not hidden from the generic renderer with the expected nonzero collision alpha.');
}

// Freeze oscillator advance and neural residual for this unit test so the
// measured difference is only the drive/steering multiplier applied to the
// same twelve actuator targets.
const genome = {
  ...createGenome(0x574f524c),
  frequencyHz: 0,
  neuralGain: 0,
};
const makeController = (command) => {
  const controller = new NeuralCPGController(structuredClone(genome));
  controller.setDriveCommand(command);
  return {
    controller,
    controls: Array.from(controller.update(0.10, observation)),
  };
};

const stop = makeController({ mode: 'stop', throttle: 0, turn: 0 });
const walk = makeController({ mode: 'walk', throttle: 1, turn: 0 });
const left = makeController({ mode: 'left', throttle: 0.72, turn: 0.82 });
const right = makeController({ mode: 'right', throttle: 0.72, turn: -0.82 });

for (const [name, sample] of Object.entries({ stop, walk, left, right })) {
  if (sample.controls.length !== 12) fail(`${name} produced ${sample.controls.length} controls instead of 12.`);
  if (sample.controls.some((value) => !Number.isFinite(value))) fail(`${name} produced a non-finite actuator target.`);
  if (sample.controller.driveCommand.schema !== 'nexus.robot-drive-command.v1') {
    fail(`${name} is missing the authoritative drive-command schema.`);
  }
}

const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
if (distance(stop.controls, walk.controls) < 0.08) fail('Stop and Walk actuator vectors are not meaningfully different.');
if (distance(left.controls, right.controls) < 0.08) fail('Left and Right actuator vectors are not meaningfully different.');

const leftLegIndexes = [0, 1, 2];
const rightLegIndexes = [3, 4, 5];
const averageDriveScale = (sample, indexes) => {
  const ratios = [];
  for (const index of indexes) {
    const actuator = index * 2;
    const walkDelta = walk.controls[actuator] - stop.controls[actuator];
    const commandDelta = sample.controls[actuator] - stop.controls[actuator];
    if (Math.abs(walkDelta) > 0.01) ratios.push(commandDelta / walkDelta);
  }
  if (!ratios.length) fail('Steering test found no measurable hip targets.');
  return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
};

const leftInsideScale = averageDriveScale(left, leftLegIndexes);
const leftOutsideScale = averageDriveScale(left, rightLegIndexes);
const rightInsideScale = averageDriveScale(right, rightLegIndexes);
const rightOutsideScale = averageDriveScale(right, leftLegIndexes);
const leftCommandBias = leftOutsideScale - leftInsideScale;
const rightCommandBias = rightOutsideScale - rightInsideScale;
if (leftCommandBias <= 0.20) fail(`Left command did not create right-side drive bias: ${leftCommandBias}.`);
if (rightCommandBias <= 0.20) fail(`Right command did not create left-side drive bias: ${rightCommandBias}.`);

const report = Object.freeze({
  schema: 'nexus.robot-world-science-test.v1',
  courseSchema: WORLD_COURSE_SCHEMA,
  obstacleCount: WORLD_COURSE_OBSTACLES.length,
  physicsObstacleNames,
  actuatorCount: walk.controls.length,
  stopWalkVectorDistance: distance(stop.controls, walk.controls),
  leftRightVectorDistance: distance(left.controls, right.controls),
  leftInsideScale,
  leftOutsideScale,
  rightInsideScale,
  rightOutsideScale,
  leftCommandBias,
  rightCommandBias,
  driveRevisions: {
    stop: stop.controller.driveCommand.revision,
    walk: walk.controller.driveCommand.revision,
    left: left.controller.driveCommand.revision,
    right: right.controller.driveCommand.revision,
  },
  passed: true,
});

console.log(JSON.stringify(report, null, 2));
