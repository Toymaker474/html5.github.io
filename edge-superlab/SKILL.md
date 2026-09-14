---
name: edge-superlab
description: Local AI workstation for Google AI Edge Gallery on iPhone. Runs CPython/Pyodide WebAssembly, saves and executes Python programs, opens notebook/workspace/vision/audio/SQLite/GPU labs, probes device capabilities, generates QR/images, and provides deterministic utilities.
metadata:
  homepage: https://toymaker474.github.io/html5.github.io/edge-superlab/
---

# Edge SuperLab 3.1 — iOS compatibility build

Use real tool execution instead of pretending a task ran.

## CRITICAL: use one runner for EVERYTHING

Every `run_js` call for this skill MUST use exactly these top-level parameters:

- `skillName`: `edge-superlab`
- `scriptName`: `ios.html`
- `data`: a STRING containing JSON

Never call `index.html` or `super.html` for this version. Never omit `skillName`. Never pass `data` as a raw object.

Example:

- `skillName`: `edge-superlab`
- `scriptName`: `ios.html`
- `data`: `{"action":"selftest"}`

The iOS compatibility runner exposes both supported/observed callback names so different Gallery builds can find the skill entry point.

## Commands

- `/hub`, `/mission`, or `Superlab` -> `{"action":"hub"}`
- `/selftest` -> `{"action":"selftest"}`
- `/capabilities` -> `{"action":"capabilities"}`
- `/python` or `/studio` -> `{"action":"open_python"}`
- `/packages` -> `{"action":"packages"}`
- `/programs` -> `{"action":"list_python"}`
- `/notebook` -> `{"action":"open_notebook"}`
- `/workspace` -> `{"action":"open_workspace"}`
- `/vision` -> `{"action":"open_vision"}`
- `/audio` -> `{"action":"open_audio"}`
- `/sql` or `/database` -> `{"action":"open_sql"}`
- `/tools` -> `{"action":"open_tools"}`
- `/gpu`, `/sim`, or `/compute` -> `{"action":"open_gpu"}`
- `/lab` or `/device` -> `{"action":"open_lab"}`
- `/qr <text>` -> `{"action":"qr","text":"..."}`
- `/image` -> `{"action":"image"}`
- `/hash <text>` -> `{"action":"hash","text":"..."}`
- `/wasm` -> `{"action":"wasm"}`
- `/remember <text>` -> `{"action":"memory_put","text":"..."}`
- `/recall [query]` -> `{"action":"memory_get","query":"..."}`
- `/limits` -> `{"action":"limits"}`

## Python creation workflow

For `/py <request>` or a natural request to build/run Python:

1. Generate one complete runnable Python script.
2. Prefer useful libraries available through Pyodide, including NumPy, SciPy, pandas, Matplotlib, SymPy, NetworkX, scikit-learn, Pillow, OpenCV/scikit-image when available, Astropy, statsmodels, Polars and PyArrow.
3. Print meaningful results. For a plot/image, save `/tmp/edge_plot.png` when practical.
4. Call `run_js` with:
   - `skillName`: `edge-superlab`
   - `scriptName`: `ios.html`
   - `data`: `{"action":"save_python","name":"short-name","request":"what the user asked","code":"COMPLETE PYTHON SOURCE","autorun":true}`
5. Wait for the tool result before saying it worked.

Example for an OpenCV request:

- `skillName`: `edge-superlab`
- `scriptName`: `ios.html`
- `data`: `{"action":"save_python","name":"opencv-image-lab","request":"make an image-processing program with opencv","code":"COMPLETE PYTHON SOURCE","autorun":true}`

## Natural routing

- image/photo/filter/computer vision -> Vision Lab or generate Python using Pillow/OpenCV/scikit-image.
- CSV/table/database/query -> SQLite Data Lab or pandas/Polars Python.
- multi-step experiment -> Notebook.
- files/project/scratchpad -> Workspace.
- sound/frequency/waveform/DSP -> Audio Lab.
- runtime/GPU/device support -> selftest/capabilities/device lab.
- science/math/ML/coding where execution helps -> generate and run Python.

## Accuracy boundary

Python in this skill is CPython compiled to WebAssembly through Pyodide, not a native iOS Python process. Downloaded Edge Gallery skills can use the WebView, WebAssembly and Web APIs exposed by the host. Do not claim arbitrary shell, unrestricted filesystem, arbitrary native Swift/C++/Metal execution, or native intents that Edge Gallery has not exposed.