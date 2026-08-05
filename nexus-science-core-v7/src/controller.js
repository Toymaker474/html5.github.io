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

export function createGenome(seed = 0x4e455855) {
  const random = mulberry32(seed >>> 0);
  return {
    seed: seed >>> 0,
    frequencyHz: 0.72 + random() * 0.35,
    hipAmplitude: 0.28 + random() * 0.16,
    kneeLift: 0.46 + random() * 0.18,
    kneeStance: -0.72 - random() * 0.14,
    contactGain: 0.08 + random() * 0.12,
    rollGain: 0.10 + random() * 0.12,
    pitchGain: 0.08 + random() * 0.10,
    phaseOffsets: LEG_METADATA.map((leg) => leg.phase + (random() - 0.5) * 0.08),
  };
}

export function mutateGenome(parent, seed = (parent.seed + 0x9E3779B9) >>> 0) {
  const random = mulberry32(seed);
  const mutate = (value, scale, min, max) => clamp(value + (random() - 0.5) * scale, min, max);
  return {
    seed,
    frequencyHz: mutate(parent.frequencyHz, 0.22, 0.35, 1.8),
    hipAmplitude: mutate(parent.hipAmplitude, 0.16, 0.12, 0.62),
    kneeLift: mutate(parent.kneeLift, 0.20, 0.18, 0.9),
    kneeStance: mutate(parent.kneeStance, 0.18, -1.15, -0.35),
    contactGain: mutate(parent.contactGain, 0.10, 0, 0.35),
    rollGain: mutate(parent.rollGain, 0.12, 0, 0.40),
    pitchGain: mutate(parent.pitchGain, 0.12, 0, 0.35),
    phaseOffsets: parent.phaseOffsets.map((phase) => phase + (random() - 0.5) * 0.18),
  };
}

export class OscillatorController {
  constructor(genome = createGenome()) {
    this.genome = genome;
    this.controls = new Float64Array(ACTUATOR_COUNT);
  }

  setGenome(genome) {
    this.genome = genome;
  }

  update(timeSeconds, observation) {
    const g = this.genome;
    const omega = Math.PI * 2 * g.frequencyHz;
    const rollCorrection = clamp(-observation.roll * g.rollGain, -0.18, 0.18);
    const pitchCorrection = clamp(-observation.pitch * g.pitchGain, -0.16, 0.16);

    for (let i = 0; i < LEG_METADATA.length; i += 1) {
      const leg = LEG_METADATA[i];
      const phase = omega * timeSeconds + g.phaseOffsets[i];
      const swing = Math.sin(phase);
      const lift = Math.max(0, Math.sin(phase + Math.PI * 0.35));
      const contact = observation.footContacts[i] > 0.001 ? 1 : 0;
      const sideBalance = leg.side * rollCorrection;
      const foreAftBalance = Math.sign(leg.x) * pitchCorrection;

      const hipTarget = clamp(
        g.hipAmplitude * swing + sideBalance + foreAftBalance,
        -0.70,
        0.70,
      );
      const kneeTarget = clamp(
        g.kneeStance + g.kneeLift * lift - contact * g.contactGain,
        -1.28,
        0.28,
      );

      this.controls[i * 2] = hipTarget;
      this.controls[i * 2 + 1] = kneeTarget;
    }

    return this.controls;
  }
}
