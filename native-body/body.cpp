#include <stdint.h>
#include <stddef.h>
#if defined(__wasm__)
#define EXPORT(name) __attribute__((export_name(name)))
#else
#define EXPORT(name)
#endif

namespace body3d {
using fx=int32_t;
constexpr fx ONE=65536;
constexpr fx DT=546;               // ~1/120 s in Q16.16
constexpr int MAX_NODES=32;
constexpr int MAX_LINKS=64;
constexpr int MAX_RANGES=32;
constexpr int VW=32,VH=24,VD=32,MAX_VOX=VW*VH*VD;
constexpr int SOLVER_ITERS=10;
constexpr fx DEFAULT_GRAVITY=-642908; // -9.81 units/s^2

struct V3{fx x,y,z;};
struct Node{V3 p,old,v,contactN;fx mass,invMass,radius,contactPush;uint8_t contact;};
struct Link{uint8_t a,b;fx rest,softness,yieldStrain,breakStrain,plasticRate;uint16_t damage;uint8_t broken;};
struct Range{uint8_t a,b;fx minLen,maxLen,softness;};
static Node nodes[MAX_NODES];static Link links[MAX_LINKS];static Range ranges[MAX_RANGES];
static uint8_t vox[MAX_VOX];static int nodeCount=0,linkCount=0,rangeCount=0;
static V3 gravity={0,DEFAULT_GRAVITY,0};static fx friction=39322; // 0.60
static uint32_t stepIndex=0,contactCount=0,yieldCount=0,breakCount=0;
static fx maxStrain=0,maxPenetration=0;static uint64_t normalImpulse=0,frictionImpulse=0,kinetic=0;

inline fx absv(fx a){return a<0?-a:a;} inline fx minv(fx a,fx b){return a<b?a:b;} inline fx maxv(fx a,fx b){return a>b?a:b;} inline fx clampv(fx v,fx a,fx b){return v<a?a:(v>b?b:v);} 
inline fx mul(fx a,fx b){return (fx)(((int64_t)a*(int64_t)b)>>16);} inline fx divq(fx a,fx b){return b?(fx)(((int64_t)a<<16)/b):0;}
inline V3 add(V3 a,V3 b){return{a.x+b.x,a.y+b.y,a.z+b.z};} inline V3 sub(V3 a,V3 b){return{a.x-b.x,a.y-b.y,a.z-b.z};} inline V3 scale(V3 a,fx s){return{mul(a.x,s),mul(a.y,s),mul(a.z,s)};} inline fx dot(V3 a,V3 b){return(fx)(((int64_t)a.x*b.x+(int64_t)a.y*b.y+(int64_t)a.z*b.z)>>16);}
uint64_t isqrt64(uint64_t x){uint64_t r=0,bit=(uint64_t)1<<62;while(bit>x)bit>>=2;while(bit){if(x>=r+bit){x-=r+bit;r=(r>>1)+bit;}else r>>=1;bit>>=2;}return r;}
fx length(V3 a){uint64_t s=(uint64_t)((int64_t)a.x*a.x)+(uint64_t)((int64_t)a.y*a.y)+(uint64_t)((int64_t)a.z*a.z);uint64_t r=isqrt64(s);return r>0x7fffffffULL?0x7fffffff:(fx)r;}
V3 normal(V3 a){fx l=length(a);return l>0?V3{divq(a.x,l),divq(a.y,l),divq(a.z,l)}:V3{0,ONE,0};}
inline int vidx(int x,int y,int z){return(y*VD+z)*VW+x;} inline bool vin(int x,int y,int z){return x>=0&&x<VW&&y>=0&&y<VH&&z>=0&&z<VD;} inline bool solid(int x,int y,int z){return !vin(x,y,z)||vox[vidx(x,y,z)]!=0;}
fx mass_from_inv(fx inv){return inv>0?(fx)(((int64_t)ONE*ONE)/inv):0;}

void reset_metrics(){contactCount=yieldCount=breakCount=0;maxStrain=maxPenetration=0;normalImpulse=frictionImpulse=kinetic=0;}
void clear(){nodeCount=linkCount=rangeCount=0;stepIndex=0;gravity={0,DEFAULT_GRAVITY,0};friction=39322;for(int i=0;i<MAX_VOX;i++)vox[i]=0;reset_metrics();}
int add_node(fx x,fx y,fx z,fx mass,fx radius){if(nodeCount>=MAX_NODES||mass<=0)return-1;Node&n=nodes[nodeCount];n.p=n.old={x,y,z};n.v=n.contactN={0,0,0};n.mass=mass;n.invMass=(fx)(((int64_t)ONE*ONE)/mass);n.radius=radius;n.contactPush=0;n.contact=0;return nodeCount++;}
int add_link(int a,int b,fx rest,fx softness,fx ys,fx bs,fx plastic){if(linkCount>=MAX_LINKS||a<0||b<0||a>=nodeCount||b>=nodeCount||a==b||rest<=0)return-1;links[linkCount]={(uint8_t)a,(uint8_t)b,rest,clampv(softness,0,ONE),ys,bs,clampv(plastic,0,ONE),0,0};return linkCount++;}
int add_range(int a,int b,fx mn,fx mx,fx softness){if(rangeCount>=MAX_RANGES||a<0||b<0||a>=nodeCount||b>=nodeCount||a==b||mn<0||mx<mn)return-1;ranges[rangeCount]={(uint8_t)a,(uint8_t)b,mn,mx,clampv(softness,0,ONE)};return rangeCount++;}
void weighted_pair(Node&a,Node&b,V3 n,fx error,fx softness){fx w=a.invMass+b.invMass;if(w<=0)return;fx stiff=ONE-softness;fx c=mul(error,stiff);fx wa=divq(a.invMass,w),wb=divq(b.invMass,w);V3 da=scale(n,mul(c,wa)),db=scale(n,mul(c,wb));a.p=add(a.p,da);b.p=sub(b.p,db);}
void solve_links(){for(int k=0;k<linkCount;k++){Link&c=links[k];if(c.broken)continue;Node&a=nodes[c.a];Node&b=nodes[c.b];V3 d=sub(b.p,a.p);fx l=length(d);if(l<=0)continue;fx err=l-c.rest;fx strain=divq(absv(err),maxv(c.rest,1));maxStrain=maxv(maxStrain,strain);if(c.breakStrain>0&&strain>c.breakStrain){c.broken=1;c.damage=65535;breakCount++;continue;}if(c.yieldStrain>0&&strain>c.yieldStrain&&c.plasticRate>0){fx drift=mul(err,c.plasticRate);c.rest=maxv(ONE/32,c.rest+drift);uint32_t dmg=(uint32_t)c.damage+(uint32_t)minv(4096,maxv(1,(strain-c.yieldStrain)>>4));c.damage=(uint16_t)(dmg>65535?65535:dmg);yieldCount++;}weighted_pair(a,b,normal(d),err,c.softness);}}
void solve_ranges(){for(int k=0;k<rangeCount;k++){Range&c=ranges[k];Node&a=nodes[c.a];Node&b=nodes[c.b];V3 d=sub(b.p,a.p);fx l=length(d);if(l<=0)continue;fx target=l;if(l<c.minLen)target=c.minLen;else if(l>c.maxLen)target=c.maxLen;else continue;weighted_pair(a,b,normal(d),l-target,c.softness);}}

bool sphere_box(Node&n,int x,int y,int z){fx loX=x*ONE,loY=y*ONE,loZ=z*ONE,hiX=loX+ONE,hiY=loY+ONE,hiZ=loZ+ONE;fx qx=clampv(n.p.x,loX,hiX),qy=clampv(n.p.y,loY,hiY),qz=clampv(n.p.z,loZ,hiZ);V3 d={n.p.x-qx,n.p.y-qy,n.p.z-qz};fx dist=length(d),pen=0;V3 nn={0,ONE,0};if(dist>0){if(dist>=n.radius)return false;nn=normal(d);pen=n.radius-dist;}else{fx dl=n.p.x-loX,dr=hiX-n.p.x,db=n.p.y-loY,dt=hiY-n.p.y,dn=n.p.z-loZ,df=hiZ-n.p.z;fx m=dl;nn={-ONE,0,0};if(dr<m){m=dr;nn={ONE,0,0};}if(db<m){m=db;nn={0,-ONE,0};}if(dt<m){m=dt;nn={0,ONE,0};}if(dn<m){m=dn;nn={0,0,-ONE};}if(df<m){m=df;nn={0,0,ONE};}pen=n.radius+m;}
 n.p=add(n.p,scale(nn,pen));if(pen>n.contactPush){n.contactPush=pen;n.contactN=nn;}n.contact=1;contactCount++;maxPenetration=maxv(maxPenetration,pen);return true;}
void solve_contacts(){for(int i=0;i<nodeCount;i++){Node&n=nodes[i];int cx=n.p.x>=0?n.p.x/ONE:-1,cy=n.p.y>=0?n.p.y/ONE:-1,cz=n.p.z>=0?n.p.z/ONE:-1;for(int y=cy-1;y<=cy+1;y++)for(int z=cz-1;z<=cz+1;z++)for(int x=cx-1;x<=cx+1;x++)if(solid(x,y,z))sphere_box(n,x,y,z);}}
void apply_contact_velocity(Node&n){if(!n.contact)return;V3 nn=n.contactN;fx vn=dot(n.v,nn);fx corrSpeed=DT>0?divq(n.contactPush,DT):0;fx jn=maxv(vn<0?-vn:0,corrSpeed);if(vn<0)n.v=sub(n.v,scale(nn,vn));V3 tangent=sub(n.v,scale(nn,dot(n.v,nn)));fx ts=length(tangent);fx maxF=mul(friction,jn),take=minv(ts,maxF);if(ts>0&&take>0){fx keep=ONE-divq(take,ts);tangent=scale(tangent,maxv(0,keep));fx ncomp=dot(n.v,nn);n.v=add(scale(nn,ncomp),tangent);}uint64_t m=(uint32_t)n.mass;normalImpulse+=((uint64_t)(uint32_t)jn*m)>>16;frictionImpulse+=((uint64_t)(uint32_t)take*m)>>16;}
void update_kinetic(){uint64_t sum=0;for(int i=0;i<nodeCount;i++){Node&n=nodes[i];int64_t vv=((int64_t)n.v.x*n.v.x+(int64_t)n.v.y*n.v.y+(int64_t)n.v.z*n.v.z)>>16;uint64_t e=((uint64_t)(uint32_t)n.mass*(uint64_t)(vv<0?0:vv))>>17;sum+=e;}kinetic=sum;}
void step_one(){reset_metrics();for(int i=0;i<nodeCount;i++){Node&n=nodes[i];n.old=n.p;n.contact=0;n.contactPush=0;n.contactN={0,0,0};n.v.x+=mul(gravity.x,DT);n.v.y+=mul(gravity.y,DT);n.v.z+=mul(gravity.z,DT);n.p.x+=mul(n.v.x,DT);n.p.y+=mul(n.v.y,DT);n.p.z+=mul(n.v.z,DT);}for(int it=0;it<SOLVER_ITERS;it++){solve_links();solve_ranges();solve_contacts();}for(int i=0;i<nodeCount;i++){Node&n=nodes[i];n.v={divq(n.p.x-n.old.x,DT),divq(n.p.y-n.old.y,DT),divq(n.p.z-n.old.z,DT)};apply_contact_velocity(n);n.v=scale(n.v,65470);}update_kinetic();stepIndex++;}
uint32_t hash(){uint32_t h=2166136261u;auto mix=[&](uint32_t v){h^=v;h*=16777619u;};mix(stepIndex);mix(nodeCount);mix(linkCount);mix(rangeCount);for(int i=0;i<nodeCount;i++){mix(nodes[i].p.x);mix(nodes[i].p.y);mix(nodes[i].p.z);mix(nodes[i].v.x);mix(nodes[i].v.y);mix(nodes[i].v.z);}for(int i=0;i<linkCount;i++){mix(links[i].rest);mix(links[i].damage);mix(links[i].broken);}return h;}
fx com_axis(int axis){int64_t weighted=0,total=0;for(int i=0;i<nodeCount;i++){Node&n=nodes[i];fx p=axis==0?n.p.x:(axis==1?n.p.y:n.p.z);weighted+=(int64_t)p*n.mass;total+=n.mass;}return total?(fx)(weighted/total):0;}
int seed_organism(fx ox,fx oy,fx oz){clear();for(int z=0;z<VD;z++)for(int x=0;x<VW;x++){vox[vidx(x,0,z)]=1;vox[vidx(x,1,z)]=1;}const fx R=11796,M=ONE;int p=add_node(ox,oy,oz,M+M/2,R),s0=add_node(ox,oy+ONE/2,oz,M,R),s1=add_node(ox,oy+ONE,oz,M,R),head=add_node(ox,oy+ONE+ONE/2,oz,M,R);int ls=add_node(ox-ONE/2,oy+ONE,oz,M,R),le=add_node(ox-ONE,oy+ONE-ONE/3,oz,M,R),lw=add_node(ox-ONE-ONE/3,oy+ONE/3,oz,M,R);int rs=add_node(ox+ONE/2,oy+ONE,oz,M,R),re=add_node(ox+ONE,oy+ONE-ONE/3,oz,M,R),rw=add_node(ox+ONE+ONE/3,oy+ONE/3,oz,M,R);int lh=add_node(ox-ONE/3,oy,oz,M+M/4,R),lk=add_node(ox-ONE/2,oy-ONE,oz,M+M/4,R),la=add_node(ox-ONE/2,oy-ONE*2,oz,M+M/4,R);int rh=add_node(ox+ONE/3,oy,oz,M+M/4,R),rk=add_node(ox+ONE/2,oy-ONE,oz,M+M/4,R),ra=add_node(ox+ONE/2,oy-ONE*2,oz,M+M/4,R);int tb=add_node(ox,oy,oz+ONE/2,M,R),tt=add_node(ox,oy-ONE/3,oz+ONE+ONE/2,M,R);
 const fx soft=ONE/32,ys=ONE/10,bs=ONE/2,pl=ONE/32;auto link=[&](int a,int b){fx r=length(sub(nodes[b].p,nodes[a].p));add_link(a,b,r,soft,ys,bs,pl);};link(p,s0);link(s0,s1);link(s1,head);link(s1,ls);link(ls,le);link(le,lw);link(s1,rs);link(rs,re);link(re,rw);link(p,lh);link(lh,lk);link(lk,la);link(p,rh);link(rh,rk);link(rk,ra);link(p,tb);link(tb,tt);link(ls,rs);link(lh,rh);link(s0,ls);link(s0,rs);link(p,s1);
 add_range(ls,lw,ONE,ONE*2,ONE/16);add_range(rs,rw,ONE,ONE*2,ONE/16);add_range(lh,la,ONE+ONE/2,ONE*2+ONE/2,ONE/16);add_range(rh,ra,ONE+ONE/2,ONE*2+ONE/2,ONE/16);return nodeCount;}
}

extern "C" {
EXPORT("genesis_body_clear") void genesis_body_clear(){body3d::clear();}
EXPORT("genesis_body_set_gravity") void genesis_body_set_gravity(int x,int y,int z){body3d::gravity={(body3d::fx)x,(body3d::fx)y,(body3d::fx)z};}
EXPORT("genesis_body_set_friction") void genesis_body_set_friction(int mu){body3d::friction=body3d::clampv(mu,0,body3d::ONE*2);}
EXPORT("genesis_body_set_voxel") int genesis_body_set_voxel(int x,int y,int z,int s){if(!body3d::vin(x,y,z))return 0;body3d::vox[body3d::vidx(x,y,z)]=s?1:0;return 1;}
EXPORT("genesis_body_fill_floor") void genesis_body_fill_floor(int top){top=top<0?0:(top>body3d::VH?body3d::VH:top);for(int y=0;y<top;y++)for(int z=0;z<body3d::VD;z++)for(int x=0;x<body3d::VW;x++)body3d::vox[body3d::vidx(x,y,z)]=1;}
EXPORT("genesis_body_add_node") int genesis_body_add_node(int x,int y,int z,int mass,int radius){return body3d::add_node(x,y,z,mass,radius);}
EXPORT("genesis_body_add_link") int genesis_body_add_link(int a,int b,int rest,int softness,int ys,int bs,int plastic){return body3d::add_link(a,b,rest,softness,ys,bs,plastic);}
EXPORT("genesis_body_add_range") int genesis_body_add_range(int a,int b,int mn,int mx,int softness){return body3d::add_range(a,b,mn,mx,softness);}
EXPORT("genesis_body_apply_impulse") int genesis_body_apply_impulse(int i,int ix,int iy,int iz){if(i<0||i>=body3d::nodeCount)return 0;auto&n=body3d::nodes[i];n.v.x+=body3d::mul(ix,n.invMass);n.v.y+=body3d::mul(iy,n.invMass);n.v.z+=body3d::mul(iz,n.invMass);return 1;}
EXPORT("genesis_body_seed_organism") int genesis_body_seed_organism(int x,int y,int z){return body3d::seed_organism(x,y,z);}
EXPORT("genesis_body_step") void genesis_body_step(int n){n=n<1?1:(n>32?32:n);for(int i=0;i<n;i++)body3d::step_one();}
EXPORT("genesis_body_node_count") int genesis_body_node_count(){return body3d::nodeCount;} EXPORT("genesis_body_link_count") int genesis_body_link_count(){return body3d::linkCount;} EXPORT("genesis_body_range_count") int genesis_body_range_count(){return body3d::rangeCount;}
EXPORT("genesis_body_node_x") int genesis_body_node_x(int i){return i>=0&&i<body3d::nodeCount?body3d::nodes[i].p.x:0;} EXPORT("genesis_body_node_y") int genesis_body_node_y(int i){return i>=0&&i<body3d::nodeCount?body3d::nodes[i].p.y:0;} EXPORT("genesis_body_node_z") int genesis_body_node_z(int i){return i>=0&&i<body3d::nodeCount?body3d::nodes[i].p.z:0;}
EXPORT("genesis_body_node_vx") int genesis_body_node_vx(int i){return i>=0&&i<body3d::nodeCount?body3d::nodes[i].v.x:0;} EXPORT("genesis_body_node_vy") int genesis_body_node_vy(int i){return i>=0&&i<body3d::nodeCount?body3d::nodes[i].v.y:0;} EXPORT("genesis_body_node_vz") int genesis_body_node_vz(int i){return i>=0&&i<body3d::nodeCount?body3d::nodes[i].v.z:0;}
EXPORT("genesis_body_link_rest") int genesis_body_link_rest(int i){return i>=0&&i<body3d::linkCount?body3d::links[i].rest:0;} EXPORT("genesis_body_link_broken") int genesis_body_link_broken(int i){return i>=0&&i<body3d::linkCount?body3d::links[i].broken:0;}
EXPORT("genesis_body_com_x") int genesis_body_com_x(){return body3d::com_axis(0);} EXPORT("genesis_body_com_y") int genesis_body_com_y(){return body3d::com_axis(1);} EXPORT("genesis_body_com_z") int genesis_body_com_z(){return body3d::com_axis(2);}
EXPORT("genesis_body_contacts") uint32_t genesis_body_contacts(){return body3d::contactCount;} EXPORT("genesis_body_yields") uint32_t genesis_body_yields(){return body3d::yieldCount;} EXPORT("genesis_body_breaks") uint32_t genesis_body_breaks(){return body3d::breakCount;} EXPORT("genesis_body_max_strain") int genesis_body_max_strain(){return body3d::maxStrain;} EXPORT("genesis_body_max_penetration") int genesis_body_max_penetration(){return body3d::maxPenetration;}
EXPORT("genesis_body_normal_impulse") uint32_t genesis_body_normal_impulse(){return body3d::normalImpulse>0xffffffffULL?0xffffffffu:(uint32_t)body3d::normalImpulse;} EXPORT("genesis_body_friction_impulse") uint32_t genesis_body_friction_impulse(){return body3d::frictionImpulse>0xffffffffULL?0xffffffffu:(uint32_t)body3d::frictionImpulse;} EXPORT("genesis_body_kinetic") uint32_t genesis_body_kinetic(){return body3d::kinetic>0xffffffffULL?0xffffffffu:(uint32_t)body3d::kinetic;}
EXPORT("genesis_body_hash") uint32_t genesis_body_hash(){return body3d::hash();} EXPORT("genesis_body_step_index") uint32_t genesis_body_step_index(){return body3d::stepIndex;} EXPORT("genesis_body_model_version") uint32_t genesis_body_model_version(){return 0x00010001u;}
}
