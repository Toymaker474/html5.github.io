// ---------------- coherent developmental genome ----------------
class Gene{
  constructor(copy=null){
    if(copy){Object.assign(this,JSON.parse(JSON.stringify(copy)));return}

    // Correlated body plans keep organisms anatomically coherent. The same Creature class interprets all plans.
    this.plan=rand(0,5)|0;
    this.hue=rand(155,285);
    this.bodyHue=rand(-16,16);
    this.bellyHue=rand(-24,8);
    this.saturation=rand(62,88);
    this.glow=rand(.04,.75);
    this.translucency=rand(.04,.38);
    this.pattern=rand(0,4)|0;
    this.patternScale=rand(.7,1.45);
    this.patternContrast=rand(.12,.5);

    if(this.plan===0){
      this.segments=rand(8,12)|0;this.segmentSize=rand(7,11);this.taper=rand(.86,.96);
      this.flex=rand(.40,.68);this.bodyDepth=rand(.48,.7);this.fins=rand(1,4)|0;this.limbs=0;
      this.armor=rand(0,.18);this.jaw=rand(.05,.58);this.locomotion=0;
    }else if(this.plan===1){
      this.segments=rand(5,8)|0;this.segmentSize=rand(10,15);this.taper=rand(.82,.93);
      this.flex=rand(.18,.4);this.bodyDepth=rand(.72,1.0);this.fins=rand(0,3)|0;this.limbs=4;
      this.armor=rand(.06,.42);this.jaw=rand(.15,.9);this.locomotion=1;
    }else if(this.plan===2){
      this.segments=rand(3,6)|0;this.segmentSize=rand(12,19);this.taper=rand(.75,.9);
      this.flex=rand(.12,.28);this.bodyDepth=rand(.9,1.28);this.fins=rand(4,7)|0;this.limbs=0;
      this.armor=rand(0,.26);this.jaw=rand(.05,.62);this.locomotion=2;
    }else if(this.plan===3){
      this.segments=rand(5,8)|0;this.segmentSize=rand(11,17);this.taper=rand(.78,.9);
      this.flex=rand(.14,.34);this.bodyDepth=rand(.7,1.0);this.fins=rand(2,5)|0;this.limbs=rand()<.4?2:0;
      this.armor=rand(.38,.78);this.jaw=rand(.55,1.25);this.locomotion=0;
    }else{
      this.segments=rand(4,7)|0;this.segmentSize=rand(10,17);this.taper=rand(.78,.93);
      this.flex=rand(.2,.46);this.bodyDepth=rand(.8,1.15);this.fins=rand(2,5)|0;this.limbs=rand()<.45?2:0;
      this.armor=rand(.02,.34);this.jaw=rand(.1,.82);this.locomotion=3;
    }

    this.head=rand(.78,1.35);
    this.snout=rand(.5,1.18);
    this.neck=rand(.68,1.0);
    this.tail=rand(.6,1.7);
    this.finSize=rand(.45,1.35);
    this.finAspect=rand(.55,1.55);
    this.limbLength=rand(.55,1.55);
    this.limbThickness=rand(.55,1.25);
    this.toes=this.limbs?rand(2,5)|0:0;

    this.eyes=rand()<.92?(rand(1,4)|0):0;
    this.eyeSize=rand(.55,1.25);
    this.eyeSpread=rand(.35,.72);
    this.pupil=rand(.25,.62);
    this.blinkRate=rand(.08,.4);

    this.whiskers=rand()<.5?(rand(0,5)|0):0;
    this.spines=rand()<.35?(rand(0,6)|0):0;
    this.gills=rand(2,6)|0;
    this.gillSize=rand(.45,1.15);

    this.gape=rand(.48,1.15);
    this.biteSpeed=rand(.72,1.35);
    this.mouthReach=rand(.72,1.2);
    this.toothSize=rand(.45,1.15);

    this.muscle=rand(.65,1.5);
    this.finBeat=rand(.72,1.4);
    this.sensor=rand(130,320);
    this.metabolism=rand(.5,1.3);
    this.fertility=rand(.6,1.3);
    this.aggression=rand();
    this.carnivore=rand();
    this.schooling=rand();
    this.startle=rand(.15,.9);
    this.regen=rand(.04,.65);
    this.venom=rand()<.2?rand():0;
  }
}

function mutateGene(g,amt=1){
  const n=new Gene(g);
  const t=(k,s,a,b,p=.26)=>{if(Math.random()<p*amt)n[k]=clamp(n[k]+gauss()*s*amt,a,b)};

  t('hue',6,120,320);t('bodyHue',3,-35,35);t('bellyHue',3,-40,25);t('saturation',3,45,96);
  t('glow',.06,0,1.4);t('translucency',.04,0,.7);t('patternScale',.08,.35,2.2);t('patternContrast',.04,0,.7);
  t('segmentSize',.9,5,24);t('taper',.03,.6,1);t('flex',.035,.04,.75);t('bodyDepth',.045,.4,1.4);
  t('head',.07,.5,1.8);t('snout',.07,.25,1.6);t('neck',.04,.45,1.1);t('tail',.08,.2,2.3);
  t('finSize',.08,.2,2);t('finAspect',.08,.3,2.1);t('limbLength',.08,.25,2.2);t('limbThickness',.06,.3,1.8);
  t('eyeSize',.06,.25,1.7);t('eyeSpread',.04,.2,.9);t('pupil',.04,.12,.82);t('blinkRate',.035,.02,.8);
  t('gillSize',.06,.2,1.6);t('jaw',.07,0,1.8);t('gape',.06,.2,1.5);t('biteSpeed',.06,.45,2);
  t('mouthReach',.05,.5,1.45);t('toothSize',.06,.2,1.7);t('armor',.055,0,.95);
  t('muscle',.06,.35,2.05);t('finBeat',.06,.35,1.95);t('sensor',13,70,450);t('metabolism',.045,.35,1.65);
  t('fertility',.045,.35,1.7);t('aggression',.055,0,1);t('carnivore',.055,0,1);t('schooling',.055,0,1);
  t('startle',.05,0,1);t('regen',.04,0,1);t('venom',.045,0,1);

  if(Math.random()<.09*amt)n.segments=clamp(n.segments+(Math.random()<.5?-1:1),2,12);
  if(Math.random()<.06*amt)n.fins=clamp(n.fins+(Math.random()<.5?-1:1),0,8);
  if(Math.random()<.05*amt)n.limbs=clamp(n.limbs+(Math.random()<.5?-2:2),0,8);
  if(Math.random()<.05*amt)n.eyes=clamp(n.eyes+(Math.random()<.5?-1:1),0,5);
  if(Math.random()<.05*amt)n.whiskers=clamp(n.whiskers+(Math.random()<.5?-1:1),0,7);
  if(Math.random()<.05*amt)n.spines=clamp(n.spines+(Math.random()<.5?-1:1),0,8);
  if(Math.random()<.04*amt)n.gills=clamp(n.gills+(Math.random()<.5?-1:1),1,7);
  if(Math.random()<.03*amt)n.pattern=(n.pattern+(Math.random()<.5?1:3))%4;
  if(Math.random()<.025*amt)n.locomotion=clamp(n.locomotion+(Math.random()<.5?-1:1),0,3);
  if(n.limbs===0)n.toes=0;else if(Math.random()<.04*amt)n.toes=clamp(n.toes+(Math.random()<.5?-1:1),1,6);
  return n;
}

function crossoverGene(a,b){
  const n=new Gene(a);
  const blocks=[
    ['plan','segments','segmentSize','taper','flex','bodyDepth','neck','tail','locomotion'],
    ['head','snout','eyes','eyeSize','eyeSpread','pupil','blinkRate','whiskers','gills','gillSize'],
    ['jaw','gape','biteSpeed','mouthReach','toothSize'],
    ['fins','finSize','finAspect','limbs','limbLength','limbThickness','toes','spines','armor'],
    ['muscle','finBeat','sensor','metabolism','fertility','aggression','carnivore','schooling','startle','regen','venom'],
    ['hue','bodyHue','bellyHue','saturation','glow','translucency','pattern','patternScale','patternContrast']
  ];
  for(const block of blocks)if(Math.random()<.5)for(const k of block)n[k]=b[k];
  return n;
}

class Brain{
  constructor(copy=null){this.w=copy?copy.w.slice():Array.from({length:72},()=>gauss()*.55)}
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
function mutateBrain(b,amt=1){const n=new Brain(b);for(let i=0;i<n.w.length;i++)if(Math.random()<.16*amt)n.w[i]+=gauss()*.22*amt;return n}
function crossoverBrain(a,b){const n=new Brain(a);for(let i=0;i<n.w.length;i++)if(Math.random()<.5)n.w[i]=b.w[i];return n}
