import { createBuffer, createBufferWithData } from '../gpu/resources.js';

const COMPUTE_WGSL = /* wgsl */`
struct Particle {
  position: vec4<f32>,
  velocity: vec4<f32>,
  color: vec4<f32>,
};
struct SimUniforms {
  dt: f32,
  time: f32,
  count: u32,
  burst: f32,
  attractor: vec4<f32>,
  bounds: vec4<f32>,
};
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> sim: SimUniforms;

fn hash31(p: vec3<f32>) -> f32 {
  let q = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  let d = dot(q, q.yzx + vec3<f32>(33.33));
  return fract((q.x + q.y) * q.z + d);
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= sim.count) { return; }
  var p = particles[i];
  var pos = p.position.xyz;
  var vel = p.velocity.xyz;

  let toCore = sim.attractor.xyz - pos;
  let dist2 = max(dot(toCore, toCore), 0.4);
  let radial = normalize(toCore);
  let swirl = normalize(vec3<f32>(-toCore.z, toCore.y * 0.18, toCore.x));
  let wave = vec3<f32>(
    sin(pos.y * 0.31 + sim.time * 1.7),
    cos(pos.z * 0.27 - sim.time * 1.1),
    sin(pos.x * 0.29 + sim.time * 1.3)
  );
  let jitter = vec3<f32>(
    hash31(pos + f32(i)),
    hash31(pos.zxy + f32(i) * 0.17),
    hash31(pos.yzx - f32(i) * 0.11)
  ) - vec3<f32>(0.5);

  vel += radial * (14.0 / dist2) * sim.dt;
  vel += swirl * (2.4 + 5.5 / sqrt(dist2)) * sim.dt;
  vel += wave * 0.65 * sim.dt;
  vel += jitter * 0.24 * sim.dt;
  vel += normalize(pos - sim.attractor.xyz + vec3<f32>(0.001)) * sim.burst * 18.0 * sim.dt;
  vel *= exp(-0.32 * sim.dt);
  pos += vel * sim.dt;

  let radius = sim.bounds.x;
  if (length(pos - sim.attractor.xyz) > radius) {
    let seed = hash31(vec3<f32>(f32(i), sim.time, f32(i) * 0.13));
    let angle = seed * 6.2831853;
    let height = (hash31(vec3<f32>(seed, f32(i), 7.0)) - 0.5) * radius * 0.85;
    pos = sim.attractor.xyz + vec3<f32>(cos(angle), height / radius, sin(angle)) * radius * 0.7;
    vel *= 0.25;
  }

  let speed = length(vel);
  let heat = clamp(speed / 10.0 + sim.burst * 0.35, 0.0, 1.0);
  p.position = vec4<f32>(pos, 1.0);
  p.velocity = vec4<f32>(vel, speed);
  p.color = vec4<f32>(
    mix(0.08, 1.0, heat),
    mix(0.72, 0.34, heat),
    mix(0.95, 0.08, heat),
    0.28 + heat * 0.55
  );
  particles[i] = p;
}`;

export function createInitialParticles(count, seed = 9137) {
  const floatsPerParticle = 12;
  const data = new Float32Array(count * floatsPerParticle);
  let state = seed >>> 0;
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const radius = 3 + Math.pow(random(), 0.55) * 17;
    const angle = random() * Math.PI * 2;
    const y = (random() - 0.5) * 13;
    const base = i * floatsPerParticle;
    data[base] = Math.cos(angle) * radius;
    data[base + 1] = y;
    data[base + 2] = Math.sin(angle) * radius;
    data[base + 3] = 1;
    data[base + 4] = -Math.sin(angle) * (1 + random() * 3);
    data[base + 5] = (random() - 0.5) * 0.7;
    data[base + 6] = Math.cos(angle) * (1 + random() * 3);
    data[base + 7] = 0;
    data[base + 8] = 0.15;
    data[base + 9] = 0.75;
    data[base + 10] = 0.95;
    data[base + 11] = 0.5;
  }
  return data;
}

export class ShardSimulation {
  constructor(engine, { count = 32768, seed = 9137 } = {}) {
    this.engine = engine;
    this.device = engine.device;
    this.count = count;
    this.workgroups = Math.ceil(count / 128);
    this.particleBuffer = createBufferWithData(
      this.device,
      createInitialParticles(count, seed),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      'NEXUS shard particles'
    );
    this.uniformBuffer = createBuffer(
      this.device,
      64,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      'NEXUS shard simulation uniforms'
    );
    this.module = this.device.createShaderModule({ label: 'NEXUS shard compute', code: COMPUTE_WGSL });
    this.pipeline = this.device.createComputePipeline({
      label: 'NEXUS shard compute pipeline',
      layout: 'auto',
      compute: { module: this.module, entryPoint: 'main' },
    });
    this.bindGroup = this.device.createBindGroup({
      label: 'NEXUS shard compute bind group',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    });
    this.uniforms = new ArrayBuffer(64);
    this.uniformF32 = new Float32Array(this.uniforms);
    this.uniformU32 = new Uint32Array(this.uniforms);
  }

  encode(encoder, { dt, time, burst, attractor, radius = 24 }) {
    this.uniformF32[0] = dt;
    this.uniformF32[1] = time;
    this.uniformU32[2] = this.count;
    this.uniformF32[3] = burst;
    this.uniformF32.set([attractor[0], attractor[1], attractor[2], 1], 4);
    this.uniformF32.set([radius, 0, 0, 0], 8);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniforms);
    const pass = encoder.beginComputePass({ label: 'NEXUS shard simulation' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(this.workgroups);
    pass.end();
  }

  destroy() { this.particleBuffer.destroy(); this.uniformBuffer.destroy(); }
}
