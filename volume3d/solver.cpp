#include <stdint.h>
#include <stddef.h>

#if defined(__wasm__)
#define EXPORT(name) __attribute__((export_name(name)))
#else
#define EXPORT(name)
#endif

extern "C" void* memset(void* dst,int value,size_t n){
  unsigned char* p=(unsigned char*)dst;for(size_t i=0;i<n;i++)p[i]=(unsigned char)value;return dst;
}
extern "C" void* memcpy(void* dst,const void* src,size_t n){
  unsigned char* d=(unsigned char*)dst;const unsigned char* s=(const unsigned char*)src;for(size_t i=0;i<n;i++)d[i]=s[i];return dst;
}

namespace {
constexpr int MAX_W=64, MAX_H=40, MAX_D=64;
constexpr int MAX_CELLS=MAX_W*MAX_H*MAX_D;
enum Material : uint8_t { EMPTY=0, SAND=1, WATER=2, ROCK=3 };
static uint8_t state[MAX_CELLS*3];
static uint32_t packed[MAX_CELLS];
static int W=40,H=28,D=40,N=W*H*D;
static uint32_t rngState=0x3d5a17u;
static int cohesion=70;
static uint32_t stepIndex=0, sandMoves=0, waterMoves=0, erosionEvents=0, depositionEvents=0;

inline int idx(int x,int y,int z){ return (y*D+z)*W+x; }
inline bool inside(int x,int y,int z){ return x>=0&&x<W&&y>=0&&y<H&&z>=0&&z<D; }
inline uint8_t& mat(int i){ return state[i*3]; }
inline uint8_t& moist(int i){ return state[i*3+1]; }
inline uint8_t& sediment(int i){ return state[i*3+2]; }
inline uint32_t rnd(){ uint32_t x=rngState; x^=x<<13; x^=x>>17; x^=x<<5; rngState=x?x:0x9e3779b9u; return rngState; }
inline int clampi(int v,int a,int b){ return v<a?a:(v>b?b:v); }

void clear_all(){
  for(int i=0;i<MAX_CELLS*3;i++) state[i]=0;
  for(int i=0;i<MAX_CELLS;i++) packed[i]=0;
  stepIndex=sandMoves=waterMoves=erosionEvents=depositionEvents=0;
}
void swap_cells(int a,int b){for(int k=0;k<3;k++){uint8_t t=state[a*3+k];state[a*3+k]=state[b*3+k];state[b*3+k]=t;}}
bool has_water_neighbor(int x,int y,int z){
  static const int dirs[6][3]={{1,0,0},{-1,0,0},{0,1,0},{0,-1,0},{0,0,1},{0,0,-1}};
  for(auto &d:dirs){int nx=x+d[0],ny=y+d[1],nz=z+d[2];if(inside(nx,ny,nz)&&mat(idx(nx,ny,nz))==WATER)return true;}return false;
}
void wetting(){for(int y=1;y<H;y++)for(int z=0;z<D;z++)for(int x=0;x<W;x++){int i=idx(x,y,z);if(mat(i)!=SAND)continue;if(has_water_neighbor(x,y,z))moist(i)=255;else if(moist(i)>0)moist(i)=(uint8_t)(moist(i)-1);}}
void step_sand(){
  sandMoves=0;const int diag[8][2]={{1,0},{-1,0},{0,1},{0,-1},{1,1},{1,-1},{-1,1},{-1,-1}};bool rev=(stepIndex&1)!=0;
  for(int y=1;y<H;y++)for(int zz=0;zz<D;zz++){int z=rev?(D-1-zz):zz;for(int xx=0;xx<W;xx++){int x=rev?(W-1-xx):xx;int i=idx(x,y,z);if(mat(i)!=SAND)continue;int below=idx(x,y-1,z);if(mat(below)==EMPTY){swap_cells(i,below);sandMoves++;continue;}if(mat(below)==WATER){swap_cells(i,below);moist(below)=255;sandMoves++;continue;}int wet=moist(i);int moveChance=100-(wet*cohesion)/255;if(moveChance<8)moveChance=8;if((int)(rnd()%100)>=moveChance)continue;int start=(int)(rnd()%8);for(int k=0;k<8;k++){int q=(start+k)&7,nx=x+diag[q][0],nz=z+diag[q][1];if(!inside(nx,y-1,nz))continue;int j=idx(nx,y-1,nz);if(mat(j)==EMPTY){swap_cells(i,j);sandMoves++;break;}if(mat(j)==WATER){swap_cells(i,j);moist(j)=255;sandMoves++;break;}}}}
}
void step_water(){
  waterMoves=0;const int dirs[8][2]={{1,0},{-1,0},{0,1},{0,-1},{1,1},{1,-1},{-1,1},{-1,-1}};bool rev=(stepIndex&1)==0;
  for(int y=1;y<H;y++)for(int zz=0;zz<D;zz++){int z=rev?(D-1-zz):zz;for(int xx=0;xx<W;xx++){int x=rev?(W-1-xx):xx;int i=idx(x,y,z);if(mat(i)!=WATER)continue;int below=idx(x,y-1,z);if(mat(below)==EMPTY){swap_cells(i,below);waterMoves++;continue;}int start=(int)(rnd()%8);bool moved=false;for(int k=0;k<8;k++){int q=(start+k)&7,nx=x+dirs[q][0],nz=z+dirs[q][1];if(!inside(nx,y,nz))continue;int down=idx(nx,y-1,nz);if(mat(down)==EMPTY){swap_cells(i,down);waterMoves++;moved=true;break;}}if(moved)continue;for(int k=0;k<8;k++){int q=(start+k)&7,nx=x+dirs[q][0],nz=z+dirs[q][1];if(!inside(nx,y,nz))continue;int j=idx(nx,y,nz);if(mat(j)==EMPTY){swap_cells(i,j);waterMoves++;break;}}}}
}
void erode_and_deposit(){
  const int dirs[4][2]={{1,0},{-1,0},{0,1},{0,-1}};
  for(int y=1;y<H-1;y++)for(int z=1;z<D-1;z++)for(int x=1;x<W-1;x++){int i=idx(x,y,z);if(mat(i)!=WATER)continue;if(sediment(i)==0&&(rnd()&31u)==0u){int start=(int)(rnd()%4);for(int k=0;k<4;k++){int q=(start+k)&3,j=idx(x+dirs[q][0],y,z+dirs[q][1]);if(mat(j)!=SAND||moist(j)>180)continue;int above=idx(x+dirs[q][0],y+1,z+dirs[q][1]);if(mat(above)!=EMPTY)continue;mat(j)=EMPTY;moist(j)=0;sediment(j)=0;sediment(i)=255;erosionEvents++;break;}}if(sediment(i)>=255&&(rnd()&15u)==0u){int below=idx(x,y-1,z);if(mat(below)==EMPTY)continue;int start=(int)(rnd()%4);for(int k=0;k<4;k++){int q=(start+k)&3,nx=x+dirs[q][0],nz=z+dirs[q][1],j=idx(nx,y,nz),jb=idx(nx,y-1,nz);if(mat(j)==EMPTY&&mat(jb)!=EMPTY&&mat(jb)!=WATER){mat(j)=SAND;moist(j)=200;sediment(i)=0;depositionEvents++;break;}}}}
}
uint32_t sand_mass_units_internal(){uint32_t s=0;for(int i=0;i<N;i++){if(mat(i)==SAND)s+=255u;s+=sediment(i);}return s;}
uint32_t water_cells_internal(){uint32_t n=0;for(int i=0;i<N;i++)if(mat(i)==WATER)n++;return n;}
uint32_t hash_internal(){uint32_t h=2166136261u;for(int i=0;i<N*3;i++){h^=state[i];h*=16777619u;}h^=stepIndex;h*=16777619u;return h;}
}

extern "C" {
EXPORT("genesis_init") int genesis_init(int w,int h,int d,uint32_t seed,int cohesionPct){W=clampi(w,16,MAX_W);H=clampi(h,16,MAX_H);D=clampi(d,16,MAX_D);N=W*H*D;rngState=seed?seed:0x3d5a17u;cohesion=clampi(cohesionPct,0,100);clear_all();return N;}
EXPORT("genesis_clear") void genesis_clear(){clear_all();}
EXPORT("genesis_seed_scene") void genesis_seed_scene(){clear_all();for(int z=0;z<D;z++)for(int x=0;x<W;x++){uint32_t n=(uint32_t)(x*73856093u)^(uint32_t)(z*19349663u)^rngState;int rockH=1+(int)((n>>5)%3u);for(int y=0;y<=rockH&&y<H;y++)mat(idx(x,y,z))=ROCK;int dx=x-W/2,dz=z-D/2;int r2=dx*dx+dz*dz;int pile=12-r2/18;if(pile>0)for(int y=rockH+1;y<=rockH+pile&&y<H;y++){mat(idx(x,y,z))=SAND;moist(idx(x,y,z))=0;}int wx=x-(W*3/4),wz=z-(D/3),basin=wx*wx+wz*wz;if(basin<(W/5)*(W/5))for(int y=rockH+1;y<=rockH+6&&y<H;y++){int i=idx(x,y,z);if(mat(i)==EMPTY)mat(i)=WATER;}}}
EXPORT("genesis_step") void genesis_step(int iterations){iterations=clampi(iterations,1,8);for(int n=0;n<iterations;n++){wetting();step_sand();step_water();erode_and_deposit();stepIndex++;}}
EXPORT("genesis_paint") int genesis_paint(int kind,int cx,int cy,int cz,int radius){radius=clampi(radius,1,8);int changed=0;for(int y=cy-radius;y<=cy+radius;y++)for(int z=cz-radius;z<=cz+radius;z++)for(int x=cx-radius;x<=cx+radius;x++){if(!inside(x,y,z))continue;int dx=x-cx,dy=y-cy,dz=z-cz;if(dx*dx+dy*dy+dz*dz>radius*radius)continue;int i=idx(x,y,z);if(kind==4){if(mat(i)!=ROCK){mat(i)=EMPTY;moist(i)=sediment(i)=0;changed++;}continue;}if(mat(i)!=EMPTY)continue;if(kind==1){mat(i)=SAND;moist(i)=0;changed++;}else if(kind==2){mat(i)=WATER;changed++;}else if(kind==3){mat(i)=ROCK;changed++;}else if(kind==5){mat(i)=SAND;moist(i)=255;changed++;}}return changed;}
EXPORT("genesis_pack") uint32_t* genesis_pack(){for(int i=0;i<N;i++)packed[i]=(uint32_t)mat(i)|((uint32_t)moist(i)<<8)|((uint32_t)sediment(i)<<16);return packed;}
EXPORT("genesis_state_ptr") uint8_t* genesis_state_ptr(){return state;}
EXPORT("genesis_state_bytes") int genesis_state_bytes(){return N*3;}
EXPORT("genesis_cell_count") int genesis_cell_count(){return N;}
EXPORT("genesis_width") int genesis_width(){return W;}
EXPORT("genesis_height") int genesis_height(){return H;}
EXPORT("genesis_depth") int genesis_depth(){return D;}
EXPORT("genesis_hash") uint32_t genesis_hash(){return hash_internal();}
EXPORT("genesis_step_index") uint32_t genesis_step_index(){return stepIndex;}
EXPORT("genesis_sand_mass_units") uint32_t genesis_sand_mass_units(){return sand_mass_units_internal();}
EXPORT("genesis_water_cells") uint32_t genesis_water_cells(){return water_cells_internal();}
EXPORT("genesis_sand_moves") uint32_t genesis_sand_moves(){return sandMoves;}
EXPORT("genesis_water_moves") uint32_t genesis_water_moves(){return waterMoves;}
EXPORT("genesis_erosion_events") uint32_t genesis_erosion_events(){return erosionEvents;}
EXPORT("genesis_deposition_events") uint32_t genesis_deposition_events(){return depositionEvents;}
EXPORT("genesis_invariant") int genesis_invariant(){for(int i=0;i<N;i++){uint8_t m=mat(i);if(m>ROCK)return 0;if(m!=WATER&&sediment(i)!=0)return 0;if(m!=SAND&&moist(i)!=0)return 0;}return 1;}
EXPORT("genesis_model_version") uint32_t genesis_model_version(){return 0x00030001u;}
}
