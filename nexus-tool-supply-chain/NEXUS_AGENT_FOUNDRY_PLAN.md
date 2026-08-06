# NEXUS Agent Foundry — Web-First Open Tool Economy

## Mission

Build a free, open-source, phone-first web platform that can discover tools, verify them, create missing tools, run local browser AI, build WebGPU/WebAssembly software, publish testable GitHub.io demos, and improve its own toolchain through measured experiments.

The system must help humans and AI agents. It must never claim success without evidence, never silently change the live site, and never let a model self-certify its own work.

## Plain-language architecture

```text
                              TYLER — ARCHITECT
                         vision, priorities, final authority
                                      |
                                      v
+--------------------------------------------------------------------------------+
|                         NEXUS AGENT FOUNDRY                                    |
|                                                                                |
|  [1] DISCOVER          [2] VERIFY             [3] BUILD MISSING TOOLS          |
|  GitHub / docs /       license, hashes,       small reusable source tools      |
|  open model catalogs   tests, security        when no good tool exists         |
|          |                    |                         |                       |
|          +--------------------+-------------------------+                       |
|                                      |                                         |
|                                      v                                         |
|  [4] TOOL REGISTRY  --->  [5] AGENT CONTRACTS  --->  [6] TOOL EXCHANGE         |
|  versions, scores,       MCP tools + A2A cards       ratings, reputation,       |
|  platforms, evidence     human docs + schemas        verified bundles           |
|                                      |                                         |
|                                      v                                         |
|  [7] GENETIC TOOL LAB                                                       |
|  create candidate tool bundles -> test all -> compare fitness -> preserve best |
|  mutation means controlled configuration/code proposals, never live mutation   |
|                                      |                                         |
|                         +------------+------------+                            |
|                         |                         |                            |
|                         v                         v                            |
|                [8] WEB DEMO FORGE       [9] CLOUD WORKERS                     |
|                GitHub.io / PWA           GitHub Actions                       |
|                WebGPU / WASM             builds, tests, screenshots, AI review |
|                         |                         |                            |
|                         +------------+------------+                            |
|                                      |                                         |
|                                      v                                         |
|                         [10] EVIDENCE + RELEASE GATE                            |
|                    receipts, screenshots, benchmarks, hashes                    |
|                         red = repair, green = draft PR                          |
+--------------------------------------------------------------------------------+
                                      |
                         FUTURE VERIFIED EXPORTS
                                      |
              +-----------------------+------------------------+
              v                       v                        v
      Windows / Ally X          Xbox-style handheld       Other AI agents
      native worker             controller-first UI       MCP / A2A / CLI / SDK
```

## What runs where

### GitHub.io and mobile browser

Runs without a paid server:

- PWA interface, offline cache and touch/controller UI.
- WebGPU graphics and compute where supported, with WebGL/WASM fallback.
- WebAssembly modules and sandboxed workers.
- Small local browser models.
- Python through Pyodide.
- Local storage through OPFS, IndexedDB and SQLite WASM.
- Analytics through DuckDB WASM.
- Tool registry, ratings, contracts, demos and evidence viewer.
- A PowerShell-compatible safe command language implemented by NEXUS.

A static GitHub.io page cannot honestly run modern native `pwsh.exe`. The web product will therefore provide a real parser, pipelines, variables, objects, files and safe commands in-browser. Actual PowerShell execution is reserved for a Windows worker or isolated cloud runner.

### GitHub Actions cloud workers

Runs automatically in temporary Linux machines:

- npm/Rust/Python builds.
- Playwright mobile browser tests.
- Lighthouse audits.
- Gitleaks and dependency/security checks.
- Ollama plus a small open model for advisory review.
- Aider/OpenHands/Cline-style bounded coding jobs.
- Screenshot, benchmark, bundle and evidence generation.
- Draft branches and draft pull requests only.

### Future Windows / ASUS ROG Ally X worker

Adds capabilities that browsers cannot provide:

- Real PowerShell, Win32 and .NET tools.
- Native llama.cpp/Ollama models.
- GPU-heavy compilation and simulation profiling.
- Controller testing and packaged Windows builds.
- Sandboxed native tool execution.

## Verified open-source foundation

### Browser-local AI

- WebLLM — WebGPU LLM runtime with an OpenAI-style API.
- Transformers.js — browser ML with WASM and WebGPU.
- ONNX Runtime Web — portable inference through WASM, WebGPU and WebNN.
- SmolLM2 360M — fast helper/classifier/planner candidate.
- SmolLM2 1.7B — stronger browser reasoning and tool-call candidate.
- Qwen 0.5B/1.5B WebLLM variants — coding and structured-output candidates.

### Browser programming and compute

- Pyodide — CPython and scientific packages in WebAssembly.
- Web Workers and Shared Workers — isolation and background computation.
- WebGPU — graphics, particles, fields, neural inference and compute kernels.
- Babylon.js — high-quality WebGPU/WebGL simulation rendering.
- MuJoCo WASM — authoritative robot and rigid-body physics.
- v86 — x86-to-WASM browser computer emulator for Linux/FreeDOS experiments.
- xterm.js — accessible terminal presentation layer; it is not a shell by itself.

### Browser data and persistence

- SQLite WASM plus OPFS — durable structured local state.
- DuckDB WASM — fast local analytics, ranking and evidence queries.
- IndexedDB/Cache Storage — model and asset caches.
- JSON Schema — machine-checkable tool contracts.

### Agent construction and interoperability

- OpenHands Software Agent SDK — model-agnostic coding-agent framework.
- Aider — Git-aware coding agent that supports local models.
- Cline CLI/SDK — headless agent and integration engine.
- MCP TypeScript SDK v1 — tools, resources and prompts for other AI clients.
- A2A protocol — agent cards, discovery and long-running agent tasks.

### Verification and supply-chain safety

- GitHub Actions — temporary cloud builders.
- Playwright — real browser interaction and phone-size tests.
- Lighthouse CI — web quality evidence.
- Gitleaks — credential scanning.
- npm audit and CodeQL — dependency and code security checks.
- SHA-256 manifests — evidence and download identity.
- License allowlist — MIT, Apache-2.0, BSD and other reviewed licenses.

## Products to build

### 1. NEXUS Agent Workbench

A phone-first PWA where a user can choose a goal, select tools, run a local model, inspect steps and export an agent contract.

### 2. NEXUS Tool Genome Lab

A visual genetic laboratory that evolves tool bundles. Fitness includes reliability, usefulness, security, speed, mobile quality, documentation, openness, agent compatibility and user ratings.

### 3. NEXUS WebShell

A safe PowerShell-inspired shell using xterm.js. It supports commands, objects, pipelines, variables, scripts, a virtual filesystem and permission-scoped tools. It never pretends to be native PowerShell.

### 4. NEXUS WASM Forge

Imports Rust/C/C++/Python-compatible modules, validates licenses and hashes, generates wrappers, runs tests and publishes tiny reusable browser plugins.

### 5. NEXUS WebGPU Lab

Reusable compute kernels and visual systems for particles, fluids, fields, cellular automata, neural agents, robotics and scientific simulations.

### 6. NEXUS Demo Forge

Every accepted tool must produce a playable or interactive GitHub.io demonstration, phone screenshots, benchmark results, a failure report and an AI-readable contract.

### 7. NEXUS Agent Exchange

A registry that lets agents discover and invoke tools through MCP and collaborate through A2A. Initial currency is reputation and usage credits, not fake money. Real revenue is collected from people and organizations buying support, customization, packaged native editions or managed agent work.

## Self-improvement loop

```text
Observe real failures and ratings
            |
            v
Generate several small improvement proposals
            |
            v
Create isolated branches/worktrees
            |
            v
Build + lint + security scan + browser test + benchmark
            |
            v
Compare against the last known-good version
            |
      +-----+-----+
      |           |
 worse/unknown   measurably better
      |           |
 quarantine      draft PR + evidence
      |           |
      +-----+-----+
            |
     Tyler approves release
```

The model may propose changes to its prompts, policies, routing, code and tool choices. It may not directly overwrite the running production system. Improvement is accepted only when independent tests show a measurable gain without breaking safety, quality or device performance.

## Genetic algorithm

A tool or bundle genome contains:

- tool IDs and pinned versions;
- model and quantization;
- prompts and routing policy;
- WASM/WebGPU modules;
- memory and cache limits;
- device targets;
- test suite and evidence requirements.

Selection uses verified fitness, not model confidence. Elite candidates are preserved. Mutation changes one bounded trait at a time. Crossover combines compatible verified traits. Failed candidates remain available for diagnosis but cannot enter a release.

## Roadmap

### Phase 1 — Foundation

- Finish the tool registry and license/source verifier.
- Add MCP contracts and A2A agent cards.
- Add OPFS/SQLite persistence.
- Add deterministic tests for the genetic engine.

### Phase 2 — First public web product

- Publish the Agent Workbench and Tool Genome Lab as a separate GitHub.io preview.
- Add touch-first UI, offline support and human-language status reports.
- Add browser capability detection and quality presets for iPhone.

### Phase 3 — WebShell

- Build the PowerShell-inspired parser, object pipeline and virtual filesystem.
- Add safe command permissions and rewindable history.
- Add Pyodide and WASM command adapters.

### Phase 4 — Local browser brain

- Add a tiered model router: 360M helper, 1.7B planner and optional larger desktop model.
- Add structured JSON generation, tool calling and retrieval over local docs.
- Benchmark memory, startup and tokens per second on iPhone and desktop.

### Phase 5 — WASM and WebGPU tool factory

- Build plugin templates, kernel tests and performance budgets.
- Publish reusable physics, particles, fields, fluid, graph and agent modules.
- Create demos automatically from verified templates.

### Phase 6 — Autonomous cloud builder

- Run bounded Aider/OpenHands/Cline jobs in GitHub Actions.
- One goal, one branch, one small change per run.
- No automatic merging or production deployment.

### Phase 7 — Agent exchange and reputation

- Publish searchable tool cards, ratings, benchmarks, evidence and compatibility.
- Allow MCP clients and A2A agents to request tasks.
- Add anti-spam, provenance and signed result receipts.

### Phase 8 — Windows and handheld edition

- Add an isolated Windows worker with real PowerShell and local models.
- Add controller-first UI and Ally X performance profiles.
- Package verified tools without weakening browser compatibility.

## Getting stars and real users

- One clear flagship product instead of unrelated repositories.
- Instant live demo with no sign-up.
- Excellent phone experience.
- Honest benchmark dashboard and failure history.
- Copy-paste agent contracts and small SDK examples.
- Weekly useful tool releases, not cosmetic commits.
- Screenshots, short demos and reproducible science examples.
- Good issue templates, contribution tasks and public roadmap.

## Revenue without locking the core

The open-source browser core stays free. Possible paid products later:

- custom agent/tool development;
- verified enterprise tool packs;
- private deployment and security hardening;
- Windows/handheld packaged edition;
- managed continuous agent work;
- training, integration and support;
- marketplace transaction fee only when real buyers and sellers exist.

Stars, ratings and revenue are goals, not proof of quality. Releases still require tests and evidence.

## Definition of done for every tool

A tool is not accepted until it has:

1. source and license records;
2. a pinned version or source commit;
3. human-readable documentation;
4. an AI-readable JSON/MCP contract;
5. deterministic tests;
6. security and permission boundaries;
7. a phone-friendly live demo when applicable;
8. benchmark and bundle-size evidence;
9. failure messages in normal language;
10. a rollback path and immutable evidence manifest.
