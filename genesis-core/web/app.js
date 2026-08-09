import init, { Genesis } from './pkg/genesis_core.js';

const $ = id => document.getElementById(id);
const canvas = $('view');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
const fatal = $('fatal');
const panel = $('panel');
const status = $('status');

function fail(error) {
  console.error(error);
  fatal.style.display = 'block';
  fatal.textContent = `GENESIS CORE HALTED\n\n${error?.stack || error}`;
}

if (!gl) {
  fail(new Error('WebGL2 is unavailable on this browser.'));
  throw new Error('WebGL2 unavailable');
}

const atomVS = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec2 aPosition;
in vec2 aVelocity;
in float aType;
uniform vec2 uResolution;
uniform float uScale;
out vec2 vLocal;
out float vSpeed;
flat out int vType;
void main(){
  float radii[6]=float[6](4.8,3.0,4.3,4.5,5.3,5.1);
  float r=radii[int(aType)]*uScale;
  vec2 p=aPosition+aCorner*r;
  vec2 clip=vec2(p.x/uResolution.x*2.0-1.0,1.0-p.y/uResolution.y*2.0);
  gl_Position=vec4(clip,0.0,1.0);
  vLocal=aCorner;
  vType=int(aType);
  vSpeed=length(aVelocity);
}`;

const atomFS = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vSpeed;
flat in int vType;
out vec4 outColor;
vec3 atomColor(int t){
  if(t==0)return vec3(.30,.38,.46);
  if(t==1)return vec3(.96,.99,1.0);
  if(t==2)return vec3(1.0,.12,.18);
  if(t==3)return vec3(.16,.34,1.0);
  if(t==4)return vec3(1.0,.48,.04);
  return vec3(1.0,.82,.08);
}
void main(){
  float d=length(vLocal);
  if(d>1.0)discard;
  vec3 base=atomColor(vType);
  float z=sqrt(max(0.0,1.0-d*d));
  vec3 n=normalize(vec3(vLocal,z));
  vec3 light=normalize(vec3(-.45,-.5,.9));
  float diff=max(0.0,dot(n,light));
  float spec=pow(max(0.0,dot(reflect(-light,n),vec3(0,0,1))),42.0);
  float fres=pow(1.0-z,3.0);
  float hot=clamp(vSpeed*.035,0.0,1.0);
  vec3 color=base*(.18+1.05*diff)+spec*vec3(1.0)+fres*base*.7+hot*vec3(.35,.12,.02);
  float edge=smoothstep(1.0,.78,d);
  outColor=vec4(color,edge);
}`;

const lineVS = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform vec2 uResolution;
void main(){
  vec2 clip=vec2(aPosition.x/uResolution.x*2.0-1.0,1.0-aPosition.y/uResolution.y*2.0);
  gl_Position=vec4(clip,0.0,1.0);
}`;
const lineFS = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main(){outColor=uColor;}`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}
function program(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

const atomProgram = program(atomVS, atomFS);
const lineProgram = program(lineVS, lineFS);

const atomVAO = gl.createVertexArray();
gl.bindVertexArray(atomVAO);
const corners = new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);
const cornerBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
let loc = gl.getAttribLocation(atomProgram, 'aCorner');
gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const posBuffer = gl.createBuffer();
loc = gl.getAttribLocation(atomProgram, 'aPosition');
gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(loc, 1);
const velBuffer = gl.createBuffer();
loc = gl.getAttribLocation(atomProgram, 'aVelocity');
gl.bindBuffer(gl.ARRAY_BUFFER, velBuffer); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(loc, 1);
const typeBuffer = gl.createBuffer();
loc = gl.getAttribLocation(atomProgram, 'aType');
gl.bindBuffer(gl.ARRAY_BUFFER, typeBuffer); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 1, gl.UNSIGNED_BYTE, false, 0, 0); gl.vertexAttribDivisor(loc, 1);

const lineVAO = gl.createVertexArray();
gl.bindVertexArray(lineVAO);
const lineBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
loc = gl.getAttribLocation(lineProgram, 'aPosition');
gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

let sim;
let worldWidth = innerWidth;
let worldHeight = innerHeight;
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
  canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  gl.viewport(0, 0, canvas.width, canvas.height);
}
addEventListener('resize', resize);
resize();

const controls = {
  temp: ['set_temperature', 'tempV', v => `${Math.round(v)} K`],
  pressure: ['set_pressure', 'pressureV', v => `${v.toFixed(1)} atm`],
  dielectric: ['set_dielectric', 'dielectricV', v => v.toFixed(0)],
  uv: ['set_uv_flux', 'uvV', v => `${v.toFixed(2)}×`],
  reaction: ['set_reaction_rate', 'reactionV', v => `${v.toFixed(2)}×`],
  bondStrength: ['set_bond_strength', 'bondStrengthV', v => `${v.toFixed(2)}×`],
  drag: ['set_solvent_drag', 'dragV', v => v.toFixed(3)],
  speed: ['set_time_scale', 'speedV', v => `${v.toFixed(1)}×`]
};

function applyControl(id) {
  const input = $(id);
  const [method, valueId, format] = controls[id];
  const value = +input.value;
  $(valueId).textContent = format(value);
  if (sim && typeof sim[method] === 'function') sim[method](value);
}
for (const id of Object.keys(controls)) {
  $(id).addEventListener('input', () => applyControl(id));
  applyControl(id);
}

const presets = {
  pond: { temp: 335, pressure: 1.1, dielectric: 40, uv: .35, reaction: 1.35, bondStrength: 1.0, drag: .995, speed: 1.0 },
  vent: { temp: 430, pressure: 5.5, dielectric: 22, uv: .08, reaction: 2.3, bondStrength: 1.15, drag: .992, speed: 1.2 },
  ice: { temp: 245, pressure: 1.8, dielectric: 65, uv: .12, reaction: .55, bondStrength: 1.35, drag: .997, speed: 1.5 },
  uv: { temp: 365, pressure: .8, dielectric: 28, uv: 3.2, reaction: 1.7, bondStrength: .72, drag: .991, speed: .8 }
};
function setPreset(name) {
  const values = presets[name];
  for (const [id, value] of Object.entries(values)) { $(id).value = value; applyControl(id); }
  panel.classList.add('open');
}
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => setPreset(button.dataset.preset)));

$('settings').addEventListener('click', () => panel.classList.toggle('open'));
$('preset').addEventListener('click', () => { panel.classList.add('open'); panel.scrollTop = panel.scrollHeight; });
$('close').addEventListener('click', () => panel.classList.remove('open'));

try {
  await init();
} catch (error) {
  fail(error);
  throw error;
}

function reset() {
  worldWidth = innerWidth;
  worldHeight = innerHeight;
  sim = new Genesis(720, worldWidth, worldHeight, 0x52a91f31);
  for (const id of Object.keys(controls)) applyControl(id);
  $('core').textContent = typeof sim.molecule_count === 'function' ? 'RUST/WASM V2' : 'RUST/WASM BUILDING';
  status.textContent = typeof sim.molecule_count === 'function'
    ? 'Spatial-hash molecular dynamics active: reversible bonding, angle constraints, electrostatics, thermal forcing and molecule graph analysis.'
    : 'The new Rust core has been committed. GitHub Actions is still rebuilding the WASM package; this page is temporarily using the previous compiled core.';
}
reset();

$('reset').addEventListener('click', reset);
$('pulse').addEventListener('click', () => sim?.add_energy_pulse(worldWidth * .5, worldHeight * .5, Math.min(worldWidth, worldHeight) * .28, 9));
canvas.addEventListener('pointerdown', event => {
  const rect = canvas.getBoundingClientRect();
  sim?.add_energy_pulse(event.clientX - rect.left, event.clientY - rect.top, 110, 5.5);
});

function buildBondVertices(positions, pairs) {
  const result = new Float32Array(pairs.length * 2);
  let out = 0;
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i] * 2;
    const b = pairs[i + 1] * 2;
    if (a + 1 >= positions.length || b + 1 >= positions.length) continue;
    result[out++] = positions[a]; result[out++] = positions[a + 1];
    result[out++] = positions[b]; result[out++] = positions[b + 1];
  }
  return result.subarray(0, out);
}

let last = performance.now();
let frames = 0;
let ft = 0;
function frame(now) {
  try {
    const dt = Math.min(.03, (now - last) / 1000);
    last = now;
    sim.step(dt);
    const positions = sim.positions();
    const velocities = sim.velocities();
    const types = sim.atom_types();
    const pairs = sim.bond_pairs();

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(.003, .009, .016, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (pairs.length) {
      const lines = buildBondVertices(positions, pairs);
      gl.useProgram(lineProgram);
      gl.bindVertexArray(lineVAO);
      gl.uniform2f(gl.getUniformLocation(lineProgram, 'uResolution'), worldWidth, worldHeight);
      gl.uniform4f(gl.getUniformLocation(lineProgram, 'uColor'), .48, .82, .92, .42);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, lines, gl.DYNAMIC_DRAW);
      gl.lineWidth(1);
      gl.drawArrays(gl.LINES, 0, lines.length / 2);
    }

    gl.useProgram(atomProgram);
    gl.bindVertexArray(atomVAO);
    gl.uniform2f(gl.getUniformLocation(atomProgram, 'uResolution'), worldWidth, worldHeight);
    gl.uniform1f(gl.getUniformLocation(atomProgram, 'uScale'), Math.min(1.5, Math.max(.85, innerWidth / 850)));
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, velBuffer); gl.bufferData(gl.ARRAY_BUFFER, velocities, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, typeBuffer); gl.bufferData(gl.ARRAY_BUFFER, types, gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, sim.atom_count());

    $('atoms').textContent = sim.atom_count();
    $('bonds').textContent = sim.bond_count();
    $('molecules').textContent = typeof sim.molecule_count === 'function' ? sim.molecule_count() : '—';
    $('largest').textContent = typeof sim.largest_molecule === 'function' ? sim.largest_molecule() : '—';
    $('formed').textContent = typeof sim.formed_total === 'function' ? sim.formed_total() : '—';
    $('broken').textContent = typeof sim.broken_total === 'function' ? sim.broken_total() : '—';
    if (typeof sim.kinetic_energy === 'function') {
      $('energyReadout').innerHTML = `Kinetic energy <b>${sim.kinetic_energy().toFixed(1)}</b><br>Potential energy <b>${sim.potential_energy().toFixed(1)}</b><br>Tap the fluid to inject a local energy pulse. Bonds can now form and break instead of being permanent.`;
    }

    frames++; ft += dt;
    if (ft > .5) { $('fps').textContent = Math.round(frames / ft); frames = 0; ft = 0; }
    requestAnimationFrame(frame);
  } catch (error) {
    fail(error);
  }
}
requestAnimationFrame(frame);
