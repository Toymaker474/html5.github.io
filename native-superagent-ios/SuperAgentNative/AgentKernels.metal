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
