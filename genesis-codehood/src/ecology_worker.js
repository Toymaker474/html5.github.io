const MAX=1400,GENES=6;
let width=2400,height=1600,running=true,tick=0,count=0,seed=1;
const x=new Float32Array(MAX),y=new Float32Array(MAX),vx=new Float32Array(MAX),vy=new Float32Array(MAX),energy=new Float32Array(MAX),age=new Uint32Array(MAX),species=new Uint8Array(MAX),alive=new Uint8Array(MAX),genes=new Float32Array(MAX*GENES);
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
const bases=[
  [0.55,0.80,0.10,0.45,0.55,0.70], // deer speed vision aggression metabolism fertility fear
  [0.42,0.62,0.52,0.55,0.48,0.35], // boar
  [0.72,0.78,0.92,0.68,0.34,0.12], // wolf
  [0.80,0.60,0.05,0.42,0.86,0.88], // rabbit
  [0.58,0.44,0.05,0.35,0.72,0.65]  // fish
];
function g(i,k){return genes[i*GENES+k];}function sg(i,k,v){genes[i*GENES+k]=clamp(v,0.02,1.5);}function spawn(sp,parent=-1){if(count>=MAX)return -1;let i=-1;for(let n=0;n<MAX;n++)if(!alive[n]){i=n;break;}if(i<0)return-1;alive[i]=1;species[i]=sp;age[i]=0;energy[i]=70+rnd()*30;if(parent>=0){x[i]=clamp(x[parent]+(rnd()-.5)*20,0,width);y[i]=clamp(y[parent]+(rnd()-.5)*20,0,height);for(let k=0;k<GENES;k++)sg(i,k,g(parent,k)+(rnd()+rnd()-1)*.09);}else{x[i]=rnd()*width;y[i]=rnd()*height;for(let k=0;k<GENES;k++)sg(i,k,bases[sp][k]+(rnd()+rnd()-1)*.12);}vx[i]=vy[i]=0;count++;return i;}
function kill(i){if(alive[i]){alive[i]=0;count--;}}
function dist2(i,j){const dx=x[j]-x[i],dy=y[j]-y[i];return dx*dx+dy*dy;}
function nearest(i,pred){let best=-1,bd=Infinity;const vision=55+g(i,1)*120,v2=vision*vision;for(let j=0;j<MAX;j++){if(i===j||!alive[j]||!pred(j))continue;const d=dist2(i,j);if(d<bd&&d<v2){bd=d;best=j;}}return best;}
function steer(i,tx,ty,away=false){let dx=tx-x[i],dy=ty-y[i],d=Math.hypot(dx,dy)||1;if(away){dx=-dx;dy=-dy;}const s=.15+.5*g(i,0);vx[i]=vx[i]*.82+(dx/d)*s;vy[i]=vy[i]*.82+(dy/d)*s;}
function stepOne(i){if(!alive[i])return;age[i]++;const sp=species[i],fear=g(i,5),agg=g(i,2),met=g(i,3),fert=g(i,4);energy[i]-=.018+.045*met;let target=-1;
  if(sp===2){target=nearest(i,j=>species[j]!==2&&species[j]!==4);if(target>=0){steer(i,x[target],y[target]);if(dist2(i,target)<55){energy[i]+=12;energy[target]-=30;if(energy[target]<=0)kill(target);}}}
  else{const wolf=nearest(i,j=>species[j]===2);if(wolf>=0&&fear>.15)steer(i,x[wolf],y[wolf],true);else{target=nearest(i,j=>species[j]===sp);if(target>=0&&agg<.35&&rnd()<.03)steer(i,x[target],y[target]);else{vx[i]+=(rnd()-.5)*.18;vy[i]+=(rnd()-.5)*.18;}}energy[i]+=.01*(sp===4?1.5:1);}
  const maxSpeed=.35+1.05*g(i,0),m=Math.hypot(vx[i],vy[i]);if(m>maxSpeed){vx[i]=vx[i]/m*maxSpeed;vy[i]=vy[i]/m*maxSpeed;}x[i]+=vx[i];y[i]+=vy[i];if(sp===4){const band=height*.50+Math.sin(x[i]*.003)*height*.06;y[i]+= (band-y[i])*.015;}x[i]=clamp(x[i],0,width);y[i]=clamp(y[i],0,height);
  if(energy[i]>88&&age[i]>350&&rnd()<fert*.00055){energy[i]-=18;spawn(sp,i);}if(energy[i]<=0||age[i]>16000+g(i,3)*5000)kill(i);
}
function snapshot(){const arr=[];for(let i=0;i<MAX;i++)if(alive[i])arr.push({id:i,x:x[i],y:y[i],species:species[i],energy:energy[i]});postMessage({type:'snapshot',tick,count,animals:arr});}
function init(msg){seed=msg.seed>>>0||1;width=msg.width||width;height=msg.height||height;for(let i=0;i<MAX;i++)alive[i]=0;count=0;const starts=[180,90,55,260,150];for(let sp=0;sp<starts.length;sp++)for(let n=0;n<starts[sp];n++)spawn(sp);snapshot();}
function loop(){if(running){for(let k=0;k<2;k++){tick++;for(let i=0;i<MAX;i++)stepOne(i);}if(tick%6===0)snapshot();}setTimeout(loop,16);}
onmessage=e=>{const m=e.data||{};if(m.type==='init')init(m);else if(m.type==='pause')running=!!m.running;else if(m.type==='hunt'){let best=-1,bd=Infinity;for(let i=0;i<MAX;i++){if(!alive[i]||species[i]===2||species[i]===4)continue;const dx=x[i]-m.x,dy=y[i]-m.y,d=dx*dx+dy*dy;if(d<bd&&d<(m.radius||100)**2){bd=d;best=i;}}if(best>=0){const meat=18+energy[best]*.15;kill(best);postMessage({type:'huntResult',requestId:m.requestId,ok:true,meat,species:species[best]});}else postMessage({type:'huntResult',requestId:m.requestId,ok:false,meat:0});}};
loop();
