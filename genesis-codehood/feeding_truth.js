'use strict';
/* GENESIS feeding truth patch.
   Removes the legacy predator "head is close enough => damage/grab" shortcut.
   Predator tissue damage is left to V107's articulated jaw-node contact gate.
   Corpse scavenging is gated by jaw-to-corpse contact, but digestion is STILL
   a direct energy approximation. This file deliberately exposes that truth. */
(function(){
  if(typeof handleInteractions!=='function'||typeof creatures==='undefined')return;
  const truth=window.GENESIS_FEED_TRUTH={
    predatorLegacyProximityDamage:false,
    predatorJawContactGate:true,
    toothPenetrationSolver:false,
    stomachDigestion:false,
    herbPlantIngestionPhysical:false,
    scavengerCorpseContactGate:true,
    scavengerDigestionApproximation:true,
    scavengerContacts:0
  };

  function mouthNode(c){return c?.v107?.jaw||c?.head?.()||null}
  function mouthTouches(c,target){
    const m=mouthNode(c);if(!m||!target?.nodes?.length)return null;
    let best=null,bd=1e9;
    for(let i=0;i<target.nodes.length;i++){
      const n=target.nodes[i],d=Math.hypot(n.x-m.x,n.y-m.y),limit=(n.r||3)+(m.r||2)+(c.g?.size||1)*1.8;
      if(d<bd){bd=d;best={node:n,index:i,d,limit}}
    }
    return best&&best.d<=best.limit?best:null;
  }

  handleInteractions=function(c){
    if(c.biteCooldown>0)c.biteCooldown--;
    if(c.stun>0)c.stun--;
    if(!c.alive)return;
    const q=c.head();

    // Existing herb path remains a proximity-based plant-consumption approximation.
    if(c.spec.role==='herb'&&c.state==='FORAGE'){
      const p=c.aiTarget;
      if(p&&p.alive&&Math.hypot(q.x-p.x,q.y-p.y)<22){
        const eat=Math.min(.18,p.food);p.food-=eat;c.energy=Math.min(105,c.energy+eat*3.2);if(p.food<=0)p.alive=false;
      }
    }

    // IMPORTANT: no predator damage/grab here. V107 articulated jaw contact owns bites.
    // Clear stale grabs created by the old proximity path, while V107 mouthLatch remains independent.
    if(c.spec.role==='pred'&&c.grab&&c.grab.alive)c.grab=null;

    // Scavenging now requires the simulated jaw node to physically overlap a corpse body node.
    // Calories still go directly to energy; there is no stomach/digestion model in this ecosystem stack yet.
    if((c.spec.role==='scav'||c.spec.role==='pred')&&c.state==='SCAVENGE'){
      const corpse=c.aiTarget;
      if(corpse&&!corpse.alive&&corpse.meat>0){
        const hit=mouthTouches(c,corpse),gape=c.v107?.gape??1;
        if(hit&&gape>.18){
          truth.scavengerContacts++;
          spring(mouthNode(c),hit.node,Math.max(2,hit.limit*.55),.055*(c.g?.grip||1));
          if(simTick%8===c.id%8){const e=Math.min(.9,corpse.meat);corpse.meat-=e;c.energy=Math.min(105,c.energy+e*.72)}
        }
      }
    }

    // Preserve culture/reproduction systems from the old ecosystem.
    handleCulture(c);cultureInteraction(c);
    if(c.energy>84&&c.age>900&&c.mateCooldown<=0&&creatures.length<48){
      const mate=nearest(c,o=>o.alive&&o.type===c.type&&o!==c&&o.energy>78&&o.mateCooldown<=0,75);
      if(mate&&dist(c.center(),mate.center())<50&&rnd()<.006*c.g.fertility){
        const p=c.center();spawnCreature(c.type,c,mate,p.x+8,p.y-8);c.energy-=18;mate.energy-=18;c.mateCooldown=900;mate.mateCooldown=900;
      }
    }
  };
})();
