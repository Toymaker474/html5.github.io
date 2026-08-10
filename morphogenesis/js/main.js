// ---------------- loop ----------------
function frame(now){
  try{
    const raw=Math.max(.001,(now-last)/1000);
    last=now;
    fps=fps*.9+(1/raw)*.1;

    cam.z=lerp(cam.z,cam.tz,.12);

    for(let i=0;i<simSpeed;i++)step(1/60);

    render();
    updateHUD();

    requestAnimationFrame(frame);
  }catch(e){
    panic(e.stack||String(e));
  }
}

// ---------------- boot ----------------
async function start(){
  try{
    bootPct(7,'CHECKING RENDERER...');
    resize();
    if(!ctx)throw new Error('Canvas unavailable');
    bootLine('Canvas / Retina surface');
    await sleep(65);

    bootPct(20,'TESTING DEVELOPMENTAL GENOME...');
    const plans=new Set();
    for(let i=0;i<24;i++){
      const g0=new Gene();plans.add(g0.plan);
      const gm=mutateGene(g0);
      if(!Number.isFinite(gm.segmentSize)||gm.segments<2||gm.gills<1)throw new Error('Gene mutation failed');
    }
    if(plans.size<3)throw new Error('Body-family seed diversity failed');
    bootLine('Correlated developmental body families');
    bootLine('Skin / eye / jaw / limb / locomotion genes');
    await sleep(65);

    bootPct(34,'TESTING GENETIC CONTROLLER...');
    const b=new Brain();
    const out=b.act(new Array(12).fill(0));
    if(out.length!==6||out.some(x=>!Number.isFinite(x)))throw new Error('Brain test failed');
    bootLine('Inherited 72-weight neural controller');
    await sleep(65);

    bootPct(48,'TESTING LOCAL-SPACE ARTICULATION...');
    const g=new Gene(),c=new Creature(g,b);
    c.angle=1.3;c.vx=.8;c.vy=.2;c.turnVel=.05;
    for(let i=0;i<30;i++){c.phase+=1/60;c.stroke=.5+.5*Math.sin(c.phase);c.updateSpine()}
    if(c.spine.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('Spine solver failed');
    if(c.spine.length>1&&c.spine[1].x>=0)throw new Error('Local spine orientation failed');
    for(let mode=0;mode<4;mode++){c.g.locomotion=mode;if(!(c.locomotionForce(.7)>0))throw new Error('Locomotion mode failed')}
    bootLine('Connected local-space spine');
    bootLine('Tail / paddle / fin-wave / bell locomotion');
    await sleep(70);

    bootPct(62,'TESTING JAW + SWALLOW STATE...');
    c.g.jaw=.9;c.g.gape=1;c.g.biteSpeed=1;c.g.mouthReach=1;c.g.carnivore=.1;
    c.x=100;c.y=100;c.angle=0;
    const mouth=c.mouthWorld(),f=new Food(mouth.x,mouth.y);f.energy=10;
    foods=[f];c.startBite();
    for(let i=0;i<90;i++)c.updateMouth(1/60,4);
    if(!f.dead||c.stomach<9.9)throw new Error('Bite/swallow state failed');
    bootLine('Hinged open → hold → close → recover jaw');
    bootLine('Mouth contact → visible swallow → stomach');
    await sleep(70);

    bootPct(75,'TESTING WOUND / STARTLE...');
    const attacker=new Creature(new Gene(),new Brain()),victim=new Creature(new Gene(),new Brain());
    const hp=victim.health;victim.applyWound(victim.x,victim.y,9,attacker);
    if(!(victim.health<hp)||!victim.wounds.length||victim.startleTimer<=0)throw new Error('Wound response failed');
    bootLine('Localized wound + injury response');
    bootLine('Prey startle / escape impulse');
    await sleep(70);

    bootPct(87,'TESTING SHARED ECOLOGY...');
    initWorld();rebuildGrid();step(1/60);
    bootLine('Shared creature ruleset');
    bootLine('Finite carcass biomass + gradual productivity');
    bootLine('Diversity-aware generation selection + gene bank');
    await sleep(75);

    bootPct(96,'TESTING RENDER PATH...');
    render();
    bootLine('Continuous organic skin envelope');
    bootLine('Patterns / gills / eyes / limbs / jaws / wounds');
    await sleep(75);

    bootPct(100,'MORPHOGENESIS V1 READY');
    bootLine('Runtime sanity checks returned finite state');
    await sleep(180);

    bootEl.style.transition='opacity .35s';
    bootEl.style.opacity='0';
    setTimeout(()=>bootEl.remove(),380);

    last=performance.now();
    requestAnimationFrame(frame);

  }catch(e){
    bootLine(e.message||String(e),false);
    bootPct(100,'BOOT FAILED');
    panic(e.stack||String(e));
  }
}

start();
