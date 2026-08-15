#include "../volume3d/solver.cpp"

extern "C" {
int genesis_material_at(int x,int y,int z){return inside(x,y,z)?(int)mat(idx(x,y,z)):-1;}
int genesis_water_velocity_x_at(int x,int y,int z){return water_at(x,y,z)?(int)velX[idx(x,y,z)]:0;}
int genesis_water_velocity_y_at(int x,int y,int z){return water_at(x,y,z)?(int)velY[idx(x,y,z)]:0;}
int genesis_water_velocity_z_at(int x,int y,int z){return water_at(x,y,z)?(int)velZ[idx(x,y,z)]:0;}
int genesis_pressure_at(int x,int y,int z){return water_at(x,y,z)?(int)pressureField[idx(x,y,z)]:0;}
int genesis_sediment_at(int x,int y,int z){return water_at(x,y,z)?(int)sediment(idx(x,y,z)):0;}
}
