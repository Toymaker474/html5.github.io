import { createGenome } from './controller.js';
import { DEFAULT_MORPHOLOGY, validateMorphology } from './research/morphologyGenome.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function mergeMorphology(overrides) {
  const morphology = structuredClone(DEFAULT_MORPHOLOGY);
  for (const [section, values] of Object.entries(overrides)) {
    morphology[section] = { ...morphology[section], ...values };
  }
  const validation = validateMorphology(morphology);
  if (!validation.valid) {
    throw new Error(`Invalid robot preset morphology: ${validation.errors.join(' | ')}`);
  }
  return deepFreeze(morphology);
}

function tuneController(seed, tuning) {
  const genome = createGenome(seed);
  return deepFreeze({ ...genome, ...tuning, seed: seed >>> 0 });
}

function readyPreset({
  id,
  name,
  role,
  description,
  hardware,
  morphology,
  controller,
  batteryJoules = 6500,
}) {
  return deepFreeze({
    schema: 'nexus.robot-preset.v1',
    id,
    name,
    role,
    description,
    hardware,
    topology: 'hexapod-2dof',
    status: 'ready',
    batteryJoules,
    morphology: mergeMorphology(morphology),
    controllerGenome: tuneController(controller.seed, controller.tuning),
  });
}

function blockedPreset({ id, name, role, description, hardware, blocker }) {
  return deepFreeze({
    schema: 'nexus.robot-preset.v1',
    id,
    name,
    role,
    description,
    hardware,
    topology: 'not-implemented',
    status: 'blocked',
    blocker,
  });
}

export const READY_ROBOT_PRESETS = deepFreeze([
  readyPreset({
    id: 'explorer',
    name: 'Explorer Hexapod',
    role: 'Balanced world scout',
    description: 'The stable general-purpose robot for walking, obstacle tests and autonomous experiments.',
    hardware: '6 legs · 12 motors · IMU · 6 foot sensors',
    morphology: {},
    controller: {
      seed: 0x4558504c,
      tuning: { frequencyHz: 0.82, hipAmplitude: 0.34, kneeLift: 0.54, kneeStance: -0.78 },
    },
  }),
  readyPreset({
    id: 'sandwalker',
    name: 'Sand Walker',
    role: 'Soft-ground specialist',
    description: 'Longer legs, wider stance and oversized feet reduce sink pressure on loose terrain.',
    hardware: 'Wide feet · long tibias · high-grip contact',
    morphology: {
      torso: { halfWidth: 0.30, massKg: 3.5 },
      leg: { upperOut: 0.34, lowerOut: 0.28, lowerDrop: 0.31, footRadius: 0.095 },
      actuators: { hipKp: 68, hipKv: 6.2, kneeKp: 88, kneeKv: 7.5 },
      contact: { frictionSlide: 2.15, frictionTorsion: 0.035, frictionRoll: 0.003 },
    },
    controller: {
      seed: 0x53414e44,
      tuning: { frequencyHz: 0.58, hipAmplitude: 0.38, kneeLift: 0.60, kneeStance: -0.82, contactGain: 0.22 },
    },
  }),
  readyPreset({
    id: 'builder',
    name: 'Builder Base',
    role: 'Stable construction platform',
    description: 'A slow, stiff and wide robot base intended to carry a future arm without tipping.',
    hardware: 'Wide frame · stiff joints · low-speed gait',
    morphology: {
      torso: { halfLength: 0.48, halfWidth: 0.33, halfHeight: 0.12, massKg: 4.6 },
      core: { radiusX: 0.23, radiusY: 0.17, radiusZ: 0.13, massKg: 1.0 },
      leg: { upperOut: 0.33, upperRadius: 0.055, upperMassKg: 0.24, lowerRadius: 0.048, lowerMassKg: 0.20, footRadius: 0.08 },
      joints: { damping: 2.8, armature: 0.028, frictionLoss: 0.07 },
      actuators: { hipKp: 92, hipKv: 9, kneeKp: 118, kneeKv: 10.5 },
    },
    controller: {
      seed: 0x4255494c,
      tuning: { frequencyHz: 0.46, hipAmplitude: 0.25, kneeLift: 0.43, kneeStance: -0.72, rollGain: 0.28, pitchGain: 0.24 },
    },
    batteryJoules: 9000,
  }),
  readyPreset({
    id: 'cargo',
    name: 'Cargo Mule',
    role: 'Heavy payload carrier',
    description: 'Thicker limbs, stronger motors and a heavier chassis trade speed for carrying stability.',
    hardware: 'Heavy chassis · reinforced legs · high torque',
    morphology: {
      torso: { halfLength: 0.52, halfWidth: 0.31, halfHeight: 0.14, massKg: 5.2 },
      core: { radiusX: 0.24, radiusY: 0.17, radiusZ: 0.14, massKg: 1.2 },
      leg: { upperRadius: 0.062, upperMassKg: 0.28, lowerRadius: 0.054, lowerMassKg: 0.24, footRadius: 0.085, footMassKg: 0.11 },
      joints: { damping: 3.2, armature: 0.04, frictionLoss: 0.09 },
      actuators: { hipKp: 112, hipKv: 11, kneeKp: 142, kneeKv: 13 },
    },
    controller: {
      seed: 0x43415247,
      tuning: { frequencyHz: 0.40, hipAmplitude: 0.23, kneeLift: 0.40, kneeStance: -0.76, couplingStrength: 1.35 },
    },
    batteryJoules: 12000,
  }),
  readyPreset({
    id: 'climber',
    name: 'Cliff Climber',
    role: 'High-clearance obstacle robot',
    description: 'Long articulated legs and aggressive contact feedback for steep steps and broken terrain.',
    hardware: 'Long reach · high knee lift · maximum grip',
    morphology: {
      torso: { halfLength: 0.36, halfWidth: 0.22, halfHeight: 0.09, massKg: 2.7 },
      leg: { upperOut: 0.37, upperDrop: 0.10, lowerOut: 0.31, lowerDrop: 0.39, footRadius: 0.072 },
      joints: { hipMin: -1.02, hipMax: 1.02, kneeMin: -1.75, kneeMax: 0.55, damping: 1.8 },
      actuators: { hipKp: 82, hipKv: 7, kneeKp: 108, kneeKv: 9 },
      contact: { frictionSlide: 2.65, frictionTorsion: 0.055, frictionRoll: 0.004 },
    },
    controller: {
      seed: 0x434c494d,
      tuning: { frequencyHz: 0.62, hipAmplitude: 0.46, kneeLift: 0.78, kneeStance: -0.90, contactGain: 0.30 },
    },
  }),
  readyPreset({
    id: 'rescue',
    name: 'Rescue Scout',
    role: 'Fast lightweight responder',
    description: 'A compact, lower-mass robot tuned for quick inspection runs and tight spaces.',
    hardware: 'Light frame · fast gait · compact footprint',
    morphology: {
      torso: { halfLength: 0.31, halfWidth: 0.19, halfHeight: 0.075, massKg: 1.8 },
      core: { radiusX: 0.15, radiusY: 0.10, radiusZ: 0.09, height: 0.09, massKg: 0.30 },
      leg: { upperOut: 0.23, upperDrop: 0.05, upperRadius: 0.034, upperMassKg: 0.10, lowerOut: 0.19, lowerDrop: 0.23, lowerRadius: 0.029, lowerMassKg: 0.08, footRadius: 0.052, footMassKg: 0.045 },
      joints: { damping: 0.95, armature: 0.009, frictionLoss: 0.025 },
      actuators: { hipKp: 48, hipKv: 4, kneeKp: 62, kneeKv: 5 },
    },
    controller: {
      seed: 0x52455343,
      tuning: { frequencyHz: 1.16, hipAmplitude: 0.31, kneeLift: 0.50, kneeStance: -0.69, neuralTimeConstant: 0.06 },
    },
    batteryJoules: 4200,
  }),
]);

export const FUTURE_ROBOT_PRESETS = deepFreeze([
  blockedPreset({
    id: 'rover-car',
    name: 'Rover Car',
    role: 'Fast wheeled exploration',
    description: 'Four driven wheels, steering, suspension and wheel-slip physics.',
    hardware: '4 wheels · steering rack · suspension',
    blocker: 'Requires a real wheeled MuJoCo topology and authored rover CAD. It is not simulated by hiding hexapod legs.',
  }),
  blockedPreset({
    id: 'sandcastle-maker',
    name: 'Sandcastle Maker',
    role: 'Scoop, carry and compact sand',
    description: 'A mobile base with a scoop, bucket, compactor and moisture-aware sand tool.',
    hardware: 'Mobile base · arm · scoop · compactor',
    blocker: 'Requires articulated-arm dynamics and a granular-material world model before it can be honest.',
  }),
  blockedPreset({
    id: 'maker-arm',
    name: 'Workshop Maker',
    role: 'Pick, assemble and repair',
    description: 'A stable construction robot with a force-sensing arm and interchangeable tools.',
    hardware: '6-axis arm · gripper · tool changer',
    blocker: 'Requires arm kinematics, grasp constraints and authored end-effector CAD.',
  }),
  blockedPreset({
    id: 'snake',
    name: 'Pipe Snake',
    role: 'Inspection in narrow spaces',
    description: 'A many-joint robot for pipes, rubble gaps and confined structures.',
    hardware: 'Segment chain · distributed contact sensors',
    blocker: 'Requires a variable-length articulated-chain topology and a matching controller.',
  }),
  blockedPreset({
    id: 'drone',
    name: 'Survey Drone',
    role: 'Aerial mapping and inspection',
    description: 'A rotorcraft with thrust, battery, wind and stabilized flight control.',
    hardware: '4 rotors · IMU · depth camera',
    blocker: 'Requires aerodynamic force and rotor-control systems; a floating mesh would be fake.',
  }),
  blockedPreset({
    id: 'swarm',
    name: 'Micro Swarm',
    role: 'Cooperative search and construction',
    description: 'Many small robots coordinating through local sensing instead of one giant machine.',
    hardware: 'Multiple agents · local radio · shared task map',
    blocker: 'Requires deterministic multi-agent scheduling and a mobile performance budget.',
  }),
]);

export const DEFAULT_ROBOT_PRESET_ID = 'explorer';

export function getRobotPreset(id) {
  return READY_ROBOT_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function validateRobotPresetCatalog() {
  const ids = new Set();
  const errors = [];
  for (const preset of [...READY_ROBOT_PRESETS, ...FUTURE_ROBOT_PRESETS]) {
    if (ids.has(preset.id)) errors.push(`Duplicate preset id: ${preset.id}`);
    ids.add(preset.id);
    if (preset.status === 'ready') {
      const validation = validateMorphology(preset.morphology);
      if (!validation.valid) errors.push(`${preset.id}: ${validation.errors.join(' | ')}`);
      if (preset.controllerGenome?.schema !== 'nexus.neural-cpg-genome.v1') {
        errors.push(`${preset.id}: invalid controller genome.`);
      }
    } else if (!preset.blocker) {
      errors.push(`${preset.id}: blocked preset must explain its blocker.`);
    }
  }
  return deepFreeze({ valid: errors.length === 0, errors });
}
