const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;

class RNG {
  constructor(seed) { this.s = seed >>> 0 || 1; }
  next() { let x=this.s; x^=x<<13; x^=x>>>17; x^=x<<5; this.s=x>>>0; return this.s/4294967296; }
  range(a,b){return a+(b-a)*this.next();}
  int(a,b){return Math.floor(this.range(a,b+1));}
  pick(a){return a[(this.next()*a.length)|0];}
}

const WORLD_W = 6200;
const WORLD_H = 1700;
const SPECIES = {
  grazer:{name:'Prism Grazer',hue:158,predator:false,flyer:false,speed:1.0,size:.95},
  skitter:{name:'Volt Skitter',hue:48,predator:false,flyer:false,speed:1.35,size:.72},
  crawler:{name:'Glass Crawler',hue:278,predator:false,flyer:false,speed:.8,size:1.18},
  hunter:{name:'Rift Prowler',hue:345,predator:true,flyer:false,speed:1.18,size:1.22},
  glider:{name:'Halo Glider',hue:202,predator:false,flyer:true,speed:1.05,size:.9},
  maw:{name:'Grav Maw',hue:316,predator:true,flyer:false,speed:.78,size:1.55}
};

class Creature {
  constructor(world, kind, x, y, parent=null) {
    const r=world.rng, meta=SPECIES[kind];
    this.world=world; this.id=world.nextId++; this.kind=kind; this.meta=meta;
    this.x=x; this.y=y; this.vx=r.range(-20,20); this.vy=0; this.facing=r.next()<.5?-1:1;
    this.r=r.range(11,18)*meta.size; this.energy=r.range(.55,1); this.health=1; this.age=0;
    this.dead=false; this.grounded=false; this.mode='wander'; this.target=null; this.think=r.range(0,.18);
    this.memoryX=x; this.memoryY=y; this.repro=r.range(8,30); this.attack=0;
    this.hue=parent?(parent.hue+r.range(-16,16)+360)%360:(meta.hue+r.range(-20,20)+360)%360;
    this.morph={segments:parent?clamp(parent.morph.segments+(r.next()<.15?r.pick([-1,1]):0),3,8):r.int(3,7),legs:meta.flyer?0:r.pick([2,4,6]),eyes:r.int(1,4),horns:meta.predator?r.int(1,3):r.int(0,1),fins:meta.flyer?r.int(2,4):r.int(0,2)};
    this.nodes=Array.from({length:this.morph.segments},(_,i)=>({x:x-i*this.r*.58*this.facing,y,px:x-i*this.r*.58*this.facing,py:y}));
  }
  mutate(){const r=this.world.rng;this.hue=(this.hue+r.range(35,95))%360;this.r=clamp(this.r*r.range(.82,1.22),8,31);this.morph.eyes=clamp(this.morph.eyes+r.pick([-1,1]),1,5);this.morph.horns=clamp(this.morph.horns+r.pick([-1,0,1]),0,4);this.energy=Math.min(1,this.energy+.25);}
}

class World {
  constructor(seed=(Date.now()^0x9e3779b9)>>>0){
    this.seed=seed;this.rng=new RNG(seed);this.nextId=1;this.time=0;this.wind=0;this.day=0;
    this.creatures=[];this.food=[];this.effects=[];this.particles=[];this.powers=[];
    this.heights=new Float32Array(260);this.generateTerrain();this.seedLife();
  }
  terrainY(x){const f=clamp(x/WORLD_W,0,1)*(this.heights.length-1),i=Math.floor(f),t=f-i;return lerp(this.heights[i],this.heights[Math.min(this.heights.length-1,i+1)],t);}
  generateTerrain(){let y=1180;for(let i=0;i<this.heights.length;i++){const x=i/(this.heights.length-1);y+=this.rng.range(-42,42);const ridge=Math.sin(x*TAU*3.1)*95+Math.sin(x*TAU*9.7)*36;this.heights[i]=clamp(y*.92+ridge,780,1420);}for(let p=0;p<3;p++)for(let i=1;i<this.heights.length-1;i++)this.heights[i]=(this.heights[i-1]+this.heights[i]*2+this.heights[i+1])/4;}
  seedLife(){const counts={grazer:20,skitter:17,crawler:10,hunter:8,glider:12,maw:4};for(const [kind,n] of Object.entries(counts))for(let i=0;i<n;i++){const x=this.rng.range(180,WORLD_W-180),y=SPECIES[kind].flyer?this.rng.range(300,900):this.terrainY(x)-40;this.creatures.push(new Creature(this,kind,x,y));}for(let i=0;i<150;i++)this.addFood(this.rng.range(80,WORLD_W-80),false);}
  addFood(x,burst=true){const y=this.terrainY(x)-this.rng.range(4,18);this.food.push({x,y,energy:this.rng.range(.18,.32),hue:this.rng.next()<.18?318:145,size:this.rng.range(4,8),alive:true,phase:this.rng.range(0,TAU)});if(burst)for(let i=0;i<12;i++)this.particle(x,y,this.rng.range(-55,55),this.rng.range(-130,-25),145,1.2);}
  particle(x,y,vx,vy,hue,life=1){if(this.particles.length>420)this.particles.shift();this.particles.push({x,y,vx,vy,hue,life,max:life,size:this.rng.range(1.5,4)});}
  nearest(c,predicate,max=700){let best=null,bd=max*max;for(const o of this.creatures){if(o===c||o.dead||!predicate(o))continue;const d=(o.x-c.x)**2+(o.y-c.y)**2;if(d<bd){bd=d;best=o;}}return best;}
  nearestFood(c,max=700){let best=null,bd=max*max;for(const f of this.food)if(f.alive){const d=(f.x-c.x)**2+(f.y-c.y)**2;if(d<bd){bd=d;best=f;}}return best;}
  think(c,dt){c.think-=dt;if(c.think>0)return;c.think=.09+this.rng.range(0,.08);let target=null,threat=null;if(c.meta.predator){target=this.nearest(c,o=>!o.meta.predator&&o.r<c.r*1.55,820);c.mode=target?'hunt':'prowl';}else{threat=this.nearest(c,o=>o.meta.predator&&o.r>c.r*.65,460);if(threat){target=threat;c.mode='flee';}else{target=this.nearestFood(c,760);c.mode=target?'forage':'wander';}}c.target=target;if(target&&!threat){c.memoryX=target.x;c.memoryY=target.y;}else if(this.rng.next()<.08){c.memoryX=clamp(c.x+this.rng.range(-620,620),80,WORLD_W-80);c.memoryY=this.terrainY(c.memoryX)-40;}}
  stepCreature(c,dt){
    c.age+=dt;c.attack=Math.max(0,c.attack-dt);c.repro=Math.max(0,c.repro-dt);this.think(c,dt);
    let tx=c.target?c.target.x:c.memoryX,ty=c.target?c.target.y:c.memoryY;
    let dx=tx-c.x,dy=ty-c.y;if(c.mode==='flee'){dx=-dx;dy=-dy;}
    const want=sign(dx||c.facing);c.facing=want||c.facing;
    const terrain=this.terrainY(c.x);c.grounded=c.y+c.r*.66>=terrain-2;
    let ax=want*620*c.meta.speed;if(!c.grounded)ax*=.42;
    if(c.mode==='hunt'||c.mode==='flee')ax*=1.28;
    if(c.meta.flyer){const desiredY=clamp(ty-90,220,terrain-100);c.vy+=(desiredY-c.y)*1.55*dt;c.vy+=Math.sin(this.time*2+c.id)*22*dt;}else{c.vy+=980*dt;if(c.grounded&&((dy<-45)||(Math.abs(dx)>100&&this.rng.next()<.015))){c.vy=-this.rng.range(260,410)*(c.kind==='skitter'?1.2:1);}}
    c.vx+=ax*dt;c.vx+=this.wind*(c.meta.flyer?1.6:.22)*dt;c.vx*=Math.pow(c.grounded?.16:.62,dt);c.vx=clamp(c.vx,-310*c.meta.speed,310*c.meta.speed);
    c.x=clamp(c.x+c.vx*dt,c.r,WORLD_W-c.r);c.y+=c.vy*dt;
    const floor=this.terrainY(c.x)-c.r*.66;if(c.y>floor){c.y=floor;if(c.vy>70)this.particle(c.x,c.y+c.r*.5,-c.vx*.08,-20,c.hue,.45);c.vy=0;c.grounded=true;}
    if(c.meta.flyer)c.y=clamp(c.y,150,this.terrainY(c.x)-70);
    c.energy-=dt*(.0018+Math.abs(c.vx)/250000+(c.meta.predator?.0013:0));
    for(const f of this.food)if(f.alive&&!c.meta.predator&&Math.abs(f.x-c.x)<c.r+12&&Math.abs(f.y-c.y)<c.r+18){f.alive=false;f.regrow=this.rng.range(35,85);c.energy=Math.min(1,c.energy+f.energy);for(let i=0;i<6;i++)this.particle(f.x,f.y,this.rng.range(-40,40),this.rng.range(-70,0),f.hue,.6);break;}
    if(c.meta.predator&&c.target&&!c.target.dead&&Math.hypot(c.target.x-c.x,c.target.y-c.y)<c.r+c.target.r+10&&c.attack<=0){c.attack=.6;c.target.health-=c.kind==='maw'?.46:.30;c.target.vx+=c.facing*180;c.target.vy-=90;c.energy=Math.min(1,c.energy+.18);for(let i=0;i<10;i++)this.particle(c.target.x,c.target.y,this.rng.range(-85,85),this.rng.range(-120,20),c.target.hue,.8);}
    if(c.energy>.88&&c.repro<=0&&this.creatures.length<105&&this.rng.next()<dt*.06){const child=new Creature(this,c.kind,c.x+this.rng.range(-20,20),c.y-12,c);child.energy=.42;c.energy-=.27;c.repro=24;this.creatures.push(child);}
    if(c.energy<=0||c.health<=0||c.age>260){c.dead=true;for(let i=0;i<16;i++)this.particle(c.x,c.y,this.rng.range(-90,90),this.rng.range(-120,40),c.hue,1.2);return;}
    const head=c.nodes[0];head.px=head.x;head.py=head.y;head.x=lerp(head.x,c.x,clamp(dt*18,0,1));head.y=lerp(head.y,c.y,clamp(dt*18,0,1));
    for(let i=1;i<c.nodes.length;i++){const n=c.nodes[i],vx=(n.x-n.px)*.93,vy=(n.y-n.py)*.93;n.px=n.x;n.py=n.y;n.x+=vx;n.y+=vy+420*dt*dt;const fy=this.terrainY(n.x)-3;if(n.y>fy){n.y=fy;n.py=lerp(n.py,n.y,.55);}}
    const spacing=c.r*.56;for(let pass=0;pass<3;pass++)for(let i=1;i<c.nodes.length;i++){const a=c.nodes[i-1],b=c.nodes[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,q=(d-spacing)/d*.55;b.x-=dx*q;b.y-=dy*q;if(i>1){a.x+=dx*q*.28;a.y+=dy*q*.28;}}
  }
  applyPower(kind,x,y){
    if(kind==='bloom'){for(let i=0;i<14;i++)this.addFood(clamp(x+this.rng.range(-180,180),30,WORLD_W-30),false);for(const c of this.creatures)if(!c.dead&&Math.hypot(c.x-x,c.y-y)<260){c.energy=Math.min(1,c.energy+.22);c.health=Math.min(1,c.health+.14);}this.effects.push({kind,x,y,t:0,life:1.2});}
    if(kind==='pull'){this.powers.push({kind,x,y,t:0,life:1.8});this.effects.push({kind,x,y,t:0,life:1.8});}
    if(kind==='storm'){for(const c of this.creatures)if(!c.dead){const dx=c.x-x,dy=c.y-y,d=Math.hypot(dx,dy)||1;if(d<360){const f=(1-d/360)*520;c.vx+=dx/d*f;c.vy+=dy/d*f-120;}}for(let i=0;i<55;i++)this.particle(x,y,this.rng.range(-260,260),this.rng.range(-340,80),210,1.1);this.effects.push({kind,x,y,t:0,life:1.1});}
    if(kind==='mutate'){let changed=0;for(const c of this.creatures)if(!c.dead&&Math.hypot(c.x-x,c.y-y)<290){c.mutate();changed++;for(let i=0;i<8;i++)this.particle(c.x,c.y,this.rng.range(-75,75),this.rng.range(-110,15),c.hue,.9);}if(!changed){const k=this.rng.pick(Object.keys(SPECIES));this.creatures.push(new Creature(this,k,x,this.terrainY(x)-40));}this.effects.push({kind,x,y,t:0,life:1.4});}
  }
  step(dt){this.time+=dt;this.day=(Math.sin(this.time*.045)+1)/2;this.wind=lerp(this.wind,Math.sin(this.time*.13)*70,.006);for(const p of this.powers){p.t+=dt;for(const c of this.creatures)if(!c.dead){const dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy)||1;if(d<520){const f=(1-d/520)*780;c.vx+=dx/d*f*dt;c.vy+=dy/d*f*dt;}}}this.powers=this.powers.filter(p=>p.t<p.life);for(const c of [...this.creatures])if(!c.dead)this.stepCreature(c,dt);this.creatures=this.creatures.filter(c=>!c.dead);for(const f of this.food)if(!f.alive){f.regrow-=dt;if(f.regrow<=0)f.alive=true;}for(const p of this.particles){p.life-=dt;p.vy+=340*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.25,dt);}this.particles=this.particles.filter(p=>p.life>0);for(const e of this.effects)e.t+=dt;this.effects=this.effects.filter(e=>e.t<e.life);if(this.creatures.length<55&&this.rng.next()<dt*.22){const k=this.rng.pick(Object.keys(SPECIES)),x=this.rng.range(100,WORLD_W-100);this.creatures.push(new Creature(this,k,x,SPECIES[k].flyer?this.rng.range(300,800):this.terrainY(x)-40));}}
}

let world=new World();
let quality=localStorage.getItem('gg_quality')||'auto';
let dpr=1,fps=60,last=performance.now(),acc=0,frames=0,paused=false,selectedPower='bloom';
const camera={x:WORLD_W*.5,y:850,zoom:.72};
const pointers=new Map();let gesture={drag:false,moved:false,lastX:0,lastY:0,startDist:0,startZoom:1};
let messageTimer=4,deferredInstall=null;
const stars=Array.from({length:95},()=>({x:Math.random(),y:Math.random(),a:Math.random(),s:Math.random()*1.8+.5}));

function resize(){const max=quality==='battery'?1:quality==='ultra'?2:1.55;dpr=Math.min(devicePixelRatio||1,max);canvas.width=Math.max(1,Math.floor(innerWidth*dpr));canvas.height=Math.max(1,Math.floor(innerHeight*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);}
addEventListener('resize',resize,{passive:true});resize();
const toScreen=(x,y)=>({x:(x-camera.x)*camera.zoom+innerWidth/2,y:(y-camera.y)*camera.zoom+innerHeight/2});
const toWorld=(x,y)=>({x:(x-innerWidth/2)/camera.zoom+camera.x,y:(y-innerHeight/2)/camera.zoom+camera.y});
function showMessage(text,sec=2.5){$('message').textContent=text;$('message').classList.add('show');messageTimer=sec;}

function drawBackground(now){const w=innerWidth,h=innerHeight,g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,`hsl(${232+world.day*18} 45% ${5+world.day*4}%)`);g.addColorStop(.55,'#07131d');g.addColorStop(1,'#020407');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);for(const s of stars){const x=(s.x*w-camera.x*.008*s.s+w*3)%w,y=s.y*h*.72;ctx.fillStyle=`rgba(170,210,255,${.06+s.a*.45})`;ctx.fillRect(x,y,s.s,s.s);}for(let layer=0;layer<4;layer++){const base=h*(.48+layer*.11);ctx.fillStyle=`hsla(${218+layer*22},55%,${7+layer*2}%,${.6+layer*.08})`;ctx.beginPath();ctx.moveTo(0,h);for(let x=0;x<=w+28;x+=24){const wx=x+camera.x*(.018+layer*.01);ctx.lineTo(x,base+Math.sin(wx*.009+layer)*35+Math.sin(wx*.0028)*72);}ctx.lineTo(w,h);ctx.fill();}}
function drawTerrain(){ctx.save();ctx.beginPath();let started=false;for(let i=0;i<world.heights.length;i++){const x=i/(world.heights.length-1)*WORLD_W,p=toScreen(x,world.heights[i]);if(!started){ctx.moveTo(p.x,p.y);started=true}else ctx.lineTo(p.x,p.y);}ctx.lineTo(toScreen(WORLD_W,WORLD_H).x,toScreen(WORLD_W,WORLD_H).y);ctx.lineTo(toScreen(0,WORLD_H).x,toScreen(0,WORLD_H).y);ctx.closePath();const g=ctx.createLinearGradient(0,Math.max(0,toScreen(0,800).y),0,innerHeight);g.addColorStop(0,'#162d32');g.addColorStop(.28,'#10202a');g.addColorStop(1,'#05080d');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(102,255,211,.34)';ctx.lineWidth=Math.max(1,2*camera.zoom);ctx.shadowBlur=quality==='battery'?3:12;ctx.shadowColor='#56ffd1';ctx.stroke();ctx.restore();}
function drawFood(now){ctx.save();ctx.globalCompositeOperation='lighter';for(const f of world.food)if(f.alive){const p=toScreen(f.x,f.y);if(p.x<-30||p.x>innerWidth+30||p.y<-30||p.y>innerHeight+30)continue;const pulse=1+Math.sin(now*.006+f.phase)*.2;ctx.shadowBlur=quality==='battery'?5:15;ctx.shadowColor=`hsl(${f.hue} 100% 60%)`;ctx.fillStyle=`hsl(${f.hue} 95% 64%)`;ctx.beginPath();ctx.arc(p.x,p.y,f.size*pulse*camera.zoom,0,TAU);ctx.fill();ctx.strokeStyle=`hsla(${f.hue+40} 100% 82% / .55)`;for(let i=0;i<3;i++){const a=i*TAU/3+f.phase;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(a)*12*camera.zoom,p.y+Math.sin(a)*7*camera.zoom);ctx.stroke();}}ctx.restore();}
function drawCreature(c,now){const head=toScreen(c.x,c.y);if(head.x<-120||head.x>innerWidth+120||head.y<-120||head.y>innerHeight+120)return;const r=c.r*camera.zoom,gait=now*.008*(.4+Math.abs(c.vx)/160)+c.id;ctx.save();ctx.globalCompositeOperation='lighter';ctx.shadowColor=`hsl(${c.hue} 100% 62%)`;ctx.shadowBlur=quality==='battery'?4:13;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=`hsla(${c.hue} 88% 64% / .5)`;ctx.lineWidth=Math.max(2,r*.34);ctx.beginPath();for(let i=0;i<c.nodes.length;i++){const p=toScreen(c.nodes[i].x,c.nodes[i].y);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.shadowBlur=0;for(let i=c.nodes.length-1;i>=0;i--){const p=toScreen(c.nodes[i].x,c.nodes[i].y),t=i/Math.max(1,c.nodes.length-1),br=r*(.45-.15*t);const grad=ctx.createRadialGradient(p.x-br*.3,p.y-br*.3,1,p.x,p.y,br);grad.addColorStop(0,`hsl(${c.hue+58} 100% 86%)`);grad.addColorStop(.35,`hsl(${c.hue} 92% 61%)`);grad.addColorStop(1,`hsl(${c.hue-28} 80% 25%)`);ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(p.x,p.y,br,br*.72,0,0,TAU);ctx.fill();}
if(c.morph.legs){ctx.strokeStyle=`hsla(${c.hue+65} 95% 78% / .7)`;ctx.lineWidth=Math.max(1.2,r*.12);for(let i=0;i<c.morph.legs;i++){const anchor=c.nodes[Math.min(c.nodes.length-1,1+((i/2)|0))],a=toScreen(anchor.x,anchor.y),side=i%2?-1:1,footX=a.x+Math.sin(gait+i*1.7)*r*.75,footY=toScreen(anchor.x,world.terrainY(anchor.x)).y;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(a.x+side*r*.45,a.y+r*.35,footX,Math.min(footY,a.y+r*1.1));ctx.stroke();}}
ctx.save();ctx.translate(head.x,head.y);ctx.scale(c.facing,1);ctx.fillStyle=`hsl(${c.hue} 94% 58%)`;ctx.beginPath();ctx.ellipse(r*.42,0,r*.52,r*.43,0,0,TAU);ctx.fill();for(let i=0;i<c.morph.horns;i++){ctx.strokeStyle=`hsl(${c.hue+70} 100% 83%)`;ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(r*.45,(-.2+i*.18)*r);ctx.lineTo(r*(.82+i*.08),(-.7+i*.22)*r);ctx.stroke();}for(let i=0;i<c.morph.eyes;i++){const ey=(-.24+i*(.48/Math.max(1,c.morph.eyes-1)))*r;ctx.fillStyle='#f0ffff';ctx.beginPath();ctx.arc(r*.56,ey,r*.09,0,TAU);ctx.fill();ctx.fillStyle='#071018';ctx.beginPath();ctx.arc(r*.59,ey,r*.038,0,TAU);ctx.fill();}if(c.meta.flyer){ctx.fillStyle=`hsla(${c.hue+95} 95% 66% / .26)`;for(let i=0;i<c.morph.fins;i++){ctx.rotate(i%2?-.08:.08);ctx.beginPath();ctx.ellipse(-r*.25,(i%2?-1:1)*r*.38,r*1.05,r*.24,(i%2?-1:1)*.35,0,TAU);ctx.fill();}}ctx.restore();ctx.restore();}
function drawEffects(){ctx.save();ctx.globalCompositeOperation='lighter';for(const e of world.effects){const p=toScreen(e.x,e.y),t=e.t/e.life,r=(40+t*300)*camera.zoom;const hue=e.kind==='bloom'?145:e.kind==='pull'?270:e.kind==='storm'?205:325;ctx.strokeStyle=`hsla(${hue} 100% 68% / ${1-t})`;ctx.lineWidth=Math.max(1,5*(1-t));ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.stroke();if(e.kind==='pull'){ctx.fillStyle=`hsla(${hue} 100% 60% / ${.16*(1-t)})`;ctx.beginPath();ctx.arc(p.x,p.y,r*.45,0,TAU);ctx.fill();}}for(const p of world.particles){const q=toScreen(p.x,p.y);ctx.fillStyle=`hsla(${p.hue} 100% 65% / ${clamp(p.life/p.max,0,1)})`;ctx.fillRect(q.x,q.y,p.size*camera.zoom,p.size*camera.zoom);}ctx.restore();}
function render(now){drawBackground(now);ctx.save();drawTerrain();drawFood(now);const ordered=[...world.creatures].sort((a,b)=>a.y-b.y);for(const c of ordered)drawCreature(c,now);drawEffects();ctx.restore();}

function updateUI(){const species=new Set(world.creatures.map(c=>c.kind));$('population').textContent=world.creatures.length;$('species').textContent=species.size;$('fps').textContent=Math.round(fps);if(messageTimer>0){messageTimer-=.12;if(messageTimer<=0)$('message').classList.remove('show');}}
function loop(now){const dt=Math.min(.08,(now-last)/1000);last=now;fps=fps*.92+(dt?1/dt:60)*.08;acc+=dt;let guard=0;while(acc>=1/60&&guard++<5){if(!paused)world.step(1/60);acc-=1/60;}render(now);if(frames++%7===0)updateUI();if(quality==='auto'&&frames%300===0){if(fps<45){quality='battery';resize();showMessage('Performance graphics enabled.')}else if(fps>58&&(devicePixelRatio||1)>1.4){quality='ultra';resize();}}requestAnimationFrame(loop);}requestAnimationFrame(loop);

function choosePower(kind){selectedPower=kind;document.querySelectorAll('.power').forEach(b=>b.classList.toggle('selected',b.dataset.power===kind));showMessage(kind==='bloom'?'Bloom grows food and heals nearby life.':kind==='pull'?'Gravity pulls creatures toward your touch.':kind==='storm'?'Storm throws creatures with a physical shockwave.':'Mutate changes nearby bodies and traits.');}
document.querySelectorAll('.power').forEach(b=>b.addEventListener('click',()=>choosePower(b.dataset.power)));
canvas.addEventListener('pointerdown',e=>{e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture?.(e.pointerId);gesture.moved=false;gesture.lastX=e.clientX;gesture.lastY=e.clientY;if(pointers.size===2){const a=[...pointers.values()];gesture.startDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);gesture.startZoom=camera.zoom;}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const p=pointers.get(e.pointerId);p.x=e.clientX;p.y=e.clientY;if(pointers.size===1){const dx=e.clientX-gesture.lastX,dy=e.clientY-gesture.lastY;if(Math.hypot(dx,dy)>2){gesture.moved=true;camera.x=clamp(camera.x-dx/camera.zoom,innerWidth*.25/camera.zoom,WORLD_W-innerWidth*.25/camera.zoom);camera.y=clamp(camera.y-dy/camera.zoom,250,WORLD_H-150);}gesture.lastX=e.clientX;gesture.lastY=e.clientY;}else if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);camera.zoom=clamp(gesture.startZoom*d/Math.max(1,gesture.startDist),.38,1.45);gesture.moved=true;}});
function endPointer(e){if(!pointers.has(e.pointerId))return;const wasTap=!gesture.moved&&pointers.size===1;const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(wasTap&&!paused){const q=toWorld(p.x,p.y);world.applyPower(selectedPower,clamp(q.x,0,WORLD_W),clamp(q.y,0,WORLD_H));navigator.vibrate?.(selectedPower==='storm'?24:10);}if(pointers.size<2){gesture.lastX=e.clientX;gesture.lastY=e.clientY;}}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);

function setPause(value){paused=value;$('pause').classList.toggle('show',paused);}
$('pauseBtn').onclick=()=>setPause(true);$('resumeBtn').onclick=()=>setPause(false);$('enterBtn').onclick=()=>$('intro').classList.remove('show');
$('newWorldBtn').onclick=()=>{world=new World((Date.now()^0x51f15e)>>>0);camera.x=WORLD_W*.5;camera.y=850;camera.zoom=.72;setPause(false);showMessage('A new alien world has formed.');};
$('qualityBtn').onclick=()=>{quality=quality==='auto'?'ultra':quality==='ultra'?'battery':'auto';localStorage.setItem('gg_quality',quality);$('qualityLabel').textContent=quality.toUpperCase();resize();};$('qualityLabel').textContent=quality.toUpperCase();
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});$('installBtn').onclick=async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;}else showMessage('iPhone: Safari Share → Add to Home Screen.',4);};
function createRating(){const root=$('stars'),saved=Number(localStorage.getItem('gg_rating')||0),choice=localStorage.getItem('gg_feedback')||'';for(let i=1;i<=10;i++){const b=document.createElement('button');b.textContent='★';b.classList.toggle('on',i<=saved);b.onclick=()=>{localStorage.setItem('gg_rating',String(i));[...root.children].forEach((x,n)=>x.classList.toggle('on',n<i));$('ratingText').textContent=`${i}/10`;};root.append(b);}if(saved)$('ratingText').textContent=`${saved}/10`;document.querySelectorAll('[data-feedback]').forEach(b=>{b.classList.toggle('selected',b.dataset.feedback===choice);b.onclick=()=>{localStorage.setItem('gg_feedback',b.dataset.feedback);document.querySelectorAll('[data-feedback]').forEach(x=>x.classList.toggle('selected',x===b));};});}createRating();
addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true);});
if('serviceWorker'in navigator)navigator.serviceWorker.register('../sw.js?v=7',{updateViaCache:'none'}).catch(()=>{});
