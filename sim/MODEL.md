# GENESIS Matter Lab — model card

Status: **LAB CANDIDATE**

This is the first real simulation vertical slice in the clean-room GENESIS rebuild.

## What it actually simulates

- 2D classical coarse-grained particles
- three generic species with different reduced mass/size/interaction parameters
- Lennard-Jones 12-6 pair potential
- potential shifted to zero at a 2.5 sigma cutoff
- velocity-Verlet time integration
- reflective boundaries
- optional weak thermostat
- deterministic seeded initialization on the same JavaScript numerical path
- direct user impulse as an explicitly logged intervention count

## Reduced units

The current model uses reduced Lennard-Jones-style units. Values are not yet mapped to SI units or real chemical species.

## Important numerical detail

To avoid singular numerical blow-ups at pathological overlap, pair distance used by the force evaluation has a minimum clamp of 0.38 sigma. This is a numerical safety approximation and must not be described as literal short-range atomic physics.

## What it does NOT simulate

- quantum mechanics
- literal atoms
- electrons
- real chemical bond formation/breaking
- reaction kinetics
- membranes
- cells
- heredity
- evolution
- organisms
- robot physics
- agent intelligence

## Current acceptance fixtures

The automated model test checks:

1. equal seeds produce equal initial state hashes;
2. 3,000 no-thermostat integration steps remain finite and inside boundaries;
3. relative total-energy drift stays below the current 8% fail threshold for the fixture;
4. an explicit impulse affects particles and changes subsequent state.

The local pre-commit run for the current candidate measured approximately 0.0000803 relative energy drift (~0.0080%) in that specific fixture. GitHub CI must rerun the test independently before this candidate may be described as CI-passing.

## Next scientific step

After this vertical slice is independently tested and visible on the deployed product, the next simulation work should deepen the model rather than rename it: spatial acceleration, explicit pair diagnostics, model-unit provenance, then a separately specified reversible association/chemistry experiment if justified.
