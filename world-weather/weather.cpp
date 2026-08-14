#include <stdint.h>
#include <stddef.h>
#if defined(__wasm__)
#define EXPORT(name) __attribute__((export_name(name)))
#else
#define EXPORT(name)
#endif

namespace ww1 {
constexpr int W=192,H=128,N=W*H;
constexpr int Q=256,HQ=4096;
static uint16_t elev[N],hum[N],cloud[N],soil[N],water[N],rain[N];
static int16_t temp[N],press[N],windX[N],windZ[N],vort[N];
static uint32_t discharge[N];
static uint8_t tornado[N],river[N];
static uint16_t nHum[N],nCloud[N],nWater[N];
static int16_t nPress[N],nWindX[N],nWindZ[N];
static uint32_t seed=1,stepN=0,totalRain=0,totalEvap=0;

inline int idx(int x,int z){return z*W+x;}
inline int wrapx(int x){while(x<0)x+=W;while(x>=W)x-=W;return x;}
inline int clampi(int v,int a,int b){return v<a?a:(v>b?b:v);}
inline int absi(int v){return v<0?-v:v;}
inline uint32_t mix(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;x^=x>>16;return x;}
inline uint32_t noise(int x,int z,uint32_t s){return mix((uint32_t)(x*73856093u)^(uint32_t)(z*19349663u)^s);}

void diagnostics(){
  for(int z=0;z<H;z++)for(int x=0;x<W;x++){
    int i=idx(x,z),xm=idx(wrapx(x-1),z),xp=idx(wrapx(x+1),z),zm=idx(x,z>0?z-1:z),zp=idx(x,z<H-1?z+1:z);
    int curl=((int)windZ[xp]-(int)windZ[xm]-(int)windX[zp]+(int)windX[zm])/2;
    vort[i]=(int16_t)clampi(curl,-4096,4096);
    int speed=absi(windX[i])+absi(windZ[i]);
    int spin=absi(vort[i]);
    int score=(spin-180)+(0-press[i])/2+(cloud[i]>2300?(cloud[i]-2300)/4:0)+(rain[i]>8?(rain[i]-8)*2:0);
    tornado[i]=(spin>180&&press[i]<-220&&cloud[i]>2300&&rain[i]>8&&speed>260)?(uint8_t)clampi(score/8,1,255):0;
    river[i]=(discharge[i]>2600u&&water[i]>80)?1:0;
  }
}

void make_terrain(){
  for(int z=0;z<H;z++)for(int x=0;x<W;x++){
    int i=idx(x,z);uint32_t a=noise(x>>3,z>>3,seed),b=noise(x>>1,z>>1,seed^0x9e3779b9u);
    int ridge=absi(x-W/2);int basin=(z*5)/3;
    int e=520+(int)(a&255u)*3+(int)(b&63u)+ridge*2-basin;
    elev[i]=(uint16_t)clampi(e,40,1800);
    int lat=absi(z-H/2);temp[i]=(int16_t)clampi((28*Q)-lat*42-(int)e/3,-20*Q,42*Q);
    hum[i]=(uint16_t)clampi(2050+(int)(noise(x,z,seed^17u)&1023u)-(int)e/5,400,3500);
    cloud[i]=soil[i]=water[i]=rain[i]=0;press[i]=windX[i]=windZ[i]=vort[i]=0;discharge[i]=0;tornado[i]=river[i]=0;
  }
}

void reset(uint32_t s){seed=s?s:1;stepN=totalRain=totalEvap=0;make_terrain();diagnostics();}

void seed_supercell(int cx,int cz){
  for(int z=0;z<H;z++)for(int x=0;x<W;x++){
    int dx=x-cx;if(dx>W/2)dx-=W;if(dx<-W/2)dx+=W;int dz=z-cz;int r2=dx*dx+dz*dz;if(r2>22*22)continue;
    int i=idx(x,z);int fall=clampi(22*22-r2,0,22*22);
    hum[i]=(uint16_t)clampi(3000+fall*2,0,HQ);cloud[i]=(uint16_t)clampi(2450+fall,0,HQ);temp[i]=(int16_t)clampi(temp[i]+8*Q,-20*Q,48*Q);
    press[i]=(int16_t)clampi(-900+dx*dx+dz*dz,-1200,200);
    int den=absi(dx)+absi(dz)+3;windX[i]=(int16_t)clampi((-dz*820)/den,-1400,1400);windZ[i]=(int16_t)clampi((dx*820)/den,-1400,1400);
    rain[i]=18;
  }
  diagnostics();
}

void quench_storm(){for(int i=0;i<N;i++){press[i]=0;windX[i]=windZ[i]=vort[i]=0;tornado[i]=0;}}

void seed_river_basin(){
  for(int z=0;z<H;z++)for(int x=0;x<W;x++){
    int i=idx(x,z),dx=absi(x-W/2);elev[i]=(uint16_t)clampi(1480-z*9+dx*16,30,1900);hum[i]=2600;cloud[i]=0;water[i]=rain[i]=0;soil[i]=900;discharge[i]=0;river[i]=0;
  }
  for(int z=3;z<28;z++)for(int x=W/2-18;x<=W/2+18;x++){int i=idx(x,z);cloud[i]=3300;hum[i]=3500;}
}

void atmosphere(){
  for(int z=0;z<H;z++)for(int x=0;x<W;x++){
    int i=idx(x,z),xm=idx(wrapx(x-1),z),xp=idx(wrapx(x+1),z),zm=idx(x,z>0?z-1:z),zp=idx(x,z<H-1?z+1:z);
    int thermal=(temp[i]-(18*Q))/16;int moisture=((int)hum[i]-2200)/12;
    int target=clampi(-thermal-moisture-(int)cloud[i]/20,-1500,1500);
    int p=press[i]+(target-press[i])/10+((int)press[xm]+press[xp]+press[zm]+press[zp]-4*(int)press[i])/24;
    nPress[i]=(int16_t)clampi(p,-2000,2000);
    int ax=-((int)press[xp]-(int)press[xm])/5,az=-((int)press[zp]-(int)press[zm])/5;
    int coriolis=(z-H/2);int wx=((int)windX[i]*247)/256+ax+(windZ[i]*coriolis)/9000;
    int wz=((int)windZ[i]*247)/256+az-(windX[i]*coriolis)/9000;
    nWindX[i]=(int16_t)clampi(wx,-1536,1536);nWindZ[i]=(int16_t)clampi(wz,-1536,1536);
  }
  for(int i=0;i<N;i++){press[i]=nPress[i];windX[i]=nWindX[i];windZ[i]=nWindZ[i];}

  for(int z=0;z<H;z++)for(int x=0;x<W;x++){
    int i=idx(x,z);int sx=wrapx(x-clampi((int)windX[i]/512,-2,2));int sz=clampi(z-clampi((int)windZ[i]/512,-2,2),0,H-1);int sidx=idx(sx,sz);
    int h=hum[sidx],c=cloud[sidx];int sat=clampi(1850+(temp[i]-10*Q)/5,900,3650);
    if(h>sat){int cond=clampi((h-sat)/3,0,180);h-=cond;c+=cond;}
    int evap=clampi(((int)water[i]/48)+(int)soil[i]/320,0,34);if(evap>0){h=clampi(h+evap,0,HQ);totalEvap+=(uint32_t)evap;}
    int r=c>2380?clampi((c-2380)/10,0,180):0;c-=r;rain[i]=(uint16_t)r;totalRain+=(uint32_t)r;
    nHum[i]=(uint16_t)clampi(h,0,HQ);nCloud[i]=(uint16_t)clampi(c,0,HQ);
  }
  for(int i=0;i<N;i++){hum[i]=nHum[i];cloud[i]=nCloud[i];}
}

void hydrology(){
  for(int i=0;i<N;i++){
    int add=rain[i]*3;int infiltrate=clampi(add/3,0,HQ-(int)soil[i]);soil[i]=(uint16_t)clampi((int)soil[i]+infiltrate-(int)soil[i]/600,0,HQ);
    water[i]=(uint16_t)clampi((int)water[i]+add-infiltrate,0,65535);nWater[i]=water[i];
    discharge[i]=(discharge[i]*7u)/8u;
  }
  for(int z=0;z<H;z++)for(int x=0;x<W;x++){
    int i=idx(x,z);if(water[i]<4)continue;int best=i,bh=(int)elev[i]*Q+(int)water[i];
    const int dx[4]={1,-1,0,0},dz[4]={0,0,1,-1};
    for(int k=0;k<4;k++){int nx=wrapx(x+dx[k]),nz=z+dz[k];if(nz<0||nz>=H)continue;int j=idx(nx,nz),head=(int)elev[j]*Q+(int)water[j];if(head<bh){bh=head;best=j;}}
    if(best!=i){int diff=((int)elev[i]*Q+(int)water[i])-bh;int flow=clampi(diff/64,1,(int)water[i]/3+1);flow=clampi(flow,0,(int)nWater[i]);nWater[i]-=(uint16_t)flow;nWater[best]=(uint16_t)clampi((int)nWater[best]+flow,0,65535);discharge[best]+=((uint32_t)flow<<4);}
  }
  for(int i=0;i<N;i++){water[i]=nWater[i];if(water[i]>0&&rain[i]==0){int e=water[i]>3?1:0;water[i]-=(uint16_t)e;hum[i]=(uint16_t)clampi((int)hum[i]+e,0,HQ);}}
}

void step(int n){n=clampi(n,1,64);for(int s=0;s<n;s++){stepN++;atmosphere();hydrology();diagnostics();}}

uint32_t hash_state(){uint32_t h=2166136261u;auto m=[&](uint32_t v){h^=v;h*=16777619u;};m(stepN);for(int i=0;i<N;i+=7){m(elev[i]);m(hum[i]);m(cloud[i]);m((uint16_t)press[i]);m((uint16_t)windX[i]);m((uint16_t)windZ[i]);m(water[i]);m(discharge[i]);m(tornado[i]);}return h;}
}

extern "C" {
EXPORT("genesis_weather_reset") void genesis_weather_reset(uint32_t s){ww1::reset(s);}
EXPORT("genesis_weather_step") void genesis_weather_step(int n){ww1::step(n);}
EXPORT("genesis_weather_seed_supercell") void genesis_weather_seed_supercell(int x,int z){ww1::seed_supercell(ww1::wrapx(x),ww1::clampi(z,0,ww1::H-1));}
EXPORT("genesis_weather_quench_storm") void genesis_weather_quench_storm(){ww1::quench_storm();}
EXPORT("genesis_weather_seed_river_basin") void genesis_weather_seed_river_basin(){ww1::seed_river_basin();}
EXPORT("genesis_weather_width") int genesis_weather_width(){return ww1::W;}
EXPORT("genesis_weather_height") int genesis_weather_height(){return ww1::H;}
EXPORT("genesis_weather_steps") uint32_t genesis_weather_steps(){return ww1::stepN;}
EXPORT("genesis_weather_cloud_cells") uint32_t genesis_weather_cloud_cells(){uint32_t n=0;for(int i=0;i<ww1::N;i++)if(ww1::cloud[i]>512)n++;return n;}
EXPORT("genesis_weather_rain_cells") uint32_t genesis_weather_rain_cells(){uint32_t n=0;for(int i=0;i<ww1::N;i++)if(ww1::rain[i]>0)n++;return n;}
EXPORT("genesis_weather_river_cells") uint32_t genesis_weather_river_cells(){uint32_t n=0;for(int i=0;i<ww1::N;i++)if(ww1::river[i])n++;return n;}
EXPORT("genesis_weather_tornado_cells") uint32_t genesis_weather_tornado_cells(){uint32_t n=0;for(int i=0;i<ww1::N;i++)if(ww1::tornado[i])n++;return n;}
EXPORT("genesis_weather_max_discharge") uint32_t genesis_weather_max_discharge(){uint32_t m=0;for(int i=0;i<ww1::N;i++)if(ww1::discharge[i]>m)m=ww1::discharge[i];return m;}
EXPORT("genesis_weather_max_vorticity") int genesis_weather_max_vorticity(){int m=0;for(int i=0;i<ww1::N;i++)if(ww1::absi(ww1::vort[i])>m)m=ww1::absi(ww1::vort[i]);return m;}
EXPORT("genesis_weather_total_rain") uint32_t genesis_weather_total_rain(){return ww1::totalRain;}
EXPORT("genesis_weather_elevation_at") int genesis_weather_elevation_at(int x,int z){if(z<0||z>=ww1::H)return -1;return ww1::elev[ww1::idx(ww1::wrapx(x),z)];}
EXPORT("genesis_weather_cloud_at") int genesis_weather_cloud_at(int x,int z){if(z<0||z>=ww1::H)return 0;return ww1::cloud[ww1::idx(ww1::wrapx(x),z)];}
EXPORT("genesis_weather_rain_at") int genesis_weather_rain_at(int x,int z){if(z<0||z>=ww1::H)return 0;return ww1::rain[ww1::idx(ww1::wrapx(x),z)];}
EXPORT("genesis_weather_water_at") int genesis_weather_water_at(int x,int z){if(z<0||z>=ww1::H)return 0;return ww1::water[ww1::idx(ww1::wrapx(x),z)];}
EXPORT("genesis_weather_discharge_at") uint32_t genesis_weather_discharge_at(int x,int z){if(z<0||z>=ww1::H)return 0;return ww1::discharge[ww1::idx(ww1::wrapx(x),z)];}
EXPORT("genesis_weather_tornado_at") int genesis_weather_tornado_at(int x,int z){if(z<0||z>=ww1::H)return 0;return ww1::tornado[ww1::idx(ww1::wrapx(x),z)];}
EXPORT("genesis_weather_hash") uint32_t genesis_weather_hash(){return ww1::hash_state();}
EXPORT("genesis_weather_model_version") uint32_t genesis_weather_model_version(){return 0x00010001u;}
}
