# GENESIS Native Body ↔ Material Coupling 0.1

Status: isolated combined-C++ proof slice. Not loaded by the active browser route yet.

`native-body/coupled.cpp` compiles the existing native material/fluid solver and native articulated-body solver into one C++ translation unit. No JavaScript participates in contact decisions.

## Causal bridge
`genesis_coupled_sync_solids()` reads the actual material bytes owned by `volume3d/solver.cpp` and rebuilds the body solver's collision cache:
- ROCK → solid body contact
- SAND → solid body contact
- WATER → counted but **not** treated as solid
- EMPTY → non-solid

`genesis_coupled_step(worldIterations, bodySteps)` advances the material/fluid solver, refreshes solid occupancy, then advances articulated-body mechanics. Therefore granular motion or material removal can change subsequent body support.

## Current bounded cache
The body collision cache is currently 32 × 24 × 32 cells. Coupling copies the overlapping region from the material volume. This is an explicit proof-slice limit, not a claim of whole-world body collision. Before active integration, this must become a moving/local chunk cache or direct full-volume query.

## Proof gates
- a body collision sample dropped onto native ROCK remains supported by imported material occupancy
- clearing the native material state and re-syncing removes that support and the body falls
- native WATER produces zero solid-cache cells and cannot fake body support
- native SAND produces real collision occupancy
- combined material/fluid/body command replay is deterministic
- both underlying material and body invariants must remain valid

## Non-claims / next physics
Water currently has no force coupling to the body. There is no buoyancy, hydrodynamic drag, pressure-force integration, added mass or fluid displacement from the body. The body must fall through water rather than pretending to swim until those forces are implemented.

The cache also carries only solid occupancy at this stage; material-dependent friction, sand moisture, yielding substrate response, two-way body↔sand displacement and fracture are later coupling systems.
