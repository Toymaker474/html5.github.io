#include <math.h>
#include <stdint.h>

#ifndef GENESIS_BODY_MAX_PARTICLES
#define GENESIS_BODY_MAX_PARTICLES 32
#endif
#ifndef GENESIS_BODY_MAX_JOINTS
#define GENESIS_BODY_MAX_JOINTS 48
#endif

struct BodyVec3 { float x,y,z; };
struct BodyParticle { BodyVec3 p,v,prev; float invMass; float radius; };
struct BodyJoint { int a,b; float restLength,compliance,yieldStrain,plasticRate,lambda; };

static BodyParticle BP[GENESIS_BODY_MAX_PARTICLES];
static BodyJoint BJ[GENESIS_BODY_MAX_JOINTS];
static int BP_N=0,BJ_N=0;
static float GY=-9.81f,FLOOR_Y=0.0f,MU=0.55f;
static uint32_t STEP_N=0,YIELD_EVENTS=0;
static float MAX_STRAIN=0.0f,MAX_PEN=0.0f;

static BodyVec3 bv(float x,float y,float z){BodyVec3 r={x,y,z};return r;}
static BodyVec3 add(BodyVec3 a,BodyVec3 b){return bv(a.x+b.x,a.y+b.y,a.z+b.z);}
static BodyVec3 sub(BodyVec3 a,BodyVec3 b){return bv(a.x-b.x,a.y-b.y,a.z-b.z);}
static BodyVec3 mul(BodyVec3 a,float s){return bv(a.x*s,a.y*s,a.z*s);}
static float dot(BodyVec3 a,BodyVec3 b){return a.x*b.x+a.y*b.y+a.z*b.z;}
static float len(BodyVec3 a){return sqrtf(dot(a,a));}

extern "C" {
void genesis_body_reset(){BP_N=0;BJ_N=0;STEP_N=0;YIELD_EVENTS=0;MAX_STRAIN=0;MAX_PEN=0;GY=-9.81f;FLOOR_Y=0;MU=0.55f;}
void genesis_body_set_gravity(float y){GY=y;}
void genesis_body_set_floor(float y){FLOOR_Y=y;}
void genesis_body_set_friction(float mu){MU=mu<0?0:mu;}
int genesis_body_add_particle(float x,float y,float z,float mass,float radius){if(BP_N>=GENESIS_BODY_MAX_PARTICLES||mass<=0||radius<=0)return -1;BodyParticle &q=BP[BP_N];q.p=q.prev=bv(x,y,z);q.v=bv(0,0,0);q.invMass=1.0f/mass;q.radius=radius;return BP_N++;}
int genesis_body_add_joint(int a,int b,float compliance,float yieldStrain,float plasticRate){if(BJ_N>=GENESIS_BODY_MAX_JOINTS||a<0||b<0||a>=BP_N||b>=BP_N||a==b)return -1;float r=len(sub(BP[b].p,BP[a].p));if(r<=1e-6f)return -1;BodyJoint &j=BJ[BJ_N];j.a=a;j.b=b;j.restLength=r;j.compliance=compliance<0?0:compliance;j.yieldStrain=yieldStrain<0?0:yieldStrain;j.plasticRate=plasticRate<0?0:(plasticRate>1?1:plasticRate);j.lambda=0;return BJ_N++;}
int genesis_body_impulse(int i,float ix,float iy,float iz){if(i<0||i>=BP_N)return 0;BP[i].v=add(BP[i].v,mul(bv(ix,iy,iz),BP[i].invMass));return 1;}

static void plasticity_prepass(){
  for(int k=0;k<BJ_N;k++){
    BodyJoint &j=BJ[k];float L=len(sub(BP[j.b].p,BP[j.a].p));if(j.restLength<=1e-6f)continue;
    float s=fabsf(L-j.restLength)/j.restLength;if(s>MAX_STRAIN)MAX_STRAIN=s;
    if(j.yieldStrain>0&&s>j.yieldStrain&&j.plasticRate>0){float sign=(L>=j.restLength)?1.0f:-1.0f;float excess=(s-j.yieldStrain)*j.restLength;j.restLength+=sign*excess*j.plasticRate;if(j.restLength<1e-4f)j.restLength=1e-4f;YIELD_EVENTS++;}
  }
}

void genesis_body_step(float dt,int iterations){
  if(dt<=0)return;if(iterations<1)iterations=1;if(iterations>32)iterations=32;STEP_N++;MAX_PEN=0;
  for(int i=0;i<BP_N;i++){BodyParticle &q=BP[i];q.prev=q.p;q.v.y+=GY*dt;q.p=add(q.p,mul(q.v,dt));}
  // Yield sees the externally loaded predicted configuration before elastic constraints relax it.
  plasticity_prepass();
  for(int k=0;k<BJ_N;k++)BJ[k].lambda=0;
  const float alphaScale=1.0f/(dt*dt);
  for(int it=0;it<iterations;it++){
    for(int k=0;k<BJ_N;k++){
      BodyJoint &j=BJ[k];BodyParticle &a=BP[j.a],&b=BP[j.b];BodyVec3 d=sub(b.p,a.p);float L=len(d);if(L<1e-7f)continue;BodyVec3 n=mul(d,1.0f/L);float C=L-j.restLength;float w=a.invMass+b.invMass;float alpha=j.compliance*alphaScale;float dl=(-C-alpha*j.lambda)/(w+alpha);j.lambda+=dl;a.p=sub(a.p,mul(n,dl*a.invMass));b.p=add(b.p,mul(n,dl*b.invMass));
    }
    for(int i=0;i<BP_N;i++){BodyParticle &q=BP[i];float bottom=q.p.y-q.radius;if(bottom<FLOOR_Y){float pen=FLOOR_Y-bottom;if(pen>MAX_PEN)MAX_PEN=pen;q.p.y+=pen;}}
  }
  for(int i=0;i<BP_N;i++){
    BodyParticle &q=BP[i];BodyVec3 raw=mul(sub(q.p,q.prev),1.0f/dt);bool contact=(q.p.y-q.radius)<=FLOOR_Y+1e-5f;
    if(contact){if(raw.y<0)raw.y=0;float tang=sqrtf(raw.x*raw.x+raw.z*raw.z);float maxDrop=MU*fabsf(GY)*dt;if(tang>0){float next=tang-maxDrop;if(next<0)next=0;float s=next/tang;raw.x*=s;raw.z*=s;}}
    q.v=raw;
  }
}

int genesis_body_particles(){return BP_N;} int genesis_body_joints(){return BJ_N;}
float genesis_body_x(int i){return i>=0&&i<BP_N?BP[i].p.x:0;} float genesis_body_y(int i){return i>=0&&i<BP_N?BP[i].p.y:0;} float genesis_body_z(int i){return i>=0&&i<BP_N?BP[i].p.z:0;}
float genesis_body_vx(int i){return i>=0&&i<BP_N?BP[i].v.x:0;} float genesis_body_vy(int i){return i>=0&&i<BP_N?BP[i].v.y:0;} float genesis_body_vz(int i){return i>=0&&i<BP_N?BP[i].v.z:0;}
float genesis_body_joint_rest(int i){return i>=0&&i<BJ_N?BJ[i].restLength:0;}
float genesis_body_joint_error(int i){if(i<0||i>=BJ_N)return 0;BodyJoint &j=BJ[i];return fabsf(len(sub(BP[j.b].p,BP[j.a].p))-j.restLength);}
float genesis_body_max_strain(){return MAX_STRAIN;} float genesis_body_max_penetration(){return MAX_PEN;} uint32_t genesis_body_yield_events(){return YIELD_EVENTS;} uint32_t genesis_body_steps(){return STEP_N;}
uint32_t genesis_body_hash(){uint32_t h=2166136261u;auto mix=[&](uint32_t x){h^=x;h*=16777619u;};mix((uint32_t)BP_N);mix((uint32_t)BJ_N);mix(STEP_N);mix(YIELD_EVENTS);for(int i=0;i<BP_N;i++){union{float f;uint32_t u;}a,b,c,d,e,f;a.f=BP[i].p.x;b.f=BP[i].p.y;c.f=BP[i].p.z;d.f=BP[i].v.x;e.f=BP[i].v.y;f.f=BP[i].v.z;mix(a.u);mix(b.u);mix(c.u);mix(d.u);mix(e.u);mix(f.u);}for(int i=0;i<BJ_N;i++){union{float f;uint32_t u;}r;r.f=BJ[i].restLength;mix(r.u);}return h;}
}
