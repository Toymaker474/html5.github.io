#include <metal_stdlib>
using namespace metal;

kernel void vector_add(
  device const float *a [[buffer(0)]],
  device const float *b [[buffer(1)]],
  device float *out [[buffer(2)]],
  constant uint &count [[buffer(3)]],
  uint id [[thread_position_in_grid]])
{
  if (id >= count) return;
  out[id] = a[id] + b[id];
}

// state.xy = position, state.zw = velocity
kernel void particle_integrate(
  device float4 *state [[buffer(0)]],
  constant uint &count [[buffer(1)]],
  constant uint &steps [[buffer(2)]],
  constant float &dt [[buffer(3)]],
  constant float2 &gravity [[buffer(4)]],
  uint id [[thread_position_in_grid]])
{
  if (id >= count) return;
  float4 s = state[id];
  for (uint i = 0; i < steps; ++i) {
    s.zw += gravity * dt;
    s.xy += s.zw * dt;

    if (s.x < -1.0f) { s.x = -1.0f; s.z = abs(s.z) * 0.82f; }
    if (s.x >  1.0f) { s.x =  1.0f; s.z = -abs(s.z) * 0.82f; }
    if (s.y < -1.0f) { s.y = -1.0f; s.w = abs(s.w) * 0.78f; }
    if (s.y >  1.0f) { s.y =  1.0f; s.w = -abs(s.w) * 0.78f; }
  }
  state[id] = s;
}
