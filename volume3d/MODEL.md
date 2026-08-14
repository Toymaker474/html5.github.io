# GENESIS Materials 0.4 — Native 3D Momentum + Pressure Projection

Status: LAB CANDIDATE.

## State
The solver is from-scratch C++ compiled to WebAssembly over a real `x × y × z` volume. Each cell stores coarse material occupancy (empty, sand, water, rock), sand moisture and water-borne sediment. Water cells additionally carry signed fixed-point velocity `(vx, vy, vz)` plus a native pressure field.

WebGPU is presentation only. It consumes the packed native material field; the renderer does not create physical wave motion.

## Fluid update
For each native step:
1. Gravity and bounded damping update water momentum.
2. Discrete velocity divergence is measured over neighboring water cells.
3. A pressure Poisson approximation is relaxed repeatedly in the native C++ volume.
4. The pressure gradient is subtracted from velocity.
5. Solid and world-boundary normal velocity is clamped.
6. The projection is repeated, then divergence is measured again.
7. Water voxels advect at most one neighboring cell from the projected velocity field.
8. Native kinetic energy, signed XYZ momentum and pressure magnitude are recomputed.

Internal stepping conserves the number of water voxels. Fixed-seed replay hashes include water velocity and pressure, not occupancy alone.

## Material coupling
- Unsupported sand still collapses under gravity.
- Adjacent water drives sand moisture.
- Soil strength uses a bounded capillary-cohesion peak and saturation weakening approximation.
- Erosion consumes local simulated water speed and soil strength.
- Suspended sediment is conserved as sand mass and can deposit in slow supported flow.
- The GPU turbidity channel remains actual native sediment. Pressure is never relabeled as sediment or visual turbidity.

## Validation gates
- Native C++ fixture.
- Fresh C++ → WebAssembly fixture.
- Exact committed browser WebAssembly fixture.
- Fresh/committed semantic equality.
- Water-voxel conservation.
- Sand-mass conservation through erosion/deposition.
- Impulse produces native signed momentum and kinetic energy.
- Pressure projection must not increase measured discrete divergence on the impulse fixture.
- Gravity fixture produces downward native momentum.
- Fixed-seed + fixed-impulse deterministic replay.
- Invariant forbids velocity/pressure on non-water cells.
- Active renderer must consume native sediment for water turbidity and may not invent time-driven wave motion.

## Non-claims
This is **not validated Navier–Stokes CFD**, SPH, MPM, FLIP, LBM or an engineering fluid package. The free surface remains coarse binary voxel occupancy and advection is discrete neighbor transport rather than continuous characteristic tracing. Pressure projection is a real native dynamics constraint, but spatial accuracy is voxel-scale and viscosity is approximated by bounded damping. Do not call it full CFD.
