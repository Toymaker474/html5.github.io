import { Vector3 } from '@babylonjs/core';
import { mutateGenome } from './controller.js';

const CONTROL_IDS = Object.freeze(['pause', 'reset', 'mutate', 'evolve']);
const COMMAND_TIMEOUT_MS = 60000;
const READY_TIMEOUT_MS = 120000;
const LEDGER_LIMIT = 40;

let installed = false;
let commandSequence = 0;
let commandChain = Promise.resolve();
let activeCommand = null;
let configuredRenderer = null;
let latestFrameRate = 0;
let frameWindowStart = performance.now();
let frameWindowCount = 0;
const ledger = [];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function control(id) {
  const element = document.querySelector(`#${id}`);
  return element instanceof HTMLButtonElement ? element : null;
}

function allControls() {
  return CONTROL_IDS.map(control).filter(Boolean);
}

function installOperationalPresentation() {
  if (document.querySelector('#nexus-operational-style')) return;

  const style = document.createElement('style');
  style.id = 'nexus-operational-style';
  style.textContent = `
    #tool-receipt {
      position: fixed;
      left: 50%;
      bottom: max(79px, calc(env(safe-area-inset-bottom) + 70px));
      transform: translateX(-50%);
      width: min(394px, calc(100vw - 20px));
      min-height: 42px;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 9px;
      padding: 8px 11px;
      border: 1px solid rgba(240, 241, 237, .24);
      border-radius: 11px;
      background: rgba(9, 12, 12, .94);
      box-shadow: 0 8px 26px rgba(0, 0, 0, .42);
      color: #eef0ec;
      font: 650 9px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      pointer-events: none;
      z-index: 6;
    }
    #tool-receipt strong {
      min-width: 60px;
      color: #a4aaa6;
      font-size: 8px;
      letter-spacing: .08em;
    }
    #tool-receipt span { min-width: 0; overflow-wrap: anywhere; }
    #tool-receipt[data-state="running"] { border-color: #e7bd67; }
    #tool-receipt[data-state="running"] strong { color: #e7bd67; }
    #tool-receipt[data-state="pass"] { border-color: #83c99a; }
    #tool-receipt[data-state="pass"] strong { color: #83c99a; }
    #tool-receipt[data-state="fail"] { border-color: #e76442; }
    #tool-receipt[data-state="fail"] strong { color: #e76442; }
    #controls button:disabled {
      opacity: .48;
      cursor: wait;
    }
    #controls button[data-command-active="true"] {
      opacity: 1;
      box-shadow: inset 0 0 0 1px #e7bd67;
      color: #e7bd67;
    }
  `;
  document.head.append(style);

  const receipt = document.createElement('section');
  receipt.id = 'tool-receipt';
  receipt.dataset.state = 'running';
  receipt.setAttribute('role', 'status');
  receipt.setAttribute('aria-live', 'polite');
  receipt.innerHTML = '<strong>TOOLS BOOT</strong><span>Waiting for authoritative MuJoCo state…</span>';
  document.body.append(receipt);
}

function setReceipt(state, title, message) {
  const receipt = document.querySelector('#tool-receipt');
  if (!(receipt instanceof HTMLElement)) return;
  receipt.dataset.state = state;
  receipt.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = title;
  const detail = document.createElement('span');
  detail.textContent = message;
  receipt.append(heading, detail);
}

function updateControlLabels(runtime = null, coordinator = null) {
  const pause = control('pause');
  const reset = control('reset');
  const mutate = control('mutate');
  const evolve = control('evolve');

  if (pause) {
    pause.textContent = runtime?.paused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-pressed', String(Boolean(runtime?.paused)));
  }
  if (reset) reset.textContent = 'Reset world';
  if (mutate) mutate.textContent = 'Mutate gait';
  if (evolve) {
    evolve.textContent = coordinator?.enabled ? 'Evolving ×1' : 'Evolve ×1';
    evolve.setAttribute('aria-pressed', String(Boolean(coordinator?.enabled)));
  }
}

function setControlsBusy(busy, activeId = null) {
  for (const button of allControls()) {
    button.disabled = Boolean(busy);
    button.dataset.commandActive = String(Boolean(busy && button.id === activeId));
  }
}

function currentNexus() {
  const nexus = window.__NEXUS_V7__;
  if (!nexus?.runtime || !nexus?.renderer || !nexus?.coordinator || !nexus?.experiment) return null;
  return nexus;
}

async function waitForNexus(timeoutMilliseconds = READY_TIMEOUT_MS) {
  const started = performance.now();
  while (performance.now() - started < timeoutMilliseconds) {
    const nexus = currentNexus();
    if (nexus) return nexus;
    const status = document.querySelector('#status')?.textContent || '';
    if (status.includes('FAIL-CLOSED')) throw new Error(status.replace(/\s+/g, ' ').trim());
    await sleep(40);
  }
  throw new Error('MuJoCo runtime did not become operational before the safety timeout.');
}

function installFunctionalRendererProfile(renderer) {
  if (!renderer || renderer === configuredRenderer) return;
  configuredRenderer = renderer;

  renderer.updateFollowCamera = function updateFollowCameraWithoutRadiusMutation() {
    const position = this.runtime.rootPosition;
    const authoritativeTarget = new Vector3(
      position.x,
      Math.max(0.18, position.z - 0.12),
      -position.y,
    );
    this.followTarget = Vector3.Lerp(this.followTarget, authoritativeTarget, 0.09);
    this.camera.target.copyFrom(this.followTarget);
  };

  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const devicePixelRatio = Number(window.devicePixelRatio || 1);
  if (mobile) {
    renderer.scene.shadowsEnabled = false;
    const shadowMap = renderer.shadowGenerator?.getShadowMap?.();
    if (shadowMap) shadowMap.renderList = [];
    renderer.scene.skipPointerMovePicking = true;
    renderer.camera.inertia = Math.min(renderer.camera.inertia, 0.38);

    if (devicePixelRatio > 1.5) {
      const currentScaling = Number(renderer.engine.getHardwareScalingLevel?.() || 1);
      const functionalScaling = Math.max(currentScaling, Math.min(3, devicePixelRatio));
      renderer.engine.setHardwareScalingLevel(functionalScaling);
      renderer.engine.resize();
    }

    for (const [name, material] of Object.entries(renderer.materials || {})) {
      if (name === 'cadSignal') continue;
      material?.freeze?.();
    }
  }

  renderer.performanceProfile = Object.freeze({
    schema: 'nexus.functional-render-profile.v1',
    mobile,
    shadowsEnabled: renderer.scene.shadowsEnabled !== false,
    hardwareScalingLevel: Number(renderer.engine.getHardwareScalingLevel?.() || 1),
    radiusSafeFollow: true,
    configuredAt: performance.now(),
  });
}

function summarizeRuntime(runtime) {
  return Object.freeze({
    presetId: runtime.presetId,
    paused: Boolean(runtime.paused),
    simulationTime: Number(runtime.data?.time || 0),
    controllerSeed: Number(runtime.controller?.genome?.seed || 0),
    displacement: Number(runtime.planarDisplacement || 0),
    batteryJoules: Number(runtime.batteryJoules || 0),
  });
}

function appendLedger(entry) {
  ledger.push(Object.freeze(entry));
  while (ledger.length > LEDGER_LIMIT) ledger.shift();
}

async function waitForCondition(predicate, timeoutMilliseconds, failureMessage) {
  const started = performance.now();
  while (performance.now() - started < timeoutMilliseconds) {
    const value = predicate();
    if (value) return value;
    const status = document.querySelector('#status')?.textContent || '';
    if (status.includes('FAIL-CLOSED')) throw new Error(status.replace(/\s+/g, ' ').trim());
    await sleep(50);
  }
  throw new Error(failureMessage);
}

async function commandPause(nexus) {
  const runtime = nexus.runtime;
  const before = Boolean(runtime.paused);
  runtime.setPaused(!before);
  if (runtime.paused === before) throw new Error('Pause state did not change.');
  updateControlLabels(runtime, nexus.coordinator);
  return runtime.paused ? 'MuJoCo clock paused.' : 'MuJoCo clock resumed.';
}

async function commandReset(nexus) {
  const { runtime, coordinator, experiment } = nexus;
  coordinator.setEnabled(false, runtime);
  runtime.setPaused(true);
  runtime.reset();
  experiment.reset(runtime);
  runtime.setPaused(false);

  if (Math.abs(Number(runtime.data.time || 0)) > runtime.fixedStep * 1.5) {
    runtime.setPaused(true);
    throw new Error(`Reset verification failed at t=${Number(runtime.data.time || 0).toFixed(4)} s.`);
  }
  if (Math.abs(runtime.batteryJoules - runtime.maxBatteryJoules) > 1e-6) {
    runtime.setPaused(true);
    throw new Error('Reset verification failed to restore the battery state.');
  }
  updateControlLabels(runtime, coordinator);
  return 'World rebuilt at t=0 with full battery and odometry reset.';
}

async function commandMutate(nexus) {
  const { runtime, coordinator, experiment } = nexus;
  const wasPaused = runtime.paused;
  const beforeGenome = structuredClone(runtime.controller.genome);
  const beforeSignature = JSON.stringify(beforeGenome);
  const mutationSeed = (Number(beforeGenome.seed || 0) + 0x9e3779b9 + experiment.generation + commandSequence) >>> 0;
  const nextGenome = mutateGenome(beforeGenome, mutationSeed);

  coordinator.setEnabled(false, runtime);
  runtime.setPaused(true);
  runtime.reset();
  runtime.controller.setGenome(nextGenome);
  runtime.captureStableSnapshot();
  experiment.reset(runtime);
  runtime.setPaused(wasPaused);

  const afterSignature = JSON.stringify(runtime.controller.genome);
  if (beforeSignature === afterSignature) {
    runtime.setPaused(true);
    throw new Error('Mutation produced no controller-state change.');
  }
  updateControlLabels(runtime, coordinator);
  return `Gait changed: seed ${beforeGenome.seed} → ${runtime.controller.genome.seed}.`;
}

async function commandEvolveOne(nexus) {
  const { runtime, coordinator, experiment } = nexus;
  const wasPaused = runtime.paused;
  const startingGeneration = experiment.generation;

  runtime.setPaused(false);
  coordinator.setEnabled(true, runtime);
  updateControlLabels(runtime, coordinator);

  try {
    await waitForCondition(
      () => experiment.generation > startingGeneration && coordinator.lastResult,
      COMMAND_TIMEOUT_MS,
      `Evolution did not finish generation ${startingGeneration} before the timeout.`,
    );
  } finally {
    coordinator.setEnabled(false, runtime);
    runtime.setPaused(wasPaused);
    updateControlLabels(runtime, coordinator);
  }

  const result = coordinator.lastResult;
  if (!result || result.generation !== startingGeneration) {
    throw new Error('Evolution completed without an authoritative result record.');
  }
  return `Generation ${startingGeneration} complete · fitness ${Number(result.fitness).toFixed(3)}.`;
}

async function executeCommand(commandId, sequence, queuedAt) {
  const startedAt = performance.now();
  activeCommand = Object.freeze({ commandId, sequence, queuedAt, startedAt });
  setControlsBusy(true, commandId);
  setReceipt('running', `TOOL ${sequence}`, `${commandId.toUpperCase()} running against MuJoCo…`);
  await nextPaint();

  let nexus = null;
  let before = null;
  try {
    nexus = await waitForNexus();
    installFunctionalRendererProfile(nexus.renderer);
    before = summarizeRuntime(nexus.runtime);

    let detail;
    if (commandId === 'pause') detail = await commandPause(nexus);
    else if (commandId === 'reset') detail = await commandReset(nexus);
    else if (commandId === 'mutate') detail = await commandMutate(nexus);
    else if (commandId === 'evolve') detail = await commandEvolveOne(nexus);
    else throw new Error(`Unknown operational command: ${commandId}.`);

    const endedAt = performance.now();
    const after = summarizeRuntime(nexus.runtime);
    appendLedger({
      schema: 'nexus.tool-receipt.v1',
      sequence,
      commandId,
      status: 'pass',
      queuedAt,
      startedAt,
      endedAt,
      inputLatencyMs: startedAt - queuedAt,
      durationMs: endedAt - startedAt,
      before,
      after,
      detail,
    });
    setReceipt('pass', `PASS ${sequence}`, detail);
  } catch (error) {
    const endedAt = performance.now();
    const message = error instanceof Error ? error.message : String(error);
    nexus?.runtime?.setPaused?.(true);
    nexus?.coordinator?.setEnabled?.(false, nexus.runtime);
    appendLedger({
      schema: 'nexus.tool-receipt.v1',
      sequence,
      commandId,
      status: 'fail',
      queuedAt,
      startedAt,
      endedAt,
      inputLatencyMs: startedAt - queuedAt,
      durationMs: endedAt - startedAt,
      before,
      after: nexus?.runtime ? summarizeRuntime(nexus.runtime) : null,
      error: message,
    });
    setReceipt('fail', `FAIL ${sequence}`, message);
    console.error(`NEXUS operational command ${commandId} failed closed`, error);
  } finally {
    activeCommand = null;
    const current = currentNexus();
    updateControlLabels(current?.runtime, current?.coordinator);
    setControlsBusy(!current, null);
  }
}

function enqueueCommand(commandId) {
  const sequence = ++commandSequence;
  const queuedAt = performance.now();
  commandChain = commandChain.then(
    () => executeCommand(commandId, sequence, queuedAt),
    () => executeCommand(commandId, sequence, queuedAt),
  );
  return commandChain;
}

function installControlCapture() {
  const controls = document.querySelector('#controls');
  if (!(controls instanceof HTMLElement) || controls.dataset.operationalCore === 'true') return;
  controls.dataset.operationalCore = 'true';

  controls.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!(target instanceof HTMLButtonElement) || !CONTROL_IDS.includes(target.id)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (target.disabled || activeCommand) return;
    void enqueueCommand(target.id);
  }, true);
}

function monitorOperationalState() {
  frameWindowCount += 1;
  const now = performance.now();
  if (now - frameWindowStart >= 1000) {
    latestFrameRate = frameWindowCount * 1000 / (now - frameWindowStart);
    frameWindowStart = now;
    frameWindowCount = 0;
  }

  const nexus = currentNexus();
  if (nexus) {
    installFunctionalRendererProfile(nexus.renderer);
    if (!activeCommand) {
      setControlsBusy(false, null);
      updateControlLabels(nexus.runtime, nexus.coordinator);
      const receipt = document.querySelector('#tool-receipt');
      if (receipt instanceof HTMLElement && receipt.dataset.state === 'running' && commandSequence === 0) {
        setReceipt('pass', 'TOOLS READY', 'Pause · Reset world · Mutate gait · Evolve ×1');
      }
    }
  } else if (!activeCommand) {
    setControlsBusy(true, null);
  }

  requestAnimationFrame(monitorOperationalState);
}

export function installOperationalCore() {
  if (installed) return;
  installed = true;
  installOperationalPresentation();
  installControlCapture();
  setControlsBusy(true, null);

  const publicState = {};
  Object.defineProperties(publicState, {
    schema: { value: 'nexus.operational-core.v1', enumerable: true },
    activeCommand: { get: () => activeCommand, enumerable: true },
    latestFrameRate: { get: () => latestFrameRate, enumerable: true },
    ledger: { get: () => Object.freeze([...ledger]), enumerable: true },
    configuredRenderer: { get: () => configuredRenderer, enumerable: false },
  });
  window.__NEXUS_OPERATIONAL__ = Object.freeze(publicState);

  requestAnimationFrame(monitorOperationalState);
}
