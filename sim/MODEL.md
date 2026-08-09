# GENESIS Matter Lab — model card

Status: **0.2 CANDIDATE**

Matter Lab is the first real simulation vertical slice in the clean-room GENESIS rebuild.

## What 0.2 actually simulates

- 2D classical coarse-grained particles
- three generic species with different reduced mass/size/interaction parameters
- Lennard-Jones 12-6 pair potential, shifted to zero at a 2.5 sigma cutoff
- velocity-Verlet time integration
- periodic boundaries using the minimum-image convention
- optional weak velocity-rescaling thermostat
- deterministic seeded initialization on the same JavaScript numerical path
- direct user impulse intervention
- instantaneous radial distribution function g(r) from pair separations
- a quench control that rescales kinetic temperature and enables the thermostat at a low target

## What g(r) means here

The displayed radial distribution function bins pair separations up to half the smaller box dimension and normalizes each annular shell against the expected unordered-pair count for a uniform 2D distribution. A peak means some pair distance occurs more often than that uniform reference. It is a structural diagnostic; it is not proof of crystallization or a thermodynamic phase transition.

## Reduced units

The model uses reduced Lennard-Jones-style units. Values are not mapped to SI units or real chemical species.

## Numerical safety approximation

Force evaluation clamps pathological pair overlap at 0.38 sigma to avoid the Lennard-Jones singularity causing numerical blow-up. This is a numerical safety approximation and must not be described as literal short-range atomic physics.

## What it does NOT simulate

- quantum mechanics or electrons
- literal atoms or real chemical species
- bond formation/breaking or reaction kinetics
- membranes, cells, heredity, evolution, organisms
- robot physics or agent intelligence
- a thermodynamic-limit phase diagram

## Current acceptance fixtures

The automated model test checks deterministic initialization, periodic minimum-image displacement, periodic position wrapping, 3,000 finite no-thermostat integration steps, bounded total-energy drift for the fixture, finite/non-negative g(r), a detected pair-separation peak, periodic impulse behavior, and deterministic temperature rescaling for the quench path.

Passing these tests validates only those software/model invariants. It does not validate the model against laboratory data.
