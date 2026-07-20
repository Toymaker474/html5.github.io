import { TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, TAU, RNG, ROLE, BIOMES, clamp, lerp, sign, dist2, fractalNoise, activityFactor, approach } from './organism-core-v8.js';
import { PlantSystem } from './organism-plants-v8.js';
import { Creature, genomeKey } from './organism-creatures-v8.js';

export class TileMap {
  constructor(seed, rng) {
    this.seed=seed; this.rng=rng; this.width=MAP_W; this.height=MAP_H;
    this.tiles=new Uint8Array(MAP_W*MAP_H); this.dens=[]; this.vines=[]; this.vents=[]; this.pools=[]; this.surface=new Int16Array(MAP_W);
    this.roomNames=BIOMES.map(b=>b.name); this.generate();
  }
  idx(x,y){return y*MAP_W+x;} inBounds(x,y){return x>=0&&y>=0&&x<MAP_W&&y<MAP_H;}
  get(x,y){if(!this.inBounds(x,y))return 1;return this.tiles[this.idx(x,y)];}
  set(x,y,v){if(this.inBounds(x,y))this.tiles[this.idx(x,y)]=v;}
  roomAt(px){return clamp(Math.floor(px/(WORLD_W/BIOMES.length)),0,BIOMES.length-1);}
  biomeAt(px){return BIOMES[this.roomAt(px)];}
  solidAtPixel(px,py){return this.get(Math.floor(px/TILE),Math.floor(py/TILE))===1;}
  waterAtPixel(px,py){return this.get(Math.floor(px/TILE),Math.floor(py/TILE))===2;}
  findFloor(tx){tx=clamp(Math.floor(tx),0,MAP_W-1);for(let y=3;y<MAP_H-1;y++)if(this.get(tx,y)!==1&&this.get(tx,y+1)===1)return y;return this.surface[tx]||38;}
  generate(){
    const r=this.rng;
    for(let x=0;x<MAP_W;x++){
      const macro=(fractalNoise(x*.018,0.3,this.seed,4)-.5)*18;
      const ridge=Math.sin(x*.041)*5+Math.sin(x*.013+1.7)*8;
      const surface=Math.floor(clamp(39+macro+ridge,24,52)); this.surface[x]=surface;
      for(let y=surface;y<MAP_H;y++)this.set(x,y,1);
    }
    for(let c=0;c<74;c++){
      const cx=r.int(5,MAP_W-6),cy=r.int(17,MAP_H-7),rx=r.int(3,14),ry=r.int(2,8);
      for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){
        const q=((x-cx)/rx)**2+((y-cy)/ry)**2;
        if(q<1+(fractalNoise(x*.21,y*.21,this.seed+c,2)-.5)*.36)this.set(x,y,0);
      }
    }
    for(let i=0;i<24;i++){
      const x0=r.int(8,MAP_W-18),len=r.int(6,18),y=r.int(18,39);
      for(let x=x0;x<x0+len;x++)if(this.get(x,y)===0)this.set(x,y,1);
      if(r.chance(.55))for(let j=1;j<r.int(3,9);j++)this.set(x0,y+j,1);
    }
    for(let y=27;y<42;y++)for(let x=2;x<24;x++)this.set(x,y,0);
    for(let x=2;x<25;x++)this.set(x,42,1);
    const denXs=[10,38,68,98,128,158,190,216];
    denXs.forEach((tx,index)=>{
      const ty=this.findFloor(tx)-1;
      for(let y=ty-5;y<=ty;y++)for(let x=tx-4;x<=tx+4;x++)this.set(x,y,0);
      for(let x=tx-4;x<=tx+4;x++)this.set(x,ty+1,1);
      this.dens.push({x:(tx+.5)*TILE,y:(ty-.15)*TILE,r:TILE*2.6,index});
    });
    for(let i=0;i<72;i++){
      const tx=r.int(5,MAP_W-6),top=r.int(7,31),len=r.int(5,17);let end=top;
      for(let y=top;y<Math.min(MAP_H-2,top+len);y++){if(this.get(tx,y)===1)break;end=y;}
      if(end-top>3)this.vines.push({x:(tx+.5)*TILE,y1:top*TILE,y2:(end+1)*TILE,phase:r.range(0,TAU)});
    }
    for(let i=0;i<18;i++){
      const tx=r.int(22,MAP_W-5),fy=this.findFloor(tx);
      this.vents.push({x:(tx+.5)*TILE,y:(fy-.15)*TILE,strength:r.range(.3,1),phase:r.range(0,TAU)});
    }
    for(let i=0;i<18;i++){
      const cx=r.int(24,MAP_W-12),floor=this.findFloor(cx),w=r.int(4,13),depth=r.int(1,4);
      for(let x=cx;x<Math.min(MAP_W-2,cx+w);x++)for(let y=Math.max(3,floor-depth);y<floor;y++)if(this.get(x,y)===0)this.set(x,y,2);
      this.pools.push({x:cx*TILE,y:(floor-depth)*TILE,w:w*TILE,h:depth*TILE});
    }
  }
}

class SpatialHash{
  constructor(size=260){this.size=size;this.cells=new Map();}
  key(x,y){return `${Math.floor(x/this.size)},${Math.floor(y/this.size)}`;}
  rebuild(items){this.cells.clear();for(const item of items)if(!item.dead){const k=this.key(item.x,item.y);let cell=this.cells.get(k);if(!cell)this.cells.set(k,cell=[]);cell.push(item);}}
  query(x,y,r){const out=[],a=Math.floor((x-r)/this.size),b=Math.floor((x+r)/this.size),c=Math.floor((y-r)/this.size),d=Math.floor((y+r)/this.size);for(let cy=c;cy<=d;cy++)for(let cx=a;cx<=b;cx++){const cell=this.cells.get(`${cx},${cy}`);if(cell)out.push(...cell);}return out;}
}

const MISSIONS=[
  {id:'scan',title:'Ethology Survey',text:'Scan 5 distinct living species.',target:5,reward:40},
  {id:'plant',title:'Primary Production',text:'Record 6 mature plant species.',target:6,reward:48},
  {id:'storm',title:'Shelter Selection',text:'Survive a fracture storm with four fruit units.',target:1,reward:55},
  {id:'predation',title:'Trophic Observation',text:'Observe 4 successful predator strikes.',target:4,reward:55},
  {id:'biomass',title:'Living Carbon',text:'Help the biosphere exceed 180 plant biomass.',target:180,reward:65}
];

export class World{
  constructor(seed=Date.now()>>>0,options={}){
    this.seed=seed;this.rng=new RNG(seed);this.map=new TileMap(seed,this.rng);this.width=WORLD_W;this.height=WORLD_H;
    this.performanceTier=options.performanceTier||'medium';this.populationCap=this.capForTier(this.performanceTier);
    this.time=0;this.dayLength=210;this.day=1;this.daylight=.72;this.season=0;this.wind=0;this.windTarget=0;
    this.rainPhase='clear';this.rainClock=0;this.clearDuration=165;this.warningDuration=32;this.rainDuration=44;this.rainIntensity=0;this.floodY=WORLD_H+200;
    this.creatures=[];this.carcasses=[];this.pheromones=[];this.events=[];this.particles=[];this.grid=new SpatialHash();this.gridClock=0;
    this.points=Number(localStorageSafe('fw_points','0'))||0;this.bucks=Number(localStorageSafe('fw_bucks','0'))||0;this.research=Number(localStorageSafe('fw_research','0'))||0;this.samples=Number(localStorageSafe('fw_samples','0'))||0;
    this.discovered=new Set(JSON.parse(localStorageSafe('fw_species_v8','[]')));this.scanned=new Set(JSON.parse(localStorageSafe('fw_scans_v8','[]')));this.plantsScanned=new Set(JSON.parse(localStorageSafe('fw_plants_v8','[]')));
    this.predationObserved=Number(localStorageSafe('fw_predation_v8','0'))||0;this.cycle=1;this.bestCycle=Number(localStorageSafe('fw_best_cycle','1'))||1;
    this.missionIndex=Number(localStorageSafe('fw_mission_v8','0'))%MISSIONS.length;this.mission={...MISSIONS[this.missionIndex],progress:0};
    this.ecology={oxygen:.7,toxin:.12,nutrients:.7,temperature:.5,biodiversity:0,biomass:0,soilMoisture:.6};
    this.message='Move slowly. Observe life, graze plants, drink, and reach shelter before fracture rain.';this.messageTime=8;this.paused=false;this.gameOver=false;this.pendingEvolution=null;
    this.plants=new PlantSystem(this,this.performanceTier);
    const start=this.map.dens[0];this.player=new Creature(this,'nibbler',start.x,start.y-34,null,null,true);this.creatures.push(this.player);
    this.spawnEcology();this.rebuildGrid();this.refreshMission();
  }
  capForTier(t){return t==='low'?54:t==='medium'?78:t==='high'?104:132;}
  setPerformanceTier(t){this.performanceTier=t;this.populationCap=this.capForTier(t);this.plants.setTier(t);}
  spawnEcology(){
    const factor=this.performanceTier==='low' ? .56:this.performanceTier==='medium' ? .78:this.performanceTier==='high'?1:1.16;
    const counts={nibbler:22,skitter:17,carrion:10,hunter:7,glider:10,lurker:5};
    for(const [role,base] of Object.entries(counts))for(let i=0;i<Math.round(base*factor);i++){
      const tx=this.rng.int(24,MAP_W-5),y=(this.map.findFloor(tx)-1.2)*TILE;this.creatures.push(new Creature(this,role,tx*TILE,y));
    }
  }
  toast(text,sec=3){this.message=text;this.messageTime=sec;}
  addPoints(gp=0,gb=0){this.points+=gp;this.bucks+=gb;saveLocal('fw_points',this.points);saveLocal('fw_bucks',this.bucks);}
  addResearch(v,reason=''){this.research+=v;saveLocal('fw_research',this.research);if(reason)this.toast(`Research +${v}: ${reason}`,4);}
  rebuildGrid(){this.grid.rebuild(this.creatures);}
  nearby(c,r,predicate=()=>true){const rr=r*r;return this.grid.query(c.x,c.y,r).filter(o=>o!==c&&!o.dead&&predicate(o)&&dist2(c,o)<=rr);}
  nearest(c,predicate,maxDist=560){let best=null,bd=maxDist*maxDist;for(const o of this.grid.query(c.x,c.y,maxDist)){if(o===c||o.dead||!predicate(o))continue;const d=dist2(c,o);if(d<bd){bd=d;best=o;}}return best;}
  nearestCarcass(c,maxDist=650){let best=null,bd=maxDist*maxDist;for(const o of this.carcasses)if(o.mass>0){const d=dist2(c,o);if(d<bd){bd=d;best=o;}}return best;}
  nearestDen(c){let best=this.map.dens[0],bd=Infinity;for(const d of this.map.dens){const q=dist2(c,d);if(q<bd){bd=q;best=d;}}return best;}
  nearestWater(c,maxDist=800){let best=null,bd=maxDist*maxDist;for(const p of this.map.pools){const q={x:p.x+p.w*.5,y:p.y};const d=dist2(c,q);if(d<bd){bd=d;best=q;}}return best;}
  inDen(c){const d=this.nearestDen(c);return Math.hypot(d.x-c.x,d.y-c.y)<d.r;}
  lightAt(x,y){const biome=this.map.biomeAt(x);const canopy=biome.canopy;const depth=clamp((y/TILE-15)/38,0,1);return clamp(this.daylight*(1-canopy*.45)*(1-depth*.52)+.12,0.04,1);}
  windAt(x){return this.wind+Math.sin(this.time*.31+x*.003)*.18;}
  environmentAt(c){
    const biome=this.map.biomeAt(c.x),soil=this.plants.soil.sample(c.x);let toxin=biome.toxin,oxygen=biome.oxygen,temperature=soil.temperature;
    for(const v of this.map.vents){const d=Math.hypot(v.x-c.x,v.y-c.y);if(d<250)toxin+=(1-d/250)*v.strength*.26;}
    return{biome,toxin:clamp(toxin,0,1),oxygen:clamp(oxygen+this.ecology.oxygen*.12-.08,0,1),temperature:clamp(temperature,0,1),water:this.map.waterAtPixel(c.x,c.y)||c.y>this.floodY,soil};
  }
  tileCollision(c,dt){
    c.grounded=false;c.wall=0;c.onVine=false;c.slope=0;const r=c.r*.7;
    c.x+=c.vx*dt;
    let minX=Math.floor((c.x-r)/TILE),maxX=Math.floor((c.x+r)/TILE),minY=Math.floor((c.y-r)/TILE),maxY=Math.floor((c.y+r)/TILE);
    for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++)if(this.map.get(tx,ty)===1){const l=tx*TILE,rr=l+TILE;if(c.vx>0&&c.x+r>l&&c.x<l){c.x=l-r;c.vx*=-.04;c.wall=1;}else if(c.vx<0&&c.x-r<rr&&c.x>rr){c.x=rr+r;c.vx*=-.04;c.wall=-1;}}
    c.y+=c.vy*dt;minX=Math.floor((c.x-r)/TILE);maxX=Math.floor((c.x+r)/TILE);minY=Math.floor((c.y-r)/TILE);maxY=Math.floor((c.y+r)/TILE);
    for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++)if(this.map.get(tx,ty)===1){const top=ty*TILE,bottom=top+TILE;if(c.vy>0&&c.y+r>top&&c.y<top){c.y=top-r;c.vy=0;c.grounded=true;}else if(c.vy<0&&c.y-r<bottom&&c.y>bottom){c.y=bottom+r;c.vy=0;}}
    if(c.grounded){const leftFloor=this.map.findFloor(Math.floor((c.x-r*.7)/TILE)),rightFloor=this.map.findFloor(Math.floor((c.x+r*.7)/TILE));c.slope=clamp((rightFloor-leftFloor)*.16,-.45,.45);}
    for(const v of this.map.vines)if(Math.abs(c.x-v.x)<19&&c.y>v.y1&&c.y<v.y2){c.onVine=true;break;}
    c.x=clamp(c.x,c.r,WORLD_W-c.r);if(c.y>WORLD_H+120)this.kill(c,'fell into the abyss');
  }
  updateAstronomy(dt){
    const t=(this.time%this.dayLength)/this.dayLength;this.day=1+Math.floor(this.time/this.dayLength);this.daylight=clamp(.5+.5*Math.sin(t*TAU-Math.PI/2),0.04,1);this.season=(this.time/(this.dayLength*5))%1;
    this.windTarget=Math.sin(this.time*.023)*.48+Math.sin(this.time*.071+1.2)*.22+(this.rainPhase==='rain' ? .55:0);this.wind=lerp(this.wind,this.windTarget,dt*.08);
  }
  activity(c){return activityFactor(c.meta.activity,this.daylight);}
  updateAI(c,dt){
    c.aiClock-=dt;if(c.aiClock>0)return;
    const playerDistance=Math.hypot(c.x-this.player.x,c.y-this.player.y);const far=playerDistance>1100;
    const reaction=.12+(1.45-c.genome.reaction)*.18;const lod=far?(this.performanceTier==='low' ? .38:.25):0;c.aiClock=reaction+lod+this.rng.range(0,.08);c.decayMemory(c.aiClock);
    const env=this.environmentAt(c),rainUrgency=this.rainPhase==='clear'?0:this.rainPhase==='warning' ? .9:1.45,activity=this.activity(c);
    const threat=this.nearest(c,o=>o.meta.predator&&!c.meta.predator&&o.r>c.r*.58,460*c.genome.sensor*c.meta.fear);
    const prey=c.meta.predator?this.nearest(c,o=>!o.meta.predator&&o.r<c.r*(1.1+c.genome.jaw*.38),760*c.genome.sensor):null;
    const plant=!c.meta.predator?this.plants.nearest(c.x,c.y,700*c.genome.sensor,p=>p.species.edible>.2&&p.biomass>.08):null;
    const carcass=c.meta.scavenger||c.meta.predator?this.nearestCarcass(c,640):null;
    const water=c.hydration<.55?this.nearestWater(c):null;
    const mate=c.energy>.78&&c.stamina>.62&&c.reproCooldown<=0?this.nearest(c,o=>o.role===c.role&&o.energy>.72&&o.reproCooldown<=0,520):null;
    if(threat)c.remember('threat',threat,8);if(plant)c.remember('plant',plant,14);if(water)c.remember('water',water,12);if(mate)c.remember('mate',mate,8);
    const needs={
      shelter:rainUrgency*(this.inDen(c)?0:1),flee:threat?1.55:(c.memory.threat?.ref||c.memory.threat?0.65:0),drink:water?(1-c.hydration)*1.35:0,rest:(1-c.stamina)*.8+c.sleepDebt*.35,
      hunt:prey?(.28+(1-c.energy)*.92+c.genome.aggression*.52)*activity:0,scavenge:carcass?(.25+(1-c.energy)*.78):0,
      graze:plant?(.2+(1-c.energy)*.82)*activity:0,mate:mate?(c.energy-.68)*(.72+c.genome.social):0,explore:.10+c.genome.curiosity*.34*activity
    };
    let mode='observe',utility=.06;for(const [name,v] of Object.entries(needs))if(v>utility){mode=name;utility=v;}
    let target=null;if(mode==='shelter')target=this.nearestDen(c);else if(mode==='flee')target=threat||c.memory.threat?.ref||c.memory.threat;else if(mode==='drink')target=water||c.memory.water?.ref||c.memory.water;else if(mode==='hunt')target=prey;else if(mode==='scavenge')target=carcass;else if(mode==='graze')target=plant||c.memory.plant?.ref||c.memory.plant;else if(mode==='mate')target=mate;
    let dx=target?target.x-c.x:Math.sin(this.time*.11+c.id*1.73)*260,dy=target?target.y-c.y:Math.cos(this.time*.07+c.id)*80;
    const localKin=this.nearby(c,230,o=>o.role===c.role).length;
    const input=new Float32Array([clamp(dx/560,-1,1),clamp(dy/380,-1,1),threat?1:0,prey?1:0,c.energy,c.stamina,c.hydration,c.health,env.oxygen,env.toxin,this.rainIntensity,this.daylight,clamp(localKin/6,0,1),this.rng.signed()]);
    const out=c.brain.run(input);let move=clamp(sign(dx)*.72+out[0]*.45,-1,1);
    let targetSpeed=c.meta.pace*(.72+c.genome.stride*.25)*activity;
    if(mode==='flee'){move=-sign(dx);targetSpeed=c.meta.burst*.88;}
    if(mode==='rest'){move=0;targetSpeed=0;}
    if(mode==='observe'){move*=.22;targetSpeed*=.28;}
    if(mode==='graze'&&Math.abs(dx)<64){move*=.16;targetSpeed*=.12;}
    if(mode==='drink'&&Math.abs(dx)<50){move=0;targetSpeed=0;}
    if(mode==='hunt'){
      const distance=Math.hypot(dx,dy),stalkDistance=210+120*c.genome.patience;
      if(distance>stalkDistance){move*=.28;targetSpeed=c.meta.pace*.34;c.ai.mode='stalk';}else if(distance>70){targetSpeed=c.meta.burst*.72;c.ai.mode='pursue';}else{targetSpeed=0;c.ai.mode='pounce';}
    } else c.ai.mode=mode;
    if(c.role==='lurker'&&(mode==='hunt'||c.ai.mode==='stalk')){move*=.7;targetSpeed*=.72;}
    c.ai.target=target;c.ai.x=move;c.ai.y=clamp(sign(dy)*.5+out[1]*.35,-1,1);c.ai.targetSpeed=targetSpeed;
    c.ai.jump=(dy<-55||c.wall!==0||out[2]>.7)&&c.stamina>.2;c.ai.grab=out[3]>.28||mode==='shelter';
    c.ai.bite=(mode==='hunt'||mode==='scavenge'||mode==='graze')&&target&&Math.hypot(dx,dy)<c.r+(target.r||18)+24;
    c.ai.dash=(mode==='flee'||c.ai.mode==='pursue'||c.ai.mode==='pounce')&&c.stamina>.34;c.ai.signal=out[5];
    if(Math.abs(c.ai.signal)>.72&&c.signalCooldown<=0)this.emitPheromone(c,c.ai.signal>0?'food':'danger');
  }
  emitPheromone(c,kind){c.signalCooldown=3;this.pheromones.push({x:c.x,y:c.y,kind,strength:1,hue:kind==='food'?150:350});if(this.pheromones.length>120)this.pheromones.splice(0,this.pheromones.length-120);}
  movement(c,control,dt){
    c.attackCooldown=Math.max(0,c.attackCooldown-dt);c.reproCooldown=Math.max(0,c.reproCooldown-dt);c.pounceCooldown=Math.max(0,c.pounceCooldown-dt);c.signalCooldown=Math.max(0,c.signalCooldown-dt);c.scanCooldown=Math.max(0,c.scanCooldown-dt);c.eatClock=Math.max(0,c.eatClock-dt);c.age+=dt;
    const env=this.environmentAt(c),g=c.genome,meta=c.meta;c.inWater=env.water;
    const desiredX=clamp(control.x||0,-1,1);const targetSpeed=control.targetSpeed??(Math.abs(desiredX)*(control.dash?meta.burst:meta.pace)*(c.isPlayer?1.08:1));
    const turnRate=(1.6+g.reaction*1.7)*(c.stamina*.45+.55);c.intentX=lerp(c.intentX,desiredX,clamp(dt*turnRate,0,1));c.intentY=lerp(c.intentY,control.y||0,clamp(dt*turnRate,0,1));
    const fatigueFactor=.48+c.stamina*.52,healthFactor=.45+c.health*.55,armorPenalty=1-g.armor*.16;
    const desiredVx=c.intentX*targetSpeed*fatigueFactor*healthFactor*armorPenalty;
    const accel=(c.grounded?125:64)*(0.6+g.muscle*.55)*(0.72+g.balance*.25)/Math.max(.7,c.mass);
    c.ax=(desiredVx-c.vx)*clamp(accel/Math.max(30,Math.abs(desiredVx-c.vx))*dt,0,1)/Math.max(dt,.0001);
    c.vx=approach(c.vx,desiredVx,accel*dt);
    const speed=Math.abs(c.vx),strideHz=clamp(.55+speed/(58+g.stride*20),.5,2.35);c.gaitRate=lerp(c.gaitRate,strideHz,dt*2.5);c.gait+=dt*c.gaitRate*TAU;
    const gravity=1260*env.biome.gravity;
    if(c.inWater){c.vy+=gravity*.11*dt;c.vx*=Math.pow(.2,dt);c.vy*=Math.pow(.13,dt);c.vx+=c.intentX*(95+g.fins*30)*dt;c.vy+=c.intentY*(92+g.fins*34)*dt;c.oxygen-=dt*Math.max(.003,.024-g.lung*.017);}
    else if(meta.flyer){c.vy+=gravity*.24*dt;if(control.jump&&c.stamina>.08){c.vy-=dt*(350+g.fins*55);c.stamina-=dt*.085;}c.oxygen=Math.min(1,c.oxygen+dt*.18);}
    else{c.vy+=gravity*dt;c.oxygen=Math.min(1,c.oxygen+dt*.22);}
    if(c.onVine&&control.grab){c.vy*=Math.pow(.25,dt);c.vy+=(control.y||0)*(110+g.agility*45)*dt;c.stamina-=dt*.018;}
    if(c.wall&&control.grab){c.vy=Math.min(c.vy,55);if(control.y)c.vy=control.y*(72+g.agility*32);}
    const canJump=c.grounded||c.wall||c.onVine||c.inWater;
    if(control.jump&&canJump&&c.stamina>.16&&c.pounceCooldown<=0){c.vy=c.inWater?-205-g.fins*25:-285-g.muscle*54;c.vx+=(c.wall?-c.wall:(c.intentX||c.facing))*(40+g.agility*30);c.stamina-=.12;c.pounceCooldown=.38;}
    if(control.dash&&c.stamina>.05){c.stamina-=dt*(.09+.05*c.mass);}
    const prevX=c.x,prevY=c.y;this.tileCollision(c,dt);c.fitness.distance+=Math.hypot(c.x-prevX,c.y-prevY)/1000;
    if(c.grounded&&Math.abs(c.intentX)<.05)c.vx*=Math.pow(.03,dt);if(c.grounded)c.vx*=Math.pow(.72,dt*(1+g.armor*.3));
    c.ax=(c.vx-(c._lastVx||0))/Math.max(dt,.001);c._lastVx=c.vx;
    const movementLoad=(speed/Math.max(40,meta.pace))**2*(.018+.014*c.mass);c.stamina=clamp(c.stamina-dt*(movementLoad+(control.dash ? .055:0))+dt*(speed<12 ? .055:.012)*g.endurance,0,1);
    c.hydration=clamp(c.hydration-dt*(.00075+.0008*g.metabolism+movementLoad*.0045),0,1);c.sleepDebt=clamp(c.sleepDebt+dt*(.0007+movementLoad*.0004)-(speed<8?dt*.0038:0),0,1);
    c.energy=clamp(c.energy-dt*((.0009+movementLoad*.0065)*g.metabolism+g.armor*.00025),0,1);c.stomach=Math.max(0,c.stomach-dt*.0018*g.metabolism);
    if(c.inWater&&speed<24&&c.hydration<1)c.hydration=Math.min(1,c.hydration+dt*.22);
    const toxinStress=Math.max(0,env.toxin-g.toxinResist*.7),coldStress=Math.max(0,.36-env.temperature-g.coldResist*.22);
    c.health-=dt*(toxinStress*.012+coldStress*.014+(c.oxygen<=0 ? .09:0)+(c.hydration<=0 ? .035:0)+(c.energy<=0 ? .028:0));
    c.stress=lerp(c.stress,clamp((1-c.health)*.5+(1-c.stamina)*.25+(this.rainPhase==='rain' ? .35:0),0,1),dt*1.5);
    if(control.bite)this.feedOrAttack(c);if(control.scan&&c.isPlayer)this.scan(c);
    this.tryMate(c,dt);this.updateBody(c,dt);c.updateVisualPose(dt);
    if(c.energy<=0&&c.stomach<=0)this.kill(c,'starved');if(c.health<=0)this.kill(c,'was consumed');if(c.age>390+(1/g.metabolism)*80)this.kill(c,'aged out');
  }
  feedOrAttack(c){
    if(c.attackCooldown>0||c.eatClock>0)return;
    const plant=this.plants.nearest(c.x+c.facing*c.r,c.y,44+c.r,p=>p.biomass>.04&&p.species.edible>.15);
    if(plant&&!c.meta.predator){const gain=this.plants.nibble(plant,.06+.045*c.genome.jaw,c);if(gain>0){c.energy=clamp(c.energy+gain*.5*c.genome.digestion,0,1);c.stomach=clamp(c.stomach+gain*.6,0,1);c.hydration=clamp(c.hydration+gain*.08,0,1);c.fitness.food++;c.fitness.plants++;c.eatClock=.48+.35*(1/c.genome.digestion);if(c.isPlayer){this.addPoints(1,0);this.samples+=plant.species.fruit>.2?1:0;saveLocal('fw_samples',this.samples);this.toast(`Grazed ${plant.species.name} · fruit ${c.food}/4`,2.4);this.refreshMission();}return;}}
    const carc=this.nearestCarcass(c,48+c.r);if(carc&&dist2(c,carc)<(c.r+34)**2&&(c.meta.scavenger||c.meta.predator)){const amount=Math.min(carc.mass,.08+.04*c.genome.jaw);carc.mass-=amount;c.energy=clamp(c.energy+amount*.35,0,1);c.stomach=clamp(c.stomach+amount*.45,0,1);c.eatClock=.62;return;}
    this.bite(c);
  }
  bite(c){
    if(c.attackCooldown>0)return;c.attackCooldown=.64+.12/c.genome.reaction;const reachX=c.x+c.facing*(c.r+22+c.genome.jaw*5);let victim=null,bd=(48+c.genome.jaw*7)**2;
    for(const o of this.grid.query(reachX,c.y,74))if(o!==c&&!o.dead){const d=(o.x-reachX)**2+(o.y-c.y)**2;if(d<bd){bd=d;victim=o;}}
    if(victim){const raw=(c.meta.predator ? .27:.11)*(.68+c.genome.jaw*.55)*(c.stamina*.35+.65);const damage=raw*(1-victim.genome.armor*.38);victim.health-=damage;victim.vx+=c.facing*(95+c.genome.muscle*58)/victim.mass;victim.vy-=45;c.stamina=Math.max(0,c.stamina-.06);this.events.push({type:'bite',x:victim.x,y:victim.y,time:this.time});if(c.meta.predator){this.predationObserved++;saveLocal('fw_predation_v8',this.predationObserved);if(victim.health<=0)c.fitness.kills++;this.refreshMission();}}
  }
  tryMate(c,dt){
    if(c.isPlayer||c.reproCooldown>0||c.energy<.78||c.stamina<.6||this.creatures.length>=this.populationCap)return;const mate=c.ai.mode==='mate'?c.ai.target:null;
    if(!mate||mate.dead||mate.reproCooldown>0||mate.energy<.72||dist2(c,mate)>(c.r+mate.r+18)**2)return;if(!this.rng.chance(dt*.85))return;
    const child=new Creature(this,c.role,(c.x+mate.x)/2+this.rng.range(-10,10),Math.min(c.y,mate.y)-10,c,mate);child.energy=.42;c.energy-=.22;mate.energy-=.2;c.reproCooldown=34;mate.reproCooldown=34;c.fitness.offspring++;mate.fitness.offspring++;this.creatures.push(child);this.registerSpecies(child);this.events.push({type:'birth',x:child.x,y:child.y,time:this.time});
  }
  updateBody(c,dt){
    const speed=Math.abs(c.vx),rest=c.r*.36,head=c.spine[0];head.x=lerp(head.x,c.x-c.facingVisual*c.r*.10,clamp(dt*10,0,1));head.y=lerp(head.y,c.y+Math.sin(c.breath)*c.r*.025,clamp(dt*10,0,1));
    for(let i=1;i<c.spine.length;i++){const a=c.spine[i-1],b=c.spine[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;const wave=Math.sin(c.gait-i*.48)*c.r*.018*(.3+speed/80);const tx=a.x+dx/d*rest,ty=a.y+dy/d*rest+wave;b.x=lerp(b.x,tx,clamp(dt*8,0,1));b.y=lerp(b.y,ty,clamp(dt*8,0,1));}
    if(!c.feet.length)return;const pairCount=Math.max(1,Math.ceil(c.feet.length/2));for(let i=0;i<c.feet.length;i++){const foot=c.feet[i],pair=Math.floor(i/2),side=i%2?-1:1,phase=(c.gait/TAU+foot.phase)%1;const anchorIndex=Math.min(c.spine.length-1,1+Math.floor((pair/(pairCount-1||1))*(c.spine.length-3)));const anchor=c.spine[anchorIndex]||c;const stride=c.r*(.55+c.genome.stride*.38);let tx=anchor.x+c.facingVisual*((phase<.5?phase*2:2-phase*2)-.5)*stride,ty=c.y+c.r*.72+side*c.r*.06;if(!c.grounded){ty=anchor.y+c.r*.65+Math.sin(phase*TAU)*c.r*.18;}foot.x=lerp(foot.x,tx,clamp(dt*(phase<.5?5:11),0,1));foot.y=lerp(foot.y,ty,clamp(dt*(phase<.5?4:12),0,1));foot.planted=c.grounded&&phase>.46;}
  }
  registerSpecies(c){if(this.discovered.has(c.speciesKey))return false;this.discovered.add(c.speciesKey);saveLocal('fw_species_v8',JSON.stringify([...this.discovered]));if(c.isPlayer||Math.hypot(c.x-this.player.x,c.y-this.player.y)<500){this.addResearch(7,`new lineage ${c.name}`);this.addPoints(4,0);}this.refreshMission();return true;}
  scan(c){
    if(c.scanCooldown>0)return;c.scanCooldown=1;const creature=this.nearest(c,()=>true,250*c.genome.sensor);const plant=this.plants.nearest(c.x,c.y,220*c.genome.sensor,p=>p.maturity>.4);
    const cd=creature?Math.hypot(creature.x-c.x,creature.y-c.y):Infinity,pd=plant?Math.hypot(plant.x-c.x,plant.y-c.y):Infinity;
    if(!creature&&!plant){this.toast('Scanner found no mature organism.',2);return;}
    if(pd<cd){const fresh=!this.plantsScanned.has(plant.species.id);this.plantsScanned.add(plant.species.id);saveLocal('fw_plants_v8',JSON.stringify([...this.plantsScanned]));this.addResearch(fresh?10:2,`${plant.species.name} · biomass ${plant.biomass.toFixed(2)}`);this.addPoints(fresh?4:1,0);this.events.push({type:'scanPlant',x:plant.x,y:plant.y,time:this.time,target:plant});}
    else{const fresh=!this.scanned.has(creature.speciesKey);this.scanned.add(creature.speciesKey);saveLocal('fw_scans_v8',JSON.stringify([...this.scanned]));creature.fitness.scans++;c.fitness.scans++;this.addResearch(fresh?11:2,`${creature.meta.name} · gen ${creature.generation}`);this.addPoints(fresh?5:1,0);this.events.push({type:'scan',x:creature.x,y:creature.y,time:this.time,target:creature});}
    this.refreshMission();
  }
  refreshMission(){
    const m=this.mission;if(m.id==='scan')m.progress=this.scanned.size;else if(m.id==='plant')m.progress=this.plantsScanned.size;else if(m.id==='storm')m.progress=Math.max(0,this.cycle-1);else if(m.id==='predation')m.progress=this.predationObserved;else if(m.id==='biomass')m.progress=Math.floor(this.plants.totalBiomass());
    if(m.progress>=m.target){this.addResearch(m.reward,`mission complete: ${m.title}`);this.addPoints(m.reward,this.missionIndex%3===2?1:0);this.missionIndex=(this.missionIndex+1)%MISSIONS.length;saveLocal('fw_mission_v8',this.missionIndex);this.mission={...MISSIONS[this.missionIndex],progress:0};}
  }
  evolutionChoices(){const o=[{id:'stride',title:'Elastic Tendons',text:'Longer efficient strides and steadier footing'},{id:'endurance',title:'Dense Mitochondria',text:'Slower fatigue and faster recovery'},{id:'balance',title:'Vestibular Crown',text:'Better slope control and landing stability'},{id:'sensor',title:'Compound Cilia',text:'Wider scan and perception range'},{id:'digestion',title:'Symbiotic Gut',text:'More energy from plants and carcasses'},{id:'armor',title:'Layered Dermis',text:'More protection with a small movement cost'},{id:'toxin',title:'Catalytic Blood',text:'Higher toxin resistance'},{id:'cold',title:'Antifreeze Cells',text:'Higher cold resistance'}];const out=[];while(out.length<3){const q=this.rng.pick(o);if(!out.includes(q))out.push(q);}return out;}
  applyEvolution(id){const g=this.player.genome;if(id==='stride')g.stride=clamp(g.stride*1.16,0,1.6);else if(id==='endurance')g.endurance=clamp(g.endurance*1.18,0,1.6);else if(id==='balance')g.balance=clamp(g.balance*1.18,0,1.6);else if(id==='sensor')g.sensor=clamp(g.sensor*1.22,0,1.6);else if(id==='digestion')g.digestion=clamp(g.digestion*1.18,0,1.6);else if(id==='armor')g.armor=clamp(g.armor+.18,0,1.6);else if(id==='toxin')g.toxinResist=clamp(g.toxinResist+.25,0,1.6);else if(id==='cold')g.coldResist=clamp(g.coldResist+.25,0,1.6);this.player.speciesKey=genomeKey(g,this.player.role);this.pendingEvolution=null;this.paused=false;this.addResearch(9,'player lineage adapted');}
  kill(c,reason){if(c.dead)return;c.dead=true;this.carcasses.push({x:c.x,y:c.y,mass:c.r*.075+.7,hue:c.hue,age:0,speciesKey:c.speciesKey});this.plants.soil.addOrganic(c.x,.08+c.r*.006);if(c.isPlayer){this.gameOver=true;this.toast(`You ${reason}. Respawn from den memory.`,99);}}
  respawn(){const den=this.map.dens[0],old=this.player,replacement=new Creature(this,'nibbler',den.x,den.y-34,old,null,true);this.player=replacement;this.creatures.push(replacement);this.gameOver=false;this.rainPhase='clear';this.rainClock=0;this.rainIntensity=0;this.floodY=WORLD_H+200;this.toast('New body grown from den memory.');}
  updateRain(dt){
    this.rainClock+=dt;if(this.rainPhase==='clear'){this.rainIntensity=0;if(this.rainClock>=this.clearDuration){this.rainClock=0;this.rainPhase='warning';this.toast('Atmospheric fracture detected. Move toward shelter.',8);}}
    else if(this.rainPhase==='warning'){this.rainIntensity=clamp(this.rainClock/this.warningDuration,0,.4);if(this.rainClock>=this.warningDuration){this.rainClock=0;this.rainPhase='rain';this.toast('FRACTURE RAIN — SHELTER NOW',8);}}
    else{this.rainIntensity=clamp(this.rainClock/6,0,1);this.floodY=lerp(WORLD_H+100,WORLD_H*.60,clamp(this.rainClock/this.rainDuration,0,1));for(const c of this.creatures)if(!c.dead&&!this.inDen(c)){if(c.y>this.floodY){c.vy-=390*dt;c.health-=.10*dt;}c.health-=this.rainIntensity*.016*dt*(1-c.genome.armor*.12);}if(this.rainClock>=this.rainDuration)this.finishCycle();}
  }
  finishCycle(){const survived=!this.player.dead&&this.inDen(this.player)&&this.player.food>=4;if(survived){this.cycle++;this.bestCycle=Math.max(this.bestCycle,this.cycle);saveLocal('fw_best_cycle',this.bestCycle);this.addPoints(28,this.cycle%3===0?1:0);this.addResearch(14,'fracture-cycle survival');this.player.food=Math.max(0,this.player.food-4);this.player.health=1;this.player.energy=1;this.player.stamina=1;this.player.hydration=1;this.player.fitness.storms++;this.pendingEvolution=this.evolutionChoices();this.paused=true;this.toast(`Cycle ${this.cycle}. Choose one adaptation.`,99);this.refreshMission();}else if(!this.player.dead)this.kill(this.player,this.player.food<4?'entered shelter without four fruit units':'missed the shelter window');this.rainPhase='clear';this.rainClock=0;this.rainIntensity=0;this.floodY=WORLD_H+200;}
  updateEcology(){const biomass=this.plants.totalBiomass(),livingPlants=this.plants.livingCount();this.ecology.biomass=biomass;this.ecology.soilMoisture=this.plants.meanMoisture();this.ecology.nutrients=clamp(this.plants.soil.nutrients.reduce((a,b)=>a+b,0)/MAP_W,0,1.4);this.ecology.oxygen=clamp(.46+biomass/520-this.creatures.length/900,.25,.96);this.ecology.toxin=clamp(.06+this.map.vents.reduce((s,v)=>s+v.strength,0)/180,0,.72);this.ecology.temperature=clamp(.46+(this.daylight-.5)*.14+Math.sin(this.season*TAU)*.05,.16,.82);this.ecology.biodiversity=this.speciesCount()+this.plantsScanned.size*.35;this._livingPlants=livingPlants;}
  step(dt,playerInput={}){
    if(this.paused)return;this.time+=dt;if(this.messageTime>0)this.messageTime-=dt;this.updateAstronomy(dt);this.updateRain(dt);this.plants.update(dt);
    this.gridClock-=dt;if(this.gridClock<=0){this.rebuildGrid();this.gridClock=this.performanceTier==='low' ? .34:.22;}
    for(const p of this.pheromones)p.strength-=dt*.1;this.pheromones=this.pheromones.filter(p=>p.strength>0);
    const snapshot=[...this.creatures];for(const c of snapshot){if(c.dead)continue;const distance=c.isPlayer?0:Math.hypot(c.x-this.player.x,c.y-this.player.y);const skip=this.performanceTier==='low'&&distance>950&&(((this.time*60+c.id)|0)%2);if(skip)continue;let control;if(c.isPlayer){control={...playerInput,targetSpeed:Math.abs(playerInput.x||0)*(playerInput.dash?c.meta.burst:c.meta.pace*1.05)};}else{this.updateAI(c,dt);control={x:c.ai.x,y:c.ai.y,jump:c.ai.jump,grab:c.ai.grab,bite:c.ai.bite,dash:c.ai.dash,scan:false,targetSpeed:c.ai.targetSpeed};}this.movement(c,control,skip?dt*2:dt);}
    this.creatures=this.creatures.filter(c=>!c.dead||c.isPlayer);for(const carc of this.carcasses){carc.age+=dt;carc.mass-=dt*.0038;this.plants.soil.addOrganic(carc.x,dt*.0008);}this.carcasses=this.carcasses.filter(c=>c.mass>0&&c.age<190);
    if(this.creatures.filter(c=>!c.isPlayer&&!c.dead).length<this.populationCap*.5&&this.rng.chance(dt*.32)){const role=this.rng.pick(['nibbler','nibbler','skitter','skitter','glider','carrion','hunter','lurker']),tx=this.rng.int(22,MAP_W-5),creature=new Creature(this,role,tx*TILE,(this.map.findFloor(tx)-1.2)*TILE);this.creatures.push(creature);this.registerSpecies(creature);}
    if(((this.time*2)|0)!==(((this.time-dt)*2)|0)){this.updateEcology();this.refreshMission();}
  }
  rainRemaining(){if(this.rainPhase==='clear')return this.clearDuration-this.rainClock+this.warningDuration;if(this.rainPhase==='warning')return this.warningDuration-this.rainClock;return this.rainDuration-this.rainClock;}
  speciesCount(){const s=new Set();for(const c of this.creatures)if(!c.dead)s.add(c.speciesKey);return s.size;}
  stats(){const counts={};for(const c of this.creatures)if(!c.dead)counts[c.role]=(counts[c.role]||0)+1;const biome=this.map.biomeAt(this.player.x);return{population:this.creatures.filter(c=>!c.dead).length,species:this.speciesCount(),plants:this.plants.livingCount(),biomass:this.plants.totalBiomass(),soilMoisture:this.plants.meanMoisture(),day:this.day,daylight:this.daylight,cycle:this.cycle,bestCycle:this.bestCycle,rainPhase:this.rainPhase,rainRemaining:this.rainRemaining(),points:this.points,bucks:this.bucks,research:this.research,samples:this.samples,biome:biome.name,ecology:{...this.ecology},mission:{...this.mission},counts};}
}

function localStorageSafe(key,fallback){try{return typeof localStorage!=='undefined'?localStorage.getItem(key)??fallback:fallback;}catch{return fallback;}}
function saveLocal(key,value){try{if(typeof localStorage!=='undefined')localStorage.setItem(key,String(value));}catch{}}
