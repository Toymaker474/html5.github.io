(()=>{'use strict';
const WGSL=String.raw`
struct U { dims:vec4f, camPos:vec4f, camF:vec4f, camR:vec4f, camU:vec4f, render:vec4f, sun:vec4f };
@group(0) @binding(0) var volume:texture_3d<f32>;
@group(0) @binding(1) var samp:sampler;
@group(0) @binding(2) var<uniform> u:U;

fn sampleV(p:vec3f)->vec4f{
  let q=clamp(p/u.dims.xyz,vec3f(.001),vec3f(.999));
  return textureSampleLevel(volume,samp,q,0.0);
}
fn solidD(p:vec3f)->f32{let v=sampleV(p);return max(v.r,v.g);}
fn waterD(p:vec3f)->f32{return sampleV(p).b;}
fn boxHit(ro:vec3f,rd:vec3f)->vec2f{
  let inv=1.0/rd;
  let t0=(vec3f(0)-ro)*inv;let t1=(u.dims.xyz-ro)*inv;
  let lo=min(t0,t1);let hi=max(t0,t1);
  let a=max(max(lo.x,lo.y),lo.z);let b=min(min(hi.x,hi.y),hi.z);
  return vec2f(max(a,0.0),b);
}
fn gradS(p:vec3f)->vec3f{
  let e=.42;let g=vec3f(
    solidD(p+vec3f(e,0,0))-solidD(p-vec3f(e,0,0)),
    solidD(p+vec3f(0,e,0))-solidD(p-vec3f(0,e,0)),
    solidD(p+vec3f(0,0,e))-solidD(p-vec3f(0,0,e)));
  return select(vec3f(0,1,0),normalize(g),length(g)>.0001);
}
fn gradW(p:vec3f)->vec3f{
  let e=.46;let g=vec3f(
    waterD(p+vec3f(e,0,0))-waterD(p-vec3f(e,0,0)),
    waterD(p+vec3f(0,e,0))-waterD(p-vec3f(0,e,0)),
    waterD(p+vec3f(0,0,e))-waterD(p-vec3f(0,0,e)));
  return select(vec3f(0,1,0),normalize(g),length(g)>.0001);
}
fn hash31(p:vec3f)->f32{return fract(sin(dot(p,vec3f(127.1,311.7,74.7)))*43758.5453);}
fn sky(rd:vec3f)->vec3f{
  let h=clamp(rd.y*.5+.5,0.0,1.0);
  var c=mix(vec3f(.008,.016,.019),vec3f(.045,.12,.155),pow(h,.72));
  let s=max(dot(rd,normalize(u.sun.xyz)),0.0);
  c+=vec3f(1.0,.58,.24)*pow(s,42.0)*.32;
  c+=vec3f(1.0,.92,.76)*pow(s,900.0)*2.4;
  return c;
}
fn tone(c:vec3f)->vec3f{let x=max(c,vec3f(0));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3f(0),vec3f(1));}
fn softShadow(p:vec3f)->f32{
  let l=normalize(u.sun.xyz);var occ=0.0;var t=.7;
  for(var i=0;i<7;i++){occ+=solidD(p+l*t)*.13;t+=1.08;}
  return clamp(1.0-occ,.26,1.0);
}
fn ao(p:vec3f,n:vec3f)->f32{
  var o=0.0;var d=.55;
  for(var i=0;i<4;i++){o+=solidD(p+n*d)*.18;d+=.65;}
  return clamp(1.0-o,.38,1.0);
}
fn baseMaterial(v:vec4f,p:vec3f)->vec3f{
  let sand=v.g;let rock=v.r;let sf=sand/max(.001,sand+rock);
  let n=hash31(floor(p*3.2));
  let rockC=mix(vec3f(.042,.050,.049),vec3f(.20,.215,.205),n*.58);
  let dry=mix(vec3f(.29,.13,.038),vec3f(.79,.50,.17),n);
  let sandC=mix(dry,vec3f(.105,.052,.019),v.a*.78);
  return mix(rockC,sandC,sf);
}
fn shadeSolid(p:vec3f,rd:vec3f)->vec3f{
  let v=sampleV(p);let n=-gradS(p);let l=normalize(u.sun.xyz);let view=-rd;let h=normalize(l+view);
  let ndl=max(dot(n,l),0.0);let sh=softShadow(p+n*.20);let occ=ao(p,n);
  let base=baseMaterial(v,p);let rough=mix(.92,.57,v.a);
  let spec=pow(max(dot(n,h),0.0),mix(20.0,96.0,1.0-rough))*(.08+.22*v.a);
  var c=base*(.095+.98*ndl*sh)*occ;
  c+=base*vec3f(.075,.14,.18)*(.30+.52*max(n.y,0.0))*occ;
  c+=vec3f(1.0,.73,.40)*spec*sh;
  return c;
}
fn shadeWater(p:vec3f,rd:vec3f,behind:vec3f,depth:f32)->vec3f{
  let v=sampleV(p);
  let n=-gradW(p);
  let turb=clamp(v.a,0.0,1.0);
  let view=-rd;let l=normalize(u.sun.xyz);let fres=pow(1.0-max(dot(n,view),0.0),5.0);
  let refl=sky(reflect(rd,n));let halfv=normalize(l+view);
  let spec=pow(max(dot(n,halfv),0.0),mix(170.0,72.0,turb))*mix(2.0,.62,turb);
  let absorbCoeff=mix(vec3f(.20,.054,.027),vec3f(.34,.17,.082),turb);
  let absorb=exp(-max(depth,0.0)*absorbCoeff);
  let transmitted=behind*absorb;
  let scatterColor=mix(vec3f(.009,.115,.16),vec3f(.115,.075,.025),turb);
  let scattered=scatterColor*(vec3f(1.0)-absorb);
  return mix(transmitted+scattered,refl,.11+.66*fres)+vec3f(1.0,.84,.62)*spec;
}
struct O{@builtin(position)pos:vec4f,@location(0)uv:vec2f};
@vertex fn vs(@builtin(vertex_index)i:u32)->O{
  var q=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));var o:O;o.pos=vec4f(q[i],0,1);o.uv=q[i];return o;
}
@fragment fn fs(i:O)->@location(0)vec4f{
  let rd=normalize(u.camF.xyz+u.camR.xyz*i.uv.x*u.render.x*u.render.y+u.camU.xyz*i.uv.y*u.render.y);
  let ro=u.camPos.xyz;let bh=boxHit(ro,rd);
  if(bh.y<=bh.x){return vec4f(tone(sky(rd)),1);}
  var t=bh.x;let step=.29;var waterT=-1.0;var solidT=-1.0;
  var prevS=solidD(ro+rd*t);var prevW=waterD(ro+rd*t);
  for(var k=0;k<196;k++){
    if(t>bh.y){break;}
    let p=ro+rd*t;let s=solidD(p);let w=waterD(p);
    if(waterT<0.0 && w>.48 && prevW<=.48){waterT=t;}
    if(s>.48 && prevS<=.48){solidT=t;break;}
    prevS=s;prevW=w;t+=step;
  }
  var c=sky(rd);
  if(solidT>=0.0){let sp=ro+rd*solidT;c=shadeSolid(sp,rd);let fog=clamp(1.0-exp(-solidT*.018),0.0,.70);c=mix(c,sky(rd),fog);}
  if(waterT>=0.0 && (solidT<0.0 || waterT<solidT)){
    let wp=ro+rd*waterT;let d=select(5.0,max(.15,solidT-waterT),solidT>=0.0);c=shadeWater(wp,rd,c,d);
  }
  return vec4f(tone(c*1.18),1);
}`;
const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
class GenesisRayVolumeRenderer{
  constructor(canvas,device,context,format,w,h,d){
    this.canvas=canvas;this.device=device;this.context=context;this.format=format;this.w=w;this.h=h;this.d=d;
    this.yaw=.80;this.pitch=.42;this.distance=Math.max(w,d)*1.52;this.target=[w*.5,h*.29,d*.5];this.time=0;
    this.tex=device.createTexture({size:[w,h,d],dimension:'3d',format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
    this.sampler=device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge'});
    this.uniform=device.createBuffer({size:112,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const mod=device.createShaderModule({code:WGSL,label:'GENESIS smooth volume ray shader'});
    const bgl=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{viewDimension:'3d',sampleType:'float'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
    this.pipe=device.createRenderPipeline({layout:device.createPipelineLayout({bindGroupLayouts:[bgl]}),vertex:{module:mod,entryPoint:'vs'},fragment:{module:mod,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});
    this.bind=device.createBindGroup({layout:bgl,entries:[{binding:0,resource:this.tex.createView()},{binding:1,resource:this.sampler},{binding:2,resource:{buffer:this.uniform}}]});
    this.rowBytes=w*4;this.paddedRow=(this.rowBytes+255)&~255;this.upload=new Uint8Array(this.paddedRow*h*d);
  }
  static async create(canvas,w,h,d){
    if(!navigator.gpu)throw new Error('WebGPU unavailable');
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('No WebGPU adapter');
    const device=await adapter.requestDevice();const context=canvas.getContext('webgpu');if(!context)throw new Error('WebGPU canvas unavailable');
    const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
    const r=new GenesisRayVolumeRenderer(canvas,device,context,format,w,h,d);
    device.pushErrorScope('validation');r.render(performance.now());await device.queue.onSubmittedWorkDone();const err=await device.popErrorScope();if(err)throw new Error(err.message||String(err));return r;
  }
  resize(){
    const scale=innerWidth<700?.80:1;const dpr=Math.min(devicePixelRatio||1,1.35)*scale;
    const w=Math.max(2,Math.floor(this.canvas.clientWidth*dpr)),h=Math.max(2,Math.floor(this.canvas.clientHeight*dpr));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  }
  updateState(a){
    const q=this.upload;q.fill(0);
    for(let z=0;z<this.d;z++)for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){
      const i=(y*this.d+z)*this.w+x,v=a[i]>>>0,m=v&255,wet=(v>>>8)&255,sed=(v>>>16)&255;
      const o=(z*this.h+y)*this.paddedRow+x*4;
      q[o]=m===3?255:0;q[o+1]=m===1?255:0;q[o+2]=m===2?255:0;q[o+3]=m===1?wet:sed;
    }
    this.device.queue.writeTexture({texture:this.tex},q,{offset:0,bytesPerRow:this.paddedRow,rowsPerImage:this.h},{width:this.w,height:this.h,depthOrArrayLayers:this.d});
  }
  orbit(dx,dy){this.yaw+=dx*.008;this.pitch=Math.max(.08,Math.min(1.24,this.pitch+dy*.007));}
  zoom(delta){this.distance=Math.max(12,Math.min(120,this.distance*Math.exp(delta*.00125)));}
  render(now){
    this.resize();this.time=now*.001;
    const cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),cy=Math.cos(this.yaw),sy=Math.sin(this.yaw);
    const pos=[this.target[0]+this.distance*cp*sy,this.target[1]+this.distance*sp,this.target[2]+this.distance*cp*cy];
    const f=norm([this.target[0]-pos[0],this.target[1]-pos[1],this.target[2]-pos[2]]),r=norm(cross(f,[0,1,0])),up=norm(cross(r,f));
    const aspect=this.canvas.width/this.canvas.height,tanHalf=Math.tan(55*Math.PI/360),data=new Float32Array(28);
    data.set([this.w,this.h,this.d,0],0);data.set([...pos,0],4);data.set([...f,0],8);data.set([...r,0],12);data.set([...up,0],16);data.set([aspect,tanHalf,this.time,0],20);data.set([.55,.82,.38,0],24);
    this.device.queue.writeBuffer(this.uniform,0,data);
    const enc=this.device.createCommandEncoder(),pass=enc.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:.005,g:.010,b:.012,a:1}}]});
    pass.setPipeline(this.pipe);pass.setBindGroup(0,this.bind);pass.draw(3);pass.end();this.device.queue.submit([enc.finish()]);
  }
}
window.GenesisRayVolumeRenderer=GenesisRayVolumeRenderer;
})();