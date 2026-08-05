const LEG_SPECS = [
  { id: 'fl', x: 0.31, side: 1, phase: 0 },
  { id: 'ml', x: 0.00, side: 1, phase: Math.PI },
  { id: 'rl', x: -0.31, side: 1, phase: 0 },
  { id: 'fr', x: 0.31, side: -1, phase: Math.PI },
  { id: 'mr', x: 0.00, side: -1, phase: 0 },
  { id: 'rr', x: -0.31, side: -1, phase: Math.PI },
];

function legXml({ id, x, side }) {
  const y = 0.24 * side;
  const upperY = 0.29 * side;
  const lowerY = 0.24 * side;
  return `
    <body name="hip_${id}_body" pos="${x} ${y} 0">
      <joint name="hip_${id}" type="hinge" axis="0 0 1" range="-0.75 0.75" />
      <geom name="upper_${id}" type="capsule" fromto="0 0 0 0 ${upperY} -0.07" size="0.045" mass="0.16" rgba="0.27 0.31 0.27 1" />
      <body name="knee_${id}_body" pos="0 ${upperY} -0.07">
        <joint name="knee_${id}" type="hinge" axis="1 0 0" range="-1.35 0.35" />
        <geom name="lower_${id}" type="capsule" fromto="0 0 0 0 ${lowerY} -0.27" size="0.038" mass="0.13" rgba="0.18 0.21 0.18 1" />
        <body name="foot_${id}_body" pos="0 ${lowerY} -0.27">
          <geom name="foot_${id}" type="sphere" size="0.065" mass="0.08" friction="1.6 0.02 0.002" rgba="0.60 0.48 0.25 1" />
          <site name="foot_${id}_site" type="sphere" size="0.072" rgba="0 0 0 0" />
        </body>
      </body>
    </body>`;
}

const actuatorXml = LEG_SPECS.flatMap(({ id }) => [
  `<position name="hip_${id}_act" joint="hip_${id}" kp="55" kv="5" ctrlrange="-0.72 0.72" />`,
  `<position name="knee_${id}_act" joint="knee_${id}" kp="70" kv="6" ctrlrange="-1.30 0.30" />`,
]).join('\n    ');

const sensorXml = LEG_SPECS.flatMap(({ id }) => [
  `<touch name="touch_${id}" site="foot_${id}_site" />`,
  `<jointpos name="hip_pos_${id}" joint="hip_${id}" />`,
  `<jointvel name="hip_vel_${id}" joint="hip_${id}" />`,
  `<jointpos name="knee_pos_${id}" joint="knee_${id}" />`,
  `<jointvel name="knee_vel_${id}" joint="knee_${id}" />`,
]).join('\n    ');

export const HEXAPOD_MJCF = `
<mujoco model="nexus_v7_hexapod">
  <compiler angle="radian" autolimits="true" balanceinertia="true" />
  <option timestep="0.0025" integrator="implicitfast" solver="Newton" cone="elliptic" iterations="60" tolerance="1e-10" gravity="0 0 -9.81" />
  <size memory="64M" />

  <default>
    <joint damping="1.4" armature="0.015" frictionloss="0.04" />
    <geom condim="4" solref="0.004 1" solimp="0.92 0.98 0.002" friction="1.1 0.02 0.002" />
  </default>

  <visual>
    <headlight ambient="0.25 0.25 0.25" diffuse="0.65 0.65 0.65" specular="0.15 0.15 0.15" />
    <rgba haze="0.08 0.10 0.08 1" />
  </visual>

  <worldbody>
    <light name="key" directional="true" pos="2 -3 6" dir="-0.25 0.35 -1" diffuse="0.85 0.78 0.66" />
    <geom name="ground" type="plane" size="12 12 0.2" rgba="0.11 0.13 0.10 1" friction="1.35 0.03 0.002" />

    <body name="robot" pos="0 0 0.58">
      <freejoint name="root" />
      <geom name="torso_collision" type="box" size="0.42 0.26 0.105" mass="3.2" rgba="0.23 0.26 0.22 1" />
      <geom name="core_collision" type="ellipsoid" size="0.20 0.14 0.12" pos="0 0 0.12" mass="0.55" rgba="0.72 0.58 0.28 1" />
      <site name="imu" type="sphere" pos="0 0 0.12" size="0.025" rgba="0.9 0.7 0.25 0.2" />
      ${LEG_SPECS.map(legXml).join('\n')}
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

export const LEG_METADATA = LEG_SPECS;
export const ACTUATOR_COUNT = LEG_SPECS.length * 2;
