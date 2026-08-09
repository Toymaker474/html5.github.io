(()=>{
'use strict';
const WGSL=String.raw`
struct Params{
  grid: vec2f,
  view: vec2f,
  time: f32,
  exposure: f32,
  pad: vec2f,
};
@group(0) @binding(0) var<storage,read> cells: array<u32>;
@group(0) @binding(1) var<uniform> params: Params;

fn hash21(p:vec2f)->f32{
  let q=fract(p*vec2f(123.34,456.21));
  return fract((q.x+q.y)*(q.x+q.y+45.32));
}
fn cellAt(x:i32,y:i32)->u32{
  let w=i32(params.grid.x);let h=i32(params.grid.y);
  if(x<0||x>=w||y<0||y>=h){return 0u;}
  return cells[u32(y*w+x)];
}
fn matAt(x:i32,y:i32)->u32{return cellAt(x,y)&255u;}
fn solid(m:u32)->f32{return select(0.0,1.0,m==1u||m==3u);}
fn tonemap(c:vec3f)->vec3f{
  let x=max(vec3f(0.0),c*params.exposure);
  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),vec3f(0.0),vec3f(1.0));
}
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f{
  var p=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));
  return vec4f(p[i],0.0,1.0);
}
@fragment fn fs(@builtin(position) frag:vec4f)->@location(0) vec4f{
  let uv=frag.xy/params.view;
  let gx=i32(clamp(floor(uv.x*params.grid.x),0.0,params.grid.x-1.0));
  let gy=i32(clamp(floor((1.0-uv.y)*params.grid.y),0.0,params.grid.y-1.0));
  let packed=cellAt(gx,gy);let mat=packed&255u;let wet=f32((packed>>8u)&255u)/255.0;
  let gpos=vec2f(uv.x*params.grid.x,(1.0-uv.y)*params.grid.y);
  let local=fract(gpos);let cell=vec2f(f32(gx),f32(gy));let rnd=hash21(cell);
  var color=vec3f(0.008,0.014,0.020)+(1.0-uv.y)*vec3f(0.012,0.021,0.027);

  if(mat==1u){
    let l=solid(matAt(gx-1,gy));let r=solid(matAt(gx+1,gy));let d=solid(matAt(gx,gy-1));let u=solid(matAt(gx,gy+1));
    let normal=normalize(vec3f((l-r)*0.72,(d-u)*0.58,1.35));
    let light=normalize(vec3f(-0.48,0.62,0.92));let ndl=max(dot(normal,light),0.0);
    let jitter=(vec2f(hash21(cell+7.1),hash21(cell+19.7))-.5)*.18;
    let grain=length(local-(vec2f(.5)+jitter));
    let grainBody=1.0-smoothstep(.22,.76,grain);
    let micro=hash21(floor(gpos*vec2f(5.0,5.0))+cell*9.3);
    let fleck=hash21(floor(gpos*vec2f(3.0,3.0))+cell*4.7);
    var dry=mix(vec3f(.31,.155,.045),vec3f(.96,.68,.25),.25+.72*rnd);
    dry*=.81+.24*fleck+.08*micro;
    let wetBase=mix(dry,vec3f(.19,.105,.035),.72);
    let base=mix(dry,wetBase,wet);
    let cavity=1.0-.09*(l+r+u);let diffuse=.22+.88*ndl;
    let halfv=normalize(light+vec3f(0.0,0.0,1.0));
    let spec=pow(max(dot(normal,halfv),0.0),mix(26.0,92.0,wet))*mix(.035,.32,wet);
    let rim=.76+.24*grainBody;
    color=base*diffuse*cavity*rim+spec*vec3f(1.0,.83,.58);
  }else if(mat==2u){
    let wave=sin(f32(gx)*.37+params.time*1.7)+sin(f32(gy)*.29-params.time*1.2)+sin((f32(gx+gy))*.13+params.time*.8);
    let edge=select(0.0,1.0,matAt(gx,gy+1)!=2u);
    let depth=.58+.42*hash21(cell+3.7);let sparkle=pow(max(0.0,.5+.5*sin(wave*2.4+hash21(cell)*9.0)),12.0);
    color=mix(vec3f(.015,.12,.16),vec3f(.035,.39,.48),depth)+sparkle*vec3f(.28,.78,.86)+edge*vec3f(.08,.22,.22);
  }else if(mat==3u){
    let n=hash21(cell*2.3+floor(local*5.0));let l=solid(matAt(gx-1,gy));let r=solid(matAt(gx+1,gy));
    color=mix(vec3f(.055,.062,.066),vec3f(.24,.23,.21),n)*(.72+.18*(l+r));
  }
  return vec4f(tonemap(color),1.0);
}`;

class WebGPUMaterialsRenderer{
  constructor(canvas,device,context,format,width,height){
    this.canvas=canvas;this.device=device;this.context=context;this.format=format;this.gridWidth=width;this.gridHeight=height;this.kind='WebGPU';this.lost=false;
    this.stateBuffer=device.createBuffer({label:'GENESIS material state',size:width*height*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
    this.uniformBuffer=device.createBuffer({label:'GENESIS material render params',size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const module=device.createShaderModule({label:'GENESIS granular material shader',code:WGSL});
    this.pipeline=device.createRenderPipeline({label:'GENESIS Materials PBR-ish pipeline',layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});
    this.bindGroup=device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.stateBuffer}},{binding:1,resource:{buffer:this.uniformBuffer}}]});
    device.lost.then(info=>{this.lost=true;console.error('GENESIS WebGPU device lost',info);});
  }
  static async create(canvas,width,height){
    if(!('gpu' in navigator))throw new Error('WebGPU unavailable');
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('No WebGPU adapter');
    const device=await adapter.requestDevice();const context=canvas.getContext('webgpu');if(!context)throw new Error('WebGPU canvas context unavailable');
    const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
    return new WebGPUMaterialsRenderer(canvas,device,context,format,width,height);
  }
  resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(this.canvas.clientWidth*d)),h=Math.max(1,Math.round(this.canvas.clientHeight*d));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}}
  updateState(packed){this.device.queue.writeBuffer(this.stateBuffer,0,packed.buffer,packed.byteOffset,packed.byteLength);}
  render(timeMs){if(this.lost)return;this.resize();const p=new Float32Array([this.gridWidth,this.gridHeight,this.canvas.width,this.canvas.height,timeMs*.001,1.18,0,0]);this.device.queue.writeBuffer(this.uniformBuffer,0,p);
    const encoder=this.device.createCommandEncoder({label:'GENESIS Materials frame'});const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.005,g:.008,b:.012,a:1},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bindGroup);pass.draw(3);pass.end();this.device.queue.submit([encoder.finish()]);}
}

globalThis.GenesisWebGPUMaterialsRenderer=WebGPUMaterialsRenderer;
globalThis.GenesisMaterialsWGSL=WGSL;
})();
