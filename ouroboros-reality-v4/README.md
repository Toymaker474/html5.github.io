# OUROBOROS REALITY V4

Integrated browser living-world experiment using Babylon.js with WebGPU-first initialization and WebGL fallback.

## Current simulated layers

- Dynamic height/sediment terrain state
- Granular sand/sediment particles with gravity, slope movement and deposition
- Water-state particles with gravity, downhill flow, wetting and terrain contact
- Soil moisture, nutrients and biomass grids
- Coarse temperature, humidity, oxygen and smoke/gas fields
- Plant biomass that grows from moisture, nutrients and light and is physically consumed
- Articulated six-node organisms solved from point masses, distance constraints, gravity, water contact and internal muscle forces
- Grazers that sense plants and threats
- Predators that sense and physically approach prey
- Metabolic energy loss, eating, finite biomass removal, injury/death, nutrient return and reproduction
- Extinction is allowed; there is no population balancer
- Observer camera and organism selection

## Important boundary

This is an integrated browser simulation prototype, not yet the final native OUROBOROS PC kernel. The long-term port target remains C++20 + Flecs + Jolt compiled with Emscripten to WASM, feeding read-only render snapshots into Babylon/WebGPU. Babylon is the graphics/world presentation engine; simulation authority should ultimately remain in the C++ kernel.

No authored creature animation clips are used. Creature geometry follows solved body-node state.
