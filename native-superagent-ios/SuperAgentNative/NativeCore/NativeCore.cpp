#include "NativeCore.hpp"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <limits>
#include <queue>
#include <sstream>
#include <string>
#include <tuple>
#include <vector>

namespace superagent {
namespace {

struct RNG {
  std::uint64_t state;
  explicit RNG(std::uint64_t seed) : state(seed ? seed : 0x9E3779B97F4A7C15ULL) {}
  std::uint64_t next() {
    std::uint64_t z = (state += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
  }
  double unit() { return (next() >> 11) * (1.0 / 9007199254740992.0); }
  double signedUnit() { return unit() * 2.0 - 1.0; }
};

struct Body {
  double x, y, vx, vy, m;
};

double energy(const std::vector<Body>& b) {
  constexpr double G = 1.0;
  constexpr double soft = 1e-3;
  double e = 0.0;
  for (const auto& p : b) e += 0.5 * p.m * (p.vx * p.vx + p.vy * p.vy);
  for (std::size_t i = 0; i < b.size(); ++i) {
    for (std::size_t j = i + 1; j < b.size(); ++j) {
      const double dx = b[j].x - b[i].x;
      const double dy = b[j].y - b[i].y;
      e -= G * b[i].m * b[j].m / std::sqrt(dx * dx + dy * dy + soft * soft);
    }
  }
  return e;
}

std::uint64_t mix64(std::uint64_t h, std::uint64_t x) {
  x ^= x >> 33;
  x *= 0xff51afd7ed558ccdULL;
  x ^= x >> 33;
  x *= 0xc4ceb9fe1a85ec53ULL;
  x ^= x >> 33;
  return h ^ (x + 0x9e3779b97f4a7c15ULL + (h << 6) + (h >> 2));
}

std::vector<std::string> linesOf(const std::string& s) {
  std::vector<std::string> out;
  std::stringstream ss(s);
  std::string line;
  while (std::getline(ss, line)) out.push_back(line);
  return out;
}

std::string trim(std::string s) {
  const auto first = s.find_first_not_of(" \t\r\n");
  if (first == std::string::npos) return {};
  const auto last = s.find_last_not_of(" \t\r\n");
  return s.substr(first, last - first + 1);
}

}  // namespace

NBodyResult runNBody(int bodies, int steps, std::uint64_t seed) {
  bodies = std::clamp(bodies, 2, 160);
  steps = std::clamp(steps, 1, 3000);
  RNG rng(seed);
  std::vector<Body> b;
  b.reserve(static_cast<std::size_t>(bodies));

  for (int i = 0; i < bodies; ++i) {
    const double angle = rng.unit() * 6.283185307179586;
    const double r = 0.35 + 1.65 * std::sqrt(rng.unit());
    const double m = 0.5 + rng.unit() * 1.5;
    const double speed = std::sqrt(std::max(0.05, 0.6 / r));
    b.push_back({
      std::cos(angle) * r,
      std::sin(angle) * r,
      -std::sin(angle) * speed + rng.signedUnit() * 0.02,
      std::cos(angle) * speed + rng.signedUnit() * 0.02,
      m
    });
  }

  const double initial = energy(b);
  constexpr double G = 1.0;
  constexpr double soft2 = 0.0025;
  constexpr double dt = 0.0015;
  std::vector<double> ax(b.size()), ay(b.size());

  auto accelerations = [&] {
    std::fill(ax.begin(), ax.end(), 0.0);
    std::fill(ay.begin(), ay.end(), 0.0);
    for (std::size_t i = 0; i < b.size(); ++i) {
      for (std::size_t j = i + 1; j < b.size(); ++j) {
        const double dx = b[j].x - b[i].x;
        const double dy = b[j].y - b[i].y;
        const double r2 = dx * dx + dy * dy + soft2;
        const double invR3 = 1.0 / (r2 * std::sqrt(r2));
        const double fx = G * dx * invR3;
        const double fy = G * dy * invR3;
        ax[i] += fx * b[j].m;
        ay[i] += fy * b[j].m;
        ax[j] -= fx * b[i].m;
        ay[j] -= fy * b[i].m;
      }
    }
  };

  accelerations();
  for (int s = 0; s < steps; ++s) {
    for (std::size_t i = 0; i < b.size(); ++i) {
      b[i].vx += ax[i] * dt * 0.5;
      b[i].vy += ay[i] * dt * 0.5;
      b[i].x += b[i].vx * dt;
      b[i].y += b[i].vy * dt;
    }
    accelerations();
    for (std::size_t i = 0; i < b.size(); ++i) {
      b[i].vx += ax[i] * dt * 0.5;
      b[i].vy += ay[i] * dt * 0.5;
    }
  }

  const double final = energy(b);
  double maxRadius = 0.0;
  std::uint64_t checksum = 0xcbf29ce484222325ULL;
  for (const auto& p : b) {
    maxRadius = std::max(maxRadius, std::hypot(p.x, p.y));
    const auto qx = static_cast<std::int64_t>(std::llround(p.x * 1e6));
    const auto qy = static_cast<std::int64_t>(std::llround(p.y * 1e6));
    checksum = mix64(checksum, static_cast<std::uint64_t>(qx));
    checksum = mix64(checksum, static_cast<std::uint64_t>(qy));
  }

  NBodyResult r;
  r.bodies = bodies;
  r.steps = steps;
  r.initialEnergy = initial;
  r.finalEnergy = final;
  r.relativeEnergyDrift = std::abs(initial) > 1e-12 ? (final - initial) / std::abs(initial) : 0.0;
  r.maxRadius = maxRadius;
  r.checksum = checksum;
  return r;
}

PathResult runGridPath(int width, int height, double obstacleRate, std::uint64_t seed) {
  width = std::clamp(width, 8, 180);
  height = std::clamp(height, 8, 180);
  obstacleRate = std::clamp(obstacleRate, 0.0, 0.45);
  RNG rng(seed);
  const int n = width * height;
  std::vector<unsigned char> blocked(static_cast<std::size_t>(n), 0);
  int obstacleCount = 0;
  for (int i = 0; i < n; ++i) {
    if (rng.unit() < obstacleRate) {
      blocked[static_cast<std::size_t>(i)] = 1;
      ++obstacleCount;
    }
  }
  blocked[0] = 0;
  blocked[static_cast<std::size_t>(n - 1)] = 0;

  struct Node { int f, g, idx; };
  struct Cmp { bool operator()(const Node& a, const Node& b) const { return a.f > b.f; } };
  std::priority_queue<Node, std::vector<Node>, Cmp> open;
  std::vector<int> dist(static_cast<std::size_t>(n), std::numeric_limits<int>::max());
  dist[0] = 0;
  open.push({width + height - 2, 0, 0});
  int visited = 0;
  constexpr int dx[4] = {1, -1, 0, 0};
  constexpr int dy[4] = {0, 0, 1, -1};

  while (!open.empty()) {
    const Node cur = open.top(); open.pop();
    if (cur.g != dist[static_cast<std::size_t>(cur.idx)]) continue;
    ++visited;
    if (cur.idx == n - 1) break;
    const int x = cur.idx % width;
    const int y = cur.idx / width;
    for (int k = 0; k < 4; ++k) {
      const int nx = x + dx[k], ny = y + dy[k];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const int ni = ny * width + nx;
      if (blocked[static_cast<std::size_t>(ni)]) continue;
      const int ng = cur.g + 1;
      if (ng < dist[static_cast<std::size_t>(ni)]) {
        dist[static_cast<std::size_t>(ni)] = ng;
        const int h = (width - 1 - nx) + (height - 1 - ny);
        open.push({ng + h, ng, ni});
      }
    }
  }

  std::uint64_t checksum = 0x84222325cbf29ce4ULL;
  for (int i = 0; i < n; ++i) {
    checksum = mix64(checksum, static_cast<std::uint64_t>(blocked[static_cast<std::size_t>(i)]) + static_cast<std::uint64_t>(i) * 1315423911ULL);
  }

  PathResult r;
  r.found = dist[static_cast<std::size_t>(n - 1)] != std::numeric_limits<int>::max();
  r.width = width;
  r.height = height;
  r.pathLength = r.found ? dist[static_cast<std::size_t>(n - 1)] : -1;
  r.visited = visited;
  r.obstacles = obstacleCount;
  r.checksum = checksum;
  return r;
}

VMResult runTinyVM(const std::string& program, std::uint64_t seed) {
  VMResult result;
  RNG rng(seed);
  const auto lines = linesOf(program);
  double acc = 0.0;
  std::vector<double> stack;
  std::ostringstream output;
  int steps = 0;

  for (const auto& raw : lines) {
    if (++steps > 10000) {
      result.error = "instruction limit exceeded";
      break;
    }
    const std::string line = trim(raw);
    if (line.empty() || line[0] == '#') continue;
    std::stringstream ss(line);
    std::string op;
    ss >> op;
    std::transform(op.begin(), op.end(), op.begin(), [](unsigned char c){ return static_cast<char>(std::toupper(c)); });
    double x = 0.0;

    if (op == "SET") { if (!(ss >> x)) { result.error = "SET needs a number"; break; } acc = x; }
    else if (op == "ADD") { if (!(ss >> x)) { result.error = "ADD needs a number"; break; } acc += x; }
    else if (op == "SUB") { if (!(ss >> x)) { result.error = "SUB needs a number"; break; } acc -= x; }
    else if (op == "MUL") { if (!(ss >> x)) { result.error = "MUL needs a number"; break; } acc *= x; }
    else if (op == "DIV") { if (!(ss >> x) || std::abs(x) < 1e-15) { result.error = "invalid DIV"; break; } acc /= x; }
    else if (op == "SIN") acc = std::sin(acc);
    else if (op == "COS") acc = std::cos(acc);
    else if (op == "SQRT") { if (acc < 0) { result.error = "SQRT of negative value"; break; } acc = std::sqrt(acc); }
    else if (op == "RAND") acc = rng.unit();
    else if (op == "PUSH") stack.push_back(acc);
    else if (op == "POP") { if (stack.empty()) { result.error = "POP on empty stack"; break; } acc = stack.back(); stack.pop_back(); }
    else if (op == "EMIT") output << acc << '\n';
    else if (op == "HALT") { result.halted = true; break; }
    else { result.error = "unknown instruction: " + op; break; }
  }

  result.steps = steps;
  result.accumulator = acc;
  result.output = output.str();
  if (result.error.empty() && !result.halted) result.halted = true;
  return result;
}

}  // namespace superagent
