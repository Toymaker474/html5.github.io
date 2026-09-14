#import "NativeCoreBridge.h"
#import "CNative.h"
#include "NativeCore.hpp"

@implementation NativeCoreBridge

+ (NSDictionary<NSString *, id> *)runNBodyWithBodies:(NSInteger)bodies
                                               steps:(NSInteger)steps
                                                seed:(uint64_t)seed {
  const auto r = superagent::runNBody((int)bodies, (int)steps, seed);
  return @{
    @"engine": @"C++20 velocity-Verlet N-body",
    @"bodies": @(r.bodies),
    @"steps": @(r.steps),
    @"initialEnergy": @(r.initialEnergy),
    @"finalEnergy": @(r.finalEnergy),
    @"relativeEnergyDrift": @(r.relativeEnergyDrift),
    @"maxRadius": @(r.maxRadius),
    @"checksum": [NSString stringWithFormat:@"%016llx", (unsigned long long)r.checksum]
  };
}

+ (NSDictionary<NSString *, id> *)runGridPathWithWidth:(NSInteger)width
                                                 height:(NSInteger)height
                                           obstacleRate:(double)obstacleRate
                                                   seed:(uint64_t)seed {
  const auto r = superagent::runGridPath((int)width, (int)height, obstacleRate, seed);
  return @{
    @"engine": @"C++20 A*",
    @"found": @(r.found),
    @"width": @(r.width),
    @"height": @(r.height),
    @"pathLength": @(r.pathLength),
    @"visited": @(r.visited),
    @"obstacles": @(r.obstacles),
    @"checksum": [NSString stringWithFormat:@"%016llx", (unsigned long long)r.checksum]
  };
}

+ (NSDictionary<NSString *, id> *)runVMProgram:(NSString *)program seed:(uint64_t)seed {
  const char *utf8 = program.UTF8String ?: "";
  const auto r = superagent::runTinyVM(std::string(utf8), seed);
  return @{
    @"engine": @"C++ safe numeric VM",
    @"halted": @(r.halted),
    @"steps": @(r.steps),
    @"accumulator": @(r.accumulator),
    @"output": [NSString stringWithUTF8String:r.output.c_str()] ?: @"",
    @"error": [NSString stringWithUTF8String:r.error.c_str()] ?: @""
  };
}

+ (NSDictionary<NSString *, id> *)analyzeBytes:(NSData *)data {
  const uint8_t *bytes = (const uint8_t *)data.bytes;
  const size_t n = data.length;
  uint64_t hist[256];
  sa_histogram256(bytes, n, hist);
  uint64_t nonzero = 0, peak = 0;
  int peakByte = 0;
  for (int i = 0; i < 256; ++i) {
    if (hist[i]) ++nonzero;
    if (hist[i] > peak) { peak = hist[i]; peakByte = i; }
  }
  return @{
    @"engine": @"C byte analyzer",
    @"bytes": @(n),
    @"crc32": [NSString stringWithFormat:@"%08x", sa_crc32(bytes, n)],
    @"shannonEntropyBitsPerByte": @(sa_shannon_entropy(bytes, n)),
    @"distinctByteValues": @(nonzero),
    @"mostCommonByte": @(peakByte),
    @"mostCommonCount": @(peak)
  };
}

@end
