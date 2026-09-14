#pragma once
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

uint64_t sa_rust_hash64(const uint8_t *data, size_t len);
double sa_rust_mean(const double *values, size_t len);
void sa_rust_xorshift_fill(uint64_t seed, uint64_t *out, size_t len);

#ifdef __cplusplus
}
#endif
