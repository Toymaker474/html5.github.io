// ---------------- genome ----------------
class Gene{
  constructor(copy=null){
    if(copy){Object.assign(this,JSON.parse(JSON.stringify(copy)));return}
    this.hue=rand(155,275);
    this.bodyHue=rand(-30,30);
    this.glow=rand(.1,1.25);

    this.segments=rand(2,9)|0;
    this.segmentSize=rand(7,18);
    this.taper=rand(.72,.97);
    this.flex=rand(.10,.55);
    this.bodyStyle=rand();
    this.bell=rand(.15,1.25);

    this.head=rand(.55,1.5);
    this.tail=rand(.35,2.0);

    this.fins=rand()<.75?(rand(0,6)|0):0;
    this.finSize=rand(.35,1.6);

    this.limbs=rand()<.65?(rand(0,7)|0):0;
    this.limbLength=rand(.5,2.0);

    this.eyes=rand()<.9?(rand(1,7)|0):0;
    this.eyeSize=rand(.5,1.6);

    this.whiskers=rand()<.65?(rand(0,8)|0):0;
    this.jaw=rand()<.5?rand(.2,1.3):0;
    this.spines=rand()<.45?(rand(0,8)|0):0;
    this.armor=rand()<.5?rand(.05,.9):0;

    this.muscle=rand(.6,1.6);
    this.sensor=rand(120,330);
    this.metabolism=rand(.5,1.45);
    this.fertility=rand(.6,1.45);
    this.aggression=rand();
    this.carnivore=rand();
    this.schooling=rand();
    this.regen=rand(.05,.75);
    this.venom=rand()<.3?rand():0;
  }
}

function mutateGene(g,amt=1){
  const n=new Gene(g);
  const t=(k,s,a,b,p=.3)=>{if(Math.random()<p*amt)n[k]=clamp(n[k]+gauss()*s*amt,a,b)};
  t('hue',8,120,320);t('glow',.10,0,1.8);t('segmentSize',1.3,5,24);
  t('taper',.045,.55,1);t('flex',.045,.04,.75);t('bell',.09,0,1.7);
  t('head',.1,.25,2.1);t('tail',.12,.1,2.6);t('finSize',.12,.15,2.1);
  t('limbLength',.12,.2,2.6);t('eyeSize',.1,.2,2);t('jaw',.1,0,2);
  t('armor',.08,0,.95);t('muscle',.08,.3,2.2);t('sensor',18,60,480);
  t('metabolism',.055,.35,1.8);t('fertility',.055,.35,1.9);t('aggression',.07,0,1);
  t('carnivore',.07,0,1);t('schooling',.07,0,1);t('regen',.05,0,1);t('venom',.06,0,1);

  if(Math.random()<.14*amt)n.segments=clamp(n.segments+(Math.random()<.5?-1:1),1,12);
  if(Math.random()<.10*amt)n.fins=clamp(n.fins+(Math.random()<.5?-1:1),0,8);
  if(Math.random()<.10*amt)n.limbs=clamp(n.limbs+(Math.random()<.5?-1:1),0,8);
  if(Math.random()<.10*amt)n.eyes=clamp(n.eyes+(Math.random()<.5?-1:1),0,8);
  if(Math.random()<.10*amt)n.whiskers=clamp(n.whiskers+(Math.random()<.5?-1:1),0,10);
  if(Math.random()<.10*amt)n.spines=clamp(n.spines+(Math.random()<.5?-1:1),0,10);
  if(Math.random()<.08*amt)n.bodyStyle=rand();
  return n;
}

function crossoverGene(a,b){
  const n=new Gene(a);
  for(const k of Object.keys(n))if(Math.random()<.5)n[k]=b[k];
  return n;
}

// ---------------- tiny genetic neural controller ----------------
class Brain{
  constructor(copy=null){
    this.w=copy?copy.w.slice():Array.from({length:72},()=>gauss()*.55);
  }
  act(inp){
    const out=[];
    for(let o=0;o<6;o++){
      let s=0;
      for(let i=0;i<12;i++)s+=(inp[i]||0)*this.w[o*12+i];
      out.push(Math.tanh(s));
    }
    return out;
  }
}
function mutateBrain(b,amt=1){
  const n=new Brain(b);
  for(let i=0;i<n.w.length;i++)if(Math.random()<.16*amt)n.w[i]+=gauss()*.24*amt;
  return n;
}
function crossoverBrain(a,b){
  const n=new Brain(a);
  for(let i=0;i<n.w.length;i++)if(Math.random()<.5)n.w[i]=b.w[i];
  return n;
}
