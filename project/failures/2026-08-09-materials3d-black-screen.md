# Materials Lab 0.2 live black-screen failure

Status: OPEN / REPAIR IN PROGRESS
Date: 2026-08-09

## Symptom
User opened `/materials3d/` on the deployed GitHub Pages site and observed a black screen.

## Preserved safe state
- Matter Lab 0.6 remains separately available.
- Materials Lab 0.1 remains separately available.
- Materials Lab 0.2 model/reference CI evidence remains preserved.

## First causal failure found by source inspection
The 0.2 runtime attempts WebGPU on `#view`. If WebGPU setup/rendering fails after that canvas has acquired a `webgpu` context, `fallback()` constructs `GenesisCanvas3DMaterialsRenderer` on the same canvas. A canvas cannot reliably switch from a WebGPU context to a 2D context, so `getContext('2d')` can return null and the fallback can remain black.

A second verification gap exists: the accepted WebGPU renderer is not probed with an awaited validation error scope before normal use. A bad shader/pipeline can therefore escape the normal synchronous `try/catch` path and leave a black GPU canvas.

## Repair contract
1. Keep the WebGPU canvas and Canvas2D fallback canvas separate.
2. Make fallback visibly usable even after WebGPU has acquired its own canvas context.
3. Exercise the WebGPU renderer inside a validation error scope and wait for submitted work before accepting it.
4. Listen for uncaptured GPU errors and switch to the safe fallback.
5. Surface the fallback reason in the UI.
6. Preserve all existing model regressions.
7. Add static regression checks for the dual-canvas failover contract.

## Verification limits
CI can verify source/static/runtime model contracts, but not actual rendering on the user's GPU. Live target-device confirmation remains required after merge.
