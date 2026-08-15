#include <stdint.h>
#include <stddef.h>

// One translation unit deliberately embeds the two authoritative native kernels.
// This is a bridge, not a third weather/fluid implementation.
#include "../volume3d/solver.cpp"
#include "../world-weather/weather3d.cpp"

namespace coupling {
constexpr uint32_t MASS_UNITS_PER_WATER_VOXEL = 256u;
constexpr uint32_t MODEL_VERSION = 0x00010001u;
static uint32_t injectedVoxels = 0;
static uint32_t evaporatedVoxels = 0;
static uint32_t terrainFeedbackCells = 0;
static uint32_t weatherRemovedUnits = 0;
static uint32_t volumeAddedUnits = 0;
static uint32_t volumeRemovedUnits = 0;
static uint32_t weatherAddedUnits = 0;

inline int map_wx(int x){ return (x * w3::W) / W; }
inline int map_wz(int z){ return (z * w3::D) / D; }
inline int top_any(int x,int z){ for(int y=H-1;y>=0;y--) if(mat(idx(x,y,z))!=EMPTY) return y; return -1; }
inline int top_solid(int x,int z){ for(int y=H-1;y>=0;y--){ uint8_t m=mat(idx(x,y,z)); if(m==ROCK||m==SAND) return y; } return -1; }
inline int exposed_water(int x,int z){ int y=top_any(x,z); return y>=0 && mat(idx(x,y,z))==WATER ? y : -1; }

void reset_telemetry(){
  injectedVoxels=evaporatedVoxels=terrainFeedbackCells=0;
  weatherRemovedUnits=volumeAddedUnits=volumeRemovedUnits=weatherAddedUnits=0;
}

void sync_topography(){
  for(int wz=0;wz<w3::D;wz++) for(int wx=0;wx<w3::W;wx++){
    int x=(wx*W)/w3::W, z=(wz*D)/w3::D;
    int sy=top_solid(x,z);
    int target=w3::clampi(2 + ((sy<0?0:sy)*12)/(H>1?H-1:1),2,14);
    int wi=w3::sidx(wx,wz), old=(int)w3::terrain[wi];
    if(old==target) continue;
    w3::terrain[wi]=(uint16_t)target;
    terrainFeedbackCells++;
    if(target>old){
      for(int y=old+1;y<=target && y<w3::H;y++) w3::zero_air_cell(w3::idx(wx,y,wz));
    }
  }
}

void inject_runoff(){
  for(int z=0;z<D;z++) for(int x=0;x<W;x++){
    int wx=map_wx(x), wz=map_wz(z), wi=w3::sidx(wx,wz);
    if(w3::surfaceWater[wi] < MASS_UNITS_PER_WATER_VOXEL) continue;
    int y=top_any(x,z)+1;
    if(y<0) y=0;
    if(y>=H) continue;
    int vi=idx(x,y,z);
    if(mat(vi)!=EMPTY) continue;
    w3::surfaceWater[wi]=(uint16_t)(w3::surfaceWater[wi]-MASS_UNITS_PER_WATER_VOXEL);
    mat(vi)=WATER; moist(vi)=0; sediment(vi)=0; clear_motion(vi); movedWater[vi]=1;
    injectedVoxels++;
    weatherRemovedUnits += MASS_UNITS_PER_WATER_VOXEL;
    volumeAddedUnits += MASS_UNITS_PER_WATER_VOXEL;
  }
  update_fluid_metrics();
}

void evaporate_exposed_volume_water(){
  // Bounded transfer: at most one exposed voxel per 8x8 volume-column phase per bridge call.
  // Newly injected voxels are marked movedWater and cannot immediately evaporate back.
  for(int z=0;z<D;z++) for(int x=0;x<W;x++){
    if(((x + 3*z + (int)stepIndex) & 7) != 0) continue;
    int y=exposed_water(x,z); if(y<0) continue;
    int vi=idx(x,y,z); if(movedWater[vi]) continue;
    int wx=map_wx(x), wz=map_wz(z), floor=(int)w3::terrain[w3::sidx(wx,wz)];
    int ay=w3::clampi(floor+1,0,w3::H-1), ai=w3::idx(wx,ay,wz);
    if(w3::solid(wx,ay,wz)) continue;
    if(w3::temperature[ai] <= 8*w3::Q) continue;
    if(w3::humidity[ai] > 4095-(int)MASS_UNITS_PER_WATER_VOXEL) continue;
    mat(vi)=EMPTY; moist(vi)=sediment(vi)=0; clear_motion(vi);
    w3::humidity[ai]=(uint16_t)(w3::humidity[ai]+MASS_UNITS_PER_WATER_VOXEL);
    evaporatedVoxels++;
    volumeRemovedUnits += MASS_UNITS_PER_WATER_VOXEL;
    weatherAddedUnits += MASS_UNITS_PER_WATER_VOXEL;
  }
  update_fluid_metrics();
}

void exchange_only(){
  reset_telemetry();
  sync_topography();
  inject_runoff();
  evaporate_exposed_volume_water();
}

uint32_t conservation_error(){
  uint32_t a=weatherRemovedUnits>volumeAddedUnits?weatherRemovedUnits-volumeAddedUnits:volumeAddedUnits-weatherRemovedUnits;
  uint32_t b=volumeRemovedUnits>weatherAddedUnits?volumeRemovedUnits-weatherAddedUnits:weatherAddedUnits-volumeRemovedUnits;
  return a+b;
}

uint32_t hash(){
  uint32_t h=2166136261u;
  auto add=[&](uint32_t v){h^=v;h*=16777619u;};
  add(genesis_hash()); add(w3::hash_state()); add(injectedVoxels); add(evaporatedVoxels);
  add(terrainFeedbackCells); add(weatherRemovedUnits); add(volumeAddedUnits);
  add(volumeRemovedUnits); add(weatherAddedUnits); add(conservation_error());
  return h;
}

uint32_t reference_fixture(){
  genesis_init(24,20,24,0x51a7u,70); genesis_clear();
  w3::reset(0x51a7u);
  for(int i=0;i<w3::SN;i++) w3::surfaceWater[i]=0;
  int x=7,z=9,wx=map_wx(x),wz=map_wz(z),wi=w3::sidx(wx,wz);
  for(int y=0;y<=4;y++){int vi=idx(x,y,z);mat(vi)=ROCK;clear_motion(vi);}
  w3::surfaceWater[wi]=512;
  exchange_only();
  return hash();
}
}

extern "C" {
EXPORT("genesis_world_coupling_reset") void genesis_world_coupling_reset(uint32_t seed){
  genesis_init(40,28,40,seed^0x6a09e667u,70); genesis_seed_scene();
  genesis_weather3d_reset(seed); coupling::reset_telemetry();
}
EXPORT("genesis_world_coupling_exchange") void genesis_world_coupling_exchange(){coupling::exchange_only();}
EXPORT("genesis_world_coupling_step") void genesis_world_coupling_step(int weatherSteps,int volumeSteps){
  genesis_weather3d_step(w3::clampi(weatherSteps,1,16));
  coupling::exchange_only();
  genesis_step(clampi(volumeSteps,1,8));
}
EXPORT("genesis_world_coupling_hash") uint32_t genesis_world_coupling_hash(){return coupling::hash();}
EXPORT("genesis_world_coupling_model_version") uint32_t genesis_world_coupling_model_version(){return coupling::MODEL_VERSION;}
EXPORT("genesis_world_coupling_mass_units_per_voxel") uint32_t genesis_world_coupling_mass_units_per_voxel(){return coupling::MASS_UNITS_PER_WATER_VOXEL;}
EXPORT("genesis_world_coupling_injected_voxels") uint32_t genesis_world_coupling_injected_voxels(){return coupling::injectedVoxels;}
EXPORT("genesis_world_coupling_evaporated_voxels") uint32_t genesis_world_coupling_evaporated_voxels(){return coupling::evaporatedVoxels;}
EXPORT("genesis_world_coupling_terrain_feedback_cells") uint32_t genesis_world_coupling_terrain_feedback_cells(){return coupling::terrainFeedbackCells;}
EXPORT("genesis_world_coupling_weather_removed_units") uint32_t genesis_world_coupling_weather_removed_units(){return coupling::weatherRemovedUnits;}
EXPORT("genesis_world_coupling_volume_added_units") uint32_t genesis_world_coupling_volume_added_units(){return coupling::volumeAddedUnits;}
EXPORT("genesis_world_coupling_volume_removed_units") uint32_t genesis_world_coupling_volume_removed_units(){return coupling::volumeRemovedUnits;}
EXPORT("genesis_world_coupling_weather_added_units") uint32_t genesis_world_coupling_weather_added_units(){return coupling::weatherAddedUnits;}
EXPORT("genesis_world_coupling_conservation_error") uint32_t genesis_world_coupling_conservation_error(){return coupling::conservation_error();}
EXPORT("genesis_world_coupling_reference_fixture") uint32_t genesis_world_coupling_reference_fixture(){return coupling::reference_fixture();}
}
