# Failure: PR #63 WebAssembly instantiate gate

Date: 2026-08-09
PR: #63
GitHub Actions run: 31316858444
Job: 93253409317

## Symptom
All preserved GENESIS suites passed and the new native C++ volumetric fixture passed, but the new WebAssembly gate failed with:

`WebAssembly.instantiate(): section (code 10, "Code") extends past end of the module ...`

## What remained safe
`main` was untouched. Matter Lab 0.6, Materials Lab 0.1, and Materials Lab 0.2 all remained green. The candidate stayed isolated and was not promoted.

## First causal blocker
Not yet established from the first run. The test instantiated the committed browser WASM payload before the freshly compiled `/tmp/genesis-volume.wasm`, so the error did not identify which artifact was malformed.

## Diagnostic repair
`volume3d/wasm.test.mjs` now:
- instantiates the freshly compiled C++ WASM first;
- labels fresh and committed instantiate failures separately;
- records byte size and SHA-256 for each artifact;
- if the committed payload is bad while the fresh build is good, emits the fresh base64 payload between explicit markers so the checked-in browser artifact can be replaced exactly.

## Regression expectation
No promotion until native C++, fresh wasm32, committed browser WASM, semantic comparison, and all older GENESIS suites pass on the same PR head.
