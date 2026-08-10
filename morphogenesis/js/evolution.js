// ---------------- evolution with diversity preservation ----------------
function phenotypeDistance(a,b){
  return Math.abs(a.g.segments-b.g.segments)*.35+
    Math.abs(a.g.bodyDepth-b.g.bodyDepth)*1.2+
    Math.abs(a.g.carnivore-b.g.carnivore)*1.5+
    Math.abs(a.g.armor-b.g.armor)+
    Math.abs(a.g.locomotion-b.g.locomotion)*.55+
    (a.g.plan===b.g.plan?0:.8);
}

function noveltyScore(c,pop){
  if(pop.length<2)return 0;
  let sum=0,count=0;
  for(let i=0;i<pop.length&&count<12;i+=Math.max(1,(pop.length/12)|0)){
    const o=pop[i];if(o===c)continue;sum+=phenotypeDistance(c,o);count++;
  }
  return count?sum/count:0;
}

function selectionScore(c,pop){return c.fitness()+noveltyScore(c,pop)*7.5}

function tournament(arr,pop){
  let b=arr[(Math.random()*arr.length)|0];
  for(let i=0;i<3;i++){
    const c=arr[(Math.random()*arr.length)|0];
    if(selectionScore(c,pop)>selectionScore(b,pop))b=c;
  }
  return b;
}

function archiveBest(live){
  const ranked=[...live].sort((a,b)=>selectionScore(b,live)-selectionScore(a,live));
  geneBank=ranked.slice(0,CFG.GENE_BANK).map(c=>({g:new Gene(c.g),b:new Brain(c.b),lineage:c.lineage,score:c.fitness()}));
}

function evolve(){
  const live=creatures.filter(x=>!x.dead);
  if(!live.length){
    creatures=geneBank.length
      ? Array.from({length:CFG.BASE_POP},(_,i)=>{
          const p=geneBank[i%geneBank.length],c=new Creature(mutateGene(p.g,.75),mutateBrain(p.b,.75));c.lineage=p.lineage+1;return c;
        })
      : Array.from({length:CFG.BASE_POP},()=>new Creature());
    generation++;genStart=performance.now();return;
  }

  archiveBest(live);
  const ranked=[...live].sort((a,b)=>selectionScore(b,live)-selectionScore(a,live));
  const elitePool=ranked.slice(0,Math.min(42,ranked.length));
  const next=[];

  const byPlan=new Map();
  for(const c of ranked){if(!byPlan.has(c.g.plan))byPlan.set(c.g.plan,c)}
  for(const e of byPlan.values()){
    const c=new Creature(new Gene(e.g),new Brain(e.b));c.lineage=e.lineage+1;next.push(c);
  }

  for(const e of ranked.slice(0,5)){
    if(next.length>=10)break;
    const c=new Creature(new Gene(e.g),new Brain(e.b));c.lineage=e.lineage+1;next.push(c);
  }

  while(next.length<CFG.BASE_POP){
    const a=tournament(elitePool,live);
    let candidates=elitePool.filter(x=>x!==a&&(Math.random()<.18||phenotypeDistance(a,x)<2.4));
    if(!candidates.length)candidates=elitePool;
    const b=tournament(candidates,live);
    const g=mutateGene(crossoverGene(a.g,b.g));
    const br=mutateBrain(crossoverBrain(a.b,b.b));
    const c=new Creature(g,br);c.lineage=Math.max(a.lineage,b.lineage)+1;next.push(c);
  }

  creatures=next;generation++;genStart=performance.now();
}

function spawnFoodProductivity(){
  const cx=(CFG.WORLD_W*(.5+.42*Math.sin(time*.013)))%CFG.WORLD_W;
  const cy=CFG.WORLD_H*(.18+.55*(.5+.5*Math.sin(time*.009+1.2)));
  const f=new Food(cx+gauss()*420,cy+gauss()*260);wrap(f);foods.push(f);
}

function initWorld(){
  creatures=Array.from({length:CFG.BASE_POP},()=>new Creature());
  foods=Array.from({length:CFG.FOOD_TARGET},()=>new Food());
  carcasses=[];particles=[];geneBank=[];
  generation=1;births=0;deaths=0;bites=0;swallows=0;woundsMade=0;time=0;
  genStart=performance.now();
}

function step(dt){
  time+=dt;
  for(const f of foods)f.update(dt);
  for(const c of carcasses)c.update(dt);

  rebuildGrid();
  for(const c of creatures)c.update(dt);

  foods=foods.filter(x=>!x.dead);
  carcasses=carcasses.filter(x=>!x.dead);
  creatures=creatures.filter(x=>!x.dead);

  const deficit=CFG.FOOD_TARGET-foods.length;
  const spawnChance=clamp(deficit/CFG.FOOD_TARGET,0,1)*.65;
  if(foods.length<CFG.FOOD_TARGET&&Math.random()<spawnChance)spawnFoodProductivity();
  if(foods.length<CFG.FOOD_MIN&&Math.random()<.45)for(let i=0;i<3;i++)spawnFoodProductivity();

  if(creatures.length<20){
    const need=Math.min(36,CFG.BASE_POP-creatures.length);
    for(let i=0;i<need;i++){
      if(geneBank.length){const p=geneBank[i%geneBank.length],c=new Creature(mutateGene(p.g,.85),mutateBrain(p.b,.85));c.lineage=p.lineage+1;creatures.push(c)}
      else creatures.push(new Creature());
    }
  }

  if(creatures.length>CFG.MAX_POP){creatures.sort((a,b)=>b.fitness()-a.fitness());creatures.length=CFG.MAX_POP}
  if(carcasses.length>CFG.MAX_CARCASSES)carcasses.splice(0,carcasses.length-CFG.MAX_CARCASSES);
  if((performance.now()-genStart)/1000>CFG.GEN_SECONDS)evolve();

  if(follow&&creatures.length){
    let best=creatures[0];for(const c of creatures)if(c.fitness()>best.fitness())best=c;
    cam.x=lerp(cam.x,best.x,.05);cam.y=lerp(cam.y,best.y,.05);
  }
}
