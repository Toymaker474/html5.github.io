#include <assert.h>
#include <stdint.h>
#include <stdio.h>
extern "C" {int genesis_init(int,int,int,uint32_t,int);void genesis_clear();int genesis_paint(int,int,int,int,int);int genesis_impulse_water(int,int,int,int,int,int,int);uint32_t genesis_hash();uint32_t genesis_water_cells();uint32_t genesis_model_version();void genesis_body_clear();void genesis_body_set_gravity(int,int,int);int genesis_body_add_node(int,int,int,int,int);int genesis_body_apply_impulse(int,int,int,int);int genesis_body_node_vx(int);int genesis_body_node_vy(int);uint32_t genesis_body_hash();uint32_t genesis_body_model_version();void genesis_hydro_apply();uint32_t genesis_hydro_submerged_nodes();uint32_t genesis_hydro_buoyancy_impulse();uint32_t genesis_hydro_drag_impulse();int32_t genesis_hydro_drag_x();uint32_t genesis_hydro_model_version();}
static constexpr int ONE=65536;
static int add_probe(){genesis_body_clear();genesis_body_set_gravity(0,0,0);int n=genesis_body_add_node(12*ONE+ONE/2,10*ONE+ONE/2,12*ONE+ONE/2,ONE,ONE/4);assert(n==0);return n;}
static void water(){genesis_init(24,20,24,0x1234u,72);genesis_clear();assert(genesis_paint(2,12,10,12,3)>0);}
int main(){assert(genesis_model_version()==0x00040001u);assert(genesis_body_model_version()==0x00010001u);assert(genesis_hydro_model_version()==0x00010001u);
genesis_init(24,20,24,1u,72);genesis_clear();int n=add_probe();uint32_t fh=genesis_hash();genesis_hydro_apply();assert(genesis_hydro_submerged_nodes()==0);assert(genesis_hash()==fh);
water();n=add_probe();fh=genesis_hash();uint32_t wc=genesis_water_cells();genesis_hydro_apply();assert(genesis_hydro_submerged_nodes()==1);assert(genesis_hydro_buoyancy_impulse()>0);assert(genesis_body_node_vy(n)>0);assert(genesis_hash()==fh&&genesis_water_cells()==wc);
water();assert(genesis_impulse_water(12,10,12,3,512,0,0)>0);n=add_probe();fh=genesis_hash();genesis_hydro_apply();assert(genesis_hydro_drag_impulse()>0);assert(genesis_hydro_drag_x()>0);assert(genesis_body_node_vx(n)>0);assert(genesis_hash()==fh);
water();n=add_probe();assert(genesis_body_apply_impulse(n,ONE,0,0)==1);int vx0=genesis_body_node_vx(n);genesis_hydro_apply();assert(genesis_hydro_drag_x()<0);assert(genesis_body_node_vx(n)>0&&genesis_body_node_vx(n)<vx0);
water();n=add_probe();uint32_t f0=genesis_hash(),b0=genesis_body_hash();genesis_hydro_apply();assert(genesis_hash()==f0);assert(genesis_body_hash()!=b0);
printf("{\"model\":\"genesis-native-hydrodynamics-oneway-v1\",\"fluidHash\":%u,\"bodyHash\":%u,\"vx\":%d,\"vy\":%d}\n",genesis_hash(),genesis_body_hash(),genesis_body_node_vx(n),genesis_body_node_vy(n));puts("PASS GENESIS reconciled one-way native hydrodynamics");}
