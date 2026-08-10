#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define API EMSCRIPTEN_KEEPALIVE
#else
#define API
#endif

namespace ok {
constexpr int N=64, C=N*N;
constexpr float G=9.81f, DX=1.0f;
float terrain[C], sand[C], water[C], lava[C], lavaT[C], steam[C], sediment[C];
float uW[C],vW[C],uL[C],vL[C];
float nWater[C],nLava[C],nSed[C],nSand[C],nSteam[C];
uint64_t tickCount=0;
float injectedWater=0, injectedLava=0, evaporated=0, solidified=0, eroded=0;
inline int I(int x,int z){return z*N+x;}
inline int clampi(int v){return std::max(0,std::min(N-1,v));}
inline float hW(int i){return terrain[i]+sand[i]+water[i];}
inline float hL(int i){return terrain[i]+sand[i]+lava[i];}

void reset(){
 std::memset(sand,0,sizeof(sand));std::memset(water,0,sizeof(water));std::memset(lava,0,sizeof(lava));std::memset(lavaT,0,sizeof(lavaT));std::memset(steam,0,sizeof(steam));std::memset(sediment,0,sizeof(sediment));std::memset(uW,0,sizeof(uW));std::memset(vW,0,sizeof(vW));std::memset(uL,0,sizeof(uL));std::memset(vL,0,sizeof(vL));
 tickCount=0;injectedWater=injectedLava=evaporated=solidified=eroded=0;
 for(int z=0;z<N;z++)for(int x=0;x<N;x++){
   const float fx=x-N*.5f,fz=z-N*.5f;
   float valley=0.018f*fx*fx + 0.010f*fz*fz;
   float ridge=2.0f*std::sin(fx*.17f)*std::cos(fz*.11f)+0.8f*std::sin((fx+fz)*.31f);
   terrain[I(x,z)]=valley+ridge-4.5f;
   sand[I(x,z)]=std::max(0.f,1.2f-std::abs(fx)*.018f-std::abs(fz)*.012f);
 }
 for(int z=4;z<20;z++)for(int x=6;x<28;x++) water[I(x,z)]=3.2f;
 for(int z=8;z<18;z++)for(int x=42;x<56;x++){lava[I(x,z)]=1.2f;lavaT[I(x,z)]=1280.f;}
}

void inject(float* field,float* temp,int cx,int cz,float amount,float t){
 for(int dz=-2;dz<=2;dz++)for(int dx=-2;dx<=2;dx++){
  int x=clampi(cx+dx),z=clampi(cz+dz),i=I(x,z);float w=std::max(0.f,1.f-0.22f*(std::abs(dx)+std::abs(dz)));float a=amount*w/9.f;field[i]+=a;if(temp&&field[i]>1e-6f)temp[i]=std::max(temp[i],t);
 }
}

void flowLayer(float* depth,float* temp,float* u,float* v,float viscosity,float dt,bool hot){
 std::memcpy(nWater,depth,sizeof(float)*C);
 for(int z=1;z<N-1;z++)for(int x=1;x<N-1;x++){
  int i=I(x,z); if(depth[i]<=1e-5f) continue;
  float surf=(hot?hL(i):hW(i));
  float gx=((hot?hL(I(x+1,z)):hW(I(x+1,z)))-(hot?hL(I(x-1,z)):hW(I(x-1,z))))*.5f;
  float gz=((hot?hL(I(x,z+1)):hW(I(x,z+1)))-(hot?hL(I(x,z-1)):hW(I(x,z-1))))*.5f;
  u[i]+=-G*gx*dt; v[i]+=-G*gz*dt;
  float damp=std::exp(-viscosity*dt);u[i]*=damp;v[i]*=damp;
  float speed=std::sqrt(u[i]*u[i]+v[i]*v[i]); if(speed>6.f){float s=6.f/speed;u[i]*=s;v[i]*=s;}
  int nx=clampi(x+(u[i]>0?1:-1)),nz=clampi(z+(v[i]>0?1:-1));
  float fx=std::min(depth[i]*.24f,std::abs(u[i])*depth[i]*dt*.42f);
  float fz=std::min(depth[i]*.24f,std::abs(v[i])*depth[i]*dt*.42f);
  nWater[i]-=fx+fz; nWater[I(nx,z)]+=fx; nWater[I(x,nz)]+=fz;
 }
 for(int i=0;i<C;i++) depth[i]=std::max(0.f,nWater[i]);
 if(temp){for(int i=0;i<C;i++)if(depth[i]>1e-5f)temp[i]=std::max(20.f,temp[i]-(hot?8.f:0.f)*dt);}
}

void granular(float dt){
 std::memcpy(nSand,sand,sizeof(sand));
 for(int z=1;z<N-1;z++)for(int x=1;x<N-1;x++){
  int i=I(x,z); if(sand[i]<=1e-5f)continue; float top=terrain[i]+sand[i];
  int best=i;float bh=top;const int nb[4]={I(x-1,z),I(x+1,z),I(x,z-1),I(x,z+1)};for(int j:nb){float h=terrain[j]+sand[j];if(h<bh){bh=h;best=j;}}
  float slope=top-bh; float wet=std::min(1.f,water[i]*.5f); float repose=0.42f+0.25f*wet;
  if(best!=i&&slope>repose){float m=std::min(sand[i],(slope-repose)*.11f*dt*60.f);nSand[i]-=m;nSand[best]+=m;}
 }
 std::memcpy(sand,nSand,sizeof(sand));
}

void sedimentStep(float dt){
 std::memcpy(nSed,sediment,sizeof(sediment));
 for(int z=1;z<N-1;z++)for(int x=1;x<N-1;x++){
  int i=I(x,z);float sp=std::sqrt(uW[i]*uW[i]+vW[i]*vW[i]);
  if(water[i]>.03f&&sp>.5f&&sand[i]>.001f){float take=std::min(sand[i],(sp-.5f)*.0009f*dt*60.f);sand[i]-=take;nSed[i]+=take;eroded+=take;}
  if(water[i]>.03f&&nSed[i]>.0f){int nx=clampi(x+(uW[i]>0?1:-1)),nz=clampi(z+(vW[i]>0?1:-1));float move=std::min(nSed[i],sp*.018f*dt);nSed[i]-=move;nSed[I(nx,nz)]+=move;}
  if(sp<.22f&&nSed[i]>.0f){float dep=std::min(nSed[i],.012f*dt);nSed[i]-=dep;sand[i]+=dep;}
 }
 std::memcpy(sediment,nSed,sizeof(sediment));
}

void thermo(float dt){
 std::memcpy(nSteam,steam,sizeof(steam));
 for(int i=0;i<C;i++){
  if(lava[i]>.001f&&water[i]>.001f&&lavaT[i]>700.f){float boil=std::min(water[i],(lavaT[i]-700.f)*.0000025f*dt*60.f);water[i]-=boil;nSteam[i]+=boil;lavaT[i]-=boil*165.f;evaporated+=boil;}
  if(lava[i]>.001f&&lavaT[i]<690.f){float s=std::min(lava[i],.018f*dt*60.f);lava[i]-=s;terrain[i]+=s*.55f;solidified+=s;}
  if(nSteam[i]>.0f){float c=std::min(nSteam[i],.0014f*dt*60.f);nSteam[i]-=c;water[i]+=c;}
 }
 std::memcpy(steam,nSteam,sizeof(steam));
}

void step(float dt){dt=std::max(0.0005f,std::min(.033f,dt));flowLayer(water,nullptr,uW,vW,.65f,dt,false);flowLayer(lava,lavaT,uL,vL,3.8f,dt,true);granular(dt);sedimentStep(dt);thermo(dt);tickCount++;}
float sum(const float* a){double s=0;for(int i=0;i<C;i++)s+=a[i];return(float)s;}
}

extern "C" {
API void ok_reset(){ok::reset();}
API void ok_step(float dt){ok::step(dt);}
API void ok_inject_water(int x,int z,float a){ok::inject(ok::water,nullptr,ok::clampi(x),ok::clampi(z),a,20.f);ok::injectedWater+=a;}
API void ok_inject_lava(int x,int z,float a,float t){ok::inject(ok::lava,ok::lavaT,ok::clampi(x),ok::clampi(z),a,t);ok::injectedLava+=a;}
API int ok_n(){return ok::N;}
API uintptr_t ok_terrain(){return reinterpret_cast<uintptr_t>(ok::terrain);} API uintptr_t ok_sand(){return reinterpret_cast<uintptr_t>(ok::sand);} API uintptr_t ok_water(){return reinterpret_cast<uintptr_t>(ok::water);} API uintptr_t ok_lava(){return reinterpret_cast<uintptr_t>(ok::lava);} API uintptr_t ok_lava_temp(){return reinterpret_cast<uintptr_t>(ok::lavaT);} API uintptr_t ok_steam(){return reinterpret_cast<uintptr_t>(ok::steam);} API uintptr_t ok_sediment(){return reinterpret_cast<uintptr_t>(ok::sediment);} API uintptr_t ok_uw(){return reinterpret_cast<uintptr_t>(ok::uW);} API uintptr_t ok_vw(){return reinterpret_cast<uintptr_t>(ok::vW);}
API float ok_mass_water(){return ok::sum(ok::water)+ok::sum(ok::steam);} API float ok_mass_rock(){return ok::sum(ok::sand)+ok::sum(ok::sediment)+ok::sum(ok::lava)+ok::solidified;} API float ok_evaporated(){return ok::evaporated;} API float ok_solidified(){return ok::solidified;} API float ok_eroded(){return ok::eroded;} API uint64_t ok_ticks(){return ok::tickCount;}
}

#ifndef __EMSCRIPTEN__
#include <cstdio>
int main(){ok::reset();for(int i=0;i<36000;i++)ok::step(1.f/120.f);std::printf("ticks=%llu water=%.3f rock=%.3f evap=%.3f solid=%.3f eroded=%.3f\n",(unsigned long long)ok::tickCount,ok::sum(ok::water)+ok::sum(ok::steam),ok::sum(ok::sand)+ok::sum(ok::sediment)+ok::sum(ok::lava)+ok::solidified,ok::evaporated,ok::solidified,ok::eroded);}
#endif
