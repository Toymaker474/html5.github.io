#include <assert.h>
#include <stdio.h>
#include "body.cpp"
using namespace body3d;
static int neari(int a,int b,int tol){int d=a-b;return(d<0?-d:d)<=tol;}
static fx dist_nodes(int a,int b){return length(sub(nodes[b].p,nodes[a].p));}

int main(){
  // 1. Gravity changes real native momentum/position.
  genesis_body_clear();genesis_body_set_gravity(0,DEFAULT_GRAVITY,0);
  int g=genesis_body_add_node(10*ONE,10*ONE,10*ONE,ONE,ONE/4);assert(g==0);int y0=genesis_body_node_y(0);genesis_body_step(1);assert(genesis_body_node_vy(0)<0);assert(genesis_body_node_y(0)<y0);

  // 2. Internal weighted constraint corrections preserve equal-mass center of mass.
  genesis_body_clear();genesis_body_set_gravity(0,0,0);
  int a=genesis_body_add_node(10*ONE,10*ONE,10*ONE,ONE,ONE/8),b=genesis_body_add_node(12*ONE,10*ONE,10*ONE,ONE,ONE/8);assert(a==0&&b==1);
  int com0=genesis_body_com_x();assert(genesis_body_add_link(a,b,ONE,0,0,0,0)==0);genesis_body_step(4);assert(neari(genesis_body_com_x(),com0,8));assert(neari(dist_nodes(a,b),ONE,64));

  // 3. Range constraint is a geometric joint-angle proxy: endpoint separation is bounded.
  genesis_body_clear();genesis_body_set_gravity(0,0,0);a=genesis_body_add_node(8*ONE,8*ONE,8*ONE,ONE,ONE/8);b=genesis_body_add_node(12*ONE,8*ONE,8*ONE,ONE,ONE/8);assert(genesis_body_add_range(a,b,ONE,2*ONE,0)==0);genesis_body_step(2);assert(dist_nodes(a,b)<=2*ONE+64);

  // 4. Voxel contact removes penetration instead of teleporting through the floor.
  genesis_body_clear();genesis_body_fill_floor(2);genesis_body_set_gravity(0,DEFAULT_GRAVITY,0);int radius=ONE/4;a=genesis_body_add_node(10*ONE,6*ONE,10*ONE,ONE,radius);for(int i=0;i<240;i++)genesis_body_step(1);assert(genesis_body_node_y(a)>=2*ONE+radius-256);assert(genesis_body_node_y(a)<4*ONE);assert(genesis_body_max_penetration()<ONE);

  // 5. Coulomb friction is bounded by mu * normal impulse and reduces tangential speed.
  genesis_body_clear();genesis_body_fill_floor(2);genesis_body_set_gravity(0,0,0);genesis_body_set_friction(ONE/2);a=genesis_body_add_node(10*ONE,2*ONE+radius-ONE/16,10*ONE,ONE,radius);assert(genesis_body_apply_impulse(a,4*ONE,-ONE,0));int vx0=genesis_body_node_vx(a);genesis_body_step(1);uint32_t jn=genesis_body_normal_impulse(),jt=genesis_body_friction_impulse();assert(genesis_body_contacts()>0);assert(jn>0);assert(jt<=((uint64_t)jn*(ONE/2)>>16)+2);assert(genesis_body_node_vx(a)>=0);assert(genesis_body_node_vx(a)<vx0);

  // 6. Stretch beyond yield plastically changes rest length without immediate break.
  genesis_body_clear();genesis_body_set_gravity(0,0,0);a=genesis_body_add_node(8*ONE,8*ONE,8*ONE,ONE,ONE/8);b=genesis_body_add_node(8*ONE+ONE+ONE/3,8*ONE,8*ONE,ONE,ONE/8);int l=genesis_body_add_link(a,b,ONE,ONE/2,ONE/10,ONE/2,ONE/4);assert(l==0);int rest0=genesis_body_link_rest(l);genesis_body_step(1);assert(genesis_body_yields()>0);assert(genesis_body_link_rest(l)>rest0);assert(!genesis_body_link_broken(l));

  // 7. Stretch beyond break threshold actually severs the constraint.
  genesis_body_clear();genesis_body_set_gravity(0,0,0);a=genesis_body_add_node(8*ONE,8*ONE,8*ONE,ONE,ONE/8);b=genesis_body_add_node(10*ONE,8*ONE,8*ONE,ONE,ONE/8);l=genesis_body_add_link(a,b,ONE,0,ONE/10,ONE/2,ONE/8);genesis_body_step(1);assert(genesis_body_link_broken(l));assert(genesis_body_breaks()>0);

  // 8. Full 18-node articulated organism proof is deterministic for identical commands.
  int ox=16*ONE,oy=6*ONE,oz=16*ONE;assert(genesis_body_seed_organism(ox,oy,oz)==18);assert(genesis_body_link_count()>=20);assert(genesis_body_range_count()==4);genesis_body_apply_impulse(3,ONE,0,ONE/2);for(int i=0;i<180;i++)genesis_body_step(1);uint32_t h1=genesis_body_hash();int cy1=genesis_body_com_y();uint32_t k1=genesis_body_kinetic();assert(genesis_body_step_index()==180);assert(genesis_body_contacts()>0||cy1<oy);assert(k1>0);assert(genesis_body_max_strain()>=0);
  assert(genesis_body_seed_organism(ox,oy,oz)==18);genesis_body_apply_impulse(3,ONE,0,ONE/2);for(int i=0;i<180;i++)genesis_body_step(1);assert(genesis_body_hash()==h1);assert(genesis_body_com_y()==cy1);

  printf("{\"model\":\"genesis-native-body-fixedpoint-v1\",\"nodes\":%d,\"links\":%d,\"ranges\":%d,\"hash\":%u,\"comY\":%d,\"kinetic\":%u}\n",genesis_body_node_count(),genesis_body_link_count(),genesis_body_range_count(),h1,cy1,k1);
  puts("PASS GENESIS native fixed-point articulated-body mechanics: gravity, COM, constraints, voxel contact, Coulomb friction, yield/break and deterministic replay");
}
