// ---------------- evolution ----------------
function tournament(arr){
  let b=arr[(Math.random()*arr.length)|0];
  for(let i=0;i<3;i++){
    const c=arr[(Math.random()*arr.length)|0];
    if(c.fitness()>b.fitness())b=c;
  }
  return b;
}

function evolve(){
  const live=creatures.filter(x=>!x.dead).sort((a,b)=>b.fitness()-a.fitness());

  if(!live.length){
    creatures=Array.from({length:CFG.BASE_POP},()=>new Creature());
    generation++;genStart=performance.now();
    return;
  }

  const elite=live.slice(0,Math.min(30,live.length));
  const next=[];

  for(const e of elite.slice(0,6)){
    const c=new Creature(new Gene(e.g),new Brain(e.b));
    c.lineage=e.lineage+1;
    next.push(c);
  }

  while(next.length<CFG.BASE_POP){
    const a=tournament(elite),b=tournament(elite);
    const g=mutateGene(crossoverGene(a.g,b.g));
    const br=mutateBrain(crossoverBrain(a.b,b.b));
    const c=new Creature(g,br);
    c.lineage=Math.max(a.lineage,b.lineage)+1;
    next.push(c);
  }

  creatures=next;
  generation++;
  genStart=performance.now();
}

function initWorld(){
  creatures=Array.from({length:CFG.BASE_POP},()=>new Creature());
  foods=Array.from({length:CFG.FOOD_TARGET},()=>new Food());
  carcasses=[];
  particles=[];
  generation=1;births=0;deaths=0;bites=0;swallows=0;time=0;
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

  while(foods.length<CFG.FOOD_TARGET)foods.push(new Food());

  if(creatures.length<24){
    for(let i=0;i<48;i++)creatures.push(new Creature());
  }

  if(creatures.length>CFG.MAX_POP){
    creatures.sort((a,b)=>b.fitness()-a.fitness());
    creatures.length=CFG.MAX_POP;
  }

  if(carcasses.length>CFG.MAX_CARCASSES)carcasses.splice(0,carcasses.length-CFG.MAX_CARCASSES);

  if((performance.now()-genStart)/1000>CFG.GEN_SECONDS)evolve();

  if(follow&&creatures.length){
    let best=creatures[0];
    for(const c of creatures)if(c.fitness()>best.fitness())best=c;
    cam.x=lerp(cam.x,best.x,.05);
    cam.y=lerp(cam.y,best.y,.05);
  }
}
