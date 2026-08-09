(()=>{
'use strict';
const WGSL=String.raw`
struct Params{
  grid: vec4f,
  camPos: vec4f,
  camRight: vec4f,
  camUp: vec4f,
  camForward: vec4f,
  render: vec4f,
  sun: vec4f,
};
@group(0) @binding(0) var<storage,read> cells: array<vec4f>;
@group(0) @binding(1) var<uniform> params: Params;

fn hash21(p:vec2f)->f32{let q=fract(p*vec2f(123.34,456.21));return fract((q.x+q.y)*(q.x+q.y+45.32));}
fn hash31(p:vec3f)->f32{return fract(sin(dot(p,vec3f(12.9898,78.233,37.719)))*43758.5453);}
fn stateAt(x:u32,z:u32)->vec4f{return cells[z*u32(params.grid.x)+x];}
fn projectWorld(p:vec3f)->vec4f{
  let rel=p-params.camPos.xyz;let vx=dot(rel,params.camRight.xyz);let vy=dot(rel,params.camUp.xyz);let vz=max(.05,dot(rel,params.camForward.xyz));
  let aspect=params.render.x;let t=params.render.y;let near=.08;let far=140.0;
  return vec4f(vx/(t*aspect),vy/t,(far/(far-near))*vz-(near*far/(far-near)),vz);
}
fn worldXZ(x:u32,z:u32)->vec2f{
  let gx=f32(x)/max(1.0,params.grid.x-1.0)-.5;let gz=f32(z)/max(1.0,params.grid.y-1.0)-.5;
  return vec2f(gx*params.grid.x*params.grid.z,gz*params.grid.y*params.grid.z);
}
fn corner(local:u32)->vec2u{
  if(local==0u){return vec2u(0u,0u);}if(local==1u){return vec2u(1u,0u);}if(local==2u){return vec2u(0u,1u);}
  if(local==3u){return vec2u(0u,1u);}if(local==4u){return vec2u(1u,0u);}return vec2u(1u,1u);
}
fn tonemap(c:vec3f)->vec3f{let x=max(vec3f(0.0),c*params.render.w);return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),vec3f(0.0),vec3f(1.0));}
fn skyColor(ray:vec3f)->vec3f{
  let sunDir=normalize(params.sun.xyz);let h=clamp(ray.y*.5+.5,0.0,1.0);
  var sky=mix(vec3f(.29,.13,.07),vec3f(.035,.16,.30),smoothstep(.05,.78,h));
  sky=mix(sky,vec3f(.018,.045,.080),smoothstep(.72,1.0,h));
  let s=max(dot(ray,sunDir),0.0);sky+=vec3f(1.0,.53,.22)*pow(s,28.0)*.34+vec3f(1.0,.91,.72)*pow(s,1100.0)*5.0;
  return sky;
}
fn applyAtmosphere(color:vec3f,world:vec3f)->vec3f{
  let d=distance(params.camPos.xyz,world);let viewDir=normalize(world-params.camPos.xyz);let haze=1.0-exp(-d*.038);let sunGlow=pow(max(dot(viewDir,normalize(params.sun.xyz)),0.0),18.0);
  let fog=mix(vec3f(.20,.18,.16),vec3f(.16,.27,.34),clamp(viewDir.y*.5+.5,0.0,1.0))+sunGlow*vec3f(.42,.18,.06);
  return mix(color,fog,clamp(haze,0.0,.82));
}

struct SkyOut{@builtin(position) position:vec4f,@location(0) ndc:vec2f};
@vertex fn skyVs(@builtin(vertex_index) i:u32)->SkyOut{
  var p=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));var o:SkyOut;o.position=vec4f(p[i],0.9999,1.0);o.ndc=p[i];return o;
}
@fragment fn skyFs(in:SkyOut)->@location(0) vec4f{
  let ray=normalize(params.camForward.xyz+params.camRight.xyz*in.ndc.x*params.render.x*params.render.y+params.camUp.xyz*in.ndc.y*params.render.y);
  let horizon=pow(1.0-abs(ray.y),8.0);let c=skyColor(ray)+horizon*vec3f(.10,.055,.028);return vec4f(tonemap(c),1.0);
}

struct TerrainOut{@builtin(position) position:vec4f,@location(0) world:vec3f,@location(1) data:vec4f};
@vertex fn terrainVs(@builtin(vertex_index) vid:u32)->TerrainOut{
  let quadsX=u32(params.grid.x)-1u;let q=vid/6u;let c=corner(vid%6u);let x=q%quadsX+c.x;let z=q/quadsX+c.y;let s=stateAt(x,z);let xz=worldXZ(x,z);let y=(s.w+s.x)*params.grid.w;
  var o:TerrainOut;o.world=vec3f(xz.x,y,xz.y);o.data=s;o.position=projectWorld(o.world);return o;
}
@fragment fn terrainFs(in:TerrainOut)->@location(0) vec4f{
  var n=normalize(cross(dpdy(in.world),dpdx(in.world)));if(n.y<0.0){n=-n;}
  let sunDir=normalize(params.sun.xyz);let viewDir=normalize(params.camPos.xyz-in.world);let halfv=normalize(sunDir+viewDir);let ndl=max(dot(n,sunDir),0.0);let ndh=max(dot(n,halfv),0.0);
  let micro=hash21(floor(in.world.xz*38.0));let fine=hash21(floor(in.world.xz*118.0)+17.3);let sandMix=smoothstep(.015,.24,in.data.x);let wet=clamp(in.data.z,0.0,1.0);
  var rock=mix(vec3f(.075,.066,.058),vec3f(.24,.20,.16),micro);rock*=.72+.32*fine;
  var sand=mix(vec3f(.34,.16,.052),vec3f(1.02,.68,.26),.28+.62*micro);sand*=.84+.22*fine;sand=mix(sand,vec3f(.19,.10,.035),wet*.72);
  let base=mix(rock,sand,sandMix);let rough=mix(.78,.93,1.0-wet);let spec=pow(ndh,mix(24.0,90.0,wet))*mix(.025,.22,wet);
  let skyAmb=mix(vec3f(.08,.10,.12),vec3f(.22,.28,.31),max(n.y,0.0));var color=base*(.18+.98*ndl)+base*skyAmb*.42+spec*vec3f(1.0,.78,.48);
  let slope=1.0-clamp(n.y,0.0,1.0);color*=1.0-slope*.14;color=applyAtmosphere(color,in.world);return vec4f(tonemap(color),1.0);
}

struct GrainOut{@builtin(position) position:vec4f,@location(0) uv:vec2f,@location(1) wet:f32,@location(2) alive:f32,@location(3) rnd:f32};
fn quadCorner(local:u32)->vec2f{
  if(local==0u){return vec2f(-1.0,-1.0);}if(local==1u){return vec2f(1.0,-1.0);}if(local==2u){return vec2f(-1.0,1.0);}if(local==3u){return vec2f(-1.0,1.0);}if(local==4u){return vec2f(1.0,-1.0);}return vec2f(1.0,1.0);
}
@vertex fn grainVs(@builtin(vertex_index) vid:u32,@builtin(instance_index) iid:u32)->GrainOut{
  let cell=iid/2u;let layer=iid%2u;let w=u32(params.grid.x);let x=cell%w;let z=cell/w;let s=stateAt(x,z);let baseXZ=worldXZ(x,z);let r1=hash31(vec3f(f32(x),f32(z),f32(layer)*13.7));let r2=hash31(vec3f(f32(z),f32(x),f32(layer)*29.1));
  let offset=(vec2f(r1,r2)-.5)*params.grid.z*.92;let center=vec3f(baseXZ.x+offset.x,(s.w+s.x)*params.grid.w+.018+r1*.018,baseXZ.y+offset.y);let q=quadCorner(vid%6u);let size=.010+.010*r2;
  let world=center+(params.camRight.xyz*q.x+params.camUp.xyz*q.y)*size;var o:GrainOut;o.position=projectWorld(world);o.uv=q;o.wet=s.z;o.alive=select(0.0,1.0,s.x>.035);o.rnd=r1;return o;
}
@fragment fn grainFs(in:GrainOut)->@location(0) vec4f{
  if(in.alive<.5){discard;}let r=length(in.uv);let a=1.0-smoothstep(.48,1.0,r);if(a<.025){discard;}let dry=mix(vec3f(.48,.23,.065),vec3f(1.0,.73,.31),in.rnd);let c=mix(dry,vec3f(.18,.095,.03),clamp(in.wet,0.0,1.0)*.72);return vec4f(tonemap(c*1.15),a*.82);
}

struct WaterOut{@builtin(position) position:vec4f,@location(0) world:vec3f,@location(1) water:f32};
@vertex fn waterVs(@builtin(vertex_index) vid:u32)->WaterOut{
  let quadsX=u32(params.grid.x)-1u;let q=vid/6u;let c=corner(vid%6u);let x=q%quadsX+c.x;let z=q/quadsX+c.y;let s=stateAt(x,z);let xz=worldXZ(x,z);let y=(s.w+s.x+s.y)*params.grid.w+.026;
  var o:WaterOut;o.world=vec3f(xz.x,y,xz.y);o.water=s.y;o.position=projectWorld(o.world);return o;
}
@fragment fn waterFs(in:WaterOut)->@location(0) vec4f{
  if(in.water<.008){discard;}var n=normalize(cross(dpdy(in.world),dpdx(in.world)));if(n.y<0.0){n=-n;}let t=params.render.z;
  let wave=vec2f(sin(in.world.x*5.4+t*1.7)+sin(in.world.z*8.2-t*.8),cos(in.world.z*6.1-t*1.3)+sin(in.world.x*7.3+t*.6));n=normalize(n+vec3f(wave.x*.035,0.0,wave.y*.035));
  let view=normalize(params.camPos.xyz-in.world);let sun=normalize(params.sun.xyz);let halfv=normalize(view+sun);let fres=pow(1.0-max(dot(n,view),0.0),5.0);let spec=pow(max(dot(n,halfv),0.0),180.0)*2.8;
  let deep=mix(vec3f(.025,.19,.22),vec3f(.012,.055,.075),clamp(in.water*.75,0.0,1.0));let reflect=skyColor(reflect(-view,n));var c=mix(deep,reflect,.18+.58*fres)+spec*vec3f(1.0,.78,.52);c=applyAtmosphere(c,in.world);
  let alpha=clamp(.30+in.water*.30+fres*.25,.28,.78);return vec4f(tonemap(c),alpha);
}`;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
class WebGPU3DMaterialsRenderer{
  constructor(canvas,device,context,format,width,height){
    this.canvas=canvas;this.device=device;this.context=context;this.format=format;this.gridWidth=width;this.gridHeight=height;this.kind='WebGPU 3D';this.lost=false;this.cellScale=.12;this.heightScale=.16;this.yaw=.72;this.pitch=.50;this.distance=Math.max(10,width*this.cellScale*1.15);this.target=[0,.72,0];this.depthTexture=null;this.depthView=null;this._camera=null;
    this.stateBuffer=device.createBuffer({label:'GENESIS 3D material state',size:width*height*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
    this.uniformBuffer=device.createBuffer({label:'GENESIS 3D render params',size:112,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const bgl=device.createBindGroupLayout({label:'GENESIS 3D scene bindings',entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
    const layout=device.createPipelineLayout({bindGroupLayouts:[bgl]});const module=device.createShaderModule({label:'GENESIS cinematic terrain shader',code:WGSL});
    this.skyPipeline=device.createRenderPipeline({label:'GENESIS sky',layout,vertex:{module,entryPoint:'skyVs'},fragment:{module,entryPoint:'skyFs',targets:[{format}]},primitive:{topology:'triangle-list'}});
    this.terrainPipeline=device.createRenderPipeline({label:'GENESIS terrain',layout,vertex:{module,entryPoint:'terrainVs'},fragment:{module,entryPoint:'terrainFs',targets:[{format}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
    const blend={color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}};
    this.grainPipeline=device.createRenderPipeline({label:'GENESIS grain surface sprites',layout,vertex:{module,entryPoint:'grainVs'},fragment:{module,entryPoint:'grainFs',targets:[{format,blend}]},primitive:{topology:'triangle-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less-equal'}});
    this.waterPipeline=device.createRenderPipeline({label:'GENESIS water surface',layout,vertex:{module,entryPoint:'waterVs'},fragment:{module,entryPoint:'waterFs',targets:[{format,blend}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less-equal'}});
    this.bindGroup=device.createBindGroup({layout:bgl,entries:[{binding:0,resource:{buffer:this.stateBuffer}},{binding:1,resource:{buffer:this.uniformBuffer}}]});
    device.lost.then(info=>{this.lost=true;console.error('GENESIS 3D WebGPU device lost',info);});
  }
  static async create(canvas,width,height){if(!('gpu' in navigator))throw new Error('WebGPU unavailable');const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('No WebGPU adapter');const device=await adapter.requestDevice();const context=canvas.getContext('webgpu');if(!context)throw new Error('WebGPU canvas context unavailable');const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});return new WebGPU3DMaterialsRenderer(canvas,device,context,format,width,height);}
  _cameraFrame(){const cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),sy=Math.sin(this.yaw),cy=Math.cos(this.yaw);const pos=[this.target[0]+sy*cp*this.distance,this.target[1]+sp*this.distance,this.target[2]+cy*cp*this.distance];const forward=norm([this.target[0]-pos[0],this.target[1]-pos[1],this.target[2]-pos[2]]);const right=norm(cross(forward,[0,1,0]));const up=norm(cross(right,forward));return{pos,forward,right,up};}
  orbit(dx,dy){this.yaw-=dx*.006;this.pitch=clamp(this.pitch+dy*.004,.16,1.12);}
  zoom(delta){this.distance=clamp(this.distance*Math.exp(delta*.0012),5.5,34);}
  resetCamera(){this.yaw=.72;this.pitch=.50;this.distance=Math.max(10,this.gridWidth*this.cellScale*1.15);}
  screenToGrid(clientX,clientY){const r=this.canvas.getBoundingClientRect(),nx=((clientX-r.left)/r.width)*2-1,ny=(1-(clientY-r.top)/r.height)*2-1,c=this._cameraFrame(),aspect=Math.max(.2,r.width/Math.max(1,r.height)),tan=Math.tan(52*Math.PI/360);const ray=norm([c.forward[0]+c.right[0]*nx*aspect*tan+c.up[0]*ny*tan,c.forward[1]+c.right[1]*nx*aspect*tan+c.up[1]*ny*tan,c.forward[2]+c.right[2]*nx*aspect*tan+c.up[2]*ny*tan]);const planeY=.45;if(Math.abs(ray[1])<1e-4)return null;const t=(planeY-c.pos[1])/ray[1];if(t<=0)return null;const wx=c.pos[0]+ray[0]*t,wz=c.pos[2]+ray[2]*t;const gx=Math.floor((wx/(this.gridWidth*this.cellScale)+.5)*(this.gridWidth-1)),gz=Math.floor((wz/(this.gridHeight*this.cellScale)+.5)*(this.gridHeight-1));if(gx<0||gz<0||gx>=this.gridWidth||gz>=this.gridHeight)return null;return{x:gx,z:gz};}
  resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(this.canvas.clientWidth*d)),h=Math.max(1,Math.round(this.canvas.clientHeight*d));if(this.canvas.width!==w||this.canvas.height!==h||!this.depthTexture){this.canvas.width=w;this.canvas.height=h;this.depthTexture?.destroy();this.depthTexture=this.device.createTexture({label:'GENESIS 3D depth',size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});this.depthView=this.depthTexture.createView();}}
  updateState(packed){this.device.queue.writeBuffer(this.stateBuffer,0,packed.buffer,packed.byteOffset,packed.byteLength);}
  render(timeMs){if(this.lost)return;this.resize();const c=this._cameraFrame();this._camera=c;const aspect=this.canvas.width/Math.max(1,this.canvas.height),tan=Math.tan(52*Math.PI/360),sun=norm([-.46,.78,-.41]);const p=new Float32Array([this.gridWidth,this.gridHeight,this.cellScale,this.heightScale,c.pos[0],c.pos[1],c.pos[2],0,c.right[0],c.right[1],c.right[2],0,c.up[0],c.up[1],c.up[2],0,c.forward[0],c.forward[1],c.forward[2],0,aspect,tan,timeMs*.001,1.08,sun[0],sun[1],sun[2],0]);this.device.queue.writeBuffer(this.uniformBuffer,0,p);
    const encoder=this.device.createCommandEncoder({label:'GENESIS 3D cinematic frame'});const view=this.context.getCurrentTexture().createView();const pass=encoder.beginRenderPass({colorAttachments:[{view,clearValue:{r:.01,g:.02,b:.035,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:this.depthView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});pass.setBindGroup(0,this.bindGroup);pass.setPipeline(this.skyPipeline);pass.draw(3);const meshVerts=(this.gridWidth-1)*(this.gridHeight-1)*6;pass.setPipeline(this.terrainPipeline);pass.draw(meshVerts);pass.setPipeline(this.grainPipeline);pass.draw(6,this.gridWidth*this.gridHeight*2);pass.setPipeline(this.waterPipeline);pass.draw(meshVerts);pass.end();this.device.queue.submit([encoder.finish()]);}
}
globalThis.GenesisWebGPU3DMaterialsRenderer=WebGPU3DMaterialsRenderer;globalThis.GenesisMaterials3DWGSL=WGSL;
})();
