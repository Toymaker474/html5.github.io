#include <stdint.h>
#include <stddef.h>

// One translation unit reuses the authoritative coupled Weather3D+volume kernel
// plus the already-proven native body and one-way hydrodynamics sources.
// This file is an integration bridge, not a new solver.
#include "../world-coupling/weather_volume_bridge.cpp"
#undef EXPORT
#include "../native-body/body.cpp"

extern "C" {
int genesis_material_at(int x,int y,int z){return inside(x,y,z)?(int)mat(idx(x,y,z)):-1;}
int genesis_water_velocity_x_at(int x,int y,int z){return water_at(x,y,z)?(int)velX[idx(x,y,z)]:0;}
int genesis_water_velocity_y_at(int x,int y,int z){return water_at(x,y,z)?(int)velY[idx(x,y,z)]:0;}
int genesis_water_velocity_z_at(int x,int y,int z){return water_at(x,y,z)?(int)velZ[idx(x,y,z)]:0;}
int genesis_pressure_at(int x,int y,int z){return water_at(x,y,z)?(int)pressureField[idx(x,y,z)]:0;}
int genesis_sediment_at(int x,int y,int z){return water_at(x,y,z)?(int)sediment(idx(x,y,z)):0;}
}

#undef EXPORT
#include "../native-body/hydrodynamics.cpp"

namespace runtime_body_v1 {
constexpr uint32_t MODEL_VERSION=0x00010001u;
constexpr int Q=65536;
static uint32_t syncSolidCount=0;

void sync_body_collision_cache(){
  syncSolidCount=0;
  for(int z=0;z<32;z++)for(int y=0;y<24;y++)for(int x=0;x<32;x++){
    const int m=genesis_material_at(x,y,z);
    const int solid=(m==ROCK||m==SAND)?1:0;
    genesis_body_set_voxel(x,y,z,solid);
    syncSolidCount+=(uint32_t)solid;
  }
}

void reset(uint32_t seed){
  genesis_world_coupling_reset(seed?seed:0x3d5a17u);
  // Seed the articulated body in free volume above the generated terrain.
  // The previous y=6 placement could begin embedded in authoritative solids,
  // making the hydrodynamic fixture unable to establish real WATER occupancy.
  genesis_body_seed_organism(16*Q,18*Q,16*Q);
  sync_body_collision_cache();
  genesis_hydro_apply();
}

void step(int weatherSteps,int volumeSteps,int bodySteps){
  if(weatherSteps<1)weatherSteps=1;if(weatherSteps>8)weatherSteps=8;
  if(volumeSteps<1)volumeSteps=1;if(volumeSteps>4)volumeSteps=4;
  if(bodySteps<1)bodySteps=1;if(bodySteps>8)bodySteps=8;
  genesis_world_coupling_step(weatherSteps,volumeSteps);
  sync_body_collision_cache();
  genesis_hydro_apply();
  genesis_body_step(bodySteps);
}

uint32_t hash(){
  uint32_t h=2166136261u;
  auto mix=[&](uint32_t v){h^=v;h*=16777619u;};
  mix(genesis_world_coupling_hash());
  mix(genesis_body_hash());
  mix(genesis_hydro_submerged_nodes());
  mix(genesis_hydro_buoyancy_impulse());
  mix(genesis_hydro_drag_impulse());
  mix(genesis_hydro_pressure_impulse());
  mix(syncSolidCount);
  return h;
}
}

extern "C" {
EXPORT("genesis_runtime_body_model_version") uint32_t genesis_runtime_body_model_version(){return runtime_body_v1::MODEL_VERSION;}
EXPORT("genesis_runtime_body_reset") void genesis_runtime_body_reset(uint32_t seed){runtime_body_v1::reset(seed);}
EXPORT("genesis_runtime_body_step") void genesis_runtime_body_step(int weatherSteps,int volumeSteps,int bodySteps){runtime_body_v1::step(weatherSteps,volumeSteps,bodySteps);}
EXPORT("genesis_runtime_body_hash") uint32_t genesis_runtime_body_hash(){return runtime_body_v1::hash();}
EXPORT("genesis_runtime_body_synced_solids") uint32_t genesis_runtime_body_synced_solids(){return runtime_body_v1::syncSolidCount;}
}
