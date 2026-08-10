#include <cstdint>
#include <cstdio>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

// OUROBOROS REALITY web-port kernel entrypoint.
// This file is intentionally simulation-only: no renderer authority.
// Next build step links the same Jolt + Flecs architecture used by the PC kernel.

struct SimStats {
    uint32_t tick = 0;
    uint32_t humans = 250000;
    uint32_t physical_bodies = 0;
    float sim_hz = 120.0f;
};

static SimStats g_stats;

extern "C" {
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
void ouroboros_step(float dt) {
    (void)dt;
    ++g_stats.tick;
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
const SimStats* ouroboros_stats() {
    return &g_stats;
}
}

int main() {
    std::puts("OUROBOROS REALITY WEB PORT KERNEL");
    return 0;
}
