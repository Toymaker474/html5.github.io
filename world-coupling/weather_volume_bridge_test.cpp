#include <assert.h>
#include <stdio.h>
#include "weather_volume_bridge.cpp"

static void clear_weather_surface(){for(int i=0;i<w3::SN;i++)w3::surfaceWater[i]=0;}

int main(){
  // Weather runoff -> authoritative volume water, with exact bridge-unit conservation.
  genesis_init(24,20,24,123u,70); genesis_clear(); w3::reset(123u); clear_weather_surface();
  int x=6,z=8,wx=coupling::map_wx(x),wz=coupling::map_wz(z),wi=w3::sidx(wx,wz);
  for(int y=0;y<=3;y++){int vi=idx(x,y,z);mat(vi)=ROCK;clear_motion(vi);}
  w3::surfaceWater[wi]=512;
  uint32_t beforeWater=genesis_water_cells();
  coupling::exchange_only();
  assert(genesis_water_cells()==beforeWater+1);
  assert(w3::surfaceWater[wi]==256);
  assert(coupling::injectedVoxels==1);
  assert(coupling::weatherRemovedUnits==256);
  assert(coupling::volumeAddedUnits==256);
  assert(coupling::conservation_error()==0);

  // Exposed volume water -> atmospheric humidity, again conserving bridge units.
  genesis_init(24,20,24,222u,70); genesis_clear(); w3::reset(222u); clear_weather_surface();
  x=8;z=8;wx=coupling::map_wx(x);wz=coupling::map_wz(z);
  int floor=(int)w3::terrain[w3::sidx(wx,wz)],ay=w3::clampi(floor+1,0,w3::H-1),ai=w3::idx(wx,ay,wz);
  w3::temperature[ai]=20*w3::Q; w3::humidity[ai]=1200;
  for(int y=0;y<=2;y++){int vi=idx(x,y,z);mat(vi)=ROCK;clear_motion(vi);}
  int waterY=3,vi=idx(x,waterY,z);mat(vi)=WATER;clear_motion(vi);movedWater[vi]=0;
  // Choose phase so this column is eligible for bounded evaporation.
  stepIndex=(uint32_t)((8-((x+3*z)&7))&7);
  uint16_t humidityBefore=w3::humidity[ai];
  coupling::exchange_only();
  assert(mat(vi)==EMPTY);
  assert(w3::humidity[ai]==humidityBefore+256);
  assert(coupling::evaporatedVoxels==1);
  assert(coupling::volumeRemovedUnits==256);
  assert(coupling::weatherAddedUnits==256);
  assert(coupling::conservation_error()==0);

  // Volume solid topography feeds Weather3D terrain deterministically.
  genesis_init(24,20,24,333u,70); genesis_clear(); w3::reset(333u); clear_weather_surface();
  x=12;z=12;wx=coupling::map_wx(x);wz=coupling::map_wz(z);wi=w3::sidx(wx,wz);
  for(int y=0;y<=10;y++){int si=idx(x,y,z);mat(si)=ROCK;clear_motion(si);}
  int oldTerrain=w3::terrain[wi];
  coupling::exchange_only();
  int expected=w3::clampi(2+(10*12)/(H-1),2,14);
  assert((int)w3::terrain[wi]==expected);
  assert(coupling::terrainFeedbackCells>0 || oldTerrain==expected);

  // Fixed setup + fixed exchange must replay exactly.
  uint32_t h1=coupling::reference_fixture();
  uint32_t h2=coupling::reference_fixture();
  assert(h1==h2 && h1!=0);
  assert(coupling::conservation_error()==0);
  assert(genesis_invariant()==1);

  printf("REFERENCE_HASH %u\n",h1);
  puts("PASS GENESIS Weather3D V2 <-> native volume coupling V1");
  return 0;
}
