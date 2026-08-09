# GENESIS Materials Lab 0.1 — model card

Status: LAB CANDIDATE. This document describes what the current implementation actually does.

## Dream target
A high-agency multiscale material world where sand, water, lava, atmosphere/clouds and later biological structures share causal state and can eventually connect into the broader GENESIS hierarchy.

## Current implementation
`materials/model.js` is a deterministic 2D discrete-material reference model. Each occupied sand cell represents a coarse parcel of granular material, not one literal mineral grain. Sand falls under gravity and can move diagonally around support. Water follows local gravity/diagonal/lateral empty-cell moves. Water contact transfers a scalar moisture state into neighboring sand. Moisture plus local support produces a deliberately phenomenological cohesion rule, allowing wet structures to retain steeper shapes than the same dry fixture.

The simulation runs in `materials/worker.js`. Rendering consumes packed material + moisture state and does not decide motion.

## Rendering
`materials/renderer-webgpu.js` is the preferred presentation path. It uploads the packed simulation state into a read-only WebGPU storage buffer and uses WGSL to derive material-specific lighting, grain-scale variation, wet-sand darkening/specular response, rock roughness and animated water appearance. `materials/renderer-canvas.js` is a lower-fidelity fallback when WebGPU is unavailable or lost.

The WebGPU renderer is presentation only in 0.1. Physics is not yet GPU compute.

## Declared model family
- Sand: coarse discrete granular / falling-sand cellular model.
- Water: coarse local discrete flow approximation.
- Wetness: scalar moisture field attached to sand cells.
- Cohesion: phenomenological local rule based on wetness and neighborhood support.
- Rendering: state-derived procedural visualization.

## Invariants currently tested
- fixed seed + identical edits produces identical CPU state hash;
- suspended sand descends under gravity;
- sand material count is conserved by simulation stepping;
- water descends/spreads and water material count is conserved by stepping;
- water contact creates wet-sand state;
- wet cohesive sand retains a taller fixture than dry sand under the same seed/setup;
- material IDs and moisture ownership remain valid.

## Non-claims
This is NOT:
- discrete-element-method rigid-body grain contact mechanics;
- literal micron-scale grain simulation;
- validated geotechnical engineering;
- Navier–Stokes or SPH water;
- real capillary-force physics;
- lava, clouds, atmosphere or creatures yet;
- an all-matter model of reality;
- a finished GENESIS product.

## Why JavaScript first
0.1 keeps the reference model small, inspectable and deterministic so later optimized implementations can be compared against it. WebAssembly/Rust or WebGPU compute should only be introduced when they provide a measured capability/performance benefit and can be checked against reference fixtures; they are not added for technology prestige.

## Next unlocks
1. independently green CI for the reference model and browser asset syntax;
2. live deployment test of the playable materials page;
3. real iPhone Safari/WebGPU profiling;
4. only then benchmark whether CPU reference throughput is the limiting factor and introduce a GPU-compute or WASM optimized path with reference comparison;
5. extend the same material architecture toward thermal state / lava and atmospheric scalar/velocity fields rather than creating unrelated demos.
