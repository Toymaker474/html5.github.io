import { NexusGPUEngine } from '../src/core/engine.js';
import { ShardSimulation } from '../src/sim/particles.js';
import { SkyRenderer } from '../src/render/sky.js';
import { ShardRenderer } from '../src/render/shards.js';

const $ = id => document.getElementById(id);
const canvas = $('gpu');
const fatal = $('fatal');

function fail(error) {
  console.error(error);
  $('loading').style.display = 'none';
  fatal.style.display = 'grid';
  fatal.textContent = `NEXUS GPU FORGE COULD NOT START\n\n${error?.message || error}\n\nThis test requires WebGPU.`;
}

try {
  const engine = await NexusGPUEngine.create(canvas);
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const count = mobile ? 24576 : 65536;
  const simulation = new ShardSimulation(engine, { count, seed: 9137 });
  const sky = new SkyRenderer(engine);
  const shards = new ShardRenderer(engine, simulation.particleBuffer, count);

  $('count').textContent = `${count.toLocaleString()} GPU SHARDS`;
  $('gpuName').textContent = engine.adapter.info?.description || 'DIRECT WEBGPU';

  let time = 0;
  let burst = 0;
  let orbitHeld = false;
  let orbitAngle = 0;
  const attractor = [0, 0, 0];
  const targetAttractor = [0, 0, 0];
  const pointer = { id: null, x: 0, y: 0 };

  canvas.addEventListener('pointerdown', event => {
    if (pointer.id !== null) return;
    pointer.id = event.pointerId;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer.id) return;
    targetAttractor[0] = ((event.clientX / innerWidth) * 2 - 1) * 8;
    targetAttractor[1] = (0.5 - event.clientY / innerHeight) * 7;
  });
  const release = event => { if (event.pointerId === pointer.id) pointer.id = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  $('burst').addEventListener('pointerdown', event => {
    burst = 1;
    event.currentTarget.classList.add('on');
    navigator.vibrate?.(14);
  });
  $('burst').addEventListener('pointerup', event => event.currentTarget.classList.remove('on'));
  $('burst').addEventListener('pointercancel', event => event.currentTarget.classList.remove('on'));
  $('orbit').addEventListener('pointerdown', event => {
    orbitHeld = true;
    event.currentTarget.classList.add('on');
    event.currentTarget.setPointerCapture(event.pointerId);
  });
  const orbitOff = event => { orbitHeld = false; event.currentTarget.classList.remove('on'); };
  $('orbit').addEventListener('pointerup', orbitOff);
  $('orbit').addEventListener('pointercancel', orbitOff);

  window.addEventListener('nexus-device-lost', event => fail(new Error(`GPU device lost: ${event.detail.message}`)));
  $('loading').style.display = 'none';

  function frame() {
    const current = engine.beginFrame();
    const dt = current.dt;
    time += dt;
    burst *= Math.exp(-dt * 3.5);
    if (orbitHeld) orbitAngle += dt * 0.75;
    attractor[0] += (targetAttractor[0] - attractor[0]) * (1 - Math.exp(-dt * 5));
    attractor[1] += (targetAttractor[1] - attractor[1]) * (1 - Math.exp(-dt * 5));

    simulation.encode(current.encoder, { dt, time, burst, attractor, radius: 25 });

    const eye = [Math.sin(orbitAngle) * 28, 7 + Math.sin(time * 0.21) * 2, Math.cos(orbitAngle) * 28];
    const target = [attractor[0] * 0.18, attractor[1] * 0.18, 0];
    shards.updateCamera({ eye, target, aspect: engine.width / engine.height });
    sky.update(time, engine.width / engine.height, burst);

    const pass = current.encoder.beginRenderPass({
      label: 'NEXUS shardstorm render',
      colorAttachments: [{
        view: current.colorView,
        clearValue: { r: 0.005, g: 0.012, b: 0.035, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: current.depthView,
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });
    sky.draw(pass);
    shards.draw(pass);
    pass.end();
    engine.submit(current.encoder);

    $('fps').textContent = Math.round(engine.fps);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (error) {
  fail(error);
}
