import { createGPUDevice } from '../gpu/device.js';
import { ResourceScope } from '../gpu/resources.js';

export class NexusGPUEngine {
  static async create(canvas) {
    const gpu = await createGPUDevice(canvas);
    return new NexusGPUEngine(canvas, gpu);
  }

  constructor(canvas, gpu) {
    this.canvas = canvas;
    this.adapter = gpu.adapter;
    this.device = gpu.device;
    this.context = gpu.context;
    this.format = gpu.format;
    this.timestampQueries = gpu.timestampQueries;
    this.resources = new ResourceScope();
    this.depthTexture = null;
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.frameNumber = 0;
    this.lastTime = performance.now();
    this.fps = 0;
    this.frameMs = 0;
    this.resize();
  }

  resize(maxPixelRatio = 1.5) {
    const ratio = Math.min(devicePixelRatio || 1, maxPixelRatio);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
    if (width === this.width && height === this.height) return false;
    this.width = width;
    this.height = height;
    this.pixelRatio = ratio;
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
      colorSpace: 'srgb',
    });
    this.depthTexture?.destroy();
    this.depthTexture = this.device.createTexture({
      label: 'NEXUS depth',
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return true;
  }

  beginFrame() {
    this.resize();
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.0001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.frameMs += ((dt * 1000) - this.frameMs) * 0.08;
    this.fps += ((1 / dt) - this.fps) * 0.08;
    this.frameNumber++;
    return {
      dt,
      encoder: this.device.createCommandEncoder({ label: `NEXUS frame ${this.frameNumber}` }),
      colorView: this.context.getCurrentTexture().createView(),
      depthView: this.depthTexture.createView(),
    };
  }

  submit(encoder) { this.device.queue.submit([encoder.finish()]); }
  destroy() { this.resources.destroy(); this.depthTexture?.destroy(); this.device.destroy(); }
}
