# NEXUS Tool Scout — 2026-08-06

Status: **research quarantine**. Finding a tool does not certify it.

Rules used:

- fully free/open-source core;
- no subscription or free-trial dependency;
- usable from GitHub Actions or a static web workflow now;
- useful later on Windows / ASUS ROG Ally X;
- source, license, release, hashes, permissions, and behavior must be verified before promotion;
- AI agents never receive automatic production merge authority.

## Wave A — Promote into formal verification next

### 1. OpenCode

- Source: `anomalyco/opencode`
- License: MIT
- Role: terminal coding agent with client/server architecture and local-model support.
- NEXUS value: can run on a future Windows/Ally X host while a mobile web client controls it remotely.
- Verification needed: pin release and hashes; prove Ollama/Qwen compatibility; restrict commands and writable paths; draft-PR-only test.

### 2. Goose

- Source: `aaif-goose/goose`
- License: Apache-2.0
- Role: general-purpose native agent with desktop, CLI, API, Ollama, and MCP extensions.
- NEXUS value: strong future Windows/handheld agent shell and custom NEXUS distribution candidate.
- Verification needed: extension permission inventory, sandbox behavior, local-model quality, controller/mobile remote surface.

### 3. Aider

- Source: `Aider-AI/aider`
- License: Apache-2.0
- Role: Git-native coding agent with local-model support, linting, tests, and reversible diffs.
- NEXUS value: already fits bounded GitHub cloud tasks and later local Qwen work.
- Verification needed: exact current version, model license, no automatic commits/merges, file allowlists, repeatable patch evidence.

### 4. Continue CLI / AI Checks

- Source: `continuedev/continue`
- License: Apache-2.0
- Role: source-controlled AI checks that run as pull-request status checks.
- NEXUS value: turns Samantha rules into versioned Markdown checks enforced in CI.
- Verification needed: local Ollama provider only; reject hosted trial models; test deterministic failure/report behavior.

### 5. Model Context Protocol TypeScript SDK

- Source: `modelcontextprotocol/typescript-sdk`
- License: new code Apache-2.0, existing code MIT; verify exact release files.
- Role: standard agent-readable tools, resources, prompts, clients, and servers.
- NEXUS value: gives every sellable tool a standard interface for other agents.
- Important: production should remain on stable v1.x until v2 is stable; current v2 mainline is pre-alpha.
- Verification needed: pin stable v1.x, validate schemas, enforce authentication and host-header protections, fuzz malformed tool calls.

### 6. Dagger

- Source: `dagger/dagger`
- License: Apache-2.0
- Role: typed, repeatable build/test automation with content-addressed caching and traces.
- NEXUS value: portable pipelines that run in GitHub Actions now and Windows/Ally X containers later.
- Verification needed: Docker/container requirement, resource budgets, no host-destructive mounts, artifact provenance.

### 7. CUE

- Source: `cue-lang/cue`
- License: Apache-2.0
- Role: validate and unify JSON, YAML, OpenAPI, Protobuf, and tool contracts.
- NEXUS value: stronger fail-closed schemas than hand-written JavaScript checks alone.
- Verification needed: define the NEXUS tool-genome policy in CUE; prove invalid or incomplete manifests fail clearly.

### 8. Syft

- Source: `anchore/syft`
- License: Apache-2.0
- Role: generate SPDX/CycloneDX software bills of materials from directories, archives, images, and binaries.
- NEXUS value: exact dependency inventory for every tool package sold or shared with agents.
- Verification needed: pinned signed release, SHA-256 verification, compare SBOM inventory against raw package files.

### 9. Grype

- Source: `anchore/grype`
- License: Apache-2.0
- Role: scan filesystems and SBOMs for known vulnerabilities.
- NEXUS value: consumes Syft evidence and blocks unsafe tool promotion.
- Verification needed: pin latest supported release/database, handle stale database as unknown/blocking, preserve vulnerability DB version.

### 10. OSV-Scanner

- Source: `google/osv-scanner`
- License: Apache-2.0
- Role: vulnerability and dependency-license scanning, with offline database support.
- NEXUS value: validates both security and allowed open-source licenses; useful in web cloud and future offline Windows workflows.
- Verification needed: use scan-only mode first; never run guided remediation automatically on untrusted projects.

### 11. Sigstore / Cosign

- Source: OpenSSF Sigstore projects
- License: open source; verify each exact component.
- Role: keyless signing and public transparency records for release artifacts, binaries, images, and SBOMs.
- NEXUS value: externally anchors evidence so one agent cannot silently rewrite the local ledger.
- Verification needed: GitHub OIDC identity binding, immutable release artifact hash, verification command included with every package.

### 12. OpenSSF Scorecard

- Source: OpenSSF Scorecard
- License: verify exact repository release.
- Role: machine-generated security posture checks for open-source repositories.
- NEXUS value: candidate intake score before trusting a new upstream tool.
- Verification needed: do not treat one score as certification; preserve raw check results and apply NEXUS-specific gates.

## Wave B — Complex web simulation and on-device AI

### 13. Transformers.js

- Source: `huggingface/transformers.js`
- License: Apache-2.0
- Role: run pretrained NLP, vision, audio, and multimodal models directly in browsers.
- NEXUS value: real on-device/mobile-web AI features with no server or paid API.
- Verification needed: model license per model, download size, IndexedDB cache, WebGPU/WebAssembly fallback, iPhone memory and thermal tests.

### 14. ONNX Runtime Web

- Source: `microsoft/onnxruntime`
- License: MIT
- Role: cross-platform accelerated inference, including web backends.
- NEXUS value: common execution layer for agent ratings, classifiers, perception, and future Windows DirectML acceleration.
- Verification needed: WebGPU/WASM fallback matrix, model operator compatibility, deterministic test vectors, memory limits.

### 15. Rapier / Rapier.js

- Source: `dimforge/rapier` and `dimforge/rapier.js`
- License: Apache-2.0
- Role: fast 2D/3D Rust physics with JavaScript/WASM and deterministic variants.
- NEXUS value: lighter alternative to MuJoCo for games, construction systems, destructible tools, and mobile simulations.
- Verification needed: deterministic versus SIMD build comparison, bundle size, iPhone performance, authoritative-state rules.

### 16. Rsbuild / Rspack

- Source: `web-infra-dev/rsbuild`, `web-infra-dev/rspack`
- License: MIT
- Role: high-performance Rust-powered web builds with stable artifacts and webpack compatibility.
- NEXUS value: faster cloud and future Windows builds for large tool/simulation projects.
- Verification needed: compare output correctness and size against Vite before replacing anything; preserve a rollback path.

### 17. Rsdoctor

- Source: `web-infra-dev/rsdoctor`
- License: MIT
- Role: visual and machine-readable bundle/build analysis.
- NEXUS value: finds oversized dependencies and build bottlenecks in complex mobile simulations.
- Verification needed: integrate only after an Rspack/Rsbuild experiment; export evidence rather than rely on dashboard screenshots.

### 18. OpenHands

- Source: `OpenHands/OpenHands`
- License: MIT for the main open-source project; verify exact components.
- Role: autonomous coding platform with sandbox, browser, terminal, and SDK capabilities.
- NEXUS value: future queue-based worker for larger issue-driven jobs.
- Verification needed: heavy resource use, container isolation, network restrictions, local-model behavior, draft-PR-only authority.
- Status: future/heavy; not the first mobile-web worker.

## Quarantine / do not promote yet

### Trivy

- Useful all-in-one scanner, but its own ecosystem reported a critical supply-chain compromise in March 2026.
- Keep in quarantine until a specific patched version, release provenance, archive hash, and clean independent scan are verified.
- NEXUS already has safer coverage through Gitleaks + Syft + Grype + OSV-Scanner.

### Old `opencode-ai/opencode`

- Archived and moved; do not add it.
- The active project is `anomalyco/opencode`.

### MCP v2 pre-alpha

- Do not use the current main branch for production tool contracts.
- Pin stable v1.x until v2 has a stable release and migration tests.

### Hosted model trials

- Do not use Continue trial models, commercial API credits, or any “free trial” provider.
- Use local/open-weight models through Ollama or browser inference only.

## Recommended next verified stack

The strongest first supply-chain bundle to test is:

1. CUE — validates the tool genome and policies.
2. Syft — creates the SBOM.
3. OSV-Scanner — checks vulnerabilities and licenses.
4. Grype — independently scans the SBOM.
5. Sigstore/Cosign — signs the final artifact and evidence.
6. MCP TypeScript SDK v1.x — exposes the verified tool to other agents.
7. Continue AI Checks — enforces Samantha-style review rules on every PR.
8. Dagger — makes the whole pipeline portable and repeatable.

The strongest first web-simulation bundle is:

1. Babylon.js — renderer.
2. Rapier deterministic WASM — lightweight authoritative physics.
3. Transformers.js or ONNX Runtime Web — on-device intelligence.
4. Playwright — phone-sized behavior proof.
5. Lighthouse + bundle budgets — mobile performance gate.
6. NEXUS Evidence Manifest + Final Gate — fail-closed release proof.

## Promotion order

1. CUE
2. Syft
3. OSV-Scanner
4. Grype
5. Sigstore/Cosign
6. MCP TypeScript SDK v1.x
7. Continue AI Checks
8. Dagger
9. OpenCode
10. Goose
11. Transformers.js
12. ONNX Runtime Web
13. Rapier
14. Rsbuild/Rspack/Rsdoctor experiment
15. OpenHands heavy-worker experiment
