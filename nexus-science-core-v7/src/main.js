import { BabylonMujocoRenderer } from './babylonRenderer.js';
import { mutateGenome } from './controller.js';
import { MujocoScienceRuntime } from './mujocoRuntime.js';
import { applyProductionArtDirection } from './productionArtDirection.js';
import { installAllLegConnectivity } from './referenceLegConnectivity.js';
import {
  DEFAULT_ROBOT_PRESET_ID,
  FUTURE_ROBOT_PRESETS,
  READY_ROBOT_PRESETS,
  getRobotPreset,
  validateRobotPresetCatalog,
} from './robotPresets.js';
import { EvolutionCoordinator, LocomotionExperiment } from './research/experimentProtocol.js';
import { QualityDiversityArchive } from './research/qualityDiversity.js';
import { ScienceDashboard } from './ui/scienceDashboard.js';

const canvas = document.querySelector('#world');
const pauseButton = document.querySelector('#pause');
const resetButton = document.querySelector('#reset');
const mutateButton = document.querySelector('#mutate');
const evolveButton = document.querySelector('#evolve');
const presetToggle = document.querySelector('#preset-toggle');
const presetPanel = document.querySelector('#preset-panel');
const presetClose = document.querySelector('#preset-close');
const readyPresetList = document.querySelector('#ready-presets');
const futurePresetList = document.querySelector('#future-presets');
const robotName = document.querySelector('#robot-name');
const robotRole = document.querySelector('#robot-role');
const presetMessage = document.querySelector('#preset-message');

if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing V7 render canvas.');

const catalogValidation = validateRobotPresetCatalog();
if (!catalogValidation.valid) {
  throw new Error(`Robot preset catalog failed validation: ${catalogValidation.errors.join(' | ')}`);
}

const requestedPresetId = new URLSearchParams(location.search).get('robot');
let activePreset = getRobotPreset(requestedPresetId) ?? getRobotPreset(DEFAULT_ROBOT_PRESET_ID);
if (!activePreset) throw new Error('Default robot preset is missing.');

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
let switchingPreset = false;
let lastFrame = performance.now();
let fpsWindowStart = lastFrame;
let fpsFrames = 0;
let fps = 0;
let stableTimer = 0;

function updateDashboard() {
  if (!runtime || !renderer) return;
  dashboard.updateRuntime({ runtime, renderer, fps, coordinator });
}

function resetResearchState(preset) {
  coordinator.enabled = false;
  coordinator.lastResult = null;
  coordinator.lastInsertion = null;
  archive.reset((0x4d415045 ^ preset.controllerGenome.seed) >>> 0);
  experiment.generation = 0;
  experiment.reset(runtime);
  evolveButton?.setAttribute('aria-pressed', 'false');
  if (evolveButton) evolveButton.textContent = 'Evolve';
}

function updatePresetIdentity() {
  if (robotName) robotName.textContent = activePreset.name;
  if (robotRole) robotRole.textContent = activePreset.role;
  document.querySelectorAll('[data-preset-id]').forEach((element) => {
    const active = element.dataset.presetId === activePreset.id;
    element.toggleAttribute('data-active', active);
    if (element instanceof HTMLButtonElement) element.setAttribute('aria-pressed', String(active));
  });
}

function setPresetPanel(open) {
  if (!presetPanel || !presetToggle) return;
  presetPanel.dataset.open = String(open);
  presetPanel.setAttribute('aria-hidden', String(!open));
  presetToggle.setAttribute('aria-expanded', String(open));
  presetToggle.textContent = open ? 'Close' : 'Robots';
}

function createPresetCard(preset) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'preset-card';
  button.dataset.presetId = preset.id;
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `
    <span class="preset-card-top"><b>${preset.name}</b><small>RUNS NOW</small></span>
    <strong>${preset.role}</strong>
    <span>${preset.description}</span>
    <em>${preset.hardware}</em>
  `;
  return button;
}

function createBlockedPresetCard(preset) {
  const article = document.createElement('article');
  article.className = 'preset-card preset-card-blocked';
  article.dataset.presetId = preset.id;
  article.setAttribute('aria-disabled', 'true');
  article.innerHTML = `
    <span class="preset-card-top"><b>${preset.name}</b><small>NEEDS ENGINE</small></span>
    <strong>${preset.role}</strong>
    <span>${preset.description}</span>
    <em>${preset.blocker}</em>
  `;
  return article;
}

function renderPresetCatalog() {
  readyPresetList?.replaceChildren(...READY_ROBOT_PRESETS.map(createPresetCard));
  futurePresetList?.replaceChildren(...FUTURE_ROBOT_PRESETS.map(createBlockedPresetCard));
  updatePresetIdentity();
}

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

  if (switchingPreset || !runtime || !renderer) {
    requestAnimationFrame(animate);
    return;
  }

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

async function buildPresetWorld(preset) {
  const nextRuntime = await MujocoScienceRuntime.create({
    morphology: preset.morphology,
    controllerGenome: preset.controllerGenome,
    presetId: preset.id,
    batteryJoules: preset.batteryJoules,
  });

  try {
    const nextRenderer = await BabylonMujocoRenderer.create(canvas, nextRuntime);
    await applyProductionArtDirection(nextRenderer);
    installAllLegConnectivity(nextRenderer);
    return { runtime: nextRuntime, renderer: nextRenderer };
  } catch (error) {
    nextRuntime.dispose();
    throw error;
  }
}

async function activatePreset(preset, { initial = false } = {}) {
  if (!preset || preset.status !== 'ready' || switchingPreset) return;
  if (!initial && activePreset.id === preset.id) {
    setPresetPanel(false);
    return;
  }

  const previousPreset = activePreset;
  switchingPreset = true;
  if (presetMessage) presetMessage.textContent = `Building ${preset.name} with MuJoCo…`;
  dashboard.setBoot(`Building ${preset.name}…`);
  runtime?.setPaused(true);
  coordinator.enabled = false;

  renderer?.dispose();
  runtime?.dispose();
  renderer = null;
  runtime = null;

  try {
    const world = await buildPresetWorld(preset);
    runtime = world.runtime;
    renderer = world.renderer;
    activePreset = preset;
    resetResearchState(preset);
    updatePresetIdentity();
    pauseButton.textContent = 'Pause';
    pauseButton.setAttribute('aria-pressed', 'false');
    stableTimer = 0;
    fps = 0;
    fpsFrames = 0;
    fpsWindowStart = performance.now();
    const url = new URL(location.href);
    url.searchParams.set('robot', preset.id);
    history.replaceState(null, '', url);
    if (presetMessage) presetMessage.textContent = `${preset.name} is active. Its body, motors and gait were rebuilt.`;
    setPresetPanel(false);
    updateDashboard();
    navigator.vibrate?.([16, 24, 16]);
  } catch (error) {
    console.error(`Robot preset ${preset.id} failed`, error);
    let recovered = false;
    if (!initial && previousPreset) {
      try {
        const fallback = await buildPresetWorld(previousPreset);
        runtime = fallback.runtime;
        renderer = fallback.renderer;
        activePreset = previousPreset;
        resetResearchState(previousPreset);
        updatePresetIdentity();
        recovered = true;
      } catch (recoveryError) {
        console.error('Previous robot preset recovery failed', recoveryError);
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    if (presetMessage) {
      presetMessage.textContent = recovered
        ? `${preset.name} failed validation. ${previousPreset.name} was restored.`
        : `${preset.name} failed and the simulator stopped: ${message}`;
    }
    if (recovered) updateDashboard();
    else dashboard.setFailure(message);
  } finally {
    switchingPreset = false;
    lastFrame = performance.now();
  }
}

function installControls() {
  pauseButton.addEventListener('click', () => {
    if (!runtime || switchingPreset) return;
    runtime.setPaused(!runtime.paused);
    pauseButton.textContent = runtime.paused ? 'Resume' : 'Pause';
    pauseButton.setAttribute('aria-pressed', String(runtime.paused));
  });

  resetButton.addEventListener('click', () => {
    if (!runtime || switchingPreset) return;
    runtime.reset();
    experiment.reset(runtime);
    pauseButton.textContent = 'Pause';
    pauseButton.setAttribute('aria-pressed', 'false');
    runtime.setPaused(false);
    stableTimer = 0;
    updateDashboard();
  });

  mutateButton.addEventListener('click', () => {
    if (!runtime || switchingPreset) return;
    const nextGenome = mutateGenome(
      runtime.controller.genome,
      (runtime.controller.genome.seed + 0x9e3779b9 + experiment.generation) >>> 0,
    );
    runtime.reset();
    runtime.controller.setGenome(nextGenome);
    runtime.captureStableSnapshot();
    experiment.reset(runtime);
    navigator.vibrate?.(24);
    if (presetMessage) presetMessage.textContent = `${activePreset.name} received one bounded gait variation.`;
    updateDashboard();
  });

  evolveButton.addEventListener('click', () => {
    if (!runtime || switchingPreset) return;
    coordinator.setEnabled(!coordinator.enabled, runtime);
    evolveButton.setAttribute('aria-pressed', String(coordinator.enabled));
    evolveButton.textContent = coordinator.enabled ? 'Evolving' : 'Evolve';
    navigator.vibrate?.(coordinator.enabled ? [20, 35, 20] : 20);
    updateDashboard();
  });

  presetToggle?.addEventListener('click', () => {
    setPresetPanel(presetPanel?.dataset.open !== 'true');
  });
  presetClose?.addEventListener('click', () => setPresetPanel(false));
  readyPresetList?.addEventListener('click', (event) => {
    const button = event.target instanceof Element
      ? event.target.closest('button[data-preset-id]')
      : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const preset = getRobotPreset(button.dataset.presetId);
    void activatePreset(preset);
  });
}

async function boot() {
  try {
    renderPresetCatalog();
    installControls();
    dashboard.setBoot('Loading the mobile robot world…');
    await activatePreset(activePreset, { initial: true });

    window.__NEXUS_V7__ = Object.freeze({
      get runtime() { return runtime; },
      get renderer() { return renderer; },
      get activePreset() { return activePreset; },
      readyPresets: READY_ROBOT_PRESETS,
      futurePresets: FUTURE_ROBOT_PRESETS,
      activatePreset: (id) => activatePreset(getRobotPreset(id)),
      archive,
      experiment,
      coordinator,
      evaluation: Object.freeze({
        timeScale: EVOLUTION_TIME_SCALE,
        maximumBudgetSeconds: EVOLUTION_MAX_BUDGET_SECONDS,
        batchSeconds: SCIENCE_BATCH_SECONDS,
      }),
      realismCycle: Object.freeze({
        cycle: 1,
        increment: 2,
        target: 'all-six-leg authoritative connectivity',
        legCount: 6,
        connectivitySchema: 'nexus.all-leg-connectivity.v2',
      }),
      productCycle: Object.freeze({
        cycle: 2,
        increment: 1,
        target: 'mobile robot garage presets',
        readyPresetCount: READY_ROBOT_PRESETS.length,
        blockedPresetCount: FUTURE_ROBOT_PRESETS.length,
        presetSchema: 'nexus.robot-preset.v1',
      }),
      schema: 'nexus.science-runtime.v1',
    });

    window.addEventListener('pagehide', dispose, { once: true });
    window.addEventListener('beforeunload', dispose, { once: true });
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
