const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const LEG_LAYOUT = Object.freeze([
  { id: 'fl', longitudinal: 0.74, side: 1, phase: 0 },
  { id: 'ml', longitudinal: 0.00, side: 1, phase: Math.PI },
  { id: 'rl', longitudinal: -0.74, side: 1, phase: 0 },
  { id: 'fr', longitudinal: 0.74, side: -1, phase: Math.PI },
  { id: 'mr', longitudinal: 0.00, side: -1, phase: 0 },
  { id: 'rr', longitudinal: -0.74, side: -1, phase: Math.PI },
]);

export const DEFAULT_MORPHOLOGY = Object.freeze({
  schema: 'nexus.morphology.hexapod.v1',
  seed: 0x48455841,
  torso: {
    halfLength: 0.42,
    halfWidth: 0.26,
    halfHeight: 0.105,
    massKg: 3.2,
  },
  core: {
    radiusX: 0.20,
    radiusY: 0.14,
    radiusZ: 0.12,
    height: 0.12,
    massKg: 0.55,
  },
  leg: {
    hipInset: 0.92,
    upperOut: 0.29,
    upperDrop: 0.07,
    upperRadius: 0.045,
    upperMassKg: 0.16,
    lowerOut: 0.24,
    lowerDrop: 0.27,
    lowerRadius: 0.038,
    lowerMassKg: 0.13,
    footRadius: 0.065,
    footMassKg: 0.08,
  },
  joints: {
    damping: 1.4,
    armature: 0.015,
    frictionLoss: 0.04,
    hipMin: -0.75,
    hipMax: 0.75,
    kneeMin: -1.35,
    kneeMax: 0.35,
  },
  actuators: {
    hipKp: 55,
    hipKv: 5,
    kneeKp: 70,
    kneeKv: 6,
  },
  contact: {
    frictionSlide: 1.6,
    frictionTorsion: 0.02,
    frictionRoll: 0.002,
  },
});

const LIMITS = Object.freeze({
  'torso.halfLength': [0.25, 0.68],
  'torso.halfWidth': [0.16, 0.40],
  'torso.halfHeight': [0.06, 0.19],
  'torso.massKg': [1.2, 8.0],
  'core.radiusX': [0.08, 0.30],
  'core.radiusY': [0.06, 0.24],
  'core.radiusZ': [0.05, 0.20],
  'core.height': [0.05, 0.24],
  'core.massKg': [0.1, 2.2],
  'leg.hipInset': [0.68, 1.10],
  'leg.upperOut': [0.16, 0.48],
  'leg.upperDrop': [0.01, 0.20],
  'leg.upperRadius': [0.022, 0.075],
  'leg.upperMassKg': [0.05, 0.50],
  'leg.lowerOut': [0.10, 0.45],
  'leg.lowerDrop': [0.12, 0.55],
  'leg.lowerRadius': [0.018, 0.065],
  'leg.lowerMassKg': [0.04, 0.45],
  'leg.footRadius': [0.035, 0.11],
  'leg.footMassKg': [0.025, 0.28],
  'joints.damping': [0.1, 6.0],
  'joints.armature': [0.001, 0.08],
  'joints.frictionLoss': [0, 0.30],
  'joints.hipMin': [-1.4, -0.05],
  'joints.hipMax': [0.05, 1.4],
  'joints.kneeMin': [-2.2, -0.25],
  'joints.kneeMax': [-0.1, 1.0],
  'actuators.hipKp': [10, 150],
  'actuators.hipKv': [0.5, 20],
  'actuators.kneeKp': [10, 180],
  'actuators.kneeKv': [0.5, 24],
  'contact.frictionSlide': [0.15, 3.0],
  'contact.frictionTorsion': [0.001, 0.12],
  'contact.frictionRoll': [0.0001, 0.02],
});

function getPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const parts = path.split('.');
  let target = object;
  for (let i = 0; i < parts.length - 1; i += 1) target = target[parts[i]];
  target[parts.at(-1)] = value;
}

function deterministicRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function validateMorphology(morphology) {
  const errors = [];
  if (morphology?.schema !== 'nexus.morphology.hexapod.v1') {
    errors.push('Unsupported morphology schema.');
  }

  for (const [path, [minimum, maximum]] of Object.entries(LIMITS)) {
    const value = getPath(morphology, path);
    if (!Number.isFinite(value)) errors.push(`${path} must be finite.`);
    else if (value < minimum || value > maximum) errors.push(`${path}=${value} outside [${minimum}, ${maximum}].`);
  }

  if (morphology?.joints?.hipMin >= morphology?.joints?.hipMax) errors.push('Hip joint range is inverted.');
  if (morphology?.joints?.kneeMin >= morphology?.joints?.kneeMax) errors.push('Knee joint range is inverted.');

  const totalMass = morphology?.torso?.massKg + morphology?.core?.massKg + 6 * (
    morphology?.leg?.upperMassKg + morphology?.leg?.lowerMassKg + morphology?.leg?.footMassKg
  );
  if (!Number.isFinite(totalMass) || totalMass < 2 || totalMass > 15) {
    errors.push(`Total morphology mass ${totalMass} kg outside safe research range [2, 15].`);
  }

  const reach = Math.hypot(morphology?.leg?.upperOut, morphology?.leg?.upperDrop) +
    Math.hypot(morphology?.leg?.lowerOut, morphology?.leg?.lowerDrop);
  if (!Number.isFinite(reach) || reach < morphology?.torso?.halfHeight * 1.6) {
    errors.push('Leg reach is insufficient to support the torso.');
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), totalMassKg: totalMass, reachMetres: reach });
}

export function mutateMorphology(parent, seed = (parent.seed + 0x9e3779b9) >>> 0, mutationRate = 0.18) {
  const random = deterministicRandom(seed);
  const child = structuredClone(parent);
  child.seed = seed >>> 0;

  for (const [path, [minimum, maximum]] of Object.entries(LIMITS)) {
    if (random() > mutationRate) continue;
    const value = getPath(child, path);
    const span = maximum - minimum;
    const mutated = clamp(value + (random() - 0.5) * span * 0.12, minimum, maximum);
    setPath(child, path, mutated);
  }

  const validation = validateMorphology(child);
  if (!validation.valid) {
    throw new Error(`Morphology mutation failed validation: ${validation.errors.join(' | ')}`);
  }
  return Object.freeze(child);
}

function legXml(morphology, { id, longitudinal, side }) {
  const { torso, leg } = morphology;
  const x = torso.halfLength * longitudinal;
  const y = torso.halfWidth * leg.hipInset * side;
  const upperY = leg.upperOut * side;
  const lowerY = leg.lowerOut * side;
  return `
    <body name="hip_${id}_body" pos="${x} ${y} 0">
      <joint name="hip_${id}" type="hinge" axis="0 0 1" range="${morphology.joints.hipMin} ${morphology.joints.hipMax}" />
      <geom name="upper_${id}" type="capsule" fromto="0 0 0 0 ${upperY} -${leg.upperDrop}" size="${leg.upperRadius}" mass="${leg.upperMassKg}" rgba="0.27 0.31 0.27 1" />
      <body name="knee_${id}_body" pos="0 ${upperY} -${leg.upperDrop}">
        <joint name="knee_${id}" type="hinge" axis="1 0 0" range="${morphology.joints.kneeMin} ${morphology.joints.kneeMax}" />
        <geom name="lower_${id}" type="capsule" fromto="0 0 0 0 ${lowerY} -${leg.lowerDrop}" size="${leg.lowerRadius}" mass="${leg.lowerMassKg}" rgba="0.18 0.21 0.18 1" />
        <body name="foot_${id}_body" pos="0 ${lowerY} -${leg.lowerDrop}">
          <geom name="foot_${id}" type="sphere" size="${leg.footRadius}" mass="${leg.footMassKg}" friction="${morphology.contact.frictionSlide} ${morphology.contact.frictionTorsion} ${morphology.contact.frictionRoll}" rgba="0.60 0.48 0.25 1" />
          <site name="foot_${id}_site" type="sphere" size="${leg.footRadius * 1.1}" rgba="0 0 0 0" />
        </body>
      </body>
    </body>`;
}

export function compileMorphologyToMjcf(morphology) {
  const validation = validateMorphology(morphology);
  if (!validation.valid) {
    throw new Error(`Cannot compile invalid morphology: ${validation.errors.join(' | ')}`);
  }

  const actuatorXml = LEG_LAYOUT.flatMap(({ id }) => [
    `<position name="hip_${id}_act" joint="hip_${id}" kp="${morphology.actuators.hipKp}" kv="${morphology.actuators.hipKv}" ctrlrange="${morphology.joints.hipMin + 0.03} ${morphology.joints.hipMax - 0.03}" />`,
    `<position name="knee_${id}_act" joint="knee_${id}" kp="${morphology.actuators.kneeKp}" kv="${morphology.actuators.kneeKv}" ctrlrange="${morphology.joints.kneeMin + 0.05} ${morphology.joints.kneeMax - 0.05}" />`,
  ]).join('\n    ');

  const sensorXml = LEG_LAYOUT.flatMap(({ id }) => [
    `<touch name="touch_${id}" site="foot_${id}_site" />`,
    `<jointpos name="hip_pos_${id}" joint="hip_${id}" />`,
    `<jointvel name="hip_vel_${id}" joint="hip_${id}" />`,
    `<jointpos name="knee_pos_${id}" joint="knee_${id}" />`,
    `<jointvel name="knee_vel_${id}" joint="knee_${id}" />`,
  ]).join('\n    ');

  const spawnHeight = validation.reachMetres + morphology.torso.halfHeight + 0.10;
  return `
<mujoco model="nexus_v7_compiled_hexapod">
  <compiler angle="radian" autolimits="true" balanceinertia="true" />
  <option timestep="0.0025" integrator="implicitfast" solver="Newton" cone="elliptic" iterations="60" tolerance="1e-10" gravity="0 0 -9.81" />
  <size memory="64M" />

  <default>
    <joint damping="${morphology.joints.damping}" armature="${morphology.joints.armature}" frictionloss="${morphology.joints.frictionLoss}" />
    <geom condim="4" solref="0.004 1" solimp="0.92 0.98 0.002" friction="1.1 0.02 0.002" />
  </default>

  <visual>
    <headlight ambient="0.25 0.25 0.25" diffuse="0.65 0.65 0.65" specular="0.15 0.15 0.15" />
    <rgba haze="0.08 0.10 0.08 1" />
  </visual>

  <worldbody>
    <light name="key" directional="true" pos="2 -3 6" dir="-0.25 0.35 -1" diffuse="0.85 0.78 0.66" />
    <geom name="ground" type="plane" size="12 12 0.2" rgba="0.11 0.13 0.10 1" friction="1.35 0.03 0.002" />

    <body name="robot" pos="0 0 ${spawnHeight}">
      <freejoint name="root" />
      <geom name="torso_collision" type="box" size="${morphology.torso.halfLength} ${morphology.torso.halfWidth} ${morphology.torso.halfHeight}" mass="${morphology.torso.massKg}" rgba="0.23 0.26 0.22 1" />
      <geom name="core_collision" type="ellipsoid" size="${morphology.core.radiusX} ${morphology.core.radiusY} ${morphology.core.radiusZ}" pos="0 0 ${morphology.core.height}" mass="${morphology.core.massKg}" rgba="0.72 0.58 0.28 1" />
      <site name="imu" type="sphere" pos="0 0 ${morphology.core.height}" size="0.025" rgba="0.9 0.7 0.25 0.2" />
      ${LEG_LAYOUT.map((layout) => legXml(morphology, layout)).join('\n')}
    </body>
  </worldbody>

  <actuator>
    ${actuatorXml}
  </actuator>

  <sensor>
    <accelerometer name="imu_accel" site="imu" />
    <gyro name="imu_gyro" site="imu" />
    <framequat name="body_quat" objtype="body" objname="robot" />
    <subtreecom name="body_com" body="robot" />
    ${sensorXml}
  </sensor>
</mujoco>`;
}
