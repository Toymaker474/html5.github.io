# GENESIS Materials 0.4 — Native 3D Momentum / Pressure

Status: LAB CANDIDATE.

## Representation
The active material model is a genuine `x × y × z` C++ volume compiled to WebAssembly. Each cell stores coarse material occupancy (empty, sand, water, rock), sand moisture and water-borne sediment. Water cells now also carry explicit signed fixed-point velocity components `(vx, vy, vz)` and a pressure field.

WebGPU only renders the resulting native state. It does not invent fluid motion.

## Native fluid step
Each native water update performs a bounded discrete projection cycle:
1. Apply gravity and velocity damping to water momentum.
2. Measure discrete velocity divergence over neighboring water cells.
3. Solve a local pressure Poisson approximation with repeated relaxation iterations.
4. Subtract the pressure gradient from velocity.
5. Enforce solid/boundary normal-velocity constraints.
6. Advect each water voxel at most once using the resulting velocity field.
7. Recompute kinetic energy and total momentum telemetry.

Water-voxel count is conserved by internal stepping. The solver exposes divergence before/after projection, kinetic energy, XYZ momentum and an explicit impulse operation for deterministic tests.

## Coupled material behavior
- Gravity and projected momentum control water transport.
- Unsupported sand still undergoes granular collapse.
- Sand-water contact drives wetting/cohesion state.
- Erosion strength now consumes simulated local water speed rather than a random water-neighbor event alone.
- Suspended sediment remains part of sand-mass accounting and can deposit under slower local flow.

## Determinism
The C++ reference path uses an explicit xorshift32 PRNG and deterministic scan order for a fixed build, seed, dimensions and command sequence. The replay hash includes water velocity and pressure state, so deterministic equality now covers the fluid dynamics state rather than occupancy alone.

## Validation gates
- Native C++ fixture.
- Fresh C++ → WebAssembly fixture.
- Committed browser WebAssembly fixture.
- Fresh/committed semantic equality.
- Water-voxel conservation under internal stepping.
- Sand-mass conservation through erosion/deposition.
- Pressure projection must not increase measured discrete divergence on the impulse fixture.
- Nonzero impulse must create native momentum and kinetic energy.
- Gravity fixture must produce downward native momentum.
- Fixed-seed + fixed-impulse replay hash.
- State invariants forbid velocity/pressure living on non-water cells.

## Non-claims
This is **not** a validated Navier–Stokes CFD solver, SPH, MPM, FLIP, LBM or engineering fluid package. The free surface is still a binary coarse voxel occupancy and advection is discrete one-cell transport rather than continuous characteristic tracing. Pressure projection is a real native dynamics constraint, but spatial accuracy remains voxel-scale and viscosity is represented only by bounded damping. Do not call this full CFD.
