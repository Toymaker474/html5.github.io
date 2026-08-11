'use strict';
/* GENESIS mobile observer controls.
   Phone-first camera/navigation layer. Does not alter simulation outcomes. */
(function(){
  if(typeof C==='undefined'||typeof camera==='undefined'||typeof creatures==='undefined')return;
  const coarse=matchMedia?.('(pointer:coarse)')?.matches||innerWidth<760;if(!coarse)return;
  document.body.classList.add('mob-ui');
  C.style.touchAction='none';

  const ui=document.createElement('div');ui.id='mobileObserver';ui.innerHTML=`
    <button id="mobLook" aria-label="Hide or show interface">◉</button>
    <div id="mobStatus"><b id="mobName">WORLD</b><span id="mobMini">drag · pinch · tap</span></div>
    <div id="mobTruth">BITE: JAW CONTACT · DIGESTION: APPROX</div>
    <div id="mobDock">
      <button id="mobPause" aria-label="Pause">Ⅱ</button>
      <button id="mobSpeed" aria-label="Speed">×1</button>
      <button id="mobFocus" aria-label="Follow selected">◎</button>
      <button id="mobInfo" aria-label="Inspector">i</button>
      <button id="mobRain" aria-label="Weather">☂</button>
      <button id="mobReset" aria-label="Regenerate">↻</button>
    </div>`;document.body.appendChild(ui);

  const $=id=>document.getElementById(id),old=id=>document.getElementById(id);
  let look=false,details=false;
  function toggleLook(){look=!look;document.body.classList.toggle('mob-look',look);$('mobLook').textContent=look?'◉':'◉';if(look){details=false;document.body.classList.remove('mob-details')}}
  function toggleDetails(){details=!details;document.body.classList.toggle('mob-details',details);$('mobInfo').dataset.on=details?'1':'0'}
  $('mobLook').onclick=toggleLook;
  $('mobInfo').onclick=toggleDetails;
  $('mobPause').onclick=()=>old('pause')?.click();
  $('mobSpeed').onclick=()=>{old('speed')?.click();setTimeout(syncButtons,0)};
  $('mobFocus').onclick=()=>old('follow')?.click();
  $('mobRain').onclick=()=>old('storm')?.click();
  $('mobReset').onclick=()=>old('reset')?.click();
  function syncButtons(){const s=old('speed');if(s)$('mobSpeed').textContent=s.textContent||'×1';const p=old('pause');if(p)$('mobPause').textContent=(p.textContent||'Ⅱ').trim()}
  syncButtons();

  const pointers=new Map();let gesture=null,lastTap=0;
  const clampCam=()=>{camera.zoom=clamp(camera.zoom,.42,3.2);camera.x=clamp(camera.x,0,WORLD_W);camera.y=clamp(camera.y,0,WORLD_H)};
  function beginGesture(){
    const pts=[...pointers.values()];
    if(pts.length===1){const p=pts[0];gesture={mode:'pan',sx:p.x,sy:p.y,lx:p.x,ly:p.y,cx:camera.x,cy:camera.y,moved:false,t:performance.now()}}
    else if(pts.length>=2){const a=pts[0],b=pts[1],mx=(a.x+b.x)/2,my=(a.y+b.y)/2,d=Math.max(8,Math.hypot(a.x-b.x,a.y-b.y));gesture={mode:'pinch',d,zoom:camera.zoom,mx,my,worldX:camera.x+(mx-SW/2)/camera.zoom,worldY:camera.y+(my-SH/2)/camera.zoom,moved:true}}
  }
  function selectAt(sx,sy){
    let best=null,bd=52*52;
    for(const c of creatures){if(!c.alive||c.gone)continue;const q=c.center(),p=worldToScreen(q.x,q.y),d=(p.x-sx)**2+(p.y-sy)**2;if(d<bd){bd=d;best=c}}
    if(best){selected=best;details=false;document.body.classList.remove('mob-details');return true}return false;
  }
  function down(e){if(e.target!==C)return;e.preventDefault();e.stopImmediatePropagation();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{C.setPointerCapture(e.pointerId)}catch(_){}beginGesture()}
  function move(e){if(!pointers.has(e.pointerId))return;e.preventDefault();e.stopImmediatePropagation();const p=pointers.get(e.pointerId);p.x=e.clientX;p.y=e.clientY;
    if(pointers.size>=2){if(!gesture||gesture.mode!=='pinch')beginGesture();const pts=[...pointers.values()],a=pts[0],b=pts[1],d=Math.max(8,Math.hypot(a.x-b.x,a.y-b.y)),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nz=clamp(gesture.zoom*d/gesture.d,.42,3.2);camera.zoom=nz;camera.x=gesture.worldX-(mx-SW/2)/nz;camera.y=gesture.worldY-(my-SH/2)/nz;clampCam();return}
    if(!gesture||gesture.mode!=='pan')beginGesture();const dx=e.clientX-gesture.lx,dy=e.clientY-gesture.ly;gesture.lx=e.clientX;gesture.ly=e.clientY;if(Math.hypot(e.clientX-gesture.sx,e.clientY-gesture.sy)>5)gesture.moved=true;camera.x-=dx/camera.zoom;camera.y-=dy/camera.zoom;clampCam();
  }
  function up(e){if(!pointers.has(e.pointerId))return;e.preventDefault();e.stopImmediatePropagation();const p=pointers.get(e.pointerId),g=gesture;pointers.delete(e.pointerId);if(g?.mode==='pan'&&!g.moved&&performance.now()-g.t<380){const now=performance.now(),hit=selectAt(p.x,p.y);if(!hit&&now-lastTap<290){camera.zoom=clamp(camera.zoom*1.35,.42,3.2)}lastTap=now}if(pointers.size)beginGesture();else gesture=null}
  C.addEventListener('pointerdown',down,{capture:true,passive:false});C.addEventListener('pointermove',move,{capture:true,passive:false});C.addEventListener('pointerup',up,{capture:true,passive:false});C.addEventListener('pointercancel',up,{capture:true,passive:false});

  const UI0=updateUI;updateUI=function(){UI0();syncButtons();const alive=creatures.filter(c=>c.alive&&!c.gone),c=selected&&!selected.gone?selected:null;if(c){$('mobName').textContent=`${c.spec.name} #${c.id}`;$('mobMini').textContent=`${String(c.state||'ROAM').replaceAll('_',' ')} · ${Math.round(c.energy||0)}% · ${c.spec.family}`;}else{$('mobName').textContent=`WORLD · ${alive.length} ACTIVE`;$('mobMini').textContent='drag · pinch · tap creature'}const T=window.GENESIS_FEED_TRUTH;$('mobTruth').textContent=T?.stomachDigestion===false?'BITE: JAW CONTACT · DIGESTION: APPROX':'SIMULATION OBSERVER';};
})();
