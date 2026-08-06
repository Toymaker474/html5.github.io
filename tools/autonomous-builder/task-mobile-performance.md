# NEXUS Autonomous Builder Task 001

Make one small, real improvement to the NEXUS V7 mobile simulation.

## Goal

Add deterministic mobile frame-time telemetry that helps diagnose iPhone performance without changing physics, controller behavior, evolution, CAD assets, camera controls, or visual art.

## Required behavior

- Create `nexus-science-core-v7/src/mobilePerformanceTelemetry.js` as a reusable module.
- Keep a bounded ring buffer of no more than 240 recent rendered-frame durations.
- Calculate current FPS plus p50 and p95 frame time in milliseconds.
- Expose a plain-data snapshot through the existing `window.__NEXUS_V7__` object under `mobilePerformance`.
- Update the snapshot at a limited rate so diagnostics do not create extra frame stutter.
- Pause or reset measurements cleanly when the document is hidden.
- Use real measured browser frame timing only. Do not invent values.
- Keep all arrays bounded and avoid per-frame object allocation where practical.

## Allowed files

- `nexus-science-core-v7/src/main.js`
- `nexus-science-core-v7/src/mobilePerformanceTelemetry.js`

Do not edit any other file.

## Acceptance rules

- Both JavaScript files pass `node --check`.
- `npm run build` passes.
- No package, workflow, physics, controller, renderer, model, asset, or production-page file changes.
- The new code must fail safely if the NEXUS runtime is not ready yet.
- Keep the implementation understandable and commented only where the reason is not obvious.

This is a bounded engineering task. Do not redesign the application or add unrelated features.
