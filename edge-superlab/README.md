# Edge SuperLab 4 — iPhone performance build

A local AI workstation/capability-lab skill for Google AI Edge Gallery, tuned to avoid large memory/heat spikes on iPhone.

## Install

AI Edge Gallery → Agent Skills → Skills → + → Load skill from URL:

`https://toymaker474.github.io/html5.github.io/edge-superlab/`

## Performance profiles

- `/eco` — default. Small adaptive demos, 30 FPS target, heavy Python autorun disabled.
- `/balanced` — moderate workloads and 45 FPS target.
- `/turbo` — temporary high-load mode. Never selected automatically.
- `/perf` — show the current profile.

The GPU field now uses a much smaller adaptive particle budget, pauses when hidden, caps its frame rate, and automatically drops quality after sustained low FPS. CPU fallback is deliberately small.

## Main commands

`/selftest`, `/hub`, `/tools`, `/python`, `/packages`, `/programs`, `/notebook`, `/workspace`, `/vision`, `/audio`, `/sql`, `/gpu`, `/lab`, `/wasm`, `/qr`, `/hash`, `/remember`, `/recall`, `/limits`.

## Python Studio Lite

Python Studio loads **Pyodide 0.29.3** only when requested. It is CPython compiled to WebAssembly, not native iOS Python.

The performance build:

- loads packages one at a time instead of pulling a large default bundle,
- warns before heavy imports in ECO,
- uses smaller science/ML/fractal examples,
- caps displayed output,
- runs Python garbage collection after each execution,
- keeps only 20 saved programs,
- suppresses AI-created program autorun in ECO,
- mounts user files only when explicitly selected.

Light first choices are the Python standard library, NumPy, SymPy and NetworkX. SciPy, pandas, Matplotlib, scikit-learn, OpenCV/scikit-image and PyArrow/Polars should be loaded only when needed.

## Execution boundary

A downloaded Edge Gallery skill runs inside the host skill/WebView sandbox. WebAssembly and exposed Web APIs are available; Python works through Pyodide/WASM. The skill does not receive an arbitrary native shell, unrestricted process/filesystem access, or arbitrary native Swift/C++/Metal execution.