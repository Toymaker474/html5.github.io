# GENESIS Materials Lab 0.2 — cinematic 3D model card

Status: LAB CANDIDATE. This is a new vertical slice. Materials Lab 0.1 and Matter Lab 0.6 remain preserved.

## Why 0.2 exists
Materials Lab 0.1 was visually still a 2D cellular cross-section. Its WebGPU path rendered a fullscreen triangle and shaded cells in screen space, so it could not satisfy the experiential goal of a dramatic 3D world.

0.2 changes the representation rather than just changing colors.

## Current simulation truth
`materials3d/model.js` uses a horizontal x/z grid. Every cell stores four continuous values:

- sand depth
- water depth
- moisture
- rock/bed elevation

Sand moves toward neighboring lower surfaces when the local height difference exceeds an angle-of-repose-like threshold. Moisture raises that threshold through a deliberately phenomenological cohesion term, allowing wet sand to retain steeper/taller forms. Water moves conservatively toward lower total free-surface height. Moisture is driven by water contact and local diffusion/decay.

This is a 2.5D heightfield model. It creates real three-dimensional surface geometry but does not represent overhangs, caves, vertical fluid columns, or individual simulated grains.

## Rendering
`materials3d/renderer-webgpu.js` builds actual perspective-projected WebGPU geometry from the simulation state.

The renderer includes:

- perspective orbit camera;
- depth buffer;
- triangulated terrain surface generated from rock + sand height;
- separate raised transparent water surface;
- directional sun lighting;
- procedural sky and sun disk;
- distance/height atmospheric haze approximation;
- wet-sand darkening and specular response;
- camera-facing micro-grain sprites derived from occupied sand cells;
- procedural wave-normal perturbation and Fresnel-like water reflection;
- ACES-style tonemapping approximation.

The grain sprites are presentation microstructure. They are derived from sand state and do not claim that each visible grain is an independently simulated rigid body.

If WebGPU is unavailable or lost, the app explicitly reports a Canvas isometric fallback rather than claiming the WebGPU 3D path ran.

## Tested invariants
The Node reference suite checks:

- deterministic replay hash for fixed seed/steps;
- nonnegative finite state;
- sand mass conservation during stepping;
- water mass conservation during stepping;
- concentrated dry sand relaxes/spreads;
- water spreads across additional cells on a flat bed;
- wet cohesive sand retains more height than the equivalent dry pile.

## Non-claims
0.2 is NOT:

- per-grain discrete element method (DEM);
- volumetric 3D sand physics;
- Navier–Stokes, MPM, FLIP or SPH fluid simulation;
- validated capillary/cohesive soil mechanics;
- a literal micron-scale grain simulation;
- Unreal Engine;
- ray-traced global illumination;
- a validated physically based rendering implementation;
- GPU-compute simulation physics;
- lava, clouds, creatures or a complete GENESIS universe.

## Productization gates
Before 0.2 can be called device-verified:

1. its deterministic reference suite and all preserved older regressions must pass in PR CI;
2. the exact WebGPU shader must compile and render on the deployed route;
3. the actual renderer backend must be captured on target hardware;
4. touch orbit/sculpt behavior must be exercised on iPhone Safari;
5. frame-time, simulation throughput, memory and sustained behavior must be measured;
6. only after profiling should WebGPU compute, WASM/Rust, shadow maps, post-processing or a deeper granular solver be selected.
