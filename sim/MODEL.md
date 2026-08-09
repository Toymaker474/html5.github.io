# GENESIS Matter Lab — model card

Status: **0.3 LAB CANDIDATE**

Matter Lab is the first real simulation vertical slice in the clean-room GENESIS rebuild.

## What 0.3 actually simulates

- 2D classical coarse-grained particles
- three generic species with reduced mass/size/interaction parameters
- Lennard-Jones 12-6 pair potential shifted at a 2.5 sigma cutoff
- velocity-Verlet integration
- periodic minimum-image boundaries
- optional weak velocity-rescaling thermostat
- deterministic seeded initialization on the same JavaScript numerical path
- direct user impulse intervention
- instantaneous radial distribution function g(r)
- low-temperature quench control
- **reversible coarse-grained pair associations** between unlike generic species
- stochastic association/dissociation driven by the same seeded RNG
- harmonic spring interaction for an active association, so association changes physical motion
- active-pair age, total formations, total breakages, and mean broken-pair lifetime telemetry
- one active association maximum per particle in this first inspectable model

## Reversible association model

This is intentionally a toy coarse-grained kinetic layer, not chemistry. A free unlike-species pair can associate when its minimum-image distance lies inside a capture radius. Formation probability depends on distance, a user-controlled on-rate, and a simple low-temperature bias. Existing associations can break stochastically according to an off-rate, temperature factor, and stretch penalty. An active association adds a harmonic potential around a reduced-unit rest separation.

These rules create actual causal pair formation and breakup in the state and force model. The displayed connection is only a visualization of that state.

## What this is NOT

- quantum mechanics or electrons
- literal atoms or real chemical species
- real chemical bonds
- electronic structure
- validated reaction kinetics
- reaction pathways or stoichiometric chemistry
- membranes, cells, heredity, evolution, organisms
- robot physics or agent intelligence

## g(r)

The radial distribution function bins pair separations up to half the smaller box dimension and normalizes against a uniform 2D pair distribution. Peaks indicate preferred separations in this finite model. They are not automatically evidence of crystallization or a thermodynamic phase transition.

## Reduced units

All current values use reduced Lennard-Jones-style units and are not mapped to SI units or laboratory species.

## Numerical approximations

Force evaluation clamps pathological overlap at 0.38 sigma to avoid the Lennard-Jones singularity. The association model uses a deliberately simplified capture/break kinetic law and harmonic pair potential. Neither approximation should be described as literal microscopic chemistry.

## 0.3 acceptance fixtures

The automated test checks:

1. periodic minimum-image and wrapping behavior;
2. deterministic seeded initialization;
3. 3,000 finite integration steps with association disabled and bounded energy drift;
4. finite/non-negative g(r);
5. deterministic reversible-association evolution from identical seeds;
6. at least one association forms in the low-temperature/high-on-rate fixture;
7. each active pair joins unlike generic species and no particle belongs to two active pairs;
8. a high off-rate with formation disabled reduces active associations and records break/lifetime telemetry;
9. impulse and quench paths still operate.

Passing these tests validates only these code/model invariants. It does not validate real chemical behavior.
