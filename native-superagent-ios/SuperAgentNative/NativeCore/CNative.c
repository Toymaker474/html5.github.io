#include "CNative.h"
#include <math.h>

uint32_t sa_crc32(const uint8_t *data, size_t length) {
  uint32_t crc = 0xFFFFFFFFu;
  for (size_t i = 0; i < length; ++i) {
    crc ^= data[i];
    for (int bit = 0; bit < 8; ++bit) {
      const uint32_t mask = (uint32_t)-(int32_t)(crc & 1u);
      crc = (crc >> 1) ^ (0xEDB88320u & mask);
    }
  }
  return ~crc;
}

double sa_shannon_entropy(const uint8_t *data, size_t length) {
  if (!data || length == 0) return 0.0;
  uint64_t counts[256] = {0};
  for (size_t i = 0; i < length; ++i) counts[data[i]]++;
  double entropy = 0.0;
  const double inv = 1.0 / (double)length;
  for (int i = 0; i < 256; ++i) {
    if (!counts[i]) continue;
    const double p = (double)counts[i] * inv;
    entropy -= p * (log(p) / log(2.0));
  }
  return entropy;
}

void sa_histogram256(const uint8_t *data, size_t length, uint64_t out_counts[256]) {
  for (int i = 0; i < 256; ++i) out_counts[i] = 0;
  if (!data) return;
  for (size_t i = 0; i < length; ++i) out_counts[data[i]]++;
}
