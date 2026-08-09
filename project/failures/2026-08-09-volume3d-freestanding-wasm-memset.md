# Failure: freestanding C++ WebAssembly link required libc memory primitive

Date: 2026-08-09
Candidate: GENESIS Materials 0.3 — Volumetric C++ / WebAssembly

## Symptom
The native C++ reference executable passed, but the first `clang++ --target=wasm32 -nostdlib` link failed with repeated `undefined symbol: memset` errors.

## First causal failure
LLVM optimized explicit zeroing loops into calls to `memset`. Because the candidate intentionally uses a freestanding `-nostdlib` WebAssembly build, libc was not linked and the symbol did not exist.

## What remained safe
The existing `main` product and Materials 0.2 were untouched. The failure occurred only in the isolated `genesis-materials-0.3-volume-wasm` Lab work.

## Repair
Provide tiny freestanding `memset` and `memcpy` implementations inside `volume3d/solver.cpp`. No solver rule or model semantics changed.

## Verification
After the repair:
- native C++ fixture passed;
- WebAssembly linked successfully;
- committed browser WASM instantiated in Node;
- sand and water conservation fixtures passed;
- native and WASM deterministic reference results matched locally.

## Regression protection
GitHub CI for this candidate must compile the C++ source both natively and as freestanding `wasm32`, then execute the native and WASM fixtures. A future reappearance of missing runtime primitives therefore fails the candidate before promotion.
