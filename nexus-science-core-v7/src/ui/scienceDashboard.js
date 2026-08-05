const format = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—';

export class ScienceDashboard {
  constructor({ archive }) {
    this.archive = archive;
    this.status = document.querySelector('#status');
    this.archiveCanvas = document.querySelector('#archive-map');
    this.generation = document.querySelector('#generation-value');
    this.coverage = document.querySelector('#coverage-value');
    this.fitness = document.querySelector('#fitness-value');
    this.efficiency = document.querySelector('#efficiency-value');
    this.controller = document.querySelector('#controller-value');
    this.mode = document.querySelector('#mode-value');
    this.archiveContext = this.archiveCanvas?.getContext('2d', { alpha: false });
  }

  setBoot(message) {
    if (this.status) this.status.innerHTML = `<strong>V7 BOOT</strong><br>${message}`;
  }

  setFailure(message) {
    if (this.status) this.status.innerHTML = `<strong>FAIL-CLOSED</strong><br>${message}`;
  }

  updateRuntime({ runtime, renderer, fps, coordinator }) {
    const observation = runtime.buildObservation();
    const contacts = observation.footContacts.filter((force) => force > 0.001).length;
    const batteryPercent = runtime.batteryJoules / runtime.maxBatteryJoules * 100;
    const genome = runtime.controller.genome;

    if (this.status) {
      this.status.innerHTML =
        `<strong>MUJOCO AUTHORITY</strong> · ${renderer.backend}<br>` +
        `SIM ${runtime.data.time.toFixed(2)} s · ${fps.toFixed(0)} FPS · ${contacts}/6 FEET · MAX ${runtime.maxFootContactsSeen}/6<br>` +
        `DIST ${runtime.planarDisplacement.toFixed(3)} m · HEIGHT ${runtime.rootPosition.z.toFixed(3)} m<br>` +
        `BATTERY ${batteryPercent.toFixed(1)}% · POWER ${runtime.lastPowerWatts.toFixed(1)} W · PEAK ${runtime.maxPowerWattsSeen.toFixed(1)} W`;
    }

    if (this.generation) this.generation.textContent = String(coordinator.experiment.generation);
    if (this.coverage) this.coverage.textContent = `${format(this.archive.coverage * 100, 1)}%`;
    if (this.fitness) this.fitness.textContent = format(this.archive.best?.fitness ?? coordinator.lastResult?.fitness, 3);
    if (this.efficiency) {
      this.efficiency.textContent = format(
        coordinator.lastResult?.metrics.energyEfficiencyMetresPerJoule,
        5,
      );
    }
    if (this.controller) {
      this.controller.textContent = `${format(genome.frequencyHz, 2)} Hz · K ${format(genome.couplingStrength, 2)}`;
    }
    if (this.mode) this.mode.textContent = coordinator.enabled ? 'AUTONOMOUS EVOLUTION' : 'MANUAL EXPERIMENT';
    this.renderArchive();
  }

  renderArchive() {
    const canvas = this.archiveCanvas;
    const context = this.archiveContext;
    if (!canvas || !context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = canvas.clientWidth || 156;
    const cssHeight = canvas.clientHeight || 96;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.fillStyle = '#0b0d0b';
    context.fillRect(0, 0, width, height);
    const cellWidth = width / this.archive.binsX;
    const cellHeight = height / this.archive.binsY;
    const bestFitness = Math.max(this.archive.best?.fitness || 1, 1e-6);

    for (let y = 0; y < this.archive.binsY; y += 1) {
      for (let x = 0; x < this.archive.binsX; x += 1) {
        const elite = this.archive.cells.get(`${x}:${y}`);
        const intensity = elite ? Math.min(1, elite.fitness / bestFitness) : 0;
        const lightness = elite ? 28 + intensity * 42 : 8;
        context.fillStyle = elite
          ? `hsl(39 48% ${lightness}%)`
          : '#141814';
        context.fillRect(
          x * cellWidth + 0.6 * dpr,
          (this.archive.binsY - 1 - y) * cellHeight + 0.6 * dpr,
          Math.max(1, cellWidth - 1.2 * dpr),
          Math.max(1, cellHeight - 1.2 * dpr),
        );
      }
    }

    context.strokeStyle = '#596057';
    context.lineWidth = dpr;
    context.strokeRect(0.5 * dpr, 0.5 * dpr, width - dpr, height - dpr);
  }
}
