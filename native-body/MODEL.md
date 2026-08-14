# GENESIS Native Body 0.1 — Deterministic Fixed-Point Articulated Mechanics

Status: isolated native C++ proof slice. **Not loaded by the active GENESIS route yet.**

## Numeric model
All physical state is signed Q16.16 fixed-point integer arithmetic. The intent is deterministic replay across native and WebAssembly builds without relying on platform floating-point behavior. The solver uses a fixed ~1/120 s step.

## Body representation
A body is a mass-weighted graph of 3D collision samples:
- position and velocity per node
- explicit mass and inverse mass
- collision radius per node
- structural distance constraints
- geometric range constraints used as a distance-equivalent joint bend/cone bound
- per-link plastic rest length, accumulated damage and break state

The first organism fixture has 18 dynamic nodes covering pelvis/spine/head, bilateral arms, bilateral legs and tail, with cross-braced torso links and four limb bend-range constraints.

## Integration and constraints
Each step:
1. applies external acceleration to velocity,
2. predicts 3D positions,
3. iterates structural and bend-range constraints ten times,
4. resolves node-sphere versus solid-voxel AABB contacts,
5. reconstructs velocity from constrained displacement,
6. removes inward normal velocity,
7. caps tangential friction by `mu * normal-impulse proxy`,
8. applies small bounded velocity damping,
9. records kinetic/contact/strain telemetry.

Distance corrections are weighted by inverse mass so an isolated equal-mass pair preserves its center of mass. This is a compliant iterative position-constraint method; it is **not** claimed to be a full six-DOF rigid-body or finite-element solver.

## Material failure
For each structural link the current strain is `abs(length-rest)/rest`.
- below yield: elastic constraint response only
- above yield: rest length drifts by a bounded plastic rate and damage accumulates
- above break strain: the link is permanently severed

This gives the body actual deformation history instead of a visual injury flag.

## Contact
Collision samples resolve against explicit occupied world voxels using sphere-versus-AABB closest-point penetration. If the sphere center is inside a solid voxel, the nearest exit face determines the contact normal. Friction is applied only from a contact normal budget and is bounded by the configured Coulomb coefficient.

## Required proof gates
- gravity changes native velocity/position
- internal equal-mass constraint correction preserves center of mass
- bend/range constraint enforces endpoint bounds
- falling sample cannot remain embedded below the voxel-floor surface
- friction impulse never exceeds the configured Coulomb bound
- tangential speed decreases under frictional contact
- yield changes physical rest length
- break threshold actually severs a constraint
- 18-node whole-body command replay is deterministic

## Non-claims
This slice is not yet coupled to the active C++ material volume, native water pressure field or WebGPU renderer. Node spheres are collision samples, not final visual geometry. There is no muscle physiology, torque motor, self-collision, rotational inertia tensor, continuum tissue FEM, fracture surface generation or active creature controller yet. Those must be added and tested before this can be presented as a complete organism physics system.
