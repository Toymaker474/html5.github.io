# GENESIS Native Body ↔ Material Coupling 0.2

Status: isolated combined native C++ / WebAssembly proof slice. **Not loaded by the active browser route yet.**

## Architecture
The authoritative modules remain separate:
- `volume3d/solver.cpp` owns native material/fluid state.
- `native-body/body.cpp` owns deterministic fixed-point articulated-body state.
- `native-body/coupled.cpp` is a narrow bridge that calls only exported C APIs from those two modules.

The bridge does not include either solver `.cpp`, access anonymous namespaces, or duplicate physics logic. Native and WebAssembly builds link the same authoritative sources as separate translation units.

## Causal solid-contact synchronization
`genesis_coupled_sync_solids()` reads the actual exported native material-state bytes and rebuilds the body collision cache through `genesis_body_set_voxel()`:
- `ROCK` → solid body contact
- `SAND` → solid body contact
- `WATER` → counted but **not treated as solid**
- `EMPTY` → non-solid

`genesis_coupled_step(worldIterations, bodySteps)` advances native material/fluid physics, re-synchronizes solid occupancy, then advances body mechanics. Therefore material motion/removal can causally change later body support.

## Bounded cache
Body V1 currently exposes a 32 × 24 × 32 collision cache. Coupling synchronizes only the overlapping region of the native material volume. Out-of-cache space still follows the body V1 boundary behavior. This is a proof-slice limit, not whole-world collision.

## Required causal tests
1. A collision sample dropped onto actual native `ROCK` remains supported.
2. Clearing the native material state and re-syncing removes that support and the same body falls.
3. Native `WATER` creates zero solid-cache cells and provides no fake support.
4. Native `SAND` creates real collision occupancy.
5. Combined material + pressure-projected water + articulated-body replay is deterministic for an identical command sequence.
6. A separately compiled native executable and freestanding C++→WASM module must agree on the coupled reference fixture.
7. Combined WebAssembly must have zero external imports.

## Non-claims
There is still **no hydrodynamic force coupling** from native water into body nodes: no buoyancy, drag, pressure-force integration, added mass, lift, wake generation, or body-driven fluid displacement. A body must not be presented as swimming until those forces are implemented and tested.

Rock and sand are currently binary collision occupancy for the body. Material-dependent friction, wet-sand strength at contact, yielding substrate displacement, body↔sand momentum transfer, fractures, moving chunk caches, and full active-render integration are later systems.
