import { installWorldCourseVisuals } from './worldCourseVisuals.js';
import { MISSION_DISTANCE_METRES, WORLD_COURSE_OBSTACLES } from './worldCourseData.js';

const DRIVE_MODES = Object.freeze({
  left: Object.freeze({ mode: 'left', throttle: 0.72, turn: 0.82, label: 'Turning left' }),
  walk: Object.freeze({ mode: 'walk', throttle: 1, turn: 0, label: 'Walking forward' }),
  stop: Object.freeze({ mode: 'stop', throttle: 0, turn: 0, label: 'Holding position' }),
  right: Object.freeze({ mode: 'right', throttle: 0.72, turn: -0.82, label: 'Turning right' }),
});

const ledger = [];
let installed = false;
let ready = false;
let activeMode = 'walk';
let activeRenderer = null;
let activeRuntime = null;
let sequence = 0;
let actionChain = Promise.resolve();
let lastUiUpdate = 0;
let missionComplete = false;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function nexus() {
  const value = window.__NEXUS_V7__;
  return value?.runtime && value?.renderer ? value : null;
}

function appendReceipt(action, status, detail, before = null, after = null) {
  const receipt = Object.freeze({
    schema: 'nexus.robot-world-action-receipt.v1',
    sequence: ++sequence,
    action,
    status,
    detail,
    simulationTime: Number(nexus()?.runtime?.data?.time || 0),
    before,
    after,
    recordedAt: performance.now(),
  });
  ledger.push(receipt);
  while (ledger.length > 48) ledger.shift();
  return receipt;
}

function setToast(state, title, detail) {
  const toast = document.querySelector('#world-action-toast');
  if (!(toast instanceof HTMLElement)) return;
  toast.dataset.state = state;
  const heading = toast.querySelector('strong');
  const message = toast.querySelector('span');
  if (heading) heading.textContent = title;
  if (message) message.textContent = detail;
}

function installPresentation() {
  const style = document.createElement('style');
  style.id = 'nexus-mobile-world-style';
  style.textContent = `
    #identity, #top-actions, #controls { display: none !important; }
    #tool-receipt { opacity: 0; transform: translate(-50%, 12px); transition: opacity 140ms ease, transform 140ms ease; }
    #tool-receipt[data-state="fail"] { opacity: 1; transform: translate(-50%, 0); bottom: 142px; }

    #world-hud {
      position: fixed;
      top: max(12px, env(safe-area-inset-top));
      left: max(12px, env(safe-area-inset-left));
      right: max(12px, env(safe-area-inset-right));
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      pointer-events: none;
      z-index: 5;
    }
    #world-card {
      min-width: 0;
      max-width: 340px;
      padding: 11px 12px;
      border: 1px solid rgba(238, 241, 236, .20);
      border-radius: 14px;
      background: rgba(8, 12, 12, .83);
      box-shadow: 0 10px 34px rgba(0, 0, 0, .36);
      backdrop-filter: blur(12px);
    }
    #world-kicker {
      color: #7ee2bd;
      font: 800 9px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .12em;
    }
    #world-robot-name {
      margin-top: 4px;
      color: #f3f5f1;
      font: 760 20px/1.05 Inter, ui-sans-serif, -apple-system, sans-serif;
      letter-spacing: -.025em;
    }
    #world-mission {
      margin-top: 5px;
      color: #c1c8c3;
      font: 580 10px/1.35 Inter, ui-sans-serif, -apple-system, sans-serif;
    }
    #world-progress-track {
      height: 5px;
      margin-top: 9px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255,255,255,.10);
    }
    #world-progress-fill {
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #59a98d, #a6edc8);
      transition: width 180ms ease;
    }
    #world-stats {
      display: flex;
      gap: 8px;
      margin-top: 7px;
      color: #9ea7a1;
      font: 680 8px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: nowrap;
    }
    #world-panel-buttons {
      display: grid;
      gap: 7px;
      pointer-events: auto;
    }
    #world-panel-buttons button {
      min-width: 62px;
      min-height: 44px;
      border: 1px solid rgba(238,241,236,.24);
      border-radius: 12px;
      background: rgba(8,12,12,.88);
      color: #eef1ec;
      font: 760 10px/1 Inter, ui-sans-serif, -apple-system, sans-serif;
      touch-action: manipulation;
    }

    #world-action-toast {
      position: fixed;
      left: 50%;
      bottom: max(140px, calc(env(safe-area-inset-bottom) + 132px));
      transform: translateX(-50%);
      width: min(400px, calc(100vw - 20px));
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      min-height: 36px;
      padding: 7px 10px;
      border: 1px solid rgba(238,241,236,.18);
      border-radius: 11px;
      background: rgba(8,12,12,.88);
      color: #eef1ec;
      font: 650 9px/1.25 ui-monospace, SFMono-Regular, Menlo, monospace;
      pointer-events: none;
      z-index: 6;
    }
    #world-action-toast strong { color: #83c99a; font-size: 8px; letter-spacing: .07em; }
    #world-action-toast[data-state="running"] strong { color: #e7bd67; }
    #world-action-toast[data-state="fail"] { border-color: #e76442; }
    #world-action-toast[data-state="fail"] strong { color: #e76442; }

    #world-drive-deck {
      position: fixed;
      left: 50%;
      right: auto;
      bottom: max(8px, env(safe-area-inset-bottom));
      transform: translateX(-50%);
      width: min(410px, calc(100vw - 16px));
      display: grid;
      gap: 6px;
      padding: 6px;
      border: 1px solid rgba(238,241,236,.20);
      border-radius: 16px;
      background: rgba(8,12,12,.93);
      box-shadow: 0 14px 44px rgba(0,0,0,.48);
      backdrop-filter: blur(14px);
      z-index: 7;
    }
    .world-control-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    #world-drive-deck button {
      min-height: 50px;
      padding: 0 5px;
      border: 0;
      border-radius: 10px;
      background: #19201e;
      color: #eef1ec;
      font: 760 10px/1.05 Inter, ui-sans-serif, -apple-system, sans-serif;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    #world-drive-deck button:active { transform: translateY(1px); background: #252e2b; }
    #world-drive-deck button[data-active="true"] {
      box-shadow: inset 0 0 0 1px #75d8b5;
      color: #a9f0d1;
      background: #163128;
    }
    #world-drive-deck button:disabled { opacity: .48; }
    #world-drive-deck .secondary button { min-height: 42px; color: #bec6c1; font-size: 9px; }

    #research-panel { z-index: 12; }
    #preset-backdrop { z-index: 13; }
    #preset-panel { z-index: 14; }

    @media (max-width: 360px) {
      #world-card { padding: 9px 10px; }
      #world-robot-name { font-size: 17px; }
      #world-mission { font-size: 9px; }
      #world-stats { gap: 5px; font-size: 7px; }
      #world-drive-deck button { font-size: 9px; }
    }
  `;
  document.head.append(style);

  const hud = document.createElement('section');
  hud.id = 'world-hud';
  hud.innerHTML = `
    <div id="world-card">
      <div id="world-kicker">NEXUS ROBOT WORLD · REAL MUJOCO</div>
      <div id="world-robot-name">Loading robot…</div>
      <div id="world-mission">Mission: walk beyond the green ring and steer around the physical blocks.</div>
      <div id="world-progress-track"><div id="world-progress-fill"></div></div>
      <div id="world-stats"><span id="world-distance">0.00 / ${MISSION_DISTANCE_METRES.toFixed(2)} m</span><span id="world-feet">0/6 feet</span><span id="world-backend">booting</span></div>
    </div>
    <div id="world-panel-buttons">
      <button id="world-robots" type="button">Robots</button>
      <button id="world-data" type="button">Data</button>
    </div>
  `;

  const toast = document.createElement('section');
  toast.id = 'world-action-toast';
  toast.dataset.state = 'running';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = '<strong>WORLD BOOT</strong><span>Building the authoritative robot and course…</span>';

  const deck = document.createElement('nav');
  deck.id = 'world-drive-deck';
  deck.setAttribute('aria-label', 'Robot world controls');
  deck.innerHTML = `
    <div class="world-control-row primary">
      <button id="world-left" type="button">↶ Left</button>
      <button id="world-walk" type="button" data-active="true">Walk</button>
      <button id="world-stop" type="button">Stop</button>
      <button id="world-right" type="button">Right ↷</button>
    </div>
    <div class="world-control-row secondary">
      <button id="world-reset" type="button">Reset</button>
      <button id="world-mutate" type="button">Mutate gait</button>
      <button id="world-train" type="button">Train ×1</button>
      <button id="world-center" type="button">Center view</button>
    </div>
  `;

  document.body.append(hud, toast, deck);
}

function setDriveSelection(mode) {
  for (const candidate of Object.keys(DRIVE_MODES)) {
    const button = document.querySelector(`#world-${candidate}`);
    if (button instanceof HTMLButtonElement) button.dataset.active = String(candidate === mode);
  }
}

function controllerSnapshot(runtime) {
  const command = runtime.controller?.driveCommand;
  return command ? {
    mode: command.mode,
    throttle: command.throttle,
    turn: command.turn,
    revision: command.revision,
  } : null;
}

async function applyDrive(mode) {
  const current = nexus();
  const command = DRIVE_MODES[mode];
  if (!current || !command || typeof current.runtime.controller?.setDriveCommand !== 'function') {
    throw new Error('Authoritative drive controller is unavailable.');
  }

  const before = controllerSnapshot(current.runtime);
  const next = current.runtime.controller.setDriveCommand(command);
  current.runtime.setPaused(false);
  if (next.mode !== command.mode || next.revision <= Number(before?.revision ?? -1)) {
    throw new Error(`${mode} command did not change controller authority.`);
  }

  activeMode = mode;
  setDriveSelection(mode);
  appendReceipt(mode, 'pass', command.label, before, controllerSnapshot(current.runtime));
  setToast('pass', mode.toUpperCase(), `${command.label} · actuator command ${next.revision}`);
  navigator.vibrate?.(mode === 'stop' ? 14 : 9);
}

async function resetWorld() {
  const current = nexus();
  if (!current) throw new Error('MuJoCo world is unavailable.');
  const { runtime, coordinator, experiment } = current;
  const before = {
    simulationTime: Number(runtime.data.time),
    batteryJoules: runtime.batteryJoules,
    drive: controllerSnapshot(runtime),
  };

  coordinator.setEnabled(false, runtime);
  runtime.setPaused(true);
  runtime.reset();
  experiment.reset(runtime);
  runtime.controller.setDriveCommand(DRIVE_MODES.stop);
  runtime.setPaused(false);

  const validTime = Math.abs(Number(runtime.data.time)) <= runtime.fixedStep * 1.5;
  const validBattery = Math.abs(runtime.batteryJoules - runtime.maxBatteryJoules) <= 1e-6;
  if (!validTime || !validBattery) {
    runtime.setPaused(true);
    throw new Error('Reset failed authoritative time or battery verification.');
  }

  activeMode = 'stop';
  missionComplete = false;
  setDriveSelection('stop');
  appendReceipt('reset', 'pass', 'World reset to the verified spawn state.', before, {
    simulationTime: Number(runtime.data.time),
    batteryJoules: runtime.batteryJoules,
    drive: controllerSnapshot(runtime),
  });
  setToast('pass', 'RESET', 'World, battery, odometry and controller returned to spawn.');
  navigator.vibrate?.([12, 20, 12]);
}

async function waitForOperationalReceipt(commandId, previousSequence, timeoutMilliseconds) {
  const started = performance.now();
  while (performance.now() - started < timeoutMilliseconds) {
    const rows = window.__NEXUS_OPERATIONAL__?.ledger || [];
    const row = rows.find((candidate) => candidate.sequence > previousSequence && candidate.commandId === commandId);
    if (row?.status === 'pass') return row;
    if (row?.status === 'fail') throw new Error(row.error || `${commandId} failed.`);
    await sleep(60);
  }
  throw new Error(`${commandId} did not finish before the safety timeout.`);
}

async function runOperationalTool(commandId, title, timeoutMilliseconds = 70000) {
  const source = document.querySelector(`#${commandId}`);
  if (!(source instanceof HTMLButtonElement) || source.disabled) {
    throw new Error(`${title} tool is not ready.`);
  }
  const rows = window.__NEXUS_OPERATIONAL__?.ledger || [];
  const previousSequence = rows.at(-1)?.sequence || 0;
  source.click();
  const receipt = await waitForOperationalReceipt(commandId, previousSequence, timeoutMilliseconds);
  appendReceipt(commandId, 'pass', receipt.detail, receipt.before, receipt.after);
  setToast('pass', title, receipt.detail);
  return receipt;
}

async function centerCamera() {
  const current = nexus();
  const camera = current?.renderer?.camera;
  if (!camera) throw new Error('Robot camera is unavailable.');
  camera.alpha = -Math.PI / 2.28;
  camera.beta = 1.03;
  camera.inertialAlphaOffset = 0;
  camera.inertialBetaOffset = 0;
  camera.inertialRadiusOffset = 0;
  const fitted = current.renderer.mobileCameraFit?.fittedRadius;
  if (Number.isFinite(fitted)) camera.radius = fitted;
  appendReceipt('center', 'pass', 'Camera returned to the verified full-body view.');
  setToast('pass', 'CENTERED', 'Camera returned to the verified full-body view.');
}

function enqueue(label, action) {
  setToast('running', label, 'Checking authoritative state…');
  actionChain = actionChain.then(action, action).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    appendReceipt(label.toLowerCase(), 'fail', message);
    setToast('fail', `${label} FAILED`, message);
    nexus()?.runtime?.setPaused?.(true);
  });
  return actionChain;
}

function installInteractions() {
  document.querySelector('#world-left')?.addEventListener('click', () => void enqueue('LEFT', () => applyDrive('left')));
  document.querySelector('#world-walk')?.addEventListener('click', () => void enqueue('WALK', () => applyDrive('walk')));
  document.querySelector('#world-stop')?.addEventListener('click', () => void enqueue('STOP', () => applyDrive('stop')));
  document.querySelector('#world-right')?.addEventListener('click', () => void enqueue('RIGHT', () => applyDrive('right')));
  document.querySelector('#world-reset')?.addEventListener('click', () => void enqueue('RESET', resetWorld));
  document.querySelector('#world-mutate')?.addEventListener('click', () => void enqueue('MUTATE', () => runOperationalTool('mutate', 'MUTATED')));
  document.querySelector('#world-train')?.addEventListener('click', () => void enqueue('TRAIN', () => runOperationalTool('evolve', 'TRAINED', 90000)));
  document.querySelector('#world-center')?.addEventListener('click', () => void enqueue('CENTER', centerCamera));
  document.querySelector('#world-robots')?.addEventListener('click', () => document.querySelector('#preset-toggle')?.click());
  document.querySelector('#world-data')?.addEventListener('click', () => document.querySelector('#telemetry-toggle')?.click());
}

function expectedScalingLevel() {
  const ratio = Math.max(1, Number(window.devicePixelRatio || 1));
  return ratio >= 2.5 ? 2 : ratio >= 1.75 ? 1.5 : 1.25;
}

function bindCurrentWorld(current) {
  if (current.renderer !== activeRenderer) {
    activeRenderer = current.renderer;
    const course = installWorldCourseVisuals(current.renderer);
    const scaling = expectedScalingLevel();
    current.renderer.engine.setHardwareScalingLevel(scaling);
    current.renderer.engine.resize();
    current.renderer.worldProductProfile = Object.freeze({
      schema: 'nexus.mobile-robot-world-product.v1',
      mobileFirst: true,
      physicsAuthority: 'MuJoCo 3.10 WASM',
      renderBackend: current.renderer.backend,
      driveAuthority: 'twelve actuator targets',
      courseReady: course.report.ready,
      obstacleCount: course.report.physicsObstacleCount,
      hardwareScalingLevel: scaling,
      researchDashboardDefaultOpen: false,
    });
  }

  if (current.runtime !== activeRuntime) {
    activeRuntime = current.runtime;
    current.runtime.controller.setDriveCommand(DRIVE_MODES[activeMode]);
  }

  const scaling = expectedScalingLevel();
  const actualScaling = Number(current.renderer.engine.getHardwareScalingLevel?.() || 1);
  if (Math.abs(actualScaling - scaling) > 0.01) {
    current.renderer.engine.setHardwareScalingLevel(scaling);
    current.renderer.engine.resize();
  }
  ready = Boolean(current.renderer.worldCourse?.report?.ready) &&
    typeof current.runtime.controller?.setDriveCommand === 'function';
}

function updateHud(current) {
  const runtime = current.runtime;
  const observation = runtime.buildObservation();
  const contacts = observation.footContacts.filter((force) => force > 0.001).length;
  const distance = Number(runtime.planarDisplacement || 0);
  const ratio = clamp(distance / MISSION_DISTANCE_METRES, 0, 1);
  const robotName = document.querySelector('#world-robot-name');
  const mission = document.querySelector('#world-mission');
  const fill = document.querySelector('#world-progress-fill');
  const distanceNode = document.querySelector('#world-distance');
  const feetNode = document.querySelector('#world-feet');
  const backendNode = document.querySelector('#world-backend');

  if (robotName) robotName.textContent = current.activePreset?.name || runtime.presetId;
  if (fill instanceof HTMLElement) fill.style.width = `${(ratio * 100).toFixed(1)}%`;
  if (distanceNode) distanceNode.textContent = `${distance.toFixed(2)} / ${MISSION_DISTANCE_METRES.toFixed(2)} m`;
  if (feetNode) feetNode.textContent = `${contacts}/6 feet`;
  if (backendNode) backendNode.textContent = current.renderer.backend;

  const fallen = runtime.rootPosition.z < 0.22;
  if (mission) {
    if (fallen) mission.textContent = 'Robot down. Reset the world, then steer around the physical blocks.';
    else if (ratio >= 1) mission.textContent = 'Mission complete: the robot crossed the green range under real physics.';
    else mission.textContent = 'Mission: walk beyond the green ring and steer around the physical blocks.';
  }

  if (ratio >= 1 && !missionComplete) {
    missionComplete = true;
    appendReceipt('mission', 'pass', `Travelled ${distance.toFixed(3)} m under MuJoCo authority.`);
    setToast('pass', 'MISSION COMPLETE', `${distance.toFixed(2)} m travelled under real physics.`);
    navigator.vibrate?.([18, 28, 18, 28, 28]);
  }
}

function tick(now) {
  const current = nexus();
  if (current) {
    try {
      bindCurrentWorld(current);
      if (now - lastUiUpdate >= 180) {
        updateHud(current);
        lastUiUpdate = now;
      }
      if (ready && sequence === 0) setToast('pass', 'WORLD READY', `${WORLD_COURSE_OBSTACLES.length} physical obstacles · Walk, steer, mutate or train.`);
    } catch (error) {
      ready = false;
      const message = error instanceof Error ? error.message : String(error);
      setToast('fail', 'WORLD FAILED', message);
      current.runtime.setPaused(true);
    }
  }
  requestAnimationFrame(tick);
}

export function installMobileWorldApp() {
  if (installed) return;
  installed = true;
  installPresentation();
  installInteractions();

  const publicState = {};
  Object.defineProperties(publicState, {
    schema: { value: 'nexus.mobile-robot-world-app.v1', enumerable: true },
    ready: { get: () => ready, enumerable: true },
    activeMode: { get: () => activeMode, enumerable: true },
    missionComplete: { get: () => missionComplete, enumerable: true },
    missionDistanceMetres: { value: MISSION_DISTANCE_METRES, enumerable: true },
    obstacleCount: { value: WORLD_COURSE_OBSTACLES.length, enumerable: true },
    ledger: { get: () => Object.freeze([...ledger]), enumerable: true },
    driveCommand: { get: () => controllerSnapshot(nexus()?.runtime), enumerable: true },
    courseReport: { get: () => nexus()?.renderer?.worldCourse?.report || null, enumerable: true },
    productProfile: { get: () => nexus()?.renderer?.worldProductProfile || null, enumerable: true },
  });
  window.__NEXUS_WORLD_APP__ = Object.freeze(publicState);
  requestAnimationFrame(tick);
}
