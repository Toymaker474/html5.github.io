const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
export class TeacherAgent{
  constructor(state={}){this.lastReviewAt=Number(state.lastReviewAt||0);this.score=Number(state.score||0);this.lesson=state.lesson||'Observe the first ecosystem epoch.';this.history=Array.isArray(state.history)?state.history:[];this.rubric={survival:0,diversity:0,efficiency:0,novelty:0,stability:0};this.intervalMs=60*60*1000}
  due(now=Date.now()){return now-this.lastReviewAt>=this.intervalMs}
  remaining(now=Date.now()){return Math.max(0,this.intervalMs-(now-this.lastReviewAt))}
  review(world,manual=false){
    const m=world.metrics(),target=Math.max(1,world.params.targetPopulation),populationRatio=Math.min(1,m.population/target);
    const survival=clamp(populationRatio*80+Math.min(20,m.meanAge/18*20));
    const diversity=clamp(m.diversity*100);
    const efficiency=clamp(100-Math.abs(.62-m.meanEnergy)*115);
    const novelty=clamp(m.species*9+m.generation*1.5+Math.min(20,m.births/12));
    const stability=clamp(100-Math.min(100,m.recentDeaths*2.5+Math.abs(m.population-world.lastPopulation)*1.2));
    this.rubric={survival,diversity,efficiency,novelty,stability};
    this.score=Math.round(survival*.27+diversity*.23+efficiency*.18+novelty*.17+stability*.15);
    const lowest=Object.entries(this.rubric).sort((a,b)=>a[1]-b[1])[0][0];
    const lessons={
      survival:{title:'Resilience Trial',text:'Food appears in separated islands. Creatures must remember safe routes instead of wandering.',apply:()=>{world.params.foodGrowth=Math.min(2.5,world.params.foodGrowth*1.08);world.params.hazard=Math.max(.05,world.params.hazard*.92)}},
      diversity:{title:'Niche Expansion',text:'Microclimates diverge. Specialists receive stronger rewards for using different terrain.',apply:()=>{world.curriculum.nicheReward=Math.min(1,world.curriculum.nicheReward+.08);world.params.mutation=Math.min(.2,world.params.mutation+.008)}},
      efficiency:{title:'Energy Discipline',text:'Movement becomes expensive. Brains must learn when stillness is the smarter action.',apply:()=>{world.curriculum.motionCost=Math.min(.022,world.curriculum.motionCost+.0015)}},
      novelty:{title:'Innovation Pulse',text:'Mutation widens briefly and rare behaviors receive a learning reward.',apply:()=>{world.params.mutation=Math.min(.2,world.params.mutation+.012);world.curriculum.noveltyReward=Math.min(1,world.curriculum.noveltyReward+.1)}},
      stability:{title:'Ecological Balance',text:'Hazards soften while reproduction costs rise, reducing boom-and-crash population cycles.',apply:()=>{world.params.hazard=Math.max(0,world.params.hazard-.04);world.curriculum.birthCost=Math.min(1.05,world.curriculum.birthCost+.03)}}
    };
    const lesson=lessons[lowest];lesson.apply();this.lesson=`${lesson.title}: ${lesson.text}`;this.lastReviewAt=Date.now();
    const row={t:this.lastReviewAt,score:this.score,focus:lowest,lesson:this.lesson,manual};this.history.unshift(row);this.history=this.history.slice(0,30);
    world.log(`Teacher lesson: ${lesson.title}`,`${this.score}/100 · weakest axis ${lowest}.`);return row;
  }
  serialize(){return{lastReviewAt:this.lastReviewAt,score:this.score,lesson:this.lesson,history:this.history}}
}