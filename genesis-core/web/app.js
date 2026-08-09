import init, { Genesis } from './pkg/genesis_core.js';

const canvas = document.getElementById('view');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
const status = document.getElementById('status');
const atomsEl = document.getElementById('atoms');
const bondsEl = document.getElementById('bonds');
const fpsEl = document.getElementById('fps');
const coreEl = document.getElementById('core');
const temp = document.getElementById('temp');
const tempV = document.getElementById('tempV');
const speed = document.getElementById('speed');
const speedV = document.getElementById('speedV');

if (!gl) {
  status.textContent = 'WebGL2 renderer unavailable. Rust core can still compile, but this browser cannot render this build.';
  throw new Error('WebGL2 unavailable');
}

const vertexSource = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec2 aPosition;
in float aType;
uniform vec2 uResolution;
uniform float uScale;
out vec2 vLocal;
flat out int vType;
void main(){
  float radii[6]=float[6](4.8,3.0,4.3,4.5,5.3,5.1);
  float r=radii[int(aType)]*uScale;
  vec2 p=aPosition+(aCorner*r);
  vec2 clip=vec2(p.x/uResolution.x*2.0-1.0,1.0-p.y/uResolution.y*2.0);
  gl_Position=vec4(clip,0.0,1.0);
  vLocal=aCorner;
  vType=int(aType);
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 vLocal;
flat in int vType;
out vec4 outColor;
vec3 atomColor(int t){
  if(t==0)return vec3(.34,.39,.44);
  if(t==1)return vec3(.95,.98,1.0);
  if(t==2)return vec3(1.0,.18,.22);
  if(t==3)return vec3(.18,.38,1.0);
  if(t==4)return vec3(1.0,.58,.08);
  return vec3(1.0,.86,.12);
}
void main(){
  float d=length(vLocal);
  if(d>1.0)discard;
  vec3 base=atomColor(vType);
  float z=sqrt(max(0.0,1.0-d*d));
  vec3 n=normalize(vec3(vLocal,z));
  vec3 l=normalize(vec3(-.45,-.55,.8));
  float diff=max(.0,dot(n,l));
  float fres=pow(1.0-z,3.0);
  float spec=pow(max(0.0,dot(reflect(-l,n),vec3(0,0,1))),32.0);
  vec3 color=base*(.22+.9*diff)+spec*vec3(1.0)+fres*base*.55;
  float alpha=smoothstep(1.0,.86,d);
  outColor=vec4(color,alpha);
}`;

function shader(type, source){
  const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const program=gl.createProgram();
gl.attachShader(program,shader(gl.VERTEX_SHADER,vertexSource));
gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragmentSource));
gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));

const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
const corners=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);
const cornerBuffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,cornerBuffer); gl.bufferData(gl.ARRAY_BUFFER,corners,gl.STATIC_DRAW);
let loc=gl.getAttribLocation(program,'aCorner'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const posBuffer=gl.createBuffer(); loc=gl.getAttribLocation(program,'aPosition'); gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0); gl.vertexAttribDivisor(loc,1);
const typeBuffer=gl.createBuffer(); loc=gl.getAttribLocation(program,'aType'); gl.bindBuffer(gl.ARRAY_BUFFER,typeBuffer); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,1,gl.UNSIGNED_BYTE,false,0,0); gl.vertexAttribDivisor(loc,1);

let sim;
function resize(){
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.floor(innerWidth*dpr)); canvas.height=Math.max(1,Math.floor(innerHeight*dpr));
  canvas.style.width=innerWidth+'px'; canvas.style.height=innerHeight+'px'; gl.viewport(0,0,canvas.width,canvas.height);
}
addEventListener('resize',resize); resize();

await init();
function reset(){
  sim=new Genesis(520, innerWidth, innerHeight, 0x52a91f31);
  sim.set_temperature(+temp.value); sim.set_time_scale(+speed.value);
  coreEl.textContent='RUST/WASM'; status.textContent='Rust molecular solver running. Rendering is WebGL2; next kernel upgrade is wgpu/WebGPU compute.';
}
reset();

temp.addEventListener('input',()=>{tempV.textContent=`${temp.value} K`; sim?.set_temperature(+temp.value);});
speed.addEventListener('input',()=>{speedV.textContent=`${(+speed.value).toFixed(2)}×`; sim?.set_time_scale(+speed.value);});
document.getElementById('reset').addEventListener('click',reset);
document.getElementById('pulse').addEventListener('click',()=>sim?.add_energy_pulse(innerWidth*.5,innerHeight*.5,Math.min(innerWidth,innerHeight)*.3,8));
canvas.addEventListener('pointerdown',e=>sim?.add_energy_pulse(e.clientX,e.clientY,130,5));

let last=performance.now(),frames=0,ft=0;
function frame(now){
  const dt=Math.min(.03,(now-last)/1000); last=now; sim.step(dt);
  const positions=sim.positions(); const types=sim.atom_types();
  gl.clearColor(.004,.012,.02,1); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(program); gl.bindVertexArray(vao);
  gl.uniform2f(gl.getUniformLocation(program,'uResolution'),innerWidth,innerHeight); gl.uniform1f(gl.getUniformLocation(program,'uScale'),Math.min(1.35,Math.max(.8,innerWidth/900)));
  gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer); gl.bufferData(gl.ARRAY_BUFFER,positions,gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,typeBuffer); gl.bufferData(gl.ARRAY_BUFFER,types,gl.DYNAMIC_DRAW);
  gl.drawArraysInstanced(gl.TRIANGLES,0,6,sim.atom_count());
  atomsEl.textContent=sim.atom_count(); bondsEl.textContent=sim.bond_count();
  frames++; ft+=dt; if(ft>.5){fpsEl.textContent=Math.round(frames/ft);frames=0;ft=0;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
