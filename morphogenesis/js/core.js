'use strict';

const $=id=>document.getElementById(id);
const canvas=$('c');
const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
const hud=$('hud'),bootEl=$('boot'),logEl=$('log'),fillEl=$('fill'),stateEl=$('state'),errEl=$('error');

window.addEventListener('error',e=>panic(e.message||String(e.error||e)));
window.addEventListener('unhandledrejection',e=>panic(String(e.reason||e)));

function panic(s){errEl.style.display='block';errEl.textContent='RUNTIME ERROR\n'+s}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function bootLine(s,ok=true){const d=document.createElement('div');d.textContent=(ok?'[PASS] ':'[FAIL] ')+s;d.style.color=ok?'#aaffd7':'#ff9fb2';logEl.appendChild(d);logEl.scrollTop=logEl.scrollHeight}
function bootPct(p,s){fillEl.style.width=p+'%';stateEl.textContent=s}

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const smoothstep=t=>t*t*(3-2*t);

function rand(a=1,b=null){if(b===null){b=a;a=0}return a+Math.random()*(b-a)}
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v)}
function norm(x,y){const m=Math.hypot(x,y)||1;return{x:x/m,y:y/m,m}}
function hash2(x,y,s=1){let n=(x*374761393+y*668265263+s*69069)|0;n=(n^(n>>>13))*1274126177;return((n^(n>>>16))>>>0)/4294967295}

const CFG={
  WORLD_W:8200,
  WORLD_H:5200,
  BASE_POP:168,
  MAX_POP:320,
  FOOD_TARGET:720,
  FOOD_MIN:430,
  GEN_SECONDS:62,
  CELL:220,
  MAX_CARCASSES:140,
  MAX_PARTICLES:620,
  GENE_BANK:36
};

let DPR=1,SW=1,SH=1,last=performance.now(),fps=60,simSpeed=1,time=0;
let creatures=[],foods=[],carcasses=[],particles=[],geneBank=[];
let generation=1,genStart=0,births=0,deaths=0,bites=0,swallows=0,woundsMade=0,follow=false;
let audioCtx=null,audioOn=false,masterGain=null;

const cam={x:CFG.WORLD_W*.5,y:CFG.WORLD_H*.5,z:.46,tz:.46};

function resize(){
  DPR=Math.min(2,devicePixelRatio||1);
  SW=innerWidth;SH=innerHeight;
  canvas.width=Math.max(1,(SW*DPR)|0);
  canvas.height=Math.max(1,(SH*DPR)|0);
  canvas.style.width=SW+'px';
  canvas.style.height=SH+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize',resize,{passive:true});

function ws(x,y){return{x:(x-cam.x)*cam.z+SW*.5,y:(y-cam.y)*cam.z+SH*.5}}
function sw(x,y){return{x:(x-SW*.5)/cam.z+cam.x,y:(y-SH*.5)/cam.z+cam.y}}
function wrap(o){
  if(o.x<0)o.x+=CFG.WORLD_W;
  if(o.x>=CFG.WORLD_W)o.x-=CFG.WORLD_W;
  if(o.y<0)o.y+=CFG.WORLD_H;
  if(o.y>=CFG.WORLD_H)o.y-=CFG.WORLD_H;
}
function currentAt(x,y){
  const depth=y/CFG.WORLD_H;
  const curl=Math.sin(y*.0022+time*.47)+Math.cos(x*.0013-time*.19);
  return{
    x:Math.sin(curl+x*.00045)*(.045+.035*depth),
    y:Math.cos(curl-y*.00032)*(.018+.022*depth)
  };
}
function depthLight(y){return clamp(1-y/CFG.WORLD_H,.05,1)}
function waterTemp(y){return 24-18*(y/CFG.WORLD_H)}
function speciesKey(g){
  const carn=g.carnivore>.62?'C':g.carnivore<.35?'G':'O';
  return `${g.plan}:${Math.round(g.segments/2)}:${Math.round(g.bodyDepth*2)}:${carn}`;
}
