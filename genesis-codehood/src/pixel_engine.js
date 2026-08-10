const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLORS={
  PLAINS:['#6f8b4d','#81995b','#9aaa68'],FOREST:['#254f32','#31643d','#3e7548'],DESERT:['#9c743f','#b0864b','#c29a5c'],MARSH:['#3b6255','#477769','#5a8a79'],HIGHLAND:['#666775','#7b7c88','#9697a2'],ALPINE:['#9298a5','#b7bcc5','#d7dce2'],RIVER:['#285d86','#3173a1','#4b8fba'],TUNDRA:['#7e897d','#9ca79a','#b7c0b3'],TAIGA:['#355646','#416c55','#517d63'],SAVANNA:['#8f8747','#a39a52','#b3aa61'],BADLANDS:['#81513f','#985f49','#ad7458'],RUINS:['#6e5b59','#826b66','#927873']
};
const SPECIES_COLORS=['#d9c88c','#9b6547','#d1b28d','#c8c8c8','#93b9d8'];
function hash(x,y,s=0){let n=(x*374761393+y*668265263+s*1442695041)|0;n=(n^(n>>>13))*1274126177;return((n^(n>>>16))>>>0)/4294967296;}
function makeBuffer(){if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(512,288);const c=document.createElement('canvas');c.width=512;c.height=288;return c;}
function px(ctx,x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x|0,y|0,w|0,h|0);}
function terrainPattern(ctx,c,x,y,w,h){const p=COLORS[c.biome]||COLORS.PLAINS;px(ctx,x,y,w,h,p[0]);const count=Math.max(3,Math.floor(w*h/45));for(let i=0;i<count;i++){const rx=x+Math.floor(hash(i,c.id,1)*w),ry=y+Math.floor(hash(i,c.id,2)*h),r=hash(i,c.id,3);ctx.fillStyle=p[r>.55?2:1];ctx.fillRect(rx,ry,r>.8?2:1,r>.7?2:1);}if(c.biome==='FOREST'||c.biome==='TAIGA'){for(let i=0;i<Math.max(1,w/9);i++){const tx=x+2+Math.floor(hash(i,c.id,4)*Math.max(1,w-4)),ty=y+2+Math.floor(hash(i,c.id,5)*Math.max(1,h-5));px(ctx,tx,ty-2,1,3,'#173b26');px(ctx,tx-1,ty-3,3,2,c.biome==='TAIGA'?'#2d5b48':'#2c6a38');}}
if(c.biome==='RIVER'){for(let yy=y+2;yy<y+h;yy+=4)px(ctx,x,yy,w,1,'#6ba8cf');}
if(c.biome==='MARSH'){for(let i=0;i<3;i++)px(ctx,x+Math.floor(hash(i,c.id,8)*w),y+Math.floor(hash(i,c.id,9)*h),3,1,'#74a999');}
if(c.biome==='HIGHLAND'||c.biome==='ALPINE'||c.biome==='BADLANDS'){for(let i=0;i<2;i++){const rx=x+Math.floor(hash(i,c.id,10)*w),ry=y+Math.floor(hash(i,c.id,11)*h);px(ctx,rx,ry,2,2,'#a0a0a4');}}
}
function drawSite(ctx,c,x,y,w,h){const cx=x+(w>>1),cy=y+(h>>1);if(c.site==='CAMP'){px(ctx,cx-2,cy-1,5,3,'#5d4330');px(ctx,cx,cy-2,1,2,'#ffb52f');px(ctx,cx-1,cy-3,3,2,'#f36b2b');}
else if(c.site==='CAVE'){px(ctx,cx-3,cy-2,7,4,'#30313a');px(ctx,cx-2,cy-1,5,3,'#111218');}
else if(c.site==='RUIN'){px(ctx,cx-3,cy-2,2,4,'#81756e');px(ctx,cx+2,cy-1,2,3,'#81756e');px(ctx,cx-1,cy+1,3,1,'#6b615b');}
else if(c.site==='SPRING'){px(ctx,cx-1,cy-1,3,3,'#62b4dd');}
else if(c.site==='GROVE'){px(ctx,cx,cy-2,1,4,'#473420');px(ctx,cx-2,cy-3,5,3,'#4d8a48');}}
function human(ctx,h,x,y,t,selected){const walk=((t/130+h.id*3)|0)&1;const skin='#d8aa7a',shirt=selected?'#fff36c':h.lifeRole==='THINKER'?'#b28cff':h.lifeRole==='HUNTER'?'#8ab65e':h.lifeRole==='CRAFTER'?'#d79b59':h.lifeRole==='GAMER'?'#ef83c9':'#73b9d8';px(ctx,x,y-5,3,3,skin);px(ctx,x+1,y-2,1,3,shirt);px(ctx,x-1,y-1,1,2,skin);px(ctx,x+2,y-1,1,2,skin);px(ctx,x+(walk?0:1),y+1,1,3,'#4b3a2f');px(ctx,x+(walk?2:1),y+1,1,3,'#4b3a2f');if(selected){ctx.strokeStyle='#fff36c';ctx.strokeRect(x-2,y-7,7,12);}}
function animal(ctx,a,x,y,t){const c=SPECIES_COLORS[a.species]||'#ddd';if(a.species===4){px(ctx,x-2,y,5,2,c);px(ctx,x+2,y-1,1,1,'#d9e9f2');return;}px(ctx,x-2,y-1,4,3,c);px(ctx,x+2,y,2,2,c);const step=((t/180+a.id)|0)&1;px(ctx,x-1,y+2,1,step?2:1,'#382f2a');px(ctx,x+1,y+2,1,step?1:2,'#382f2a');if(a.species===2){px(ctx,x+3,y-1,1,1,'#333');}}
export function createPixelEngine(canvas,world){
  const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;const terrain=makeBuffer(),tctx=terrain.getContext('2d',{alpha:false});tctx.imageSmoothingEnabled=false;let logicalW=512,logicalH=288,lastKey='';
  function resize(){const r=canvas.getBoundingClientRect();const aspect=r.width/Math.max(1,r.height);logicalH=288;logicalW=clamp(Math.round(logicalH*aspect),384,640);canvas.width=logicalW;canvas.height=logicalH;ctx.imageSmoothingEnabled=false;terrain.width=logicalW;terrain.height=logicalH;lastKey='';}
  function rebuild(w){const key=w.seed+':'+logicalW+':'+logicalH;if(key===lastKey)return;lastKey=key;tctx.fillStyle='#10131a';tctx.fillRect(0,0,logicalW,logicalH);const cw=logicalW/w.cols,ch=logicalH/w.rows;for(const c of w.chunks){const x=Math.floor(c.cx*cw),y=Math.floor(c.cy*ch),x2=Math.ceil((c.cx+1)*cw),y2=Math.ceil((c.cy+1)*ch);terrainPattern(tctx,c,x,y,Math.max(1,x2-x),Math.max(1,y2-y));drawSite(tctx,c,x,y,Math.max(1,x2-x),Math.max(1,y2-y));} }
  function toScreen(x,y,w){return{x:Math.floor(x/w.width*logicalW),y:Math.floor(y/w.height*logicalH)};}
  function render(state,time=0){rebuild(state.world);ctx.drawImage(terrain,0,0);if(state.storm>0){ctx.fillStyle=`rgba(45,70,95,${Math.min(.24,state.storm*.18)})`;ctx.fillRect(0,0,logicalW,logicalH);for(let i=0;i<40;i++){const rx=(hash(i,(time/60)|0,90)*logicalW)|0,ry=(hash(i,(time/60)|0,91)*logicalH)|0;px(ctx,rx,ry,1,3,'#85a9be');}}
    for(const a of state.animals||[]){const p=toScreen(a.x,a.y,state.world);animal(ctx,a,p.x,p.y,time);}for(const h of state.humans||[]){if(!h.alive)continue;const p=toScreen(h.x,h.y,state.world);human(ctx,h,p.x,p.y,time,h.id===state.selectedId);}ctx.fillStyle='rgba(7,9,13,.78)';ctx.fillRect(5,5,150,30);ctx.fillStyle='#e9edf3';ctx.font='8px monospace';ctx.fillText(`YEAR ${state.year||0}  POP ${state.humans?.length||0}  WILDLIFE ${state.animals?.length||0}`,10,15);ctx.fillStyle='#9ed6a6';ctx.fillText(`LEARNED ${state.learned||0}  PROGRAMS ${state.programs||0}`,10,25);ctx.fillStyle='#c9b17a';ctx.fillText(`${state.status||'ALIFE RUNNING'}`,10,35);}
  function screenToWorld(clientX,clientY,w){const r=canvas.getBoundingClientRect();return{x:clamp((clientX-r.left)/r.width,0,1)*w.width,y:clamp((clientY-r.top)/r.height,0,1)*w.height};}
  resize();return{resize,render,screenToWorld,rebuild:()=>{lastKey='';rebuild(world);},logicalSize:()=>({width:logicalW,height:logicalH})};
}
