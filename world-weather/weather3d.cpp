#include <stdint.h>
#include <stddef.h>

#if defined(__wasm__)
#define EXPORT(name) __attribute__((export_name(name)))
#else
#define EXPORT(name)
#endif

namespace w3 {
constexpr int W=96,H=48,D=96,N=W*H*D,SN=W*D;
constexpr int Q=16;
static uint16_t humidity[N], cloud[N], rain[N];
static int16_t temperature[N], pressure[N], vx[N], vy[N], vz[N];
static uint16_t nHumidity[N], nCloud[N], nRain[N];
static int16_t nPressure[N], nVx[N], nVy[N], nVz[N];
static uint8_t tornado[N];
static uint16_t terrain[SN], surfaceWater[SN];
static uint32_t discharge[SN];
static uint32_t seed=1, steps=0, totalPrecip=0, totalEvap=0;

inline int idx(int x,int y,int z){return (y*D+z)*W+x;}
inline int sidx(int x,int z){return z*W+x;}
inline int wrapx(int x){while(x<0)x+=W;while(x>=W)x-=W;return x;}
inline int wrapz(int z){while(z<0)z+=D;while(z>=D)z-=D;return z;}
inline int clampi(int v,int a,int b){return v<a?a:(v>b?b:v);}
inline int absi(int v){return v<0?-v:v;}
inline uint32_t mix(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;x^=x>>16;return x;}
inline uint32_t noise(int x,int z,uint32_t s){return mix((uint32_t)(x*73856093u)^(uint32_t)(z*19349663u)^s);}
inline int solid(int x,int y,int z){return y<=(int)terrain[sidx(wrapx(x),wrapz(z))];}

void zero_air_cell(int i){humidity[i]=cloud[i]=rain[i]=nHumidity[i]=nCloud[i]=nRain[i]=0;temperature[i]=pressure[i]=vx[i]=vy[i]=vz[i]=nPressure[i]=nVx[i]=nVy[i]=nVz[i]=0;tornado[i]=0;}

void make_terrain(){
  for(int z=0;z<D;z++)for(int x=0;x<W;x++){
    uint32_t a=noise(x>>3,z>>3,seed),b=noise(x>>1,z>>1,seed^0x9e3779b9u);
    int ridge=absi(x-W/2), basin=(z*5)/D;
    int h=5+(int)(a&7u)+(int)(b&3u)+ridge/18-basin;
    terrain[sidx(x,z)]=(uint16_t)clampi(h,2,14);
    surfaceWater[sidx(x,z)]=0; discharge[sidx(x,z)]=0;
  }
}

void reset(uint32_t s){
  seed=s?s:1;steps=totalPrecip=totalEvap=0;make_terrain();
  for(int y=0;y<H;y++)for(int z=0;z<D;z++)for(int x=0;x<W;x++){
    int i=idx(x,y,z); if(solid(x,y,z)){zero_air_cell(i);continue;}
    int lat=absi(z-D/2), baseT=27*Q-y*8-lat*2;
    temperature[i]=(int16_t)clampi(baseT,-28*Q,42*Q);
    int h=1750+(int)(noise(x+y*7,z+y*11,seed^31u)&511u)-y*12;
    humidity[i]=(uint16_t)clampi(h,450,3000);
    cloud[i]=rain[i]=0; pressure[i]=0; vx[i]=(int16_t)((z-D/2)/6); vy[i]=0; vz[i]=(int16_t)(-(x-W/2)/8); tornado[i]=0;
  }
}

void seed_supercell(int cx,int cz){
  cx=wrapx(cx);cz=wrapz(cz);
  for(int z=0;z<D;z++)for(int x=0;x<W;x++){
    int dx=x-cx;if(dx>W/2)dx-=W;if(dx<-W/2)dx+=W;
    int dz=z-cz;if(dz>D/2)dz-=D;if(dz<-D/2)dz+=D;
    int r2=dx*dx+dz*dz;if(r2>18*18)continue;
    int floor=(int)terrain[sidx(x,z)];
    for(int y=floor+2;y<clampi(floor+29,0,H);y++){
      int dy=y-(floor+14);int rr=r2+dy*dy/3;if(rr>18*18)continue;
      int i=idx(x,y,z), fall=18*18-rr, den=absi(dx)+absi(dz)+5;
      humidity[i]=(uint16_t)clampi(3000+fall*2,0,4095);
      cloud[i]=(uint16_t)clampi(1500+fall*5,0,4095);
      pressure[i]=(int16_t)clampi(-700+rr*2,-1200,200);
      vx[i]=(int16_t)clampi((-dz*1100)/den,-1600,1600);
      vz[i]=(int16_t)clampi((dx*1100)/den,-1600,1600);
      vy[i]=(int16_t)clampi(220+fall/2,0,900);
      rain[i]=(uint16_t)(y<floor+20?24:8);
    }
  }
}

void seed_river_basin(){
  for(int z=0;z<D;z++)for(int x=0;x<W;x++){
    int dx=absi(x-W/2);terrain[sidx(x,z)]=(uint16_t)clampi(13-(z*9)/D+dx/5,2,18);
    surfaceWater[sidx(x,z)]=0;discharge[sidx(x,z)]=0;
    int floor=(int)terrain[sidx(x,z)];
    for(int y=floor+1;y<clampi(floor+12,0,H);y++){
      int i=idx(x,y,z);humidity[i]=3300;cloud[i]=(z<26&&dx<18)?3200:700;rain[i]=(z<26&&dx<18)?80:0;
    }
  }
}

void quench_rotation(){for(int i=0;i<N;i++){vx[i]=vy[i]=vz[i]=pressure[i]=0;tornado[i]=0;}}

void dynamics(){
  for(int y=0;y<H;y++)for(int z=0;z<D;z++)for(int x=0;x<W;x++){
    int i=idx(x,y,z);if(solid(x,y,z)){nPressure[i]=nVx[i]=nVy[i]=nVz[i]=0;continue;}
    int xm=idx(wrapx(x-1),y,z),xp=idx(wrapx(x+1),y,z),zm=idx(x,y,wrapz(z-1)),zp=idx(x,y,wrapz(z+1));
    int ym=idx(x,y>0?y-1:y,z),yp=idx(x,y<H-1?y+1:y,z);
    int buoy=(temperature[i]-12*Q)/12+((int)humidity[i]-1900)/28+(int)cloud[i]/80;
    int target=clampi(-buoy-(int)cloud[i]/16,-1400,1400);
    int lap=(int)pressure[xm]+pressure[xp]+pressure[zm]+pressure[zp]+pressure[ym]+pressure[yp]-6*(int)pressure[i];
    int p=pressure[i]+(target-pressure[i])/12+lap/36;
    nPressure[i]=(int16_t)clampi(p,-1800,1800);
    int ax=-((int)pressure[xp]-(int)pressure[xm])/6;
    int ay=-((int)pressure[yp]-(int)pressure[ym])/7+buoy/5;
    int az=-((int)pressure[zp]-(int)pressure[zm])/6;
    nVx[i]=(int16_t)clampi(((int)vx[i]*250)/256+ax,-1800,1800);
    nVy[i]=(int16_t)clampi(((int)vy[i]*248)/256+ay,-1200,1200);
    nVz[i]=(int16_t)clampi(((int)vz[i]*250)/256+az,-1800,1800);
  }
  for(int i=0;i<N;i++){pressure[i]=nPressure[i];vx[i]=nVx[i];vy[i]=nVy[i];vz[i]=nVz[i];}
}

void moisture(){
  for(int y=0;y<H;y++)for(int z=0;z<D;z++)for(int x=0;x<W;x++){
    int i=idx(x,y,z);if(solid(x,y,z)){nHumidity[i]=nCloud[i]=nRain[i]=0;continue;}
    int sx=wrapx(x-clampi((int)vx[i]/700,-1,1));
    int sy=clampi(y-clampi((int)vy[i]/600,-1,1),0,H-1);
    int sz=wrapz(z-clampi((int)vz[i]/700,-1,1));
    int si=idx(sx,sy,sz);if(solid(sx,sy,sz))si=i;
    int h=humidity[si],c=cloud[si],r=rain[si];
    int sat=clampi(1750+(int)temperature[i]*3-y*14,700,3500);
    if(h>sat){int cond=clampi((h-sat)/4,0,160);h-=cond;c+=cond;}
    if(c>2300){int make=clampi((c-2300)/16,0,100);c-=make;r+=make;}
    nHumidity[i]=(uint16_t)clampi(h,0,4095);nCloud[i]=(uint16_t)clampi(c,0,4095);nRain[i]=(uint16_t)clampi(r,0,4095);
  }
  for(int i=0;i<N;i++){humidity[i]=nHumidity[i];cloud[i]=nCloud[i];rain[i]=nRain[i];}
  for(int i=0;i<N;i++)nRain[i]=rain[i];
  for(int z=0;z<D;z++)for(int x=0;x<W;x++){
    int floor=(int)terrain[sidx(x,z)];
    for(int y=floor+1;y<H;y++){
      int i=idx(x,y,z);int fall=rain[i]/3;if(fall<=0)continue;
      if(y-1<=floor){nRain[i]=(uint16_t)clampi((int)nRain[i]-fall,0,4095);surfaceWater[sidx(x,z)]=(uint16_t)clampi((int)surfaceWater[sidx(x,z)]+fall*2,0,65535);totalPrecip+=(uint32_t)fall*2u;}
      else{int j=idx(x,y-1,z);nRain[i]=(uint16_t)clampi((int)nRain[i]-fall,0,4095);nRain[j]=(uint16_t)clampi((int)nRain[j]+fall,0,4095);}
    }
    if(surfaceWater[sidx(x,z)]>0){int e=surfaceWater[sidx(x,z)]>16?1:0;if(e){surfaceWater[sidx(x,z)]--;int ai=idx(x,floor+1,z);humidity[ai]=(uint16_t)clampi((int)humidity[ai]+2,0,4095);totalEvap++;}}
  }
  for(int i=0;i<N;i++)rain[i]=nRain[i];
}

void hydrology(){
  static uint16_t nextWater[SN];
  for(int i=0;i<SN;i++){nextWater[i]=surfaceWater[i];discharge[i]=(discharge[i]*15u)/16u;}
  const int dx[4]={1,-1,0,0},dz[4]={0,0,1,-1};
  for(int z=0;z<D;z++)for(int x=0;x<W;x++){
    int i=sidx(x,z);if(surfaceWater[i]<3)continue;int best=i,bh=(int)terrain[i]*256+(int)surfaceWater[i];
    for(int k=0;k<4;k++){int nx=wrapx(x+dx[k]),nz=wrapz(z+dz[k]),j=sidx(nx,nz);int head=(int)terrain[j]*256+(int)surfaceWater[j];if(head<bh){bh=head;best=j;}}
    if(best!=i){int diff=((int)terrain[i]*256+(int)surfaceWater[i])-bh;int flow=clampi(diff/96,1,(int)surfaceWater[i]/4+1);flow=clampi(flow,0,(int)nextWater[i]);nextWater[i]-=(uint16_t)flow;nextWater[best]=(uint16_t)clampi((int)nextWater[best]+flow,0,65535);discharge[best]+=((uint32_t)flow<<5);}
  }
  for(int i=0;i<SN;i++)surfaceWater[i]=nextWater[i];
}

void diagnostics(){
  for(int y=0;y<H;y++)for(int z=0;z<D;z++)for(int x=0;x<W;x++){
    int i=idx(x,y,z);if(solid(x,y,z)){tornado[i]=0;continue;}
    int xm=idx(wrapx(x-1),y,z),xp=idx(wrapx(x+1),y,z),zm=idx(x,y,wrapz(z-1)),zp=idx(x,y,wrapz(z+1));
    int vortY=((int)vz[xp]-(int)vz[xm]-(int)vx[zp]+(int)vx[zm])/2;
    int spin=absi(vortY),up=vy[i],def=-pressure[i],c=cloud[i];
    int score=(spin-120)+(up-80)+(def-140)/2+(c>1200?(c-1200)/8:0);
    tornado[i]=(spin>120&&up>80&&pressure[i]<-140&&cloud[i]>1200)?(uint8_t)clampi(score/8,1,255):0;
  }
}

void step(int n){n=clampi(n,1,16);for(int s=0;s<n;s++){steps++;dynamics();moisture();hydrology();diagnostics();}}
uint32_t hash_state(){uint32_t h=2166136261u;auto add=[&](uint32_t v){h^=v;h*=16777619u;};add(steps);for(int i=0;i<N;i+=97){add(humidity[i]);add(cloud[i]);add(rain[i]);add((uint16_t)pressure[i]);add((uint16_t)vx[i]);add((uint16_t)vy[i]);add((uint16_t)vz[i]);add(tornado[i]);}for(int i=0;i<SN;i+=23){add(terrain[i]);add(surfaceWater[i]);add(discharge[i]);}return h;}
uint32_t count_cloud(){uint32_t n=0;for(int i=0;i<N;i++)if(cloud[i]>512)n++;return n;}
uint32_t count_tornado(){uint32_t n=0;for(int i=0;i<N;i++)if(tornado[i])n++;return n;}
uint32_t count_river(){uint32_t n=0;for(int i=0;i<SN;i++)if(discharge[i]>2400u&&surfaceWater[i]>20)n++;return n;}
uint32_t max_discharge(){uint32_t m=0;for(int i=0;i<SN;i++)if(discharge[i]>m)m=discharge[i];return m;}
}

extern "C" {
EXPORT("genesis_weather3d_reset") void genesis_weather3d_reset(uint32_t s){w3::reset(s);w3::diagnostics();}
EXPORT("genesis_weather3d_step") void genesis_weather3d_step(int n){w3::step(n);}
EXPORT("genesis_weather3d_seed_supercell") void genesis_weather3d_seed_supercell(int x,int z){w3::seed_supercell(x,z);w3::diagnostics();}
EXPORT("genesis_weather3d_seed_river_basin") void genesis_weather3d_seed_river_basin(){w3::seed_river_basin();w3::diagnostics();}
EXPORT("genesis_weather3d_quench_rotation") void genesis_weather3d_quench_rotation(){w3::quench_rotation();w3::diagnostics();}
EXPORT("genesis_weather3d_width") int genesis_weather3d_width(){return w3::W;}
EXPORT("genesis_weather3d_height") int genesis_weather3d_height(){return w3::H;}
EXPORT("genesis_weather3d_depth") int genesis_weather3d_depth(){return w3::D;}
EXPORT("genesis_weather3d_steps") uint32_t genesis_weather3d_steps(){return w3::steps;}
EXPORT("genesis_weather3d_cloud_cells") uint32_t genesis_weather3d_cloud_cells(){return w3::count_cloud();}
EXPORT("genesis_weather3d_tornado_cells") uint32_t genesis_weather3d_tornado_cells(){return w3::count_tornado();}
EXPORT("genesis_weather3d_river_cells") uint32_t genesis_weather3d_river_cells(){return w3::count_river();}
EXPORT("genesis_weather3d_max_discharge") uint32_t genesis_weather3d_max_discharge(){return w3::max_discharge();}
EXPORT("genesis_weather3d_total_precip") uint32_t genesis_weather3d_total_precip(){return w3::totalPrecip;}
EXPORT("genesis_weather3d_total_evap") uint32_t genesis_weather3d_total_evap(){return w3::totalEvap;}
EXPORT("genesis_weather3d_hash") uint32_t genesis_weather3d_hash(){return w3::hash_state();}
EXPORT("genesis_weather3d_model_version") uint32_t genesis_weather3d_model_version(){return 0x00020001u;}
EXPORT("genesis_weather3d_cloud_ptr") uintptr_t genesis_weather3d_cloud_ptr(){return (uintptr_t)w3::cloud;}
EXPORT("genesis_weather3d_rain_ptr") uintptr_t genesis_weather3d_rain_ptr(){return (uintptr_t)w3::rain;}
EXPORT("genesis_weather3d_pressure_ptr") uintptr_t genesis_weather3d_pressure_ptr(){return (uintptr_t)w3::pressure;}
EXPORT("genesis_weather3d_vx_ptr") uintptr_t genesis_weather3d_vx_ptr(){return (uintptr_t)w3::vx;}
EXPORT("genesis_weather3d_vy_ptr") uintptr_t genesis_weather3d_vy_ptr(){return (uintptr_t)w3::vy;}
EXPORT("genesis_weather3d_vz_ptr") uintptr_t genesis_weather3d_vz_ptr(){return (uintptr_t)w3::vz;}
EXPORT("genesis_weather3d_tornado_ptr") uintptr_t genesis_weather3d_tornado_ptr(){return (uintptr_t)w3::tornado;}
EXPORT("genesis_weather3d_terrain_ptr") uintptr_t genesis_weather3d_terrain_ptr(){return (uintptr_t)w3::terrain;}
EXPORT("genesis_weather3d_surface_water_ptr") uintptr_t genesis_weather3d_surface_water_ptr(){return (uintptr_t)w3::surfaceWater;}
EXPORT("genesis_weather3d_discharge_ptr") uintptr_t genesis_weather3d_discharge_ptr(){return (uintptr_t)w3::discharge;}
EXPORT("genesis_weather3d_cloud_at") int genesis_weather3d_cloud_at(int x,int y,int z){if(y<0||y>=w3::H)return 0;return w3::cloud[w3::idx(w3::wrapx(x),y,w3::wrapz(z))];}
EXPORT("genesis_weather3d_tornado_at") int genesis_weather3d_tornado_at(int x,int y,int z){if(y<0||y>=w3::H)return 0;return w3::tornado[w3::idx(w3::wrapx(x),y,w3::wrapz(z))];}
EXPORT("genesis_weather3d_terrain_at") int genesis_weather3d_terrain_at(int x,int z){return w3::terrain[w3::sidx(w3::wrapx(x),w3::wrapz(z))];}
}
