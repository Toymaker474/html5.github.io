import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../flip_ocean.js', import.meta.url),'utf8');
const ctx={console,Math,Float32Array,Uint8Array,Uint16Array,globalThis:null};ctx.globalThis=ctx;
vm.runInNewContext(source,ctx,{filename:'flip_ocean.js'});
const T=ctx.GENESIS_FLIP_OCEAN_TEST;assert.ok(T);
function tank(){const c=T.makeCore({nx:20,ny:16,cell:1,dt:1/60,maxParticles:256,flipRatio:.9});for(let x=0;x<20;x++)c.setSolid(x,15,1);for(let y=0;y<16;y++){c.setSolid(0,y,1);c.setSolid(19,y,1)}return c}
{
 const c=tank();for(let y=8;y<14;y++)for(let x=4;x<10;x++)c.addParticle(x+.3,y+.3,(x%2?.3:-.2),0);
 const n=c.particleCount,m=c.particleMass();for(let i=0;i<20;i++)c.step({gravity:4,pressureIters:20});
 assert.equal(c.particleCount,n);assert.equal(c.particleMass(),m);console.log('PASS FLIP/PIC particle water mass is conserved without sources/sinks');
}
{
 const c=tank();for(let y=8;y<13;y++)for(let x=5;x<14;x++)c.addParticle(x+.4,y+.4,(x<10?-3:3),(y<10?-1:1));
 c.particlesToGrid();const before=c.divergenceNorm();const r=c.project(40);const after=c.divergenceNorm();assert.ok(before>1e-4);assert.ok(after<before*.75,`div ${before} -> ${after}`);assert.ok(r.after<=after+1e-6);console.log('PASS MAC pressure projection measurably reduces velocity divergence');
}
{
 const c=tank();c.addParticle(8.3,5.3,0,0);c.addParticle(9.3,5.3,0,0);c.particlesToGrid();c.applyGravity(12);c.gridToParticles();let vy=0;for(let i=0;i<c.maxP;i++)if(c.alive[i])vy+=c.pvy[i];assert.ok(vy>0);console.log('PASS gravity accelerates continuous fluid particles downward');
}
{
 const c=tank();c.setSolid(8,8,1);const id=c.addParticle(8.5,8.5,0,0);c.advectParticles();const cx=Math.floor(c.px[id]),cy=Math.floor(c.py[id]);assert.equal(c.solid[cy*c.nx+cx],0);console.log('PASS particle/terrain collision ejects liquid from solid terrain');
}
{
 const c=T.makeCore({nx:20,ny:16,cell:1,dt:1/60,maxParticles:256,flipRatio:.9});for(let x=0;x<20;x++)c.setSolid(x,15,1);for(let y=0;y<16;y++)c.setSolid(19,y,1);for(let y=7;y<13;y++)for(let x=1;x<5;x++)c.addParticle(x+.35,y+.35,0,0);for(let i=0;i<8;i++)c.step({gravity:0,pressureIters:24,waveU:3,waveSide:'left'});let vx=0,n=0;for(let i=0;i<c.maxP;i++)if(c.alive[i]){vx+=c.pvx[i];n++}assert.ok(vx/n>.02,`mean vx=${vx/n}`);console.log('PASS open ocean-boundary forcing injects coherent horizontal wave momentum');
}
assert.equal(T.fallingSand,false);assert.equal(T.full3D,false);assert.match(T.representation,/FLIP\/PIC/);console.log('PASS metadata rejects falling-sand/full-3D claims and names the actual solver');
