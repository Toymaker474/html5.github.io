---
name: edge-superlab
description: Performance-tuned local AI workstation for Google AI Edge Gallery on iPhone. Uses lightweight utilities first, optional CPython/Pyodide, adaptive GPU/CPU demos, persistent memory, and iPhone-safe performance profiles.
metadata:
  homepage: https://toymaker474.github.io/html5.github.io/edge-superlab/
---

# Edge SuperLab 4 — iPhone performance build

Use real tool execution instead of pretending a task ran. Keep the phone responsive: use the smallest tool that can solve the request and do not start heavy labs or package downloads unless needed.

## CRITICAL runner contract

Every `run_js` call MUST use:
- `skillName`: `edge-superlab`
- `scriptName`: `ios.html`
- `data`: a STRING containing JSON

Never call `index.html` or `super.html`. Never omit `skillName`.

## Performance profiles

Default to **ECO** on iPhone.

- `/eco` -> `{"action":"perf_set","mode":"eco"}`
- `/balanced` -> `{"action":"perf_set","mode":"balanced"}`
- `/turbo` -> `{"action":"perf_set","mode":"turbo"}`
- `/perf` -> `{"action":"perf_get"}`

ECO favors responsiveness, lower memory, lower heat and 30 FPS labs. BALANCED allows moderate workloads. TURBO is explicit and temporary for demanding demos. Never switch to TURBO automatically. Never run a stress test automatically.

## Commands

- `/hub`, `/mission`, `Superlab` -> `{"action":"hub"}`
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
- `/gpu`, `/sim`, `/compute` -> `{"action":"open_gpu"}`
- `/lab`, `/device` -> `{"action":"open_lab"}`
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
2. Prefer the Python standard library or NumPy. Load SciPy, pandas, Matplotlib, scikit-learn, OpenCV, scikit-image, PyArrow or Polars only when the task actually needs them.
3. Keep iPhone workloads bounded: moderate arrays, moderate image sizes, moderate iteration counts, and concise output.
4. For plots/images, save `/tmp/edge_plot.png` when useful.
5. Call `run_js` using `ios.html` with `{"action":"save_python","name":"short-name","request":"what the user asked","code":"COMPLETE PYTHON SOURCE","autorun":true}`.
6. The runner may suppress autorun in ECO mode. Do not claim execution succeeded until a tool result proves it.

Avoid loading several large Python packages together just to answer a simple question. Do not combine a heavy Python job and the GPU particle lab unless the user explicitly asks.

## Natural routing

Use deterministic compact tools first. Image/photo work can use Vision Lab or one requested Python image library. CSV/table work can use SQLite before pandas. Multi-step experiments can use Notebook. Runtime/GPU support uses selftest/capabilities. Science/math/ML uses Python only when execution materially helps.

## Accuracy boundary

Python here is CPython compiled to WebAssembly through Pyodide, not native iOS Python. Downloaded Edge Gallery skills can use the WebView, WebAssembly and exposed Web APIs, but they do not receive arbitrary shell, unrestricted filesystem, or arbitrary native Swift/C++/Metal execution.