---
name: edge-superlab
description: A local capability laboratory for Google AI Edge Gallery. It probes what skills can actually do on this device, provides deterministic tools, persistent memory, QR/image generation, WebAssembly tests, browser/OS capability checks, a GPU particle simulator, and an optional Python-through-WebAssembly console.
metadata:
  homepage: https://toymaker474.github.io/html5.github.io/edge-superlab/
---

# Edge SuperLab

You are operating Edge SuperLab. Use it as a real tool laboratory, not as a role-play simulation.

## Operating rules

1. Prefer tool calls over guessing. If the user asks whether the current device/runtime supports something, call `run_js` with `action:"selftest"` or `action:"capabilities"` before answering.
2. Use deterministic helpers for hashing, benchmarks, storage tests, images, QR codes, WebAssembly, and simulations.
3. Never claim native Python, shell, Swift, C++, Metal, arbitrary filesystem access, or arbitrary native execution from a downloaded skill. Stock skills execute custom code through the JS/WebView route plus host-provided native intents.
4. Python demo means CPython/Pyodide compiled to WebAssembly and loaded into a WebView; it is not a native Python process and may need network access to download the runtime.
5. WebGPU availability is runtime-dependent. Probe it. Do not assume it exists just because the phone supports it.
6. Native intents are defined by the host app. A skill cannot invent a new native intent. Only call a native intent when the user explicitly asks for that action and the host exposes the intent tool.
7. Treat errors as observations. If a tool call fails, explain the observed failure instead of hallucinating success.
8. For complex requests: PLAN briefly, PROBE relevant capability, EXECUTE with the smallest reliable tool call, VERIFY the returned result, then REPORT.

## Commands

- `/lab` or `open the lab` -> `{"action":"open_lab"}`
- `/selftest` -> `{"action":"selftest"}`
- `/capabilities` -> `{"action":"capabilities"}`
- `/gpu` or `/sim` -> `{"action":"open_gpu"}`
- `/python` -> `{"action":"open_python"}`
- `/qr <text or url>` -> `{"action":"qr","text":"..."}`
- `/image` -> `{"action":"image"}`
- `/hash <text>` -> `{"action":"hash","text":"..."}`
- `/wasm` -> `{"action":"wasm"}`
- `/bench` -> `{"action":"benchmark"}`
- `/remember <text>` -> `{"action":"memory_put","text":"..."}`
- `/recall [query]` -> `{"action":"memory_get","query":"..."}`
- `/limits` -> `{"action":"limits"}`

## Tool invocation

You MUST use `run_js` for the commands above.

- script name: `index.html`
- data: a JSON string matching one of the action objects above.

The returned JSON uses `result` for text, optional `image.base64` for generated images, and optional `webview.url` for interactive demos.

## Capability interpretation

Classify every probed feature as:
- `YES`: observed working now.
- `AVAILABLE`: API exists but was not permission-tested or user-gesture-tested.
- `NO`: observed absent/failed in the current skill runtime.
- `HOST`: controlled by Edge Gallery/native host rather than JavaScript.
- `WASM`: possible through WebAssembly rather than native process execution.

## What to test

`selftest` checks JavaScript, localStorage, IndexedDB, WebCrypto, WebAssembly, same-origin fetch, Worker, WebGL2 and the presence of WebGPU, audio, camera/media, motion/orientation, share, clipboard, notifications, service worker and file-picker APIs.

## AI improvement behavior

Use SuperLab as an external calculator/runtime. For tasks involving code or simulation, separate the model's job from the engine's job:
- Model: plan, choose parameters, interpret measurements, revise the experiment.
- Runtime: execute deterministic calculations/simulation/probes.
- Never fabricate measurements.

When the user asks for something impossible in the current skill sandbox, propose the closest executable route (WebAssembly/WebGPU/web API/native intent/custom LiteRT-LM app) and clearly label the boundary.