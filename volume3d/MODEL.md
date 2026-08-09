# GENESIS Materials 0.3 — Volumetric C++ / WebAssembly

Status: LAB CANDIDATE.

## Representation
The simulation state is a genuine 3D `x × y × z` voxel volume. Each cell stores one coarse material occupancy (empty, sand, water, or rock), plus moisture on sand and a sediment load on water. The browser executes the solver as WebAssembly compiled from `solver.cpp`. WebGPU renders that state as perspective 3D geometry with a depth buffer.

This removes the 0.2 heightfield restriction: material can occupy multiple vertical layers and can form overhangs, cavities, columns and buried structures within voxel resolution.

## Rules
- Gravity: unsupported sand and water fall vertically.
- Granular settling: blocked sand may move diagonally downward into open neighboring volume.
- Wet cohesion: moisture reduces the probability of lateral/diagonal sand failure, so wet structures can retain steeper voxel-scale shapes.
- Water transport: water prefers downward and downward-diagonal empty volume, then lateral empty volume.
- Wetting: sand adjacent to water gains moisture; moisture decays gradually away from water.
- Erosion: exposed dry sand next to water can become sediment carried by that water voxel.
- Deposition: sediment-bearing water can deposit a sand voxel onto a supported neighboring empty cell.
- Sand-mass accounting includes both settled sand voxels and sediment carried by water.

## Determinism
The C++ reference path uses an explicit xorshift32 PRNG and deterministic scan order for a fixed build, seed, dimensions and command sequence. Cross-compiler bit-identical WASM bytes are not promised; CI compares model outputs instead of binary identity.

## Validation gates
- Native C++ fixture.
- Freshly compiled WebAssembly fixture.
- Committed browser WebAssembly fixture.
- Native/WASM semantic result comparison.
- Sand-mass conservation through erosion/deposition.
- Water-voxel conservation under internal stepping.
- Fixed-seed replay hash.
- Explicit 3D dimension checks.
- Previous Matter 0.6, Materials 0.1 and Materials 0.2 regression suites remain required.

## Non-claims
This is not discrete-element-method grain mechanics, CFD/Navier–Stokes/SPH/MPM/FLIP, geotechnical validation, literal micron-scale grains, photoreal Unreal Engine rendering, global illumination, biological evolution, creatures, or finished GENESIS. Each voxel represents a coarse material volume. The renderer's micro-grain shading is presentation derived from state, not extra simulated particles.
