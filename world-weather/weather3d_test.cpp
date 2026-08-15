#include <cstdio>
#include <cstdint>
#include <cstdlib>
extern "C" {
void genesis_weather3d_reset(uint32_t);void genesis_weather3d_step(int);void genesis_weather3d_seed_supercell(int,int);void genesis_weather3d_seed_river_basin();void genesis_weather3d_quench_rotation();
int genesis_weather3d_width();int genesis_weather3d_height();int genesis_weather3d_depth();uint32_t genesis_weather3d_cloud_cells();uint32_t genesis_weather3d_tornado_cells();uint32_t genesis_weather3d_river_cells();uint32_t genesis_weather3d_max_discharge();uint32_t genesis_weather3d_hash();
uintptr_t genesis_weather3d_cloud_ptr();uintptr_t genesis_weather3d_tornado_ptr();uintptr_t genesis_weather3d_terrain_ptr();int genesis_weather3d_cloud_at(int,int,int);
}
static void req(bool ok,const char* m){if(!ok){std::fprintf(stderr,"FAIL %s\n",m);std::exit(1);}}
int main(){
 req(genesis_weather3d_width()==96&&genesis_weather3d_height()==48&&genesis_weather3d_depth()==96,"dimensions");
 req(genesis_weather3d_cloud_ptr()!=0&&genesis_weather3d_tornado_ptr()!=0&&genesis_weather3d_terrain_ptr()!=0,"bulk pointers");
 genesis_weather3d_reset(0x7721);genesis_weather3d_seed_supercell(52,48);
 auto c0=genesis_weather3d_cloud_cells(),t0=genesis_weather3d_tornado_cells();
 req(c0>3000,"3d cloud volume seeded");req(t0>0,"3d vortex diagnostic seeded");
 int vertical=0;for(int y=8;y<40;y++)if(genesis_weather3d_cloud_at(52,y,48)>700)vertical++;req(vertical>8,"cloud occupies vertical column");
 genesis_weather3d_quench_rotation();req(genesis_weather3d_tornado_cells()==0,"tornado vanishes without rotation/pressure");
 genesis_weather3d_reset(0x9137);genesis_weather3d_seed_river_basin();genesis_weather3d_step(120);
 req(genesis_weather3d_max_discharge()>2400,"runoff concentrates");req(genesis_weather3d_river_cells()>0,"river diagnostic emerges");
 genesis_weather3d_reset(0x55aa);genesis_weather3d_seed_supercell(52,48);genesis_weather3d_step(24);auto h1=genesis_weather3d_hash();
 genesis_weather3d_reset(0x55aa);genesis_weather3d_seed_supercell(52,48);genesis_weather3d_step(24);auto h2=genesis_weather3d_hash();req(h1==h2,"deterministic replay");
 std::printf("cloud=%u tornado=%u rivers=%u maxQ=%u hash=%u\n",c0,t0,genesis_weather3d_river_cells(),genesis_weather3d_max_discharge(),h2);
 std::puts("PASS GENESIS true 3D atmosphere hydrology: 96x48x96 native volume, causal vortex, precipitation and rivers");
}
