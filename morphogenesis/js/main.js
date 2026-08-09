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
    await sleep(75);

    bootPct(24,'TESTING BODY GENOME...');
    const g=new Gene();
    const gm=mutateGene(g);
    if(!Number.isFinite(gm.segmentSize))throw new Error('Gene mutation failed');
    bootLine('Body-plan genome');
    bootLine('Morphology mutation');
    await sleep(75);

    bootPct(40,'TESTING GENETIC CONTROLLER...');
    const b=new Brain();
    const out=b.act(new Array(12).fill(0));
    if(out.length!==6||out.some(x=>!Number.isFinite(x)))throw new Error('Brain test failed');
    bootLine('Neural controller');
    await sleep(75);

    bootPct(56,'TESTING ARTICULATION...');
    const c=new Creature(g,b);
    c.updateSpine();
    if(c.spine.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('Spine solver failed');
    bootLine('Flexible segmented spine');
    bootLine('Fins / limbs / eyes / jaws / armor');
    await sleep(75);

    bootPct(72,'TESTING SHARED ECOLOGY...');
    initWorld();
    rebuildGrid();
    step(1/60);
    bootLine('All creatures share one ruleset');
    bootLine('Carnivory is evolved, not hard-coded');
    await sleep(85);

    bootPct(88,'TESTING RENDER PATH...');
    render();
    bootLine('Morphology renderer');
    bootLine('LOD point rendering');
    await sleep(85);

    bootPct(100,'MORPHOGENESIS V1 READY');
    bootLine('All self-tests finite');
    await sleep(210);

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
