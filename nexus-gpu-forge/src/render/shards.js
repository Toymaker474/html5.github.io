import { cameraBasis, lookAt, multiply, perspective } from '../math/mat4.js';

const SHARD_WGSL = /* wgsl */`
struct Particle { position: vec4<f32>, velocity: vec4<f32>, color: vec4<f32> };
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  right: vec4<f32>,
  up: vec4<f32>,
  eye: vec4<f32>,
};
@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;
struct Out { @builtin(position) position: vec4<f32>, @location(0) color: vec4<f32>, @location(1) edge: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Out {
  let corners = array<vec2<f32>,6>(
    vec2(-1.0,-0.2), vec2(1.0,-0.2), vec2(0.45,0.2),
    vec2(-1.0,-0.2), vec2(0.45,0.2), vec2(-0.35,0.2)
  );
  let p = particles[ii];
  let speed = max(0.2,p.velocity.w);
  let width = 0.025 + min(speed,12.0)*0.006;
  let length = 0.09 + min(speed,14.0)*0.027;
  let c = corners[vi];
  let world = p.position.xyz + camera.right.xyz*c.x*width + camera.up.xyz*c.y*length;
  var o: Out;
  o.position = camera.viewProjection * vec4(world,1.0);
  o.color = p.color;
  o.edge = abs(c.x);
  return o;
}
@fragment fn fs(in: Out) -> @location(0) vec4<f32> {
  let glow = 1.0 - smoothstep(0.45,1.05,in.edge);
  return vec4(in.color.rgb * (0.45 + glow*1.7), in.color.a * (0.32 + glow*.68));
}`;

export class ShardRenderer {
  constructor(engine, particleBuffer, count) {
    this.engine = engine;
    this.device = engine.device;
    this.count = count;
    this.uniformBuffer = this.device.createBuffer({
      label: 'NEXUS camera uniforms',
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const module = this.device.createShaderModule({ label: 'NEXUS shard render shader', code: SHARD_WGSL });
    this.pipeline = this.device.createRenderPipeline({
      label: 'NEXUS shard render pipeline',
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{
          format: engine.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less-equal' },
    });
    this.bindGroup = this.device.createBindGroup({
      label: 'NEXUS shard render bind group',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    });
    this.uniformData = new Float32Array(28);
  }

  updateCamera({ eye, target, aspect }) {
    const vp = multiply(perspective(0.86, aspect, 0.1, 180), lookAt(eye, target));
    const basis = cameraBasis(eye, target);
    this.uniformData.set(vp, 0);
    this.uniformData.set([...basis.right, 0], 16);
    this.uniformData.set([...basis.up, 0], 20);
    this.uniformData.set([...eye, 1], 24);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
  }

  draw(pass) {
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(6, this.count);
  }
}
