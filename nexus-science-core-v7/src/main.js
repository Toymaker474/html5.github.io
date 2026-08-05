import { BabylonMujocoRenderer } from './babylonRenderer.js';
import { mutateGenome } from './controller.js';
import { MujocoScienceRuntime } from './mujocoRuntime.js';
import { EvolutionCoordinator, LocomotionExperiment } from './research/experimentProtocol.js';
import { QualityDiversityArchive } from './research/qualityDiversity.js';
import { ScienceDashboard } from './ui/scienceDashboard.js';

const canvas = document.querySelector('#world');
const pauseButton = document.querySelector('#pause');
const resetButton = document.querySelector('#reset');
const mutateButton = document.querySelector('#mutate');
const evolveButton = document.querySelector('#evolve');

if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing V7 render canvas.');

const archive = new QualityDiversityArchive({ binsX: 12, binsY: 12, seed: 0x4d415045 });
const experiment = new LocomotionExperiment({ durationSeconds: 8, fallHeight: 0.22 });
const coordinator = new EvolutionCoordinator({
  archive,
  experiment,
  mutateGenome: (parent) => mutateGenome(
    parent,
    (parent.seed + Math.imul(experiment.generation + 1, 0x9e3779b9)) >>> 0,
  ),
});
const dashboard = new ScienceDashboard({ archive });

const MANUAL_MAX_FRAME_SECONDS = 0.05;
const EVOLUTION_TIME_SCALE = 4;
const EVOLUTION_MAX_BUDGET_SECONDS = 0.5;
const SCIENCE_BATCH_SECONDS = 0.05;
const MAX_BATCHES_PER_RENDER = 10;

let runtime;
let renderer;
let disposed = false;
let lastFrame = performance.now();
let fpsWindowStart = lastFrame;
let fpsFrames = 0;
let fps = 0;
let stableTimer = 0;

function updateDashboard() {
  dashboard.updateRuntime({ runtime, renderer, fps, coordinator });
}

/**
 * Manual mode is visually real-time. Autonomous evolution uses deterministic
 * batched simulation so scientific episode duration does not depend on GPU or
 * display frame rate. Babylon still renders once per animation frame; MuJoCo
 * may advance several bounded batches between renders.
 */
function advanceScience(rawFrameSeconds) {
  const simulationBudget = coordinator.enabled
    ? Math.min(rawFrameSeconds * EVOLUTION_TIME_SCALE, EVOLUTION_MAX_BUDGET_SECONDS)
    : Math.min(rawFrameSeconds, MANUAL_MAX_FRAME_SECONDS);

  let remaining = Math.max(0, simulationBudget);
  let batches = 0;
  let latestEvolutionEvent = null;

  while (remaining > 1e-6 && batches < MAX_BATCHES_PER_RENDER) {
    const batchSeconds = Math.min(remaining, SCIENCE_BATCH_SECONDS);
    runtime.step(batchSeconds);
    const event = coordinator.update(runtime, batchSeconds);
    if (event) latestEvolutionEvent = event;
    remaining -= batchSeconds;
    batches += 1;
  }

  return {
    evolutionEvent: latestEvolutionEvent,
    simulatedSeconds: simulationBudget - Math.max(0, remaining),
    batches,
  };
}

function animate(now) {
  if (disposed) return;
  const rawFrameSeconds = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;

  try {
    const advancement = advanceScience(rawFrameSeconds);
    renderer.sync();
    renderer.render();

    if (advancement.evolutionEvent) {
      navigator.vibrate?.(advancement.evolutionEvent.insertion.accepted ? [18, 28, 18] : 18);
    }

    fpsFrames += 1;
    if (now - fpsWindowStart >= 500) {
      fps = fpsFrames * 1000 / (now - fpsWindowStart);
      fpsFrames = 0;
      fpsWindowStart = now;
      updateDashboard();
    }

    if (!coordinator.enabled) {
      stableTimer += advancement.simulatedSeconds;
      const height = runtime.rootPosition.z;
      if (stableTimer >= 2 && height > 0.28 && Number.isFinite(height)) {
        runtime.captureStableSnapshot();
        stableTimer = 0;
      }
    } else {
      stableTimer = 0;
    }
  } catch (error) {
    console.error(error);
    runtime?.setPaused(true);
    dashboard.setFailure(error instanceof Error ? error.message : String(error));
  }

  requestAnimationFrame(animate);
}

function installControls() {
  pauseButton.addEventListener('click', () => {
    runtime.setPaused(!runtime.paused);
    pauseButton.textContent = runtime.paused ? 'RESUME' : 'PAUSE';
    pauseButton.setAttribute('aria-pressed', String(runtime.paused));
  });

  resetButton.addEventListener('click', () => {
    runtime.reset();
    experiment.reset(runtime);
    pauseButton.textContent = 'PAUSE';
    pauseButton.setAttribute('aria-pressed', 'false');
    runtime.setPaused(false);
    stableTimer = 0;
    updateDashboard();
  });

  mutateButton.addEventListener('click', () => {
    const nextGenome = mutateGenome(
      runtime.controller.genome,
      (runtime.controller.genome.seed + 0x9e3779b9 + experiment.generation) >>> 0,
    );
    runtime.reset();
    runtime.controller.setGenome(nextGenome);
    runtime.captureStableSnapshot();
    experiment.reset(runtime);
    navigator.vibrate?.(24);
    updateDashboard();
  });

  evolveButton.addEventListener('click', () => {
    coordinator.setEnabled(!coordinator.enabled, runtime);
    evolveButton.setAttribute('aria-pressed', String(coordinator.enabled));
    evolveButton.textContent = coordinator.enabled ? 'EVOLVING' : 'EVOLVE';
    navigator.vibrate?.(coordinator.enabled ? [20, 35, 20] : 20);
    updateDashboard();
  });
}

async function boot() {
  try {
    dashboard.setBoot('Loading Google DeepMind MuJoCo WebAssembly…');
    runtime = await MujocoScienceRuntime.create();

    dashboard.setBoot('Starting Babylon scientific renderer…');
    renderer = await BabylonMujocoRenderer.create(canvas, runtime);
    installControls();

    window.__NEXUS_V7__ = Object.freeze({
      get runtime() { return runtime; },
      get renderer() { return renderer; },
      archive,
      experiment,
      coordinator,
      evaluation: Object.freeze({
        timeScale: EVOLUTION_TIME_SCALE,
        maximumBudgetSeconds: EVOLUTION_MAX_BUDGET_SECONDS,
        batchSeconds: SCIENCE_BATCH_SECONDS,
      }),
      schema: 'nexus.science-runtime.v1',
    });

    window.addEventListener('pagehide', dispose, { once: true });
    window.addEventListener('beforeunload', dispose, { once: true });

    updateDashboard();
    requestAnimationFrame(animate);
  } catch (error) {
    console.error('NEXUS V7 boot failed', error);
    dashboard.setFailure(error instanceof Error ? error.message : String(error));
  }
}

function dispose() {
  if (disposed) return;
  disposed = true;
  renderer?.dispose();
  runtime?.dispose();
  delete window.__NEXUS_V7__;
}

void boot();
