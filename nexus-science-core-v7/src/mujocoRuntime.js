import loadMujoco from '@mujoco/mujoco';
import { HEXAPOD_MJCF, LEG_METADATA } from './hexapodModel.js';
import { OscillatorController, createGenome, mutateGenome } from './controller.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function quaternionToRollPitch(w, x, y, z) {
  const sinRoll = 2 * (w * x + y * z);
  const cosRoll = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinRoll, cosRoll);

  const sinPitch = clamp(2 * (w * y - z * x), -1, 1);
  const pitch = Math.asin(sinPitch);
  return { roll, pitch };
}

function copyInto(target, source) {
  const count = Math.min(target.length, source.length);
  for (let i = 0; i < count; i += 1) target[i] = source[i];
}

export class MujocoScienceRuntime {
  static async create() {
    const module = await loadMujoco();
    return new MujocoScienceRuntime(module);
  }

  constructor(module) {
    this.mujoco = module;
    this.model = module.MjModel.from_xml_string(HEXAPOD_MJCF);
    if (!this.model) throw new Error('MuJoCo rejected the V7 MJCF morphology.');

    this.data = new module.MjData(this.model);
    if (!this.data) throw new Error('MuJoCo could not allocate authoritative simulation state.');

    this.controller = new OscillatorController(createGenome());
    this.paused = false;
    this.batteryJoules = 650;
    this.maxBatteryJoules = 650;
    this.lastPowerWatts = 0;
    this.accumulator = 0;
    this.fixedStep = Number(this.model.opt?.timestep || 0.0025);
    this.maxSubsteps = 32;
    this.sensorAddresses = new Map();
    this.snapshot = null;

    this.cacheSensorAddresses();
    this.mujoco.mj_forward(this.model, this.data);
    this.captureStableSnapshot();
  }

  cacheSensorAddresses() {
    for (const leg of LEG_METADATA) {
      const name = `touch_${leg.id}`;
      const sensor = this.model.sensor(name);
      if (!sensor) throw new Error(`Required MuJoCo sensor missing: ${name}`);
      this.sensorAddresses.set(name, Number(sensor.adr));
      sensor.delete?.();
    }
  }

  buildObservation() {
    const qpos = this.data.qpos;
    const quaternion = quaternionToRollPitch(qpos[3], qpos[4], qpos[5], qpos[6]);
    const footContacts = LEG_METADATA.map((leg) => {
      const address = this.sensorAddresses.get(`touch_${leg.id}`);
      return Number(this.data.sensordata[address] || 0);
    });
    return {
      ...quaternion,
      footContacts,
      batteryRatio: this.batteryJoules / this.maxBatteryJoules,
    };
  }

  applyController() {
    if (this.batteryJoules <= 0) {
      this.data.ctrl.fill(0);
      return;
    }
    const controls = this.controller.update(this.data.time, this.buildObservation());
    copyInto(this.data.ctrl, controls);
  }

  measureActuatorPower() {
    const forces = this.data.actuator_force;
    const velocities = this.data.actuator_velocity;
    if (!forces || !velocities) return 0;

    let watts = 0;
    const count = Math.min(forces.length, velocities.length);
    for (let i = 0; i < count; i += 1) {
      watts += Math.abs(Number(forces[i]) * Number(velocities[i]));
    }
    return watts;
  }

  step(frameSeconds) {
    if (this.paused) return 0;
    this.accumulator += Math.min(frameSeconds, 0.05);
    let substeps = 0;

    while (this.accumulator >= this.fixedStep && substeps < this.maxSubsteps) {
      this.applyController();
      this.mujoco.mj_step(this.model, this.data);

      this.lastPowerWatts = this.measureActuatorPower();
      const baselineElectronicsWatts = 2.5;
      const joulesUsed = (this.lastPowerWatts + baselineElectronicsWatts) * this.fixedStep;
      this.batteryJoules = Math.max(0, this.batteryJoules - joulesUsed);

      this.accumulator -= this.fixedStep;
      substeps += 1;
    }

    if (!Number.isFinite(this.data.time) || !Number.isFinite(this.data.qpos[0])) {
      this.restoreStableSnapshot();
      throw new Error('MuJoCo produced non-finite state; restored last stable snapshot.');
    }

    return substeps;
  }

  captureStableSnapshot() {
    this.snapshot = {
      qpos: Float64Array.from(this.data.qpos),
      qvel: Float64Array.from(this.data.qvel),
      act: this.data.act ? Float64Array.from(this.data.act) : new Float64Array(),
      ctrl: Float64Array.from(this.data.ctrl),
      time: Number(this.data.time),
      batteryJoules: this.batteryJoules,
      genome: structuredClone(this.controller.genome),
    };
  }

  restoreStableSnapshot() {
    if (!this.snapshot) return;
    copyInto(this.data.qpos, this.snapshot.qpos);
    copyInto(this.data.qvel, this.snapshot.qvel);
    if (this.data.act && this.snapshot.act.length) copyInto(this.data.act, this.snapshot.act);
    copyInto(this.data.ctrl, this.snapshot.ctrl);
    this.data.time = this.snapshot.time;
    this.batteryJoules = this.snapshot.batteryJoules;
    this.controller.setGenome(structuredClone(this.snapshot.genome));
    this.mujoco.mj_forward(this.model, this.data);
  }

  reset() {
    this.mujoco.mj_resetData(this.model, this.data);
    this.batteryJoules = this.maxBatteryJoules;
    this.accumulator = 0;
    this.mujoco.mj_forward(this.model, this.data);
    this.captureStableSnapshot();
  }

  mutateController() {
    this.controller.setGenome(mutateGenome(this.controller.genome));
    this.captureStableSnapshot();
    return this.controller.genome;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  dispose() {
    this.data?.delete?.();
    this.model?.delete?.();
    this.data = null;
    this.model = null;
  }
}
