import { BabylonMujocoRenderer } from './babylonRenderer.js';
import { MujocoScienceRuntime } from './mujocoRuntime.js';

const canvas = document.querySelector('#world');
const status = document.querySelector('#status');
const pauseButton = document.querySelector('#pause');
const resetButton = document.querySelector('#reset');
const mutateButton = document.querySelector('#mutate');

if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing V7 render canvas.');

let runtime;
let renderer;
let disposed = false;
let lastFrame = performance.now();
let fpsWindowStart = lastFrame;
let fpsFrames = 0;
let fps = 0;
let stableTimer = 0;

function setStatus(message) {
  status.innerHTML = message;
}

function countContacts() {
  const observation = runtime.buildObservation();
  return observation.footContacts.filter((force) => force > 0.001).length;
}

function updateStatus() {
  const batteryPercent = (runtime.batteryJoules / runtime.maxBatteryJoules) * 100;
  const rootHeight = Number(runtime.data.qpos[2] || 0);
  setStatus(
    `<strong>MUJOCO AUTHORITY</strong> · ${renderer.backend}<br>` +
    `SIM ${runtime.data.time.toFixed(2)} s · ${fps.toFixed(0)} FPS · ${countContacts()}/6 FEET<br>` +
    `BATTERY ${batteryPercent.toFixed(1)}% · POWER ${runtime.lastPowerWatts.toFixed(1)} W · HEIGHT ${rootHeight.toFixed(3)} m`,
  );
}

function animate(now) {
  if (disposed) return;
  const frameSeconds = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  try {
    runtime.step(frameSeconds);
    renderer.sync();
    renderer.render();

    fpsFrames += 1;
    if (now - fpsWindowStart >= 500) {
      fps = fpsFrames * 1000 / (now - fpsWindowStart);
      fpsFrames = 0;
      fpsWindowStart = now;
      updateStatus();
    }

    stableTimer += frameSeconds;
    const height = Number(runtime.data.qpos[2] || 0);
    if (stableTimer >= 2 && height > 0.28 && Number.isFinite(height)) {
      runtime.captureStableSnapshot();
      stableTimer = 0;
    }
  } catch (error) {
    console.error(error);
    runtime.setPaused(true);
    setStatus(`<strong>FAIL-CLOSED</strong><br>${error instanceof Error ? error.message : String(error)}`);
  }

  requestAnimationFrame(animate);
}

async function boot() {
  try {
    setStatus('<strong>V7 BOOT</strong><br>Loading Google DeepMind MuJoCo WASM…');
    runtime = await MujocoScienceRuntime.create();

    setStatus('<strong>V7 BOOT</strong><br>Starting Babylon WebGPU/WebGL2 renderer…');
    renderer = await BabylonMujocoRenderer.create(canvas, runtime);

    pauseButton.addEventListener('click', () => {
      runtime.setPaused(!runtime.paused);
      pauseButton.textContent = runtime.paused ? 'RESUME' : 'PAUSE';
    });

    resetButton.addEventListener('click', () => {
      runtime.reset();
      pauseButton.textContent = 'PAUSE';
      runtime.setPaused(false);
      stableTimer = 0;
    });

    mutateButton.addEventListener('click', () => {
      const genome = runtime.mutateController();
      navigator.vibrate?.(24);
      setStatus(`<strong>CONTROLLER MUTATED</strong><br>SEED ${genome.seed} · FREQ ${genome.frequencyHz.toFixed(3)} Hz`);
    });

    window.addEventListener('pagehide', dispose, { once: true });
    window.addEventListener('beforeunload', dispose, { once: true });

    updateStatus();
    requestAnimationFrame(animate);
  } catch (error) {
    console.error('NEXUS V7 boot failed', error);
    setStatus(`<strong>V7 BOOT FAILURE</strong><br>${error instanceof Error ? error.message : String(error)}`);
  }
}

function dispose() {
  if (disposed) return;
  disposed = true;
  renderer?.dispose();
  runtime?.dispose();
}

void boot();
