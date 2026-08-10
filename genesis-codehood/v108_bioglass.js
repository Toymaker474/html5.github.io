'use strict';
/* GENESIS V108 — BIOGLASS
   Cinematic wet-biome presentation + specimen observer UI.
   Simulation state remains authoritative; this layer only visualizes it. */
(function(){
  const V108_BASE_BG=drawBackground,V108_BASE_TERRAIN=drawTerrain,V108_BASE_PLANTS=drawPlants,V108_BASE_CREATURE=drawCreature,V108_BASE_UI=updateUI;
  let V108_PANEL=true,V108_lastGraph=0;

  function v108Fmt(n){if(n>=1e6)return(n/1e6).toFixed(2)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return Math.round(n)+''}
  function v108MetaLife(){let s=0;if(typeof metaPop!=='undefined')for(const n of metaPop)s+=n;return s+creatures.filter(c=>c.alive).length}
  function v108Region(c){try{if(typeof v104RegionForMicroX==='function'&&typeof v104CellAtWorld==='function')return v104RegionForMicroX(v104CellAtWorld(c.center().x,0).x).name.replaceAll('_',' ')}catch(e){}return'WILD BIOME'}
  function v108Humidity(c){const q=c.center(),cx=clamp(Math.floor(q.x/TILE),0,COLS-1),cy=clamp(Math.floor(q.y/TILE),0,ROWS-1),i=tidx(cx,cy);const local=(wet?.[i]||0);return clamp(Math.round(42+(weather?.rain||0)*42+local*24),12,100)}
  function v108Heat(c){try{if(typeof V105_HEAT!=='undefined'&&typeof v104CellAtWorld==='function'){const q=c.center(),cc=v104CellAtWorld(q.x,q.y),i=v104Idx(clamp(cc.x,0,V104_COLS-1),clamp(cc.y,0,V104_ROWS-1));return V105_HEAT[i]||0}}catch(e){}return 0}
  function v108Behavior(c){const m=c.mind;if(!m)return c.state||'ROAM';if(m.arousal>.72)return'ALERT';if(m.curiosity>.72&&m.bold>.48)return'INQUISITIVE';if(m.nerves>.72)return'WARY';if(m.territorial>.68)return'TERRITORIAL';if(m.patience>.72)return'PATIENT';return c.state||m.mood||'CALM'}
  function v108Age(c){const sec=(c.age||0)/60;const days=Math.floor(sec/120),hrs=Math.floor((sec%120)/5);return`${days}d ${hrs}h`}

  function v108BuildUI(){
    if(document.querySelector('#bioObserver'))return;
    const el=document.createElement('div');el.id='bioObserver';el.innerHTML=`<section id="bioCard" class="bioGlass"><div id="bioName">NO SPECIMEN</div><div id="bioRows" class="bioRows"></div></section><section id="bioSpec" class="bioGlass"><div id="bioSpecHead"><span>LIVE MORPHOLOGY</span><span id="bioSpecTag">—</span></div><canvas id="bioSpecCanvas"></canvas><div id="bioGraph"><canvas id="bioGraphCanvas"></canvas></div></section>`;document.body.appendChild(el);
    const hint=document.createElement('div');hint.id='bioHint';hint.textContent='tap a creature · drag world · pinch zoom';document.body.appendChild(hint);
    document.querySelector('#debug').textContent='🧬';document.querySelector('#debug').title='Anatomy debug';document.querySelector('#storm').textContent='☂';document.querySelector('#storm').title='Environment';document.querySelector('#follow').textContent='◎';document.querySelector('#follow').title='Follow specimen';document.querySelector('#reset').textContent='↻';document.querySelector('#reset').title='Regenerate world';
    el.addEventListener('pointerdown',e=>e.stopPropagation());
  }
  v108BuildUI();

  function v108Rows(c){
    const m=c.mind||{},inv=c.inventory||{},energy=clamp(c.energy||0,0,105),inj=Math.max(0,100-(c.health||0)),hum=v108Humidity(c),heat=v108Heat(c);
    const rows=[
      ['◉','FAMILY',c.spec.family||'unknown'],['◌','STATE',String(c.state||'ROAM').replaceAll('_',' ')],['⌁','GENERATION',c.gen??0],['ϟ','ENERGY',`${Math.round(energy)}%`],['⌘','FIBER / SILK',`${Math.round(inv.fiber||0)} / ${Math.round(inv.silk||0)}`],['⌇','LIMBS',c.limbs?.filter(l=>!l.disabled).length??0],['↕','BODY SCALE',`${(c.g?.size||1).toFixed(2)}×`],['◷','AGE',v108Age(c)],['⌂','ENVIRONMENT',v108Region(c)],['◈','BEHAVIOR',v108Behavior(c)],['♨','LOCAL HEAT',`${Math.round(heat)}`],['◌','HUMIDITY',`${hum}%`],['✚','INJURY',`${Math.round(inj)}%`]
    ];
    return rows.map((r,i)=>`<div class="bioRow"><span class="bioIcon">${r[0]}</span><span class="bioLabel">${r[1]}${i===3?`<div class="bioMeter"><i style="width:${energy}%"></i></div>`:''}</span><b class="bioValue">${r[2]}</b></div>`).join('');
  }

  function v108Specimen(c){
    const cv=document.querySelector('#bioSpecCanvas'),gc=document.querySelector('#bioGraphCanvas');if(!cv||!gc)return;
    const dpr=Math.min(devicePixelRatio||1,2.5),w=Math.max(120,cv.clientWidth),h=Math.max(100,cv.clientHeight);if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
    const nodes=[...(c.nodes||[]),...(c.tail||[])];if(!nodes.length)return;let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;for(const n of nodes){minX=Math.min(minX,n.x);maxX=Math.max(maxX,n.x);minY=Math.min(minY,n.y);maxY=Math.max(maxY,n.y)}for(const l of c.limbs||[]){minX=Math.min(minX,l.hand.x);maxX=Math.max(maxX,l.hand.x);minY=Math.min(minY,l.hand.y);maxY=Math.max(maxY,l.hand.y)}const sx=(w*.72)/Math.max(18,maxX-minX),sy=(h*.64)/Math.max(18,maxY-minY),s=Math.min(sx,sy),ox=w*.5-(minX+maxX)*.5*s,oy=h*.5-(minY+maxY)*.5*s;
    const P=n=>({x:n.x*s+ox,y:n.y*s+oy});
    const rg=x.createRadialGradient(w*.47,h*.43,1,w*.5,h*.5,Math.min(w,h)*.46);rg.addColorStop(0,'rgba(91,190,135,.12)');rg.addColorStop(.7,'rgba(22,72,56,.05)');rg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rg;x.fillRect(0,0,w,h);
    x.strokeStyle='rgba(170,244,202,.30)';x.lineCap='round';for(const l of c.limbs||[]){if(l.disabled)continue;const a=P(c.nodes[l.anchor]),b=P(l.hand);x.lineWidth=Math.max(1,1.7*s);x.beginPath();x.moveTo(a.x,a.y);x.lineTo((a.x+b.x)*.5,b.y-(l.arm?8:-4));x.lineTo(b.x,b.y);x.stroke()}
    for(let i=0;i<c.nodes.length-1;i++){const a=P(c.nodes[i]),b=P(c.nodes[i+1]);x.strokeStyle='rgba(197,248,215,.22)';x.lineWidth=Math.max(2,3.6*s);x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke()}
    for(let i=c.nodes.length-1;i>=0;i--){const n=c.nodes[i],p=P(n),r=Math.max(3,n.r*s);const gr=x.createRadialGradient(p.x-r*.35,p.y-r*.45,1,p.x,p.y,r*1.25);gr.addColorStop(0,c.spec.hi||'#b8d8b4');gr.addColorStop(.38,c.spec.color||'#597565');gr.addColorStop(1,'#18231f');x.fillStyle=gr;x.beginPath();x.ellipse(p.x,p.y,r*1.15,r*.82,0,0,TAU);x.fill();x.strokeStyle='rgba(210,255,228,.17)';x.lineWidth=1;x.stroke()}
    if(c.v107){const heart=P(c.v107.heart),st=P(c.v107.stomach);x.fillStyle='rgba(244,110,122,.72)';x.beginPath();x.arc(heart.x,heart.y,Math.max(1.6,2.2*s),0,TAU);x.fill();x.fillStyle='rgba(210,160,108,.6)';x.beginPath();x.arc(st.x,st.y,Math.max(2,2.7*s),0,TAU);x.fill();}
    const gw=Math.max(120,gc.clientWidth),gh=Math.max(45,gc.clientHeight);if(gc.width!==Math.round(gw*dpr)||gc.height!==Math.round(gh*dpr)){gc.width=Math.round(gw*dpr);gc.height=Math.round(gh*dpr)}const g=gc.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,gw,gh);g.strokeStyle='rgba(103,212,180,.45)';g.lineWidth=1;g.beginPath();for(let i=0;i<42;i++){const tt=(simTick-i*5)*.07+c.id,hv=.25+.22*Math.sin(tt)+.15*Math.sin(tt*.37+2),yy=gh*(.78-clamp(hv,0,1)*.55);if(i===0)g.moveTo(gw,yy);else g.lineTo(gw-i*(gw/41),yy)}g.stroke();g.fillStyle='rgba(84,178,204,.32)';for(let i=0;i<26;i++){const bh=(.18+.72*hash(c.id*173+i*97))*gh*.55;g.fillRect(i*gw/26,gh-bh,1.4,bh)}
  }

  function v108WetTerrain(t){
    if(typeof v104VisibleMicroBounds!=='function'||typeof v104Get!=='function')return;const b=v104VisibleMicroBounds(1),step=Math.max(2,Math.floor(6/Math.max(.65,camera.zoom)));
    X.save();X.globalCompositeOperation='screen';for(let y=b.t;y<=b.b;y+=step)for(let x=b.l;x<=b.r;x+=step){const m=v104Get(x,y),above=v104Get(x,y-1);if(m===0||above!==0)continue;const p=worldToScreen((x+.5)*V104_CELL,y*V104_CELL);const a=.025+.08*hash(x*977+y*311);X.fillStyle=`rgba(179,240,218,${a})`;X.beginPath();X.ellipse(p.x,p.y,Math.max(1,3.5*camera.zoom),Math.max(.5,.7*camera.zoom),0,0,TAU);X.fill()}X.restore();
  }
  function v108BioLights(t){
    X.save();X.globalCompositeOperation='screen';for(const p of plants){if(!p.alive||(p.bloom||0)<.62)continue;const s=worldToScreen(p.x,p.y-(p.height||12));if(s.x<-80||s.x>SW+80||s.y<-80||s.y>SH+80)continue;const r=(7+10*(p.bloom||0))*camera.zoom,gr=X.createRadialGradient(s.x,s.y,0,s.x,s.y,r*3);gr.addColorStop(0,'rgba(178,238,126,.12)');gr.addColorStop(.45,'rgba(94,195,117,.05)');gr.addColorStop(1,'rgba(0,0,0,0)');X.fillStyle=gr;X.fillRect(s.x-r*3,s.y-r*3,r*6,r*6)}X.restore();
  }
  function v108Post(t){
    X.save();const top=X.createLinearGradient(0,0,0,SH);top.addColorStop(0,'rgba(17,67,53,.07)');top.addColorStop(.55,'rgba(3,31,25,.02)');top.addColorStop(1,'rgba(0,0,0,.18)');X.fillStyle=top;X.fillRect(0,0,SW,SH);const v=X.createRadialGradient(SW*.5,SH*.42,Math.min(SW,SH)*.18,SW*.5,SH*.47,Math.max(SW,SH)*.68);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(.68,'rgba(0,5,5,.09)');v.addColorStop(1,'rgba(0,0,0,.46)');X.fillStyle=v;X.fillRect(0,0,SW,SH);X.restore();
  }

  drawBackground=function(t){
    const g=X.createLinearGradient(0,0,0,SH);g.addColorStop(0,'#061a15');g.addColorStop(.48,'#0a241c');g.addColorStop(1,'#04100d');X.fillStyle=g;X.fillRect(0,0,SW,SH);
    for(let layer=0;layer<4;layer++){const par=.018+layer*.028,alpha=.12+layer*.08,base=SH*(.48+layer*.10);X.strokeStyle=`rgba(4,15,12,${.55+layer*.08})`;X.lineCap='round';for(let k=-3;k<18;k++){const wx=(k*130-camera.x*par)%(SW+260),x=wx-130,w=12+layer*8+hash(k*97+layer*811)*18;X.lineWidth=w;X.beginPath();X.moveTo(x,-50);X.bezierCurveTo(x+35,SH*.18,x-28,SH*.35,x+12,base+120);X.stroke()}X.fillStyle=`rgba(7,28,20,${alpha})`;X.beginPath();X.moveTo(0,SH);for(let sx=-40;sx<SW+80;sx+=45){const h=40+hash((sx+layer*337)|0)*110;X.lineTo(sx,base-h);X.lineTo(sx+24,base-h*.4)}X.lineTo(SW,SH);X.closePath();X.fill()}
    for(let k=0;k<9;k++){const x=((hash(k*101+17)*SW)+(camera.x*.015))%(SW+120)-60,y=SH*(.18+.55*hash(k*223+7)),r=18+45*hash(k*61+3);const gr=X.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(143,225,196,.045)');gr.addColorStop(1,'rgba(0,0,0,0)');X.fillStyle=gr;X.beginPath();X.arc(x,y,r,0,TAU);X.fill()}
    if(typeof weather!=='undefined'&&weather.lightning>.02){X.fillStyle=`rgba(205,239,230,${weather.lightning*.16})`;X.fillRect(0,0,SW,SH)}
  };
  drawTerrain=function(t){V108_BASE_TERRAIN(t);v108WetTerrain(t)};
  drawPlants=function(t){V108_BASE_PLANTS(t);v108BioLights(t)};
  drawCreature=function(c,t){V108_BASE_CREATURE(c,t);if(!c.gone){const q=c.center(),s=worldToScreen(q.x,q.y);if(s.x>-100&&s.x<SW+100&&s.y>-100&&s.y<SH+100){X.save();X.globalCompositeOperation='screen';const speed=Math.min(1,Math.abs(c.speed?.()||0)*.45),r=(16+20*(c.g?.size||1))*camera.zoom,gr=X.createRadialGradient(s.x-r*.25,s.y-r*.5,0,s.x,s.y,r);gr.addColorStop(0,`rgba(170,232,210,${.035+speed*.04})`);gr.addColorStop(1,'rgba(0,0,0,0)');X.fillStyle=gr;X.fillRect(s.x-r,s.y-r,r*2,r*2);X.restore()}}};

  const V108_BASE_RENDER=render;
  render=function(t){V108_BASE_RENDER(t);v108Post(t)};

  updateUI=function(){
    V108_BASE_UI();v108BuildUI();const alive=creatures.filter(c=>c.alive);stats.innerHTML=`LIFE ${v108Fmt(v108MetaLife())} · ${alive.length} ACTIVE · GEN ${maxGen}`;
    const c=selected&&!selected.gone?selected:alive[0];const panel=document.querySelector('#bioObserver');if(!c){panel?.classList.add('bioHidden');return}panel?.classList.toggle('bioHidden',!V108_PANEL);document.querySelector('#bioName').textContent=`${c.spec.name.toUpperCase()}  #${c.id}`;document.querySelector('#bioRows').innerHTML=v108Rows(c);document.querySelector('#bioSpecTag').textContent=(c.spec.family||'').toUpperCase();if(simTick!==V108_lastGraph){V108_lastGraph=simTick;v108Specimen(c)}
  };

  const debug=document.querySelector('#debug');if(debug){debug.addEventListener('dblclick',()=>{V108_PANEL=!V108_PANEL;document.querySelector('#bioObserver')?.classList.toggle('bioHidden',!V108_PANEL)});}
})();
