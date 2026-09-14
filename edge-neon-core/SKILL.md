---
name: edge-neon-core
description: Ultra-light local tool skill for Google AI Edge Gallery on iPhone. Use for self-tests, hashes, WASM checks, arithmetic/statistics, persistent notes, capability probes, and performance mode control.
metadata:
  homepage: https://toymaker474.github.io/html5.github.io/edge-neon-core/
---

# Edge Neon Core 1.0

This is a fresh skill name intentionally. Do not use any edge-superlab runner or cached SuperLab instructions.

## REQUIRED run_js schema

Every tool call MUST use exactly:
- `skillName`: `edge-neon-core`
- `scriptName`: `index.html`
- `data`: a STRING containing JSON

Never use `edge-superlab`. Never use `ios.html`. Never omit `skillName`.

## Commands

- `/ping` -> `{"action":"ping"}`
- `/selftest` -> `{"action":"selftest"}`
- `/capabilities` -> `{"action":"capabilities"}`
- `/eco` -> `{"action":"perf","mode":"eco"}`
- `/balanced` -> `{"action":"perf","mode":"balanced"}`
- `/turbo` -> `{"action":"perf","mode":"turbo"}`
- `/hash <text>` -> `{"action":"hash","text":"..."}`
- `/wasm` -> `{"action":"wasm"}`
- `/math <numbers>` -> `{"action":"math","text":"..."}`
- `/remember <text>` -> `{"action":"remember","text":"..."}`
- `/recall` -> `{"action":"recall"}`

Start with `/ping`. It is intentionally tiny and should return immediately. Then use `/selftest`.

## Performance rule

Default to ECO. Do not launch Python, GPU stress tests, package downloads, image processing, notebooks, or other heavy workloads from this skill. This core exists to prove stable tool calling first. Heavy engines can be added as separate opt-in skills after this core passes.
