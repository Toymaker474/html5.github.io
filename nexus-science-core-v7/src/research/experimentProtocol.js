const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class LocomotionExperiment {
  constructor({ durationSeconds = 8, fallHeight = 0.22 } = {}) {
    this.durationSeconds = durationSeconds;
    this.fallHeight = fallHeight;
    this.generation = 0;
    this.reset();
  }

  reset(runtime = null) {
    this.elapsed = 0;
    this.samples = 0;
    this.contactSamples = 0;
    this.totalContactFeet = 0;
    this.energyJoules = 0;
    this.rollPitchIntegral = 0;
    this.heightIntegral = 0;
    this.maxPowerWatts = 0;
    this.fell = false;
    this.startPosition = runtime ? { ...runtime.rootPosition } : { x: 0, y: 0, z: 0 };
  }

  sample(runtime, frameSeconds) {
    const dt = Math.max(0, Math.min(frameSeconds, 0.05));
    if (dt <= 0) return;

    const observation = runtime.buildObservation();
    const contacts = observation.footContacts.filter((force) => force > 0.001).length;
    const position = runtime.rootPosition;

    this.elapsed += dt;
    this.samples += 1;
    this.contactSamples += contacts > 0 ? 1 : 0;
    this.totalContactFeet += contacts;
    this.energyJoules += (runtime.lastPowerWatts + 2.5) * dt;
    this.rollPitchIntegral += (Math.abs(observation.roll) + Math.abs(observation.pitch)) * 0.5 * dt;
    this.heightIntegral += position.z * dt;
    this.maxPowerWatts = Math.max(this.maxPowerWatts, runtime.lastPowerWatts);
    this.fell ||= position.z < this.fallHeight;
  }

  get complete() {
    return this.elapsed >= this.durationSeconds;
  }

  finalize(runtime, genome) {
    const position = runtime.rootPosition;
    const displacement = Math.hypot(
      position.x - this.startPosition.x,
      position.y - this.startPosition.y,
    );
    const meanTilt = this.rollPitchIntegral / Math.max(this.elapsed, 1e-6);
    const meanHeight = this.heightIntegral / Math.max(this.elapsed, 1e-6);
    const contactDuty = this.totalContactFeet / Math.max(1, this.samples * 6);
    const stability = clamp(1 - meanTilt / 1.2, 0, 1);
    const energyEfficiency = displacement / Math.max(this.energyJoules, 1);
    const speed = displacement / Math.max(this.elapsed, 1e-6);
    const fallPenalty = this.fell ? 0.15 : 1;
    const fitness = fallPenalty * (
      speed * 6 +
      energyEfficiency * 180 +
      stability * 0.9 +
      clamp(meanHeight / 0.5, 0, 1) * 0.35
    );

    const result = {
      generation: this.generation,
      fitness,
      descriptor: {
        contactDuty: clamp(contactDuty, 0, 1),
        stability,
      },
      metrics: {
        durationSeconds: this.elapsed,
        displacementMetres: displacement,
        speedMetresPerSecond: speed,
        energyJoules: this.energyJoules,
        energyEfficiencyMetresPerJoule: energyEfficiency,
        meanHeightMetres: meanHeight,
        meanTiltRadians: meanTilt,
        maxPowerWatts: this.maxPowerWatts,
        contactDuty,
        fell: this.fell,
      },
      genome: structuredClone(genome),
    };

    this.generation += 1;
    return result;
  }
}

export class EvolutionCoordinator {
  constructor({ archive, experiment, mutateGenome }) {
    this.archive = archive;
    this.experiment = experiment;
    this.mutateGenome = mutateGenome;
    this.enabled = false;
    this.lastResult = null;
    this.lastInsertion = null;
  }

  setEnabled(enabled, runtime) {
    this.enabled = Boolean(enabled);
    if (this.enabled) this.experiment.reset(runtime);
  }

  update(runtime, frameSeconds) {
    if (!this.enabled || runtime.paused) return null;
    this.experiment.sample(runtime, frameSeconds);
    if (!this.experiment.complete) return null;

    const result = this.experiment.finalize(runtime, runtime.controller.genome);
    const insertion = this.archive.consider(result);
    const parent = this.archive.selectParent()?.genome || result.genome;
    const child = this.mutateGenome(parent);

    runtime.reset();
    runtime.controller.setGenome(child);
    runtime.captureStableSnapshot();
    this.experiment.reset(runtime);

    this.lastResult = result;
    this.lastInsertion = insertion;
    return { result, insertion, child };
  }
}
