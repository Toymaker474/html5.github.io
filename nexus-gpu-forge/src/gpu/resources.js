export function createBuffer(device, size, usage, label = '') {
  return device.createBuffer({ label, size: Math.max(4, (size + 3) & ~3), usage });
}

export function createBufferWithData(device, data, usage, label = '') {
  const buffer = createBuffer(device, data.byteLength, usage | GPUBufferUsage.COPY_DST, label);
  device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  return buffer;
}

export class ResourceScope {
  constructor() { this.resources = new Set(); }
  track(resource) { this.resources.add(resource); return resource; }
  release(resource) { if (this.resources.delete(resource)) resource.destroy?.(); }
  destroy() { for (const resource of this.resources) resource.destroy?.(); this.resources.clear(); }
}
