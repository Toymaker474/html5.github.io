#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

uint32_t sa_crc32(const uint8_t *data, size_t length);
double sa_shannon_entropy(const uint8_t *data, size_t length);
void sa_histogram256(const uint8_t *data, size_t length, uint64_t out_counts[256]);

#ifdef __cplusplus
}
#endif
