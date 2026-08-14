#include <assert.h>
#include <stdio.h>
#include "weather.cpp"

int main(){
  genesis_weather_reset(0x51a7u);
  assert(genesis_weather_model_version()==0x00010001u);
  assert(genesis_weather_width()==192);
  assert(genesis_weather_height()==128);
  assert(genesis_weather_width()*genesis_weather_height()==24576);
  assert(genesis_weather_tornado_cells()==0);

  // A seeded warm/moist rotating pressure deficit is only an initial condition.
  // Tornado diagnosis is recomputed from pressure, vorticity, cloud, rain and wind.
  genesis_weather_seed_supercell(96,64);
  assert(genesis_weather_cloud_cells()>100);
  assert(genesis_weather_rain_cells()>20);
  assert(genesis_weather_max_vorticity()>180);
  assert(genesis_weather_tornado_cells()>0);
  genesis_weather_step(6);
  assert(genesis_weather_total_rain()>0);
  assert(genesis_weather_cloud_cells()>100);
  assert(genesis_weather_max_vorticity()>180);
  assert(genesis_weather_tornado_cells()>0);

  // Remove the rotating/low-pressure state: the diagnostic must collapse immediately.
  genesis_weather_quench_storm();
  assert(genesis_weather_tornado_cells()==0);
  assert(genesis_weather_max_vorticity()==0);

  // River fixture supplies only terrain + upstream atmospheric moisture/cloud.
  // Surface water must route downhill and concentrate into discharge channels.
  genesis_weather_reset(0x7721u);
  genesis_weather_seed_river_basin();
  genesis_weather_step(96);
  assert(genesis_weather_total_rain()>10000u);
  assert(genesis_weather_max_discharge()>2600u);
  assert(genesis_weather_river_cells()>0);
  uint32_t riverHash=genesis_weather_hash();
  uint32_t riverPeak=genesis_weather_max_discharge();
  uint32_t riverCells=genesis_weather_river_cells();

  // Fixed seed + fixed initial conditions must replay bit-identically.
  genesis_weather_reset(0x7721u);
  genesis_weather_seed_river_basin();
  genesis_weather_step(96);
  assert(genesis_weather_hash()==riverHash);
  assert(genesis_weather_max_discharge()==riverPeak);
  assert(genesis_weather_river_cells()==riverCells);

  printf("{\"model\":\"genesis-world-weather-v1\",\"resolution\":\"192x128\",\"cells\":24576,\"cloudCells\":%u,\"rainCells\":%u,\"riverCells\":%u,\"maxDischarge\":%u,\"hash\":%u}\n",
    genesis_weather_cloud_cells(),genesis_weather_rain_cells(),riverCells,riverPeak,riverHash);
  puts("PASS GENESIS high-resolution atmosphere hydrology: clouds, tornado diagnostic, rainfall and river concentration are causal and deterministic");
}
