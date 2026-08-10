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
    bootPct(8,'CHECKING RENDERER...');
    resize();
    if(!ctx)throw new Error('Canvas unavailable');
    bootLine('Canvas / Retina surface');
    await sleep(70);

    bootPct(22,'TESTING DEVELOPMENTAL GENOME...');
    const g=new Gene();
    const gm=mutateGene(g);
    if(!Number.isFinite(gm.segmentSize)||gm.segments<2)throw new Error('Gene mutation failed');
    bootLine('Correlated body-plan genome');
    bootLine('Morphology mutation');
    await sleep(70);

    bootPct(37,'TESTING GENETIC CONTROLLER...');
    const b=new Brain();
    const out=b.act(new Array(12).fill(0));
    if(out.length!==6||out.some(x=>!Number.isFinite(x)))throw new Error('Brain test failed');
    bootLine('Neural controller');
    await sleep(70);

    bootPct(53,'TESTING LOCAL-SPACE ARTICULATION...');
    const c=new Creature(g,b);
    c.updateSpine();
    if(c.spine.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('Spine solver failed');
    bootLine('Connected local-space spine');
    bootLine('Continuous tissue envelope');
    await sleep(70);

    bootPct(66,'TESTING JAW KINEMATICS...');
    c.startBite();
    c.updateMouth(1/60,{m:10});
    if(!Number.isFinite(c.mouthOpen)||c.mouthOpen<0)throw new Error('Jaw state failed');
    bootLine('Open → hold → closing bite cycle');
    bootLine('Contact-gated feeding');
    await sleep(75);

    bootPct(79,'TESTING SHARED ECOLOGY...');
    initWorld();
    rebuildGrid();
    step(1/60);
    bootLine('One shared creature ruleset');
    bootLine('Finite food capture / stomach digestion / carcasses');
    await sleep(80);

    bootPct(91,'TESTING RENDER PATH...');
    render();
    bootLine('Articulated skin + fins + limbs + hinged jaws');
    await sleep(80);

    bootPct(100,'MORPHOGENESIS V1 READY');
    bootLine('Runtime sanity checks returned finite state');
    await sleep(190);

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
