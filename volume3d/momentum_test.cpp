#include <assert.h>
#include <stdio.h>
#include "solver.cpp"
static long water_x_sum(){long s=0;for(int y=0;y<H;y++)for(int z=0;z<D;z++)for(int x=0;x<W;x++)if(mat(idx(x,y,z))==WATER)s+=x;return s;}
int main(){genesis_init(32,24,32,123456u,72);genesis_seed_scene();uint32_t w0=genesis_water_cells();assert(genesis_pressure_sum()>0);for(int i=0;i<20;i++)genesis_step(1);assert(genesis_water_cells()==w0);assert(genesis_water_momentum()>0);assert(genesis_invariant()==1);genesis_init(24,20,24,9u,95);genesis_clear();assert(genesis_paint(2,7,10,12,3)>0);uint32_t wc=genesis_water_cells();long x0=water_x_sum();assert(genesis_water_impulse(7,10,12,4,80,0,0)>0);for(int i=0;i<8;i++)genesis_step(1);assert(genesis_water_cells()==wc);assert(water_x_sum()>x0);assert(genesis_invariant()==1);puts("PASS native water momentum + pressure proxy tests");}
