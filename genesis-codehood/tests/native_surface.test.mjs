import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../native-surface.js',import.meta.url),'utf8');
const ctx={globalThis:{}};vm.createContext(ctx);vm.runInContext(src,ctx);const {build}=ctx.globalThis.GENESIS_SURFACE;
const meta={w:3,h:6,d:3},state=new Uint32Array(meta.w*meta.h*meta.d),at=(x,y,z)=>(y*meta.d+z)*meta.w+x,pack=(mat,wet=0,sed=0)=>mat|(wet<<8)|(sed<<16);
for(let z=0;z<3;z++)for(let x=0;x<3;x++){state[at(x,0,z)]=pack(3);state[at(x,1,z)]=pack(1,64+x*60);}
state[at(2,2,0)]=pack(1,220);state[at(2,2,1)]=pack(1,220);state[at(2,2,2)]=pack(1,220);
for(let z=1;z<3;z++)for(let x=0;x<2;x++)state[at(x,2,z)]=pack(2,0,128);
const mesh=build(state,meta);assert.ok(mesh.terrain.length>=4,'terrain faces derive from occupied native columns');assert.ok(mesh.water.length>=1,'water faces derive from native water columns');
const slope=mesh.terrain.find(f=>Math.abs(f.nx)>.05||Math.abs(f.nz)>.05);assert.ok(slope,'height differences produce a non-flat geometric normal');assert.ok(mesh.terrain.some(f=>f.wet>64),'sand moisture survives into render material inputs');assert.ok(mesh.water.some(f=>f.sed===128),'suspended sediment survives into water turbidity input');
const before=mesh.terrain.map(f=>[f.h00,f.h10,f.h11,f.h01]);state[at(0,2,0)]=pack(1,200);const after=build(state,meta).terrain.map(f=>[f.h00,f.h10,f.h11,f.h01]);assert.notDeepEqual(after,before,'changing native occupancy changes generated surface geometry');
console.log('PASS native surface mesh geometry, normals, moisture and turbidity are derived from simulation state');
