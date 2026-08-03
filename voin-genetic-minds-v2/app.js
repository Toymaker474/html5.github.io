import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const rand = (a) => a[(Math.random() * a.length) | 0];
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || .01)) * Math.cos(Math.PI * 2 * Math.random());

const NAMES = ['Veyra','Morrow','Sable','Karn','Nyx','Orin','Ilyx','Rook','Ash','Mara'];
const LINES = ['Stormborn','Graveglass','Red Choir','Black Bell','Ichor Wolf'];
const HEARTS = {
  'Mortal Heart': {hp:5,dmg:1.16,res:.45,luck:.45,noHeal:true},
  'Ruby Heart': {hp:4,res:.24},
  'Emerald Heart': {hp:4,revive:.2},
  'Golden Heart': {hp:1,luck:.5},
  'Vampiric Heart': {hp:4,vamp:.08},
};
const ARTS = {
  'Ritual Skull': {orb:.08},
  'Necromantic Goblet': {peel:.1},
  'Golden Scarab': {scarab:.04},
  'Hand of Misfortune': {chest:.65,boom:.19},
  'Tibia': {cool:.06},
};
const WEAPONS = {
  'Sickles': {damage:15,speed:2.3,kind:'dual'},
  'Dual Iron Swords': {damage:25,speed:1.8,kind:'dual'},
  'Scorching Twins': {damage:18,speed:2.05,kind:'dual'},
  'Barbarian Blade': {damage:56,speed:.92,kind:'sword'},
  'Heavy Hammer': {damage:96,speed:.66,kind:'hammer'},
};
const RUNES = {
  'Gathering Storm': {hits:4,extra:.8},
  'Minor Energy Flow': {hits:3,cool:.11},
  'Major Energy Flow': {hits:5,cool:.08},
  'Thundering Echoes': {hits:5,extra:2},
};
const RINGS = ['Ring of Murder','Bloody Ring','Floating Butterfly','Crystalline Ring'];
const NECKS = ['Runic Amulet','Dragonhead','Shardcaller','Poison Vial'];

let generation = 1;
let minds = [];
let selected = 0;
let playing = false;
let autoLeft = 0;
let totalDeaths = 0;
let lastSim = performance.now();
let lastRenderUI = 0;

function randomGenome(i){
  return {
    name:NAMES[i], line:LINES[i%LINES.length],
    heart:rand(Object.keys(HEARTS)), art:rand(Object.keys(ARTS)),
    weapon:rand(Object.keys(WEAPONS)), rune:rand(Object.keys(RUNES)),
    ring:rand(RINGS), neck:rand(NECKS),
    aggression:Math.random(), greed:Math.random(), fear:Math.random(),
    curiosity:Math.random(), discipline:Math.random(), reflex:Math.random(),
    resource:Math.random(), luck:Math.random()
  };
}
function spawnMind(g,i){
  const hp=HEARTS[g.heart].hp;
  return {id:i,g,hp,maxHp:hp,ichor:0,bank:0,loot:0,kills:0,wave:1,foes:3,
    chest:Math.random()<.7,state:'active',action:'Entering',thought:'I am alive. I must learn what this world punishes.',
    decisions:{},memory:[],nextDecision:.2,time:0,fitness:0,runeHits:0,streak:0,swing:0,hurt:0,power:0};
}
function reset(){
  generation=1; totalDeaths=0; autoLeft=0; playing=false; selected=0;
  minds=NAMES.map((_,i)=>spawnMind(randomGenome(i),i));
  $('run').textContent='AWAKEN MINDS';
  rebuildSelectedWorld(true); renderUI();
}
function remember(m,text){m.thought=text;m.memory.unshift(text);m.memory=m.memory.slice(0,18)}
function scoreActions(m){
  const g=m.g; const danger=(1-m.hp/m.maxHp)*.62+Math.min(1,m.foes/7)*.38; const wealth=clamp(m.ichor/500);
  return {
    Attack:m.foes?g.aggression+.55*g.discipline-danger*g.fear*.26:-2,
    Power:m.foes?.68*g.aggression+.65*Math.min(1,m.foes/5)+m.power*.25:-2,
    Dash:m.foes?.35+g.reflex*.78+danger*.45:-2,
    Chest:m.chest?g.greed*1.25+g.luck*.48-danger*g.fear*.55:-2,
    Explore:g.curiosity*.72+(m.wave<4?.22:0)-danger*.35,
    Extract:(danger*g.fear*1.55+wealth*g.greed*1.15+(m.hp===1?.8:0))*(m.wave>1?1:0)
  };
}
function decide(m){
  m.decisions=scoreActions(m);
  m.action=Object.entries(m.decisions).sort((a,b)=>b[1]-a[1])[0][0];
  if(m.action==='Chest')remember(m,'The chest could perfect this build. The risk is acceptable.');
  else if(m.action==='Dash')remember(m,'The enemy has committed. I move through the safe edge.');
  else if(m.action==='Power')remember(m,'Bodies are clustered. Spend the rune charge now.');
  else if(m.action==='Extract')remember(m,m.g.greed>.7?'I hate leaving treasure—but dead hands own nothing.':'Survival is the only permanent upgrade.');
  else if(m.action==='Explore')remember(m,'No immediate opening. Search for better terrain and Ichor.');
  else remember(m,`${m.foes} hostiles. I test ${m.g.weapon} and remember the cost.`);
}
function calculateFitness(m){
  const survived=m.state==='extracted'?1:0; const mins=Math.max(.2,m.time/15); const ipm=(survived?m.bank:0)/mins; const loot=survived?m.loot:0;
  const goal=$('goal').value;
  if(goal==='ichor')return ipm;
  if(goal==='loot')return loot*82+ipm*.15;
  if(goal==='survival')return survived*650+ipm*.18;
  return survived*170+ipm*.56+loot*56+m.kills*2;
}
function resolve(m){
  const g=m.g,h=HEARTS[g.heart],w=WEAPONS[g.weapon],r=RUNES[g.rune];
  const brutality=+$('hard').value/58;
  let incoming=.052*brutality*m.foes*(1-g.reflex*.46)*(1-g.discipline*.2);
  if(m.action==='Attack'||m.action==='Power'){
    let mult=m.action==='Power'?1.7:1;
    const crit=Math.random()<.08+(g.ring==='Ring of Murder'?.14:0);
    if(crit)mult*=1.8;
    if(g.neck==='Runic Amulet'&&m.action==='Power')mult*=1.28;
    const hit=w.damage*(h.dmg||1)*mult*(.86+Math.random()*.28);
    let kills=Math.min(m.foes,Math.max(0,Math.floor(hit/(38+m.wave*8))));
    m.runeHits++;
    if(m.runeHits%r.hits===0){kills=Math.min(m.foes,kills+Math.max(1,Math.floor(r.extra||1)));m.power=1;}
    m.foes-=kills;m.kills+=kills;m.streak+=kills;
    let gain=kills*(8+Math.random()*8)*(1+(h.res||0)+g.resource*.35);
    if(ARTS[g.art].peel)gain+=m.foes*ARTS[g.art].peel*5;
    if(ARTS[g.art].orb&&Math.random()<1-Math.pow(1-ARTS[g.art].orb,Math.max(1,kills)))gain+=18+Math.random()*22;
    m.ichor+=gain;m.swing=.34;m.power=Math.max(0,m.power-.3);
    if(!h.noHeal&&kills&&Math.random()<.08+(h.vamp||0)+(g.ring==='Bloody Ring'?.03:0))m.hp=Math.min(m.maxHp,m.hp+1);
    incoming*=m.action==='Power'?.73:1;
  }else if(m.action==='Dash'){incoming*=.12+.28*(1-g.reflex);}
  else if(m.action==='Explore'){m.ichor+=5+Math.random()*11;incoming*=.42;}
  else if(m.action==='Chest'){
    m.chest=false;
    if(ARTS[g.art].boom&&Math.random()<ARTS[g.art].boom){m.hp--;m.hurt=.7;remember(m,'The cursed chest detonated. Greed became pain.');spawnBurst('fire');}
    else{const luck=1+(h.luck||0)+g.luck*.45+(ARTS[g.art].chest||0)+(ARTS[g.art].scarab?Math.min(30,m.streak)*ARTS[g.art].scarab:0);m.loot+=(1+Math.random()*2.5)*luck;m.ichor+=22+Math.random()*30;remember(m,'Rare equipment acquired. The lineage has another build path.');spawnBurst('gold');}
  }else if(m.action==='Extract'){
    m.bank=m.ichor;m.state='extracted';m.fitness=calculateFitness(m);remember(m,`Portal stable. ${m.bank|0} Ichor belongs to the lineage.`);showEndState(m);return;
  }
  if(Math.random()<incoming){m.hp--;m.hurt=.48;m.streak=0;remember(m,`Impact. ${m.hp} Heart${m.hp===1?'':'s'} remain.`);flashDamage();spawnBurst('blood');}
  if(m.hp<=0){
    if(h.revive&&Math.random()<h.revive){m.hp=1;remember(m,'The Emerald Heart restarted me. This life continues.');spawnBurst('ichor');}
    else{m.state='dead';m.fitness=calculateFitness(m);totalDeaths++;remember(m,`Death. ${m.ichor|0} carried Ichor is lost.`);showEndState(m);return;}
  }
  if(m.foes<=0){
    m.wave++;
    if(m.wave>7){m.bank=m.ichor;m.state='extracted';m.fitness=calculateFitness(m);remember(m,'Region cleared. The portal accepts the survivor.');showEndState(m);}
    else{m.foes=2+Math.floor(m.wave*.75)+Math.floor(Math.random()*2);m.chest=Math.random()<.58;remember(m,`Encounter ${m.wave}: ${m.foes} new bodies move in the dark.`);syncEnemyCount();}
  }
}
function tickMind(m,dt){
  if(m.state!=='active')return;
  m.time+=dt;m.nextDecision-=dt;m.swing=Math.max(0,m.swing-dt);m.hurt=Math.max(0,m.hurt-dt);m.power=Math.max(0,m.power-dt*.12);
  if(m.nextDecision<=0){decide(m);resolve(m);m.fitness=calculateFitness(m);m.nextDecision=(.25+Math.random()*.32)/(m.action==='Attack'?WEAPONS[m.g.weapon].speed:1);if(ARTS[m.g.art].cool)m.nextDecision*=1-ARTS[m.g.art].cool;}
}
function cross(a,b,i){
  const g={name:NAMES[i],line:Math.random()<.5?a.line:b.line};
  ['heart','art','weapon','rune','ring','neck'].forEach(k=>g[k]=Math.random()<.5?a[k]:b[k]);
  ['aggression','greed','fear','curiosity','discipline','reflex','resource','luck'].forEach(k=>g[k]=clamp((a[k]+b[k])/2+gauss()*.055));
  const rate=+$('mut').value/100; const sets={heart:Object.keys(HEARTS),art:Object.keys(ARTS),weapon:Object.keys(WEAPONS),rune:Object.keys(RUNES),ring:RINGS,neck:NECKS};
  Object.entries(sets).forEach(([k,v])=>{if(Math.random()<rate)g[k]=rand(v)});
  ['aggression','greed','fear','curiosity','discipline','reflex','resource','luck'].forEach(k=>{if(Math.random()<rate*1.4)g[k]=clamp(g[k]+gauss()*.2)});
  return g;
}
function breed(){
  minds.forEach(m=>m.fitness=calculateFitness(m));const ranked=[...minds].sort((a,b)=>b.fitness-a.fitness);const parents=ranked.slice(0,4).map(m=>m.g);
  generation++;minds=NAMES.map((_,i)=>spawnMind(i<2?{...parents[i],name:NAMES[i]}:cross(rand(parents),rand(parents),i),i));selected=0;hideEndState();rebuildSelectedWorld(true);renderUI();
}

const container=$('viewport');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;container.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x06070a);scene.fog=new THREE.FogExp2(0x08090c,.032);
const camera=new THREE.PerspectiveCamera(67,16/9,.1,100);camera.position.set(0,1.62,1.8);scene.add(camera);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),.85,.65,.6));composer.addPass(new OutputPass());
const world=new THREE.Group(),enemyRoot=new THREE.Group(),fxRoot=new THREE.Group();scene.add(world,enemyRoot,fxRoot);
const hemi=new THREE.HemisphereLight(0x8fa8d7,0x211710,.72);scene.add(hemi);
const moon=new THREE.DirectionalLight(0xa9c1ff,1.65);moon.position.set(5,9,4);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);scene.add(moon);
const fireLight=new THREE.PointLight(0xff6f31,6,18,2),iceLight=new THREE.PointLight(0x65cfff,3,15,2);scene.add(fireLight,iceLight);
const loader=new GLTFLoader();
let soldierAsset=null,soldierAnimations=[],enemyVisuals=[],weaponRig,portal,chest,clock=new THREE.Clock(),particles=[];

function resize(){const r=container.getBoundingClientRect();renderer.setSize(r.width,r.height,false);composer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}window.addEventListener('resize',resize);
function clearGroup(g){while(g.children.length){const c=g.children[0];g.remove(c);c.traverse?.(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.()})}}
function buildWorld(){
  clearGroup(world);const region=$('region').value;let ground=0x151517,fog=0x07080b,accent=0x8d1724;
  if(region==='cathedral'){ground=0x21110d;fog=0x150705;accent=0xff4c28}else if(region==='frozen'){ground=0x101820;fog=0x060b11;accent=0x58baff}
  scene.background.setHex(fog);scene.fog.color.setHex(fog);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(36,64,50,80),new THREE.MeshStandardMaterial({color:ground,roughness:.96,metalness:.04}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;world.add(floor);
  for(let i=0;i<130;i++){const s=new THREE.Mesh(new THREE.DodecahedronGeometry(.12+Math.random()*.34,0),new THREE.MeshStandardMaterial({color:0x292a2d,roughness:1}));s.scale.y=.3;s.position.set((Math.random()-.5)*15,.04,-Math.random()*52);s.rotation.y=Math.random()*Math.PI;s.castShadow=true;world.add(s)}
  for(let z=0;z<8;z++)for(const side of [-1,1]){const p=new THREE.Group();const col=new THREE.Mesh(new THREE.CylinderGeometry(.48,.68,5.2,10),new THREE.MeshStandardMaterial({color:0x2d2c30,roughness:.92}));col.position.y=2.6;col.castShadow=true;const cap=new THREE.Mesh(new THREE.BoxGeometry(1.45,.32,1.45),new THREE.MeshStandardMaterial({color:0x403b39,roughness:.9}));cap.position.y=5.15;cap.castShadow=true;p.add(col,cap);p.position.set(side*(4.5+Math.random()*.6),0,-4-z*7);world.add(p)}
  const rune=new THREE.Mesh(new THREE.RingGeometry(1.1,1.22,48),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.45,side:THREE.DoubleSide}));rune.rotation.x=-Math.PI/2;rune.position.set(0,.02,-4);world.add(rune);
  portal=new THREE.Mesh(new THREE.TorusGeometry(1.2,.14,20,64),new THREE.MeshStandardMaterial({color:0x95a5ff,emissive:accent,emissiveIntensity:2.2,roughness:.22,metalness:.72}));portal.position.set(0,1.8,-18);portal.rotation.x=Math.PI/2;portal.visible=false;world.add(portal);
  chest=new THREE.Group();const base=new THREE.Mesh(new THREE.BoxGeometry(1.25,.7,.85),new THREE.MeshStandardMaterial({color:0x684123,roughness:.72}));const lid=new THREE.Mesh(new THREE.BoxGeometry(1.25,.28,.85),new THREE.MeshStandardMaterial({color:0x9b7041,roughness:.55,metalness:.1}));lid.position.y=.48;chest.add(base,lid);chest.position.set(2.6,.38,-6.2);world.add(chest);
  fireLight.position.set(-2.6,2.1,-3);iceLight.position.set(3.4,1.8,-8);
}
function makeWeapon(kind){
  const g=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:0xd5d6dc,roughness:.22,metalness:.9,emissive:0x10080a}),dark=new THREE.MeshStandardMaterial({color:0x251610,roughness:.9});
  const sword=(x=0)=>{const blade=new THREE.Mesh(new THREE.BoxGeometry(.08,1.35,.12),metal);blade.position.set(x,.78,0);blade.rotation.z=.06;const grip=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.55,10),dark);grip.position.set(x,-.16,0);const guard=new THREE.Mesh(new THREE.BoxGeometry(.35,.06,.15),metal);guard.position.set(x,.12,0);g.add(blade,grip,guard)};
  if(kind==='hammer'){const handle=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,1.75,10),dark);handle.rotation.z=-.62;handle.position.set(.35,-.35,0);const head=new THREE.Mesh(new THREE.BoxGeometry(.72,.4,.38),metal);head.position.set(-.18,.2,0);g.add(handle,head)}else if(kind==='dual'){sword(-.18);sword(.34);g.children.slice(3).forEach(o=>o.position.z-=.18)}else sword(0);
  return g;
}
function buildFirstPerson(){while(camera.children.length)camera.remove(camera.children[0]);weaponRig=new THREE.Group();weaponRig.position.set(.78,-.78,-1.55);weaponRig.rotation.z=-.45;weaponRig.add(makeWeapon(WEAPONS[minds[selected].g.weapon].kind));camera.add(weaponRig);const handMat=new THREE.MeshStandardMaterial({color:0x815649,roughness:.95});for(const [x,y,z,r] of [[.46,-.72,-1.28,-.65],[.68,-.62,-1.35,-.95]]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.45,5,8),handMat);arm.position.set(x,y,z);arm.rotation.z=r;camera.add(arm)}}
function proceduralEnemy(){const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xd8d2c8,roughness:.85});const body=new THREE.Mesh(new THREE.CapsuleGeometry(.38,1.1,6,12),mat);body.position.y=1.1;const head=new THREE.Mesh(new THREE.SphereGeometry(.27,16,16),mat);head.position.y=2.08;g.add(body,head);return {scene:g,animations:[]}}
async function loadSoldier(){
  try{const gltf=await loader.loadAsync('https://threejs.org/examples/models/gltf/Soldier.glb');soldierAsset=gltf.scene;soldierAnimations=gltf.animations;rebuildSelectedWorld(true)}catch(err){console.warn('Animated model unavailable; procedural fallback active.',err);soldierAsset=null;rebuildSelectedWorld(true)}
}
function createHorn(){const h=new THREE.Mesh(new THREE.ConeGeometry(.08,.48,7),new THREE.MeshStandardMaterial({color:0xeee4d5,roughness:.74}));return h}
function createEnemy(i,count){
  const source=soldierAsset?{scene:SkeletonUtils.clone(soldierAsset),animations:soldierAnimations}:proceduralEnemy();const root=source.scene;root.scale.setScalar(soldierAsset?1.14:1);root.position.set(((i-(count-1)/2)/Math.max(1,count-1))*(3.2+i*.25),0,-6-i*2.8-Math.random());
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];o.material=mats.map(m=>{const n=m.clone();n.color?.setHex(0xd8d2c8);n.roughness=.82;n.metalness=.05;n.emissive=new THREE.Color(0x100307);n.emissiveIntensity=.22;return n});if(o.material.length===1)o.material=o.material[0]}});
  const hornL=createHorn(),hornR=createHorn();hornL.position.set(-.16,2.08,.03);hornR.position.set(.16,2.08,.03);hornL.rotation.z=.55;hornR.rotation.z=-.55;root.add(hornL,hornR);
  const mixer=new THREE.AnimationMixer(root),actions={};for(const clip of source.animations){actions[clip.name]=mixer.clipAction(clip)};const preferred=actions.Run||actions.Walk||actions.Idle||Object.values(actions)[0];preferred?.play();
  root.userData={mixer,actions,phase:Math.random()*Math.PI*2,baseZ:root.position.z};enemyRoot.add(root);return root;
}
function syncEnemyCount(){const count=Math.min(7,minds[selected].foes);clearGroup(enemyRoot);enemyVisuals=[];for(let i=0;i<count;i++)enemyVisuals.push(createEnemy(i,count))}
function rebuildSelectedWorld(full=false){if(full)buildWorld();buildFirstPerson();syncEnemyCount();hideEndState()}
function switchAnimation(enemy,name){const actions=enemy.userData.actions;if(!actions)return;const target=actions[name]||actions.Run||actions.Walk||actions.Idle;if(!target||target===enemy.userData.current)return;enemy.userData.current?.fadeOut(.18);target.reset().fadeIn(.18).play();enemy.userData.current=target}
function spawnBurst(type){const color=type==='blood'?0xb51b2e:type==='ichor'?0x68d7ff:type==='gold'?0xffba55:0xff5a32;for(let i=0;i<18;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.025+Math.random()*.045,7,7),new THREE.MeshBasicMaterial({color,transparent:true}));p.position.set((Math.random()-.5)*1.6,1+Math.random()*1.5,-3.2-Math.random()*2);p.userData={v:new THREE.Vector3((Math.random()-.5)*.08,.025+Math.random()*.06,(Math.random()-.5)*.05),life:.65+Math.random()*.55};fxRoot.add(p);particles.push(p)}}
function flashDamage(){$('damageFlash').classList.add('on');setTimeout(()=>$('damageFlash').classList.remove('on'),100)}
function showEndState(m){if(m.id!==selected)return;$('deathScreen').classList.remove('hidden');$('deathKicker').textContent=m.state==='dead'?'GENOME FAILURE':'PORTAL EXTRACTION';$('deathTitle').textContent=m.state==='dead'?'THE MIND DIED':'THE LINEAGE BANKED';$('deathBody').textContent=m.state==='dead'?`${m.ichor|0} unbanked Ichor was lost.`:`${m.bank|0} Ichor and ${m.loot.toFixed(1)} loot survived.`}
function hideEndState(){$('deathScreen').classList.add('hidden')}

function animate3D(dt){
  const m=minds[selected];if(!m)return;const t=performance.now()/1000;fireLight.intensity=5.4+Math.sin(t*8)*.7;iceLight.intensity=2.7+Math.sin(t*5.6+1)*.35;
  chest.visible=m.chest;chest.rotation.y=Math.sin(t*1.8)*.08;portal.visible=m.action==='Extract'||m.state==='extracted';portal.rotation.z+=dt*2.4;portal.scale.setScalar(1+Math.sin(t*6)*.06);
  const swing=m.swing?Math.sin((.34-m.swing)/.34*Math.PI):0;weaponRig.position.set(.78-swing*.46,-.78+swing*.24,-1.55+swing*.2);weaponRig.rotation.set(0,0,-.45+swing*1.35+m.hurt*.2);
  camera.position.x=Math.sin(t*2.1)*.018+(Math.random()-.5)*m.hurt*.12;camera.position.y=1.62+Math.sin(t*4.2)*.018-m.hurt*.03;camera.rotation.z=(Math.random()-.5)*m.hurt*.08;
  enemyVisuals.forEach((e,i)=>{e.userData.mixer?.update(dt);e.userData.phase+=dt*(1.3+i*.08);e.position.z+=dt*(.42+i*.035);if(e.position.z>-1.7)e.position.z=-2.1-i*.3;e.position.x+=Math.sin(e.userData.phase)*dt*.13;e.rotation.y=Math.sin(e.userData.phase*.7)*.1;switchAnimation(e,e.position.z>-3.5?'Run':'Walk');if((m.action==='Attack'||m.action==='Power')&&m.swing>.12&&i===0){e.rotation.z=Math.sin(t*22)*.12;e.traverse(o=>{if(o.isMesh&&o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(mat=>{if(mat.emissive){mat.emissive.setHex(0x5d0712);mat.emissiveIntensity=1.4}})}})}else{e.rotation.z=0}});
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.userData.life-=dt;p.position.add(p.userData.v);p.userData.v.y-=.003;p.material.opacity=clamp(p.userData.life);if(p.userData.life<=0){fxRoot.remove(p);p.geometry.dispose();p.material.dispose();particles.splice(i,1)}}
}
function renderLoop(){resize();const dt=Math.min(.04,clock.getDelta());animate3D(dt);composer.render();requestAnimationFrame(renderLoop)}

function bar(name,value,hot=false){return `<div class="bar ${hot?'hot':''}"><span>${name}</span><i><b style="width:${clamp(value)*100}%"></b></i><em>${Math.round(clamp(value)*100)}%</em></div>`}
function renderUI(){
  const m=minds[selected],rank=[...minds].sort((a,b)=>b.fitness-a.fitness);
  $('agentName').textContent=m.g.name.toUpperCase();$('lineage').textContent=m.g.line.toUpperCase();$('gen').textContent=generation;$('alive').textContent=minds.filter(x=>x.state==='active').length;$('ichor').textContent=m.ichor|0;$('status').textContent=playing?'MINDS ACTIVE':'PAUSED';$('action').textContent=m.action.toUpperCase();$('thought').textContent=m.thought;
  $('hearts').innerHTML=Array.from({length:m.maxHp},(_,i)=>`<i class="heart ${i<m.hp?'':'empty'}"></i>`).join('');
  $('buildTitle').textContent=`${m.g.heart} · ${m.g.weapon}`;$('build').innerHTML=[['Heart',m.g.heart],['Weapon',m.g.weapon],['Artifact',m.g.art],['Rune',m.g.rune],['Ring',m.g.ring],['Necklace',m.g.neck]].map(([a,b])=>`<div class="build-item"><small>${a}</small><b>${b}</b></div>`).join('');
  const ds=Object.entries(m.decisions),max=Math.max(.1,...ds.map(x=>x[1]));$('decisionWinner').textContent=ds.length?ds.sort((a,b)=>b[1]-a[1])[0][0]:'Waiting';$('decisions').innerHTML=ds.length?ds.map(([n,v])=>bar(n,v/max,true)).join(''):'Waiting for perception…';
  $('traits').innerHTML=[['Aggression',m.g.aggression],['Greed',m.g.greed],['Fear',m.g.fear],['Curiosity',m.g.curiosity],['Discipline',m.g.discipline],['Reflex',m.g.reflex]].map(x=>bar(...x)).join('');
  $('populationSummary').textContent=`${minds.filter(x=>x.state==='dead').length} dead · ${minds.filter(x=>x.state==='extracted').length} extracted · alpha ${rank[0].g.name}`;
  $('agents').innerHTML=minds.map((x,i)=>`<button class="agent ${i===selected?'on':''}" data-i="${i}"><div class="agent-head"><b>${x.g.name}</b><span class="state">${x.state}</span></div><div class="mini-hearts">${'●'.repeat(Math.max(0,x.hp))}</div><small>${x.g.weapon}<br>${x.g.heart}<br>${x.ichor|0} Ichor · ${x.kills} kills</small></button>`).join('');
  document.querySelectorAll('.agent').forEach(b=>b.onclick=()=>{selected=+b.dataset.i;rebuildSelectedWorld(false);if(minds[selected].state!=='active')showEndState(minds[selected]);renderUI()});
  $('memory').innerHTML=m.memory.length?m.memory.map(x=>`<div>[G${generation}] ${x}</div>`).join(''):'No memories yet.';
}

function simulationLoop(now){const dt=Math.min(.04,(now-lastSim)/1000);lastSim=now;if(playing){minds.forEach(m=>tickMind(m,dt));if(minds.every(m=>m.state!=='active')){playing=false;if(autoLeft>0){autoLeft--;setTimeout(()=>{breed();playing=true;$('run').textContent='PAUSE MINDS'},300)}}if(now-lastRenderUI>90){renderUI();lastRenderUI=now}}requestAnimationFrame(simulationLoop)}

$('run').onclick=()=>{playing=!playing;$('run').textContent=playing?'PAUSE MINDS':'AWAKEN MINDS';renderUI()};
$('breed').onclick=()=>{playing=false;$('run').textContent='AWAKEN MINDS';breed()};
$('auto').onclick=()=>{autoLeft=10;breed();playing=true;$('run').textContent='PAUSE MINDS'};
$('reset').onclick=reset;
$('mut').oninput=e=>$('mutOut').textContent=`${e.target.value}%`;
$('hard').oninput=e=>$('hardOut').textContent=`${e.target.value}%`;
$('region').onchange=()=>{buildWorld();rebuildSelectedWorld(false)};
$('goal').onchange=renderUI;

reset();loadSoldier();requestAnimationFrame(simulationLoop);renderLoop();
