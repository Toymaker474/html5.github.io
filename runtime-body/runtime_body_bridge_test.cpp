#include <assert.h>
#include <stdio.h>
#include "runtime_body_bridge.cpp"

static uint32_t run_fixture(){
  genesis_runtime_body_reset(0x51a7u);
  assert(genesis_body_node_count()==18);
  assert(genesis_runtime_body_synced_solids()>0);
  genesis_paint(WATER,16,6,16,3);
  uint32_t water0=genesis_water_cells();
  assert(water0>0);
  uint32_t body0=genesis_body_hash();
  for(int i=0;i<24;i++) genesis_runtime_body_step(1,1,1);
  assert(genesis_body_hash()!=body0);
  assert(genesis_hydro_submerged_nodes()>0);
  assert(genesis_hydro_buoyancy_impulse()>0);
  assert(genesis_world_coupling_conservation_error()==0);
  assert(genesis_invariant()==1);
  return genesis_runtime_body_hash();
}

int main(){
  uint32_t a=run_fixture();
  uint32_t b=run_fixture();
  assert(a==b);
  printf("REFERENCE_HASH %u\n",a);
  printf("PASS GENESIS runtime body promotion V1: authoritative world coupling + voxel body contact + one-way native hydrodynamics replay deterministically\n");
  return 0;
}
