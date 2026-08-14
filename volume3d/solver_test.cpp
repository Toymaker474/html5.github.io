#include <assert.h>
#include <stdio.h>
#include "solver.cpp"
int main(){
  genesis_init(32,24,32,123456u,72);genesis_seed_scene();
  uint32_t h0=genesis_hash(),s0=genesis_sand_mass_units(),w0=genesis_water_cells();
  int kicked=genesis_impulse_water(24,7,10,6,420,0,160);assert(kicked>0);assert(genesis_fluid_momentum_x()>0);
  genesis_step(1);
  uint32_t div0=genesis_fluid_divergence_before(),div1=genesis_fluid_divergence_after();
  assert(div1<=div0);assert(genesis_fluid_kinetic_energy()>0);
  for(int i=1;i<80;i++)genesis_step(1);
  uint32_t h1=genesis_hash(),s1=genesis_sand_mass_units(),w1=genesis_water_cells(),ke=genesis_fluid_kinetic_energy();
  assert(genesis_invariant()==1);assert(s0==s1);assert(w0==w1);assert(h0!=h1);assert(ke>0);
  uint32_t e=genesis_erosion_events(),d=genesis_deposition_events();assert(e>0);assert(d>0);
  genesis_init(32,24,32,123456u,72);genesis_seed_scene();genesis_impulse_water(24,7,10,6,420,0,160);for(int i=0;i<80;i++)genesis_step(1);assert(h1==genesis_hash());
  genesis_init(24,20,24,9u,95);genesis_clear();int made=genesis_paint(5,12,15,12,4);assert(made>0);uint32_t wet0=genesis_sand_mass_units();for(int i=0;i<30;i++)genesis_step(1);assert(genesis_sand_mass_units()==wet0);assert(genesis_invariant()==1);
  genesis_init(24,20,24,77u,72);genesis_clear();genesis_paint(3,12,2,12,8);genesis_paint(2,12,14,12,3);uint32_t wf=genesis_water_cells();for(int i=0;i<8;i++)genesis_step(1);assert(genesis_water_cells()==wf);assert(genesis_fluid_momentum_y()<0);assert(genesis_invariant()==1);
  printf("{\"model\":\"genesis-volume3d-momentum-pressure-v1\",\"hash\":%u,\"sandUnits\":%u,\"waterCells\":%u,\"erosion\":%u,\"deposition\":%u,\"projectionDivBefore\":%u,\"projectionDivAfter\":%u,\"kinetic\":%u}\n",h1,s1,w1,e,d,div0,div1,ke);
  puts("PASS GENESIS native 3D discrete fluid momentum/pressure tests");
}
