#include "../volume3d/solver.cpp"
#undef EXPORT
#include "body.cpp"

namespace coupled3d {
static uint32_t syncedSolids=0,syncedSand=0,syncedRock=0,syncedWater=0;
int sync_solids(){
  for(int i=0;i<body3d::MAX_VOX;i++)body3d::vox[i]=0;
  syncedSolids=syncedSand=syncedRock=syncedWater=0;
  uint8_t* s=genesis_state_ptr();int w=genesis_width(),h=genesis_height(),d=genesis_depth();
  int cw=w<body3d::VW?w:body3d::VW,ch=h<body3d::VH?h:body3d::VH,cd=d<body3d::VD?d:body3d::VD;
  for(int y=0;y<ch;y++)for(int z=0;z<cd;z++)for(int x=0;x<cw;x++){
    int vi=(y*d+z)*w+x;uint8_t m=s[vi*3];
    if(m==1){body3d::vox[body3d::vidx(x,y,z)]=1;syncedSand++;syncedSolids++;}
    else if(m==3){body3d::vox[body3d::vidx(x,y,z)]=1;syncedRock++;syncedSolids++;}
    else if(m==2)syncedWater++;
  }
  return (int)syncedSolids;
}
uint32_t hash(){uint32_t h=2166136261u;h^=genesis_hash();h*=16777619u;h^=genesis_body_hash();h*=16777619u;h^=syncedSolids;h*=16777619u;h^=syncedWater;h*=16777619u;return h;}
}

extern "C" {
EXPORT("genesis_coupled_sync_solids") int genesis_coupled_sync_solids(){return coupled3d::sync_solids();}
EXPORT("genesis_coupled_step") void genesis_coupled_step(int worldIterations,int bodySteps){genesis_step(worldIterations);coupled3d::sync_solids();genesis_body_step(bodySteps);}
EXPORT("genesis_coupled_solid_count") uint32_t genesis_coupled_solid_count(){return coupled3d::syncedSolids;}
EXPORT("genesis_coupled_sand_count") uint32_t genesis_coupled_sand_count(){return coupled3d::syncedSand;}
EXPORT("genesis_coupled_rock_count") uint32_t genesis_coupled_rock_count(){return coupled3d::syncedRock;}
EXPORT("genesis_coupled_water_count") uint32_t genesis_coupled_water_count(){return coupled3d::syncedWater;}
EXPORT("genesis_coupled_hash") uint32_t genesis_coupled_hash(){return coupled3d::hash();}
EXPORT("genesis_coupled_model_version") uint32_t genesis_coupled_model_version(){return 0x00010001u;}
EXPORT("genesis_coupled_cache_width") int genesis_coupled_cache_width(){return body3d::VW;}
EXPORT("genesis_coupled_cache_height") int genesis_coupled_cache_height(){return body3d::VH;}
EXPORT("genesis_coupled_cache_depth") int genesis_coupled_cache_depth(){return body3d::VD;}
}
