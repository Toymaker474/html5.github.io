#include <assert.h>
#include <stdio.h>
#include "coupled.cpp"
using namespace body3d;

static void rock_platform(){genesis_init(24,20,24,123u,72);genesis_clear();assert(genesis_paint(3,12,2,12,3)>0);genesis_body_clear();assert(genesis_coupled_sync_solids()>0);}

static uint32_t deterministic_fixture(int* outComY){
  genesis_init(24,20,24,0x55aa7711u,72);genesis_clear();
  assert(genesis_paint(3,12,2,12,4)>0);       // actual native rock support
  assert(genesis_paint(1,12,7,12,2)>0);       // actual native sand above it
  assert(genesis_paint(2,18,8,18,3)>0);       // real native water elsewhere
  assert(genesis_body_seed_organism(12*ONE,11*ONE,12*ONE)==18);
  assert(genesis_coupled_sync_solids()>0);assert(genesis_coupled_rock_count()>0);assert(genesis_coupled_sand_count()>0);assert(genesis_coupled_water_count()>0);
  assert(genesis_body_apply_impulse(3,ONE,0,ONE/2));
  for(int i=0;i<90;i++)genesis_coupled_step(1,1);
  assert(genesis_invariant()==1);assert(genesis_body_node_count()==18);assert(genesis_body_step_index()==90);if(outComY)*outComY=genesis_body_com_y();return genesis_coupled_hash();
}

int main(){
  // 1. Contact support comes from the real material solver's rock occupancy.
  rock_platform();int r=ONE/4,n=genesis_body_add_node(12*ONE,10*ONE,12*ONE,ONE,r);assert(n==0);for(int i=0;i<240;i++)genesis_body_step(1);int supportedY=genesis_body_node_y(n);assert(supportedY>4*ONE);

  // 2. Deleting that material state and re-syncing removes support causally.
  genesis_clear();assert(genesis_coupled_sync_solids()==0);for(int i=0;i<180;i++)genesis_body_step(1);int droppedY=genesis_body_node_y(n);assert(droppedY<supportedY-2*ONE);assert(droppedY>=r-512);

  // 3. Native water is explicitly NOT converted into fake solid terrain.
  genesis_init(24,20,24,9u,72);genesis_clear();assert(genesis_paint(2,12,8,12,3)>0);genesis_body_clear();genesis_body_set_gravity(0,0,0);assert(genesis_coupled_sync_solids()==0);assert(genesis_coupled_water_count()>0);n=genesis_body_add_node(12*ONE,8*ONE,12*ONE,ONE,r);genesis_body_step(1);assert(genesis_body_contacts()==0);assert(genesis_body_node_y(n)==8*ONE);

  // 4. Native sand is a real collision material, not a renderer-only color.
  genesis_clear();assert(genesis_paint(1,12,4,12,3)>0);genesis_body_clear();assert(genesis_coupled_sync_solids()>0);assert(genesis_coupled_sand_count()>0);assert(genesis_coupled_rock_count()==0);

  // 5. Whole coupled material + fluid + articulated-body command replay is deterministic.
  int cy1=0,cy2=0;uint32_t h1=deterministic_fixture(&cy1),h2=deterministic_fixture(&cy2);assert(h1==h2);assert(cy1==cy2);
  printf("{\"model\":\"genesis-native-body-volume-coupling-v1\",\"hash\":%u,\"comY\":%d,\"supportY\":%d,\"dropY\":%d,\"solids\":%u,\"water\":%u}\n",h1,cy1,supportedY,droppedY,genesis_coupled_solid_count(),genesis_coupled_water_count());
  puts("PASS GENESIS coupled native C++: body contact derives from material occupancy, terrain removal changes support, water is not faked solid, and coupled replay is deterministic");
}
