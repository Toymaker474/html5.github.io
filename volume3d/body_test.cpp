#include <assert.h>
#include <math.h>
#include <stdio.h>
#include "body.cpp"

static void stepn(int n,float dt=1.0f/120.0f,int it=12){for(int i=0;i<n;i++)genesis_body_step(dt,it);}

int main(){
  // Gravity + floor non-penetration.
  genesis_body_reset();int p=genesis_body_add_particle(0,2,0,2.0f,0.2f);assert(p==0);float y0=genesis_body_y(p);stepn(30);assert(genesis_body_y(p)<y0);stepn(180);assert(genesis_body_y(p)>=0.1999f);assert(genesis_body_max_penetration()>=0.0f);

  // XPBD distance joint holds a two-mass link under gravity.
  genesis_body_reset();int a=genesis_body_add_particle(0,2,0,1,0.15f);int b=genesis_body_add_particle(1,2,0,1,0.15f);int j=genesis_body_add_joint(a,b,1e-7f,0.0f,0.0f);assert(j==0);genesis_body_impulse(b,0,6,0);stepn(120);assert(genesis_body_joint_error(j)<0.02f);

  // Impulse transfers real momentum into particle motion.
  genesis_body_reset();genesis_body_set_gravity(0);p=genesis_body_add_particle(0,1,0,2,0.1f);assert(genesis_body_impulse(p,4,0,0)==1);stepn(12);assert(genesis_body_x(p)>0.15f);assert(genesis_body_vx(p)>1.5f);

  // Coulomb-style floor friction cannot accelerate tangential motion.
  genesis_body_reset();genesis_body_set_friction(0.6f);p=genesis_body_add_particle(0,0.2f,0,1,0.2f);genesis_body_impulse(p,6,0,0);float vx0=genesis_body_vx(p);stepn(20);float vx1=fabsf(genesis_body_vx(p));assert(vx1<=fabsf(vx0)+1e-4f);assert(vx1<fabsf(vx0));assert(genesis_body_y(p)>=0.1999f);

  // Strain telemetry + plastic yield permanently changes rest length.
  genesis_body_reset();genesis_body_set_gravity(0);a=genesis_body_add_particle(0,2,0,1,0.1f);b=genesis_body_add_particle(1,2,0,1,0.1f);j=genesis_body_add_joint(a,b,1e-5f,0.08f,0.35f);float r0=genesis_body_joint_rest(j);genesis_body_impulse(b,18,0,0);stepn(20,1.0f/120.0f,6);float r1=genesis_body_joint_rest(j);assert(genesis_body_max_strain()>0.08f);assert(genesis_body_yield_events()>0);assert(r1>r0);

  // Fixed setup + fixed impulses replay bit-identically through the native hash.
  genesis_body_reset();a=genesis_body_add_particle(-0.4f,1.5f,0,1.2f,0.12f);b=genesis_body_add_particle(0.4f,1.5f,0,0.8f,0.12f);genesis_body_add_joint(a,b,2e-6f,0.25f,0.1f);genesis_body_impulse(a,2,3,1);genesis_body_impulse(b,-1,1,-2);stepn(90);uint32_t h1=genesis_body_hash();float e1=genesis_body_joint_error(0);
  genesis_body_reset();a=genesis_body_add_particle(-0.4f,1.5f,0,1.2f,0.12f);b=genesis_body_add_particle(0.4f,1.5f,0,0.8f,0.12f);genesis_body_add_joint(a,b,2e-6f,0.25f,0.1f);genesis_body_impulse(a,2,3,1);genesis_body_impulse(b,-1,1,-2);stepn(90);assert(h1==genesis_body_hash());assert(e1==genesis_body_joint_error(0));

  printf("{\"model\":\"genesis-native-body-mechanics-v1\",\"hash\":%u,\"jointError\":%.6f,\"maxStrain\":%.6f,\"yieldEvents\":%u}\n",h1,e1,genesis_body_max_strain(),genesis_body_yield_events());
  puts("PASS GENESIS native 3D articulated body mechanics tests");
}
