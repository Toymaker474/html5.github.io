const SKY_WGSL = /* wgsl */`
struct SkyUniforms { time: f32, aspect: f32, pulse: f32, pad: f32 };
@group(0) @binding(0) var<uniform> sky: SkyUniforms;
struct Out { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs(@builtin(vertex_index) i: u32) -> Out {
  var p = array<vec2<f32>, 3>(vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  var o: Out; o.position = vec4(p[i],0.999,1.0); o.uv = p[i] * 0.5 + 0.5; return o;
}
fn hash(p: vec2<f32>) -> f32 { return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }
@fragment fn fs(in: Out) -> @location(0) vec4<f32> {
  let uv = (in.uv * 2.0 - 1.0) * vec2(sky.aspect,1.0);
  let r = length(uv);
  let horizon = smoothstep(-0.7,0.9,in.uv.y);
  var col = mix(vec3(0.012,0.025,0.065),vec3(0.035,0.13,0.19),horizon);
  let nebula = 0.5 + 0.5*sin(uv.x*2.1 + sin(uv.y*3.3 + sky.time*.08));
  col += vec3(0.02,0.08,0.09) * nebula * (1.0-r*.3);
  let grid = floor(in.uv * vec2(340.0,190.0));
  let star = step(0.9955,hash(grid));
  col += star * vec3(0.7,0.95,1.0) * (0.45 + sky.pulse*.35);
  col += vec3(0.08,0.26,0.27) * exp(-r*4.5) * (0.35+sky.pulse*.5);
  return vec4(col,1.0);
}`;

export class SkyRenderer {
  constructor(engine) {
    this.device = engine.device;
    this.uniformBuffer = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const module = this.device.createShaderModule({ label: 'NEXUS sky shader', code: SKY_WGSL });
    this.pipeline = this.device.createRenderPipeline({
      label: 'NEXUS sky pipeline',
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format: engine.format }] },
      primitive: { topology: 'triangle-list' },
    });
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });
    this.data = new Float32Array(4);
  }

  update(time, aspect, pulse) {
    this.data.set([time, aspect, pulse, 0]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.data);
  }

  draw(pass) {
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
  }
}
