# NEXUS//GPU FORGE v0.1

A dependency-free browser graphics engine that talks directly to WebGPU. It is the rendering foundation for the original SHARDWING project, not a wrapper around Three.js, Babylon.js, Unity, or another game engine.

## Engine-owned systems

- WebGPU adapter/device/context lifecycle
- Device-loss handling
- GPU resource allocation and cleanup
- Render and compute pipeline construction
- WGSL compute simulation
- WGSL background and instanced-shard rendering
- Camera and matrix math
- Depth-buffer management
- Mobile resolution scaling
- Seeded particle initialization
- Additive translucent rendering

## Smoke test: SHARDSTORM

The included demo runs 24,576 shards on mobile or 65,536 on desktop. A WGSL compute shader performs the simulation entirely on the GPU, and an instanced render pipeline draws the shards without an external graphics framework.

Open `demo/` through GitHub Pages over HTTPS in a WebGPU-capable browser.

## Deliberate limits of v0.1

This milestone proves the custom GPU runtime, compute path, rendering path, resource lifecycle, touch input, and mobile budget. It is not yet the game engine's voxel terrain, animation graph, editor, asset format, post-processing graph, or physics world.
