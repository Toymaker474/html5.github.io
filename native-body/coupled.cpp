#include <stdint.h>

#if defined(__wasm__)
#define EXPORT(name) __attribute__((export_name(name)))
#else
#define EXPORT(name)
#endif

extern "C" {
uint8_t* genesis_state_ptr();
int genesis_width();
int genesis_height();
int genesis_depth();
void genesis_step(int iterations);
uint32_t genesis_hash();
int genesis_invariant();

int genesis_body_set_voxel(int x,int y,int z,int solid);
void genesis_body_step(int n);
uint32_t genesis_body_hash();
uint32_t genesis_body_step_index();
int genesis_body_model_version();
}

namespace coupled3d {
constexpr int BW=32,BH=24,BD=32;
static uint32_t syncedSolids=0,syncedSand=0,syncedRock=0,syncedWater=0;

void clear_cache(){
  for(int y=0;y<BH;y++)for(int z=0;z<BD;z++)for(int x=0;x<BW;x++)genesis_body_set_voxel(x,y,z,0);
}

int sync_solids(){
  clear_cache();syncedSolids=syncedSand=syncedRock=syncedWater=0;
  uint8_t* state=genesis_state_ptr();
  int w=genesis_width(),h=genesis_height(),d=genesis_depth();
  int cw=w<BW?w:BW,ch=h<BH?h:BH,cd=d<BD?d:BD;
  for(int y=0;y<ch;y++)for(int z=0;z<cd;z++)for(int x=0;x<cw;x++){
    int i=(y*d+z)*w+x;
    uint8_t m=state[i*3];
    if(m==1){genesis_body_set_voxel(x,y,z,1);syncedSand++;syncedSolids++;}
    else if(m==3){genesis_body_set_voxel(x,y,z,1);syncedRock++;syncedSolids++;}
    else if(m==2){syncedWater++;}
  }
  return (int)syncedSolids;
}

uint32_t combined_hash(){
  uint32_t h=2166136261u;
  h^=genesis_hash();h*=16777619u;
  h^=genesis_body_hash();h*=16777619u;
  h^=syncedSolids;h*=16777619u;
  h^=syncedSand;h*=16777619u;
  h^=syncedRock;h*=16777619u;
  h^=syncedWater;h*=16777619u;
  return h;
}
}

extern "C" {
EXPORT("genesis_coupled_sync_solids") int genesis_coupled_sync_solids(){return coupled3d::sync_solids();}
EXPORT("genesis_coupled_step") void genesis_coupled_step(int worldIterations,int bodySteps){
  if(worldIterations<1)worldIterations=1;if(worldIterations>8)worldIterations=8;
  if(bodySteps<1)bodySteps=1;if(bodySteps>32)bodySteps=32;
  genesis_step(worldIterations);
  coupled3d::sync_solids();
  genesis_body_step(bodySteps);
}
EXPORT("genesis_coupled_solid_count") uint32_t genesis_coupled_solid_count(){return coupled3d::syncedSolids;}
EXPORT("genesis_coupled_sand_count") uint32_t genesis_coupled_sand_count(){return coupled3d::syncedSand;}
EXPORT("genesis_coupled_rock_count") uint32_t genesis_coupled_rock_count(){return coupled3d::syncedRock;}
EXPORT("genesis_coupled_water_count") uint32_t genesis_coupled_water_count(){return coupled3d::syncedWater;}
EXPORT("genesis_coupled_hash") uint32_t genesis_coupled_hash(){return coupled3d::combined_hash();}
EXPORT("genesis_coupled_material_invariant") int genesis_coupled_material_invariant(){return genesis_invariant();}
EXPORT("genesis_coupled_body_step_index") uint32_t genesis_coupled_body_step_index(){return genesis_body_step_index();}
EXPORT("genesis_coupled_model_version") uint32_t genesis_coupled_model_version(){return 0x00020001u;}
EXPORT("genesis_coupled_cache_width") int genesis_coupled_cache_width(){return coupled3d::BW;}
EXPORT("genesis_coupled_cache_height") int genesis_coupled_cache_height(){return coupled3d::BH;}
EXPORT("genesis_coupled_cache_depth") int genesis_coupled_cache_depth(){return coupled3d::BD;}
}
