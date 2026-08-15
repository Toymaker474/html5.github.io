#include <assert.h>
#include <stdio.h>
#include "runtime_body_bridge.cpp"

static void flood_body_samples(){
  // Build the deterministic hydro fixture from the body's actual simulated
  // node coordinates instead of assuming the body still occupies its seed
  // center after world/fluid stepping. This exercises real WATER occupancy
  // against the exact seven-point native hydrodynamics sampler.
  for(int i=0;i<genesis_body_node_count();i++){
    const int x=genesis_body_node_x(i)/65536;
    const int y=genesis_body_node_y(i)/65536;
    const int z=genesis_body_node_z(i)/65536;
    genesis_paint(WATER,x,y,z,1);
  }
}

static uint32_t run_fixture(){
  genesis_runtime_body_reset(0x51a7u);
  assert(genesis_body_node_count()==18);
  assert(genesis_runtime_body_synced_solids()>0);

  flood_body_samples();
  const uint32_t water0=genesis_water_cells();
  assert(water0>0);

  // Prove the promoted hydro model sees actual native WATER before allowing
  // world advection to move the fixture away from the articulated body.
  genesis_hydro_apply();
  assert(genesis_hydro_submerged_nodes()>0);
  assert(genesis_hydro_submerged_samples()>0);
  assert(genesis_hydro_buoyancy_impulse()>0);

  const uint32_t body0=genesis_body_hash();
  for(int i=0;i<24;i++) genesis_runtime_body_step(1,1,1);
  assert(genesis_body_hash()!=body0);
  assert(genesis_world_coupling_conservation_error()==0);
  assert(genesis_invariant()==1);
  return genesis_runtime_body_hash();
}

int main(){
  const uint32_t a=run_fixture();
  const uint32_t b=run_fixture();
  assert(a==b);
  printf("REFERENCE_HASH %u\n",a);
  printf("PASS GENESIS runtime body promotion V1: authoritative world coupling + voxel body contact + one-way native hydrodynamics replay deterministically\n");
  return 0;
}
