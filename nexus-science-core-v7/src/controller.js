import { ACTUATOR_COUNT, LEG_METADATA } from './hexapodModel.js';

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function createCouplingWeights(random) {
  const count = LEG_METADATA.length;
  const weights = new Array(count * count).fill(0);
  for (let i = 0; i < count; i += 1) {
    for (let j = 0; j < count; j += 1) {
      if (i === j) continue;
      const sameTripod = Math.abs(wrapAngle(LEG_METADATA[i].phase - LEG_METADATA[j].phase)) < 0.2;
      weights[i * count + j] = (sameTripod ? 0.9 : 0.62) + (random() - 0.5) * 0.08;
    }
  }
  return weights;
}

export function createGenome(seed = 0x4e455855) {
  const random = mulberry32(seed >>> 0);
  return {
    schema: 'nexus.neural-cpg-genome.v1',
    seed: seed >>> 0,
    frequencyHz: 0.72 + random() * 0.35,
    hipAmplitude: 0.28 + random() * 0.16,
    kneeLift: 0.46 + random() * 0.18,
    kneeStance: -0.72 - random() * 0.14,
    contactGain: 0.08 + random() * 0.12,
    rollGain: 0.10 + random() * 0.12,
    pitchGain: 0.08 + random() * 0.10,
    couplingStrength: 0.8 + random() * 0.45,
    neuralTimeConstant: 0.075 + random() * 0.055,
    neuralGain: 0.06 + random() * 0.06,
    phaseOffsets: LEG_METADATA.map((leg) => leg.phase + (random() - 0.5) * 0.08),
    couplingWeights: createCouplingWeights(random),
    contactPhaseWeights: LEG_METADATA.map(() => 0.10 + random() * 0.12),
    recurrentWeights: LEG_METADATA.map(() => 0.12 + random() * 0.16),
    outputGains: LEG_METADATA.map(() => 0.85 + random() * 0.3),
  };
}

export function mutateGenome(parent, seed = (parent.seed + 0x9E3779B9) >>> 0) {
  const random = mulberry32(seed);
  const mutate = (value, scale, min, max) => clamp(value + (random() - 0.5) * scale, min, max);
  const mutateArray = (values, scale, min, max) => values.map((value) => mutate(value, scale, min, max));

  return {
    schema: 'nexus.neural-cpg-genome.v1',
    seed,
    frequencyHz: mutate(parent.frequencyHz, 0.22, 0.35, 1.8),
    hipAmplitude: mutate(parent.hipAmplitude, 0.16, 0.12, 0.62),
    kneeLift: mutate(parent.kneeLift, 0.20, 0.18, 0.9),
    kneeStance: mutate(parent.kneeStance, 0.18, -1.15, -0.35),
    contactGain: mutate(parent.contactGain, 0.10, 0, 0.35),
    rollGain: mutate(parent.rollGain, 0.12, 0, 0.40),
    pitchGain: mutate(parent.pitchGain, 0.12, 0, 0.35),
    couplingStrength: mutate(parent.couplingStrength ?? 1, 0.35, 0.2, 2.4),
    neuralTimeConstant: mutate(parent.neuralTimeConstant ?? 0.1, 0.05, 0.025, 0.3),
    neuralGain: mutate(parent.neuralGain ?? 0.08, 0.06, 0, 0.25),
    phaseOffsets: mutateArray(parent.phaseOffsets, 0.18, -Math.PI * 4, Math.PI * 4),
    couplingWeights: mutateArray(parent.couplingWeights ?? createCouplingWeights(random), 0.22, -1.5, 1.5),
    contactPhaseWeights: mutateArray(parent.contactPhaseWeights ?? LEG_METADATA.map(() => 0.15), 0.10, -0.3, 0.5),
    recurrentWeights: mutateArray(parent.recurrentWeights ?? LEG_METADATA.map(() => 0.2), 0.12, -0.6, 0.8),
    outputGains: mutateArray(parent.outputGains ?? LEG_METADATA.map(() => 1), 0.16, 0.45, 1.55),
  };
}

/**
 * Hybrid neural central-pattern generator:
 * - six phase oscillators coupled with a Kuramoto-style network;
 * - contact feedback changes oscillator phase instead of teleporting limbs;
 * - a continuous-time recurrent neural residual handles balance corrections;
 * - outputs remain actuator targets and never directly alter body transforms.
 */
export class NeuralCPGController {
  constructor(genome = createGenome()) {
    this.controls = new Float64Array(ACTUATOR_COUNT);
    this.phases = new Float64Array(LEG_METADATA.length);
    this.neuralState = new Float64Array(LEG_METADATA.length);
    this.lastTimeSeconds = null;
    this.setGenome(genome);
  }

  setGenome(genome) {
    this.genome = genome;
    for (let i = 0; i < LEG_METADATA.length; i += 1) {
      this.phases[i] = genome.phaseOffsets[i] ?? LEG_METADATA[i].phase;
      this.neuralState[i] = 0;
    }
    this.lastTimeSeconds = null;
  }

  updateOscillators(dt, observation) {
    const count = LEG_METADATA.length;
    const g = this.genome;
    const omega = Math.PI * 2 * g.frequencyHz;
    const derivatives = new Float64Array(count);

    for (let i = 0; i < count; i += 1) {
      let coupling = 0;
      for (let j = 0; j < count; j += 1) {
        if (i === j) continue;
        const desiredDifference = g.phaseOffsets[j] - g.phaseOffsets[i];
        const phaseError = this.phases[j] - this.phases[i] - desiredDifference;
        coupling += g.couplingWeights[i * count + j] * Math.sin(phaseError);
      }

      const contact = observation.footContacts[i] > 0.001 ? 1 : 0;
      const contactFeedback = contact * g.contactPhaseWeights[i] * Math.sin(this.phases[i] + Math.PI * 0.5);
      derivatives[i] = omega + g.couplingStrength * coupling + contactFeedback;
    }

    for (let i = 0; i < count; i += 1) {
      this.phases[i] = wrapAngle(this.phases[i] + derivatives[i] * dt);
    }
  }

  updateNeuralResidual(dt, observation) {
    const g = this.genome;
    const count = LEG_METADATA.length;
    const previous = Float64Array.from(this.neuralState);
    const tau = Math.max(0.025, g.neuralTimeConstant);

    for (let i = 0; i < count; i += 1) {
      const leg = LEG_METADATA[i];
      const previousLeg = previous[(i + count - 1) % count];
      const nextLeg = previous[(i + 1) % count];
      const contact = observation.footContacts[i] > 0.001 ? 1 : -0.25;
      const sensorDrive =
        contact * g.contactGain +
        (-observation.roll * leg.side) * g.rollGain +
        (-observation.pitch * Math.sign(leg.x || 1)) * g.pitchGain +
        (observation.batteryRatio - 0.5) * 0.03;
      const recurrentDrive = (previousLeg + nextLeg) * 0.5 * g.recurrentWeights[i];
      const target = Math.tanh(sensorDrive + recurrentDrive);
      this.neuralState[i] += (dt / tau) * (-this.neuralState[i] + target);
      this.neuralState[i] = clamp(this.neuralState[i], -1, 1);
    }
  }

  update(timeSeconds, observation) {
    const dt = this.lastTimeSeconds === null
      ? 0.0025
      : clamp(timeSeconds - this.lastTimeSeconds, 0.0001, 0.05);
    this.lastTimeSeconds = timeSeconds;

    this.updateOscillators(dt, observation);
    this.updateNeuralResidual(dt, observation);

    const g = this.genome;
    for (let i = 0; i < LEG_METADATA.length; i += 1) {
      const phase = this.phases[i];
      const swing = Math.sin(phase);
      const lift = Math.max(0, Math.sin(phase + Math.PI * 0.35));
      const contact = observation.footContacts[i] > 0.001 ? 1 : 0;
      const neuralResidual = this.neuralState[i] * g.neuralGain;
      const gain = g.outputGains[i];

      this.controls[i * 2] = clamp(
        gain * g.hipAmplitude * swing + neuralResidual,
        -0.70,
        0.70,
      );
      this.controls[i * 2 + 1] = clamp(
        g.kneeStance + gain * g.kneeLift * lift - contact * g.contactGain - neuralResidual * 0.5,
        -1.28,
        0.28,
      );
    }

    return this.controls;
  }
}

// Compatibility export while the rest of the V7 runtime migrates terminology.
export class OscillatorController extends NeuralCPGController {}
