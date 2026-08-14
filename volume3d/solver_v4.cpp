// GENESIS native material + incompressible fluid kernel v4
// No external physics/simulation libraries. Deterministic, fixed-memory WebAssembly target.
// Truth boundary: coarse Eulerian voxel fluid with semi-Lagrangian velocity advection,
// Jacobi pressure projection, conservative scalar transport, granular sand, erosion/deposition.

typedef unsigned char u8;
typedef unsigned int u32;
typedef int i32;

#define EXPORT(name) __attribute__((export_name(name)))
#define MAX_CELLS 98304
#define PRESSURE_ITERS 28

static i32 W=40,H=28,D=40,N=44800;
static u32 seed_value=1, step_id=0;
static u8 solid[MAX_CELLS];        // 0 air, 1 sand, 3 rock
static float water[MAX_CELLS];    // volume fraction [0,1]
static float sediment[MAX_CELLS]; // suspended sediment [0,1]
static float velx[MAX_CELLS], vely[MAX_CELLS], velz[MAX_CELLS];
static float tmpx[MAX_CELLS], tmpy[MAX_CELLS], tmpz[MAX_CELLS];
static float pressure[MAX_CELLS], pressure2[MAX_CELLS], divergence_field[MAX_CELLS];
static u32 packed[MAX_CELLS];
static u32 sand_moves=0, water_moves=0, erosion_events=0, deposition_events=0;
static float last_div_before=0.0f,last_div_after=0.0f,last_ke=0.0f;
static float last_mx=0.0f,last_my=0.0f,last_mz=0.0f;

static inline float f_abs(float x){return x<0?-x:x;}
static inline float f_min(float a,float b){return a<b?a:b;}
static inline float f_max(float a,float b){return a>b?a:b;}
static inline float clampf(float x,float a,float b){return x<a?a:(x>b?b:x);}
static inline i32 clampi(i32 x,i32 a,i32 b){return x<a?a:(x>b?b:x);}
static inline bool finitef(float x){return x==x && x<1.0e20f && x>-1.0e20f;}
static inline i32 idx(i32 x,i32 y,i32 z){return (y*D+z)*W+x;}
static inline bool inside(i32 x,i32 y,i32 z){return x>=0&&x<W&&y>=0&&y<H&&z>=0&&z<D;}
static inline bool blocked(i32 x,i32 y,i32 z){return !inside(x,y,z)||solid[idx(x,y,z)]!=0;}
static inline bool fluid_cell(i32 i){return solid[i]==0 && water[i]>0.0125f;}

static u32 hash3(i32 x,i32 y,i32 z,u32 s){
  u32 h=(u32)x*0x8da6b343u ^ (u32)y*0xd8163841u ^ (u32)z*0xcb1ab31fu ^ s*0x9e3779b9u;
  h^=h>>16;h*=0x7feb352du;h^=h>>15;h*=0x846ca68bu;h^=h>>16;return h;
}
static float noise01(i32 x,i32 y,i32 z,u32 s){return (float)(hash3(x,y,z,s)&0xffffu)*(1.0f/65535.0f);}

static float sample_field(const float* f,float x,float y,float z){
  x=clampf(x,0.0f,(float)(W-1));y=clampf(y,0.0f,(float)(H-1));z=clampf(z,0.0f,(float)(D-1));
  i32 x0=(i32)x,y0=(i32)y,z0=(i32)z;
  i32 x1=clampi(x0+1,0,W-1),y1=clampi(y0+1,0,H-1),z1=clampi(z0+1,0,D-1);
  float tx=x-(float)x0,ty=y-(float)y0,tz=z-(float)z0;
  #define LERP(a,b,t) ((a)+((b)-(a))*(t))
  float c000=f[idx(x0,y0,z0)],c100=f[idx(x1,y0,z0)],c010=f[idx(x0,y1,z0)],c110=f[idx(x1,y1,z0)];
  float c001=f[idx(x0,y0,z1)],c101=f[idx(x1,y0,z1)],c011=f[idx(x0,y1,z1)],c111=f[idx(x1,y1,z1)];
  float a=LERP(LERP(c000,c100,tx),LERP(c010,c110,tx),ty);
  float b=LERP(LERP(c001,c101,tx),LERP(c011,c111,tx),ty);
  return LERP(a,b,tz);
  #undef LERP
}

static void clear_arrays(){
  for(i32 i=0;i<N;i++){
    solid[i]=0;water[i]=sediment[i]=0;velx[i]=vely[i]=velz[i]=0;
    tmpx[i]=tmpy[i]=tmpz[i]=pressure[i]=pressure2[i]=divergence_field[i]=0;packed[i]=0;
  }
  step_id=0;sand_moves=water_moves=erosion_events=deposition_events=0;
  last_div_before=last_div_after=last_ke=last_mx=last_my=last_mz=0;
}

static i32 terrain_height(i32 x,i32 z){
  float nx=(float)x/(float)W,nz=(float)z/(float)D;
  float basin=(nx-.50f)*(nx-.50f)+(nz-.52f)*(nz-.52f);
  float ridge=noise01(x/3,0,z/3,seed_value^0xa341316cu)*3.8f;
  i32 h=(i32)(5.0f+ridge+basin*7.0f);
  return clampi(h,3,H-7);
}

extern "C" {
EXPORT("genesis_init") void genesis_init(i32 w,i32 h,i32 d,u32 seed,i32 cohesion){
  (void)cohesion;W=clampi(w,8,48);H=clampi(h,8,40);D=clampi(d,8,48);N=W*H*D;
  if(N>MAX_CELLS){W=40;H=28;D=40;N=W*H*D;}
  seed_value=seed?seed:1u;clear_arrays();
}
EXPORT("genesis_clear") void genesis_clear(){clear_arrays();}

EXPORT("genesis_seed_scene") void genesis_seed_scene(){
  clear_arrays();
  for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
    i32 th=terrain_height(x,z);
    for(i32 y=0;y<=th;y++){
      i32 i=idx(x,y,z);
      // coherent void pockets make genuine overhang/cave volume, not a height map
      float cave=noise01(x/2,y/2,z/2,seed_value^0x63d83595u);
      bool cavity=(y>2 && y<th-1 && cave>.84f && noise01(x/5,y/4,z/5,seed_value^0x91e10da5u)>.42f);
      if(cavity){solid[i]=0;continue;}
      solid[i]=(y<th-2 || noise01(x,y,z,seed_value)>.60f)?3:1;
    }
    // Fill the low central catchment with continuous water fraction.
    float dx=(float)x-(float)W*.50f,dz=(float)z-(float)D*.52f;
    float r2=dx*dx+dz*dz;
    if(r2<(float)(W*W)*.105f){
      i32 top=clampi(th+1,1,H-2);
      i32 level=clampi((i32)((float)H*.47f),top,H-2);
      for(i32 y=top;y<=level;y++)if(solid[idx(x,y,z)]==0)water[idx(x,y,z)]=1.0f;
    }
  }
}

static void advect_velocity(float dt){
  for(i32 y=0;y<H;y++)for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
    i32 i=idx(x,y,z);
    if(!fluid_cell(i)){tmpx[i]=tmpy[i]=tmpz[i]=0;continue;}
    float bx=(float)x-velx[i]*dt,by=(float)y-vely[i]*dt,bz=(float)z-velz[i]*dt;
    tmpx[i]=sample_field(velx,bx,by,bz);
    tmpy[i]=sample_field(vely,bx,by,bz);
    tmpz[i]=sample_field(velz,bx,by,bz);
  }
  // Small explicit viscosity damps grid-scale ringing without inventing motion.
  const float visc=.035f;
  for(i32 y=0;y<H;y++)for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
    i32 i=idx(x,y,z);if(!fluid_cell(i)){velx[i]=vely[i]=velz[i]=0;continue;}
    float ax=tmpx[i],ay=tmpy[i],az=tmpz[i];float sx=0,sy=0,sz=0;int c=0;
    const i32 ox[6]={1,-1,0,0,0,0},oy[6]={0,0,1,-1,0,0},oz[6]={0,0,0,0,1,-1};
    for(int k=0;k<6;k++){i32 qx=x+ox[k],qy=y+oy[k],qz=z+oz[k];if(inside(qx,qy,qz)&&fluid_cell(idx(qx,qy,qz))){i32 q=idx(qx,qy,qz);sx+=tmpx[q];sy+=tmpy[q];sz+=tmpz[q];c++;}}
    if(c){float inv=1.0f/(float)c;ax+=(sx*inv-ax)*visc;ay+=(sy*inv-ay)*visc;az+=(sz*inv-az)*visc;}
    velx[i]=ax;vely[i]=ay;velz[i]=az;
  }
}

static void enforce_boundaries(){
  for(i32 y=0;y<H;y++)for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
    i32 i=idx(x,y,z);
    if(solid[i]||water[i]<=.002f){velx[i]=vely[i]=velz[i]=0;continue;}
    if(blocked(x-1,y,z)&&velx[i]<0)velx[i]=0;if(blocked(x+1,y,z)&&velx[i]>0)velx[i]=0;
    if(blocked(x,y-1,z)&&vely[i]<0)vely[i]=0;if(blocked(x,y+1,z)&&vely[i]>0)vely[i]=0;
    if(blocked(x,y,z-1)&&velz[i]<0)velz[i]=0;if(blocked(x,y,z+1)&&velz[i]>0)velz[i]=0;
  }
}

static float compute_divergence(){
  float sum=0;int count=0;
  for(i32 y=0;y<H;y++)for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
    i32 i=idx(x,y,z);if(!fluid_cell(i)){divergence_field[i]=0;continue;}
    float ux0=blocked(x-1,y,z)?0:velx[idx(x-1,y,z)],ux1=blocked(x+1,y,z)?0:velx[idx(x+1,y,z)];
    float uy0=blocked(x,y-1,z)?0:vely[idx(x,y-1,z)],uy1=blocked(x,y+1,z)?0:vely[idx(x,y+1,z)];
    float uz0=blocked(x,y,z-1)?0:velz[idx(x,y,z-1)],uz1=blocked(x,y,z+1)?0:velz[idx(x,y,z+1)];
    float d=.5f*((ux1-ux0)+(uy1-uy0)+(uz1-uz0));divergence_field[i]=d;sum+=f_abs(d);count++;
  }
  return count?sum/(float)count:0;
}

static void project_pressure(){
  last_div_before=compute_divergence();
  for(i32 i=0;i<N;i++)pressure[i]=pressure2[i]=0;
  for(int it=0;it<PRESSURE_ITERS;it++){
    for(i32 y=0;y<H;y++)for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
      i32 i=idx(x,y,z);if(!fluid_cell(i)){pressure2[i]=0;continue;}
      float s=0;int c=0;
      const i32 ox[6]={1,-1,0,0,0,0},oy[6]={0,0,1,-1,0,0},oz[6]={0,0,0,0,1,-1};
      for(int k=0;k<6;k++){i32 qx=x+ox[k],qy=y+oy[k],qz=z+oz[k];if(!inside(qx,qy,qz)||blocked(qx,qy,qz))continue;i32 q=idx(qx,qy,qz);if(fluid_cell(q))s+=pressure[q];c++;}
      pressure2[i]=c?(s-divergence_field[i])/(float)c:0;
    }
    for(i32 i=0;i<N;i++)pressure[i]=pressure2[i];
  }
  for(i32 y=0;y<H;y++)for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
    i32 i=idx(x,y,z);if(!fluid_cell(i))continue;
    float px0=(x>0&&fluid_cell(idx(x-1,y,z)))?pressure[idx(x-1,y,z)]:0;
    float px1=(x+1<W&&fluid_cell(idx(x+1,y,z)))?pressure[idx(x+1,y,z)]:0;
    float py0=(y>0&&fluid_cell(idx(x,y-1,z)))?pressure[idx(x,y-1,z)]:0;
    float py1=(y+1<H&&fluid_cell(idx(x,y+1,z)))?pressure[idx(x,y+1,z)]:0;
    float pz0=(z>0&&fluid_cell(idx(x,y,z-1)))?pressure[idx(x,y,z-1)]:0;
    float pz1=(z+1<D&&fluid_cell(idx(x,y,z+1)))?pressure[idx(x,y,z+1)]:0;
    velx[i]-=.5f*(px1-px0);vely[i]-=.5f*(py1-py0);velz[i]-=.5f*(pz1-pz0);
  }
  enforce_boundaries();last_div_after=compute_divergence();
}

static void transfer_face(i32 a,i32 b,float vf,float dt){
  if(a<0||b<0||a>=N||b>=N||solid[a]||solid[b])return;
  float amount=f_abs(vf)*dt*.42f;if(amount<.00002f)return;
  if(vf>0){amount=f_min(amount,f_min(water[a],1.0f-water[b]));if(amount>0){water[a]-=amount;water[b]+=amount;water_moves++;}}
  else {amount=f_min(amount,f_min(water[b],1.0f-water[a]));if(amount>0){water[b]-=amount;water[a]+=amount;water_moves++;}}
}

static void transport_water(float dt){
  // Pairwise face transfers are conservative by construction.
  for(i32 y=0;y<H;y++)for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
    i32 i=idx(x,y,z);
    if(x+1<W){i32 q=idx(x+1,y,z);transfer_face(i,q,.5f*(velx[i]+velx[q]),dt);}
    if(y+1<H){i32 q=idx(x,y+1,z);transfer_face(i,q,.5f*(vely[i]+vely[q]),dt);}
    if(z+1<D){i32 q=idx(x,y,z+1);transfer_face(i,q,.5f*(velz[i]+velz[q]),dt);}
  }
  for(i32 i=0;i<N;i++){water[i]=clampf(water[i],0,1);if(water[i]<.002f){water[i]=0;velx[i]*=.25f;vely[i]*=.25f;velz[i]*=.25f;}}
}

static void granular_and_erosion(){
  // Unsupported sand falls one voxel; order is bottom-up so one substep cannot tunnel.
  for(i32 y=1;y<H;y++)for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
    i32 i=idx(x,y,z);if(solid[i]!=1)continue;i32 b=idx(x,y-1,z);
    if(solid[b]==0&&water[b]<.82f){solid[b]=1;solid[i]=0;sand_moves++;}
  }
  for(i32 y=1;y<H-1;y++)for(i32 z=1;z<D-1;z++)for(i32 x=1;x<W-1;x++){
    i32 i=idx(x,y,z);if(!fluid_cell(i))continue;
    float speed2=velx[i]*velx[i]+vely[i]*vely[i]+velz[i]*velz[i];
    if(speed2>2.2f){
      const i32 nb[6]={idx(x+1,y,z),idx(x-1,y,z),idx(x,y+1,z),idx(x,y-1,z),idx(x,y,z+1),idx(x,y,z-1)};
      for(int k=0;k<6;k++)if(solid[nb[k]]==1 && sediment[i]<.95f){
        // deterministic threshold: strong flow can entrain one neighboring sand voxel
        if(((hash3(x,y,z,seed_value+step_id+k)>>27)&31u)<2u){solid[nb[k]]=0;sediment[i]=clampf(sediment[i]+.22f,0,1);erosion_events++;break;}
      }
    }else if(speed2<.045f && sediment[i]>.28f && water[i]<.60f){
      if(solid[i]==0){solid[i]=1;water[i]=0;sediment[i]=0;velx[i]=vely[i]=velz[i]=0;deposition_events++;}
    }
  }
}

static void update_metrics(){
  double ke=0,mx=0,my=0,mz=0;
  for(i32 i=0;i<N;i++)if(water[i]>.002f){double m=(double)water[i];double x=velx[i],y=vely[i],z=velz[i];ke+=.5*m*(x*x+y*y+z*z);mx+=m*x;my+=m*y;mz+=m*z;}
  last_ke=(float)ke;last_mx=(float)mx;last_my=(float)my;last_mz=(float)mz;
}

EXPORT("genesis_step") void genesis_step(i32 iterations){
  iterations=clampi(iterations,1,12);
  const float dt=.115f;
  for(i32 it=0;it<iterations;it++){
    advect_velocity(dt);
    for(i32 i=0;i<N;i++)if(fluid_cell(i))vely[i]-=2.15f*dt; // gravity in simulation units
    enforce_boundaries();project_pressure();transport_water(dt);granular_and_erosion();update_metrics();step_id++;
  }
}

EXPORT("genesis_paint") void genesis_paint(i32 kind,i32 cx,i32 cy,i32 cz,i32 radius){
  radius=clampi(radius,1,10);for(i32 z=cz-radius;z<=cz+radius;z++)for(i32 y=cy-radius;y<=cy+radius;y++)for(i32 x=cx-radius;x<=cx+radius;x++){
    if(!inside(x,y,z))continue;i32 dx=x-cx,dy=y-cy,dz=z-cz;if(dx*dx+dy*dy+dz*dz>radius*radius)continue;i32 i=idx(x,y,z);
    if(kind==2){if(!solid[i])water[i]=1.0f;}else if(kind==1){solid[i]=1;water[i]=0;}else if(kind==3){solid[i]=3;water[i]=0;}else if(kind==0){solid[i]=0;water[i]=0;}
  }
}

EXPORT("genesis_impulse_water") void genesis_impulse_water(i32 cx,i32 cy,i32 cz,i32 radius,float ix,float iy,float iz){
  radius=clampi(radius,1,12);float r2=(float)(radius*radius);
  for(i32 z=cz-radius;z<=cz+radius;z++)for(i32 y=cy-radius;y<=cy+radius;y++)for(i32 x=cx-radius;x<=cx+radius;x++){
    if(!inside(x,y,z))continue;i32 i=idx(x,y,z);if(!fluid_cell(i))continue;float dx=(float)(x-cx),dy=(float)(y-cy),dz=(float)(z-cz),d2=dx*dx+dy*dy+dz*dz;if(d2>r2)continue;
    float falloff=1.0f-d2/(r2+1.0f);velx[i]+=ix*falloff;vely[i]+=iy*falloff;velz[i]+=iz*falloff;
  }
  enforce_boundaries();update_metrics();
}

EXPORT("genesis_pack") void genesis_pack(){
  for(i32 y=0;y<H;y++)for(i32 z=0;z<D;z++)for(i32 x=0;x<W;x++){
    i32 i=idx(x,y,z);u32 m=solid[i];if(m==0 && water[i]>.055f)m=2;
    float wet=water[i];if(wet<.01f){
      float n=0;int c=0;const i32 ox[6]={1,-1,0,0,0,0},oy[6]={0,0,1,-1,0,0},oz[6]={0,0,0,0,1,-1};
      for(int k=0;k<6;k++){i32 qx=x+ox[k],qy=y+oy[k],qz=z+oz[k];if(inside(qx,qy,qz)){n+=water[idx(qx,qy,qz)];c++;}}
      if(c)wet=n/(float)c*.65f;
    }
    u32 wb=(u32)(clampf(wet,0,1)*255.0f+.5f),sb=(u32)(clampf(sediment[i],0,1)*255.0f+.5f);
    packed[i]=(m&255u)|(wb<<8u)|(sb<<16u);
  }
}

EXPORT("genesis_state_ptr") u32 genesis_state_ptr(){return (u32)(unsigned long)packed;}
EXPORT("genesis_state_bytes") u32 genesis_state_bytes(){return (u32)N*4u;}
EXPORT("genesis_cell_count") u32 genesis_cell_count(){return (u32)N;}
EXPORT("genesis_width") u32 genesis_width(){return (u32)W;}
EXPORT("genesis_height") u32 genesis_height(){return (u32)H;}
EXPORT("genesis_depth") u32 genesis_depth(){return (u32)D;}
EXPORT("genesis_step_count") u32 genesis_step_count(){return step_id;}
EXPORT("genesis_sand_moves") u32 genesis_sand_moves(){return sand_moves;}
EXPORT("genesis_water_moves") u32 genesis_water_moves(){return water_moves;}
EXPORT("genesis_erosion_events") u32 genesis_erosion_events(){return erosion_events;}
EXPORT("genesis_deposition_events") u32 genesis_deposition_events(){return deposition_events;}
EXPORT("genesis_sand_units") u32 genesis_sand_units(){u32 c=0;for(i32 i=0;i<N;i++)if(solid[i]==1)c+=255u;return c;}
EXPORT("genesis_water_voxels") u32 genesis_water_voxels(){u32 c=0;for(i32 i=0;i<N;i++)if(water[i]>.055f)c++;return c;}
EXPORT("genesis_total_water_mass") float genesis_total_water_mass(){double s=0;for(i32 i=0;i<N;i++)s+=water[i];return (float)s;}
EXPORT("genesis_fluid_divergence_before") float genesis_fluid_divergence_before(){return last_div_before;}
EXPORT("genesis_fluid_divergence_after") float genesis_fluid_divergence_after(){return last_div_after;}
EXPORT("genesis_fluid_kinetic_energy") float genesis_fluid_kinetic_energy(){return last_ke;}
EXPORT("genesis_fluid_momentum_x") float genesis_fluid_momentum_x(){return last_mx;}
EXPORT("genesis_fluid_momentum_y") float genesis_fluid_momentum_y(){return last_my;}
EXPORT("genesis_fluid_momentum_z") float genesis_fluid_momentum_z(){return last_mz;}

EXPORT("genesis_hash") u32 genesis_hash(){
  genesis_pack();u32 h=2166136261u;for(i32 i=0;i<N;i++){h^=packed[i];h*=16777619u;if(water[i]>.01f){i32 qx=(i32)(velx[i]*1024.0f),qy=(i32)(vely[i]*1024.0f),qz=(i32)(velz[i]*1024.0f);h^=(u32)qx;h*=16777619u;h^=(u32)qy;h*=16777619u;h^=(u32)qz;h*=16777619u;}}return h;
}
EXPORT("genesis_invariant") u32 genesis_invariant(){
  if(W<8||H<8||D<8||N<=0||N>MAX_CELLS)return 0;
  for(i32 i=0;i<N;i++){
    if(water[i]<-.0001f||water[i]>1.0001f||sediment[i]<-.0001f||sediment[i]>1.0001f)return 0;
    if(!finitef(water[i])||!finitef(velx[i])||!finitef(vely[i])||!finitef(velz[i])||!finitef(pressure[i]))return 0;
    if(solid[i]&&water[i]>.0001f)return 0;
  }return 1;
}
EXPORT("genesis_model_version") u32 genesis_model_version(){return 0x00040001u;}
}
