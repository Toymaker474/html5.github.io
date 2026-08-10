// ---------------- coherent developmental genome ----------------
class Gene{
  constructor(copy=null){
    if(copy){Object.assign(this,JSON.parse(JSON.stringify(copy)));return}

    // A developmental family seeds correlated anatomy. Mutation can move away from it later.
    this.plan=(rand(0,4)|0);
    this.hue=rand(155,275);
    this.bodyHue=rand(-18,18);
    this.glow=rand(.08,1.15);

    if(this.plan===0){
      this.segments=rand(7,11)|0;this.segmentSize=rand(7,12);this.taper=rand(.82,.95);
      this.flex=rand(.35,.62);this.bodyDepth=rand(.55,.78);this.fins=rand(2,5)|0;this.limbs=0;
      this.armor=rand(0,.25);this.jaw=rand(.05,.65);
    }else if(this.plan===1){
      this.segments=rand(5,8)|0;this.segmentSize=rand(10,17);this.taper=rand(.78,.92);
      this.flex=rand(.18,.42);this.bodyDepth=rand(.70,1.0);this.fins=rand(0,3)|0;this.limbs=4;
      this.armor=rand(.08,.55);this.jaw=rand(.15,1.0);
    }else if(this.plan===2){
      this.segments=rand(3,6)|0;this.segmentSize=rand(12,20);this.taper=rand(.72,.9);
      this.flex=rand(.12,.32);this.bodyDepth=rand(.85,1.25);this.fins=rand(4,7)|0;this.limbs=rand()<.3?2:0;
      this.armor=rand(0,.35);this.jaw=rand(.05,.7);
    }else{
      this.segments=rand(4,7)|0;this.segmentSize=rand(10,18);this.taper=rand(.76,.9);
      this.flex=rand(.12,.34);this.bodyDepth=rand(.72,1.05);this.fins=rand(1,4)|0;this.limbs=rand(2,5)|0;
      this.armor=rand(.3,.8);this.jaw=rand(.35,1.25);
    }

    this.head=rand(.75,1.35);
    this.snout=rand(.55,1.2);
    this.tail=rand(.55,1.8);
    this.finSize=rand(.45,1.35);
    this.limbLength=rand(.55,1.65);
    this.eyes=rand()<.9?(rand(1,4)|0):0;
    this.eyeSize=rand(.55,1.35);
    this.whiskers=rand()<.55?(rand(0,5)|0):0;
    this.spines=rand()<.38?(rand(0,6)|0):0;

    this.gape=rand(.55,1.25);
    this.biteSpeed=rand(.75,1.4);
    this.mouthReach=rand(.75,1.2);

    this.muscle=rand(.65,1.55);
    this.finBeat=rand(.75,1.45);
    this.sensor=rand(130,320);
    this.metabolism=rand(.5,1.35);
    this.fertility=rand(.6,1.35);
    this.aggression=rand();
    this.carnivore=rand();
    this.schooling=rand();
    this.regen=rand(.05,.7);
    this.venom=rand()<.24?rand():0;
  }
}

function mutateGene(g,amt=1){
  const n=new Gene(g);
  const t=(k,s,a,b,p=.28)=>{if(Math.random()<p*amt)n[k]=clamp(n[k]+gauss()*s*amt,a,b)};

  t('hue',7,120,320);t('glow',.08,0,1.7);t('segmentSize',1.0,5,24);
  t('taper',.035,.58,1);t('flex',.04,.04,.75);t('bodyDepth',.05,.4,1.4);
  t('head',.08,.45,1.9);t('snout',.08,.25,1.7);t('tail',.1,.2,2.4);
  t('finSize',.1,.2,2);t('limbLength',.1,.25,2.3);t('eyeSize',.08,.25,1.8);
  t('jaw',.08,0,1.8);t('armor',.06,0,.95);t('gape',.07,.25,1.6);
  t('biteSpeed',.07,.45,2);t('mouthReach',.06,.5,1.5);
  t('muscle',.07,.35,2.1);t('finBeat',.07,.35,2);t('sensor',15,70,460);
  t('metabolism',.05,.35,1.7);t('fertility',.05,.35,1.8);t('aggression',.06,0,1);
  t('carnivore',.06,0,1);t('schooling',.06,0,1);t('regen',.045,0,1);t('venom',.05,0,1);

  if(Math.random()<.10*amt)n.segments=clamp(n.segments+(Math.random()<.5?-1:1),2,12);
  if(Math.random()<.07*amt)n.fins=clamp(n.fins+(Math.random()<.5?-1:1),0,8);
  if(Math.random()<.06*amt)n.limbs=clamp(n.limbs+(Math.random()<.5?-2:2),0,8);
  if(Math.random()<.06*amt)n.eyes=clamp(n.eyes+(Math.random()<.5?-1:1),0,5);
  if(Math.random()<.06*amt)n.whiskers=clamp(n.whiskers+(Math.random()<.5?-1:1),0,7);
  if(Math.random()<.06*amt)n.spines=clamp(n.spines+(Math.random()<.5?-1:1),0,8);
  return n;
}

function crossoverGene(a,b){
  const n=new Gene(a);
  const blocks=[
    ['segments','segmentSize','taper','flex','bodyDepth','tail'],
    ['head','snout','eyes','eyeSize','whiskers','jaw','gape','biteSpeed','mouthReach'],
    ['fins','finSize','limbs','limbLength','spines','armor'],
    ['muscle','finBeat','sensor','metabolism','fertility','aggression','carnivore','schooling','regen','venom'],
    ['hue','bodyHue','glow']
  ];
  for(const block of blocks)if(Math.random()<.5)for(const k of block)n[k]=b[k];
  return n;
}

// ---------------- genetic neural controller ----------------
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
  for(let i=0;i<n.w.length;i++)if(Math.random()<.16*amt)n.w[i]+=gauss()*.22*amt;
  return n;
}
function crossoverBrain(a,b){
  const n=new Brain(a);
  for(let i=0;i<n.w.length;i++)if(Math.random()<.5)n.w[i]=b.w[i];
  return n;
}
