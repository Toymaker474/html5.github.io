# Edge SuperLab

A capability-test skill for Google AI Edge Gallery on iPhone/iPad/Android.

## Install

In AI Edge Gallery → Agent Skills → Skills → + → Load skill from URL, use:

`https://toymaker474.github.io/html5.github.io/edge-superlab/`

The folder is hosted by GitHub Pages and the repository root already includes `.nojekyll`.

## Best tests

- `/selftest` — runs headless execution probes and reports observed YES/NO results.
- `/lab` — opens a touch UI to test browser APIs, storage, audio, motion, sharing and more.
- `/gpu` — 50,000-particle WebGPU/WGSL compute demo when WebGPU is available, with an 8,500-particle typed-array Canvas fallback.
- `/python` — real CPython through Pyodide/WebAssembly. It is not native Python and downloads the runtime on first use.
- `/wasm` — executes a tiny WebAssembly module and verifies the result.
- `/qr https://example.com` — generates a QR image using the same general JS-skill image-return mechanism used by Edge Gallery's built-in QR skill.
- `/image` — returns a locally generated procedural PNG.
- `/bench` — quick JS/WASM call benchmark.
- `/remember ...` and `/recall ...` — tests origin-local persistent storage.
- `/limits` — explains the sandbox boundary.

## What this demonstrates

### Directly testable inside a downloadable skill

JavaScript/WebView execution, structured tool results, Canvas image generation, returned images, returned interactive webviews, WebAssembly, WebCrypto, localStorage, IndexedDB, Workers, same-origin fetch, WebGL2 and (when WebKit exposes it) WebGPU.

### Permission/gesture dependent

Audio, motion/orientation, camera/microphone, clipboard, sharing, notifications and file pickers. The interactive lab tests several of these because iOS often requires a user gesture.

### Not native execution

A normal downloaded skill does not get an arbitrary shell, native Python process, arbitrary Swift/C++ dynamic-code loader, unrestricted filesystem/process control, or the ability to invent new Edge Gallery native intents. C/C++/Rust can still be compiled to WebAssembly, and Python can run through CPython/Pyodide WebAssembly.

### For full native power

A custom iOS app built around LiteRT-LM can expose your own Swift/C++/Metal/Python functions to the model because you control the host application.

## Extra skill

`edge-secret-probe/` is a separate minimal skill that tests Edge Gallery's secure `require-secret` path. It never echoes the secret; it returns only its length and a SHA-256 fingerprint prefix.