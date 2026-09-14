#pragma once

#include <cstdint>
#include <string>

namespace superagent {

struct NBodyResult {
  int bodies = 0;
  int steps = 0;
  double initialEnergy = 0.0;
  double finalEnergy = 0.0;
  double relativeEnergyDrift = 0.0;
  double maxRadius = 0.0;
  std::uint64_t checksum = 0;
};

struct PathResult {
  bool found = false;
  int width = 0;
  int height = 0;
  int pathLength = -1;
  int visited = 0;
  int obstacles = 0;
  std::uint64_t checksum = 0;
};

struct VMResult {
  bool halted = false;
  int steps = 0;
  double accumulator = 0.0;
  std::string output;
  std::string error;
};

NBodyResult runNBody(int bodies, int steps, std::uint64_t seed);
PathResult runGridPath(int width, int height, double obstacleRate, std::uint64_t seed);
VMResult runTinyVM(const std::string& program, std::uint64_t seed);

}  // namespace superagent
