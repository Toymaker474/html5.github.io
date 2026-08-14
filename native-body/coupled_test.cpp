#include <assert.h>
#include <stdint.h>
#include <stdio.h>

extern "C" {
int genesis_init(int w,int h,int d,uint32_t seed,int cohesionPct);void genesis_clear();int genesis_paint(int kind,int cx,int cy,int cz,int radius);uint32_t genesis_water_cells();int genesis_invariant();
void genesis_body_clear();void genesis_body_set_gravity(int x,int y,int z);void genesis_body_step(int n);int genesis_body_add_node(int x,int y,int z,int mass,int radius);int genesis_body_apply_impulse(int i,int ix,int iy,int iz);int genesis_body_seed_organism(int x,int y,int z);int genesis_body_node_count();int genesis_body_node_y(int i);int genesis_body_com_y();uint32_t genesis_body_contacts();uint32_t genesis_body_step_index();
int genesis_coupled_sync_solids();void genesis_coupled_step(int worldIterations,int bodySteps);uint32_t genesis_coupled_solid_count();uint32_t genesis_coupled_sand_count();uint32_t genesis_coupled_rock_count();uint32_t genesis_coupled_water_count();uint32_t genesis_coupled_hash();int genesis_coupled_material_invariant();uint32_t genesis_coupled_body_step_index();int genesis_coupled_cache_width();int genesis_coupled_cache_height();int genesis_coupled_cache_depth();
}

static constexpr int ONE=65536;

static uint32_t deterministic_fixture(int* outComY){
  genesis_init(24,20,24,0x55aa7711u,72);genesis_clear();
  assert(genesis_paint(3,12,2,12,4)>0);
  assert(genesis_paint(1,12,7,12,2)>0);
  assert(genesis_paint(2,18,8,18,3)>0);
  assert(genesis_body_seed_organism(12*ONE,11*ONE,12*ONE)==18);
  assert(genesis_coupled_sync_solids()>0);
  assert(genesis_coupled_rock_count()>0&&genesis_coupled_sand_count()>0&&genesis_coupled_water_count()>0);
  assert(genesis_body_apply_impulse(3,ONE,0,ONE/2)==1);
  for(int i=0;i<90;i++)genesis_coupled_step(1,1);
  assert(genesis_coupled_material_invariant()==1);
  assert(genesis_body_node_count()==18);
  assert(genesis_coupled_body_step_index()==90);
  if(outComY)*outComY=genesis_body_com_y();
  return genesis_coupled_hash();
}

int main(){
  assert(genesis_coupled_cache_width()==32&&genesis_coupled_cache_height()==24&&genesis_coupled_cache_depth()==32);

  genesis_init(24,20,24,123u,72);genesis_clear();assert(genesis_paint(3,12,2,12,3)>0);
  genesis_body_clear();assert(genesis_coupled_sync_solids()>0);assert(genesis_coupled_rock_count()>0);assert(genesis_coupled_sand_count()==0);
  int radius=ONE/4,n=genesis_body_add_node(12*ONE,10*ONE,12*ONE,ONE,radius);assert(n==0);
  for(int i=0;i<240;i++)genesis_body_step(1);
  int supportedY=genesis_body_node_y(n);assert(supportedY>4*ONE);assert(genesis_body_contacts()>0);

  genesis_clear();assert(genesis_coupled_sync_solids()==0);int beforeDrop=genesis_body_node_y(n);for(int i=0;i<180;i++)genesis_body_step(1);int droppedY=genesis_body_node_y(n);assert(droppedY<beforeDrop-2*ONE);assert(droppedY>=radius-1024);

  genesis_init(24,20,24,9u,72);genesis_clear();assert(genesis_paint(2,12,8,12,3)>0);uint32_t realWater=genesis_water_cells();assert(realWater>0);
  genesis_body_clear();genesis_body_set_gravity(0,0,0);assert(genesis_coupled_sync_solids()==0);assert(genesis_coupled_water_count()==realWater);
  n=genesis_body_add_node(12*ONE,8*ONE,12*ONE,ONE,radius);genesis_body_step(1);assert(genesis_body_contacts()==0);assert(genesis_body_node_y(n)==8*ONE);

  genesis_init(24,20,24,11u,72);genesis_clear();assert(genesis_paint(1,12,4,12,3)>0);genesis_body_clear();assert(genesis_coupled_sync_solids()>0);assert(genesis_coupled_sand_count()>0);assert(genesis_coupled_rock_count()==0);assert(genesis_coupled_water_count()==0);

  int cy1=0,cy2=0;uint32_t h1=deterministic_fixture(&cy1),h2=deterministic_fixture(&cy2);assert(h1==h2);assert(cy1==cy2);
  printf("{\"model\":\"genesis-native-body-volume-coupling-v2\",\"hash\":%u,\"comY\":%d,\"supportedY\":%d,\"droppedY\":%d}\n",h1,cy1,supportedY,droppedY);
  puts("PASS GENESIS native API coupling: ROCK/SAND create body contact, material removal removes support, WATER is non-solid, and coupled replay is deterministic");
}
