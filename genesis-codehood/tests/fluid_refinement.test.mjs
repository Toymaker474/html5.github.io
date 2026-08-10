import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../fluid_refinement.js',import.meta.url),'utf8');
function makeContext(){
  const CW=12,CH=10,N=CW*CH;
  const MAT={AIR:0,ROCK:1,DIRT:2,SAND:3,WATER:4,LAVA:5,MUD:6,OBSIDIAN:7,ASH:8};
  const M=new Uint8Array(N);for(let x=0;x<CW;x++)M[(CH-1)*CW+x]=MAT.ROCK;
  const volume=new Float32Array(N),sediment=new Float32Array(N);
  const ctx={console,Math,Float32Array,Uint8Array,performance:{now:()=>0},innerWidth:800,window:{GENESIS_V110:{fields:{volume,sediment}}},
    V104_COLS:CW,V104_ROWS:CH,V104_CELL:7,V104_MAT:MAT,V104_M:M,
    v104Get:(x,y)=>x<0||y<0||x>=CW||y>=CH?MAT.ROCK:M[y*CW+x],
    v104SolidMat:m=>[MAT.ROCK,MAT.DIRT,MAT.SAND,MAT.MUD,MAT.OBSIDIAN,MAT.ASH].includes(m),
    v104VisibleMicroBounds:()=>({l:1,r:CW-2,t:1,b:CH-2}),
    step(){},reset(){},drawTerrain(){},creatures:[],camera:{zoom:1,x:0,y:0},worldToScreen:(x,y)=>({x,y}),weather:{rain:0}
  };
  ctx.window.window=ctx.window;vm.createContext(ctx);vm.runInContext(source,ctx);return ctx;
}
function run(name,fn){try{fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1}}

run('fluid grid is genuinely 2x finer per axis',()=>{const c=makeContext(),a=c.window.GENESIS_FLUID_REFINEMENT;assert.equal(a.width,c.V104_COLS*2);assert.equal(a.height,c.V104_ROWS*2);assert.equal(a.cell,c.V104_CELL/2)});
run('pairwise solver conserves water mass without coarse sync',()=>{const c=makeContext(),a=c.window.GENESIS_FLUID_REFINEMENT;a.debugClearWater();a.debugSet(8,3,1);a.debugSet(9,3,.7);a.debugSet(8,4,.4);const m0=a.debugMass();for(let i=0;i<120;i++)a.stepOnce({sync:false,couple:false,bounds:{l:1,r:a.width-2,t:1,b:a.height-2}});const m1=a.debugMass();assert.ok(Math.abs(m1-m0)<1e-4,`mass drift ${m1-m0}`)});
run('gravity moves fluid center of mass downward',()=>{const c=makeContext(),a=c.window.GENESIS_FLUID_REFINEMENT;a.debugClearWater();a.debugSet(10,2,1);const y0=a.debugCenterOfMassY();for(let i=0;i<24;i++)a.stepOnce({sync:false,couple:false,bounds:{l:1,r:a.width-2,t:1,b:a.height-2}});const y1=a.debugCenterOfMassY();assert.ok(y1>y0+3,`expected downward movement ${y0} -> ${y1}`)});
run('fluid current couples to creature node and displaces water',()=>{const c=makeContext(),a=c.window.GENESIS_FLUID_REFINEMENT;a.debugClearWater();const x=10,y=10;a.debugSet(x,y,1);a.debugSetVelocity(x,y,1,0);const wx=(x+.5)*a.cell,wy=(y+.5)*a.cell,node={x:wx,y:wy,px:wx,py:wy,r:4};c.creatures.push({alive:true,gone:false,nodes:[node]});const m0=a.debugMass();a.coupleCreatures();const m1=a.debugMass();assert.ok(node.px!==wx||node.py!==wy,'node velocity history was not altered by fluid coupling');assert.ok(Math.abs(m1-m0)<1e-5,'body displacement must redistribute, not delete, water')});
run('coarse reservoir synchronization is gradual rather than teleporting full mass',()=>{const c=makeContext(),a=c.window.GENESIS_FLUID_REFINEMENT;a.debugClearWater();c.window.GENESIS_V110.fields.volume[4*c.V104_COLS+4]=1;const b={l:8,r:9,t:8,b:9};a.syncFromCoarse(b,.15);const m=a.debugMass();assert.ok(m>0&&m<4,`expected gradual partial sync, got ${m}`)});
if(process.exitCode)process.exit(process.exitCode);
