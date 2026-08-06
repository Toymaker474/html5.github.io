# NEXUS AI Tool Supply Chain

## What this is

NEXUS should not collect random AI tools or let one model continuously rewrite everything. It should run a trustworthy supply chain that turns free/open-source building blocks into high-quality tools that other humans and agents can discover, test, rate, reuse, and improve.

The immediate target is **mobile web** on Tyler's iPhone. The same tool contracts should later support Windows and controller-first handheld devices without rebuilding the whole system.

## The supply chain in normal language

1. **Find** — search existing free/open-source projects before building anything new.
2. **Inspect** — verify source location, license, maintenance state, dependencies, and security risks.
3. **Pin** — record exact versions, commits, hashes, and download sources.
4. **Adapt** — wrap the source in a clear NEXUS tool contract instead of forking it blindly.
5. **Build** — create a static web/PWA tool first whenever the job can be done in a browser.
6. **Test** — test real inputs, mobile touch use, accessibility, speed, offline behavior, and failure handling.
7. **Package** — publish an AI-readable manifest, human README, evidence bundle, version, and immutable hash.
8. **List** — place the verified package in the NEXUS Agent Tool Exchange.
9. **Use** — other agents call the tool through explicit inputs and outputs rather than screen-scraping or guessing.
10. **Rate** — collect verified run results, human usefulness ratings, agent compatibility ratings, and failure reports.
11. **Improve** — select one bounded improvement using the fitness system below.
12. **Propose** — open a draft pull request. Never self-merge or silently replace the currently trusted version.

## Layered architecture

### 1. Foundation

- GitHub repository and immutable commit history
- MIT/Apache/BSD-compatible source policy where possible
- content hashes and evidence manifests
- non-destructive branch and draft-PR workflow
- static GitHub Pages/PWA delivery
- mobile-first accessibility and touch rules

### 2. Core services

- source and license scanner
- dependency and vulnerability scanner
- deterministic build runner
- browser/device test runner
- evidence and receipt generator
- package signer/hash manifest
- tool registry and version resolver
- ratings and failure ledger

### 3. Developer tools

- Tool Foundry for missing capabilities
- manifest/schema generator
- prompt-to-tool-contract translator
- test generator with deterministic verification
- mobile bundle-budget checker
- performance profiler
- compatibility matrix generator
- plain-language report translator

### 4. AI systems

- web review agent using a free/open model when compute permits
- deterministic orchestrator that decides what tools may run
- bounded improvement planner
- genetic selection/ranking module
- red-team critic that cannot edit code
- verifier that receives evidence but cannot build

### 5. User applications

- mobile Tool Exchange
- tool detail and evidence viewer
- agent compatibility tester
- visual workflow builder
- one-tap PWA launcher
- controller-friendly Windows/handheld shell later

### 6. Simulations and games

Simulations and games consume verified tools from the layers above. They do not own duplicated build, testing, AI, evidence, or packaging systems.

## Tool Exchange: "sell to other agents"

The first version is a free/open-source exchange. "Selling" means publishing a dependable tool that other agents choose because it has strong proof, clear contracts, good ratings, and low friction.

Every listing contains:

- name and one-sentence purpose;
- exact version and source commit;
- license and attribution;
- supported devices and browsers;
- machine-readable input/output schema;
- examples and expected failure responses;
- security permissions;
- performance and bundle size;
- test/evidence links and hashes;
- human rating;
- agent compatibility rating;
- verified successful-run count;
- known limitations;
- replacement/migration information.

A later business layer may offer paid hosting, support, customization, or verified enterprise packaging, but the core tool source and local/static use remain free. No subscription or trial is required for the current system.

## Ratings that are difficult to fake

A single five-star score is weak. NEXUS uses several separate ratings:

- **Correctness:** deterministic tests passed.
- **Reliability:** successful verified runs divided by total verified runs.
- **Usefulness:** human rating after real use.
- **Agent fit:** how many independent agents can use the declared contract without custom repair.
- **Mobile quality:** touch size, load time, memory use, frame rate, and layout stability.
- **Clarity:** whether failures and outputs are understandable.
- **Safety:** permissions, dependency risk, secret handling, and destructive capability.
- **Reuse:** number of different projects using the tool without code duplication.

Ratings are bound to a specific tool version and artifact hash. A new version starts with inherited history clearly marked as prior-version evidence, not fresh proof.

## Controlled genetic algorithm

The genetic algorithm does not mutate arbitrary production code. It evolves small, replaceable tool modules and interface variants.

### Genome

A tool genome is its manifest plus allowlisted choices such as:

- algorithm implementation;
- UI layout variant;
- prompt/instruction template;
- input normalization rules;
- error explanation style;
- performance parameters;
- device adaptation settings;
- test cases;
- optional feature flags.

### Population

The system may keep several candidate branches or generated artifacts for one tool. Each candidate has a parent version, mutation description, test evidence, and hash.

### Fitness

Fitness combines verified facts:

- deterministic correctness;
- reliability;
- mobile performance;
- usefulness ratings;
- agent compatibility;
- accessibility;
- reuse value;
- security and complexity penalties.

AI opinions may suggest mutations, but they do not contribute proof points by themselves.

### Selection

- reject any candidate that fails a required safety or correctness gate;
- preserve the current known-good version;
- compare candidates on the same test set and device profile;
- promote only a candidate with a measurable improvement and no unaccepted regression;
- keep diversity when two candidates serve different device or workload needs;
- require review before a selected candidate can replace a trusted version.

### Mutation limits

- one bounded improvement per cycle;
- allowlisted files only;
- no workflow, constitution, credential, or production-branch mutation;
- no new dependency without a separate review;
- no automatic merge;
- automatic rollback to the previous trusted hash when post-merge verification fails.

## Device plan

### Mobile web now

- iPhone-size viewport tests
- Safari-safe WebGL2/WASM fallback
- installable PWA where useful
- one-thumb controls and 44-pixel minimum touch targets
- adaptive quality and strict bundle budgets
- static/offline operation whenever possible

### Windows and handheld later

The same manifest describes optional adapters for:

- Chromium/Edge PWA;
- Windows packaged web app;
- local Ollama/llama.cpp acceleration;
- controller navigation;
- larger WebGPU workloads;
- file-system and local-tool bridges behind explicit capabilities;
- ASUS ROG Ally X and future Windows/Xbox-style handheld profiles.

The web version remains the portable source of truth. Native adapters add capabilities; they do not replace the tested web contract.

## Fail-closed release rule

A tool cannot be marked verified when evidence is missing, stale, conflicting, generated by the same unseparated role, or bound to a different artifact hash. Failed checks create a repair task and preserve the previous trusted tool.
