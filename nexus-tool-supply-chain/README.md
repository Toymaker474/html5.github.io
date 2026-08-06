# NEXUS Tool Exchange

A mobile-first, free/open-source supply chain for tools used by humans and AI agents.

## What this is

NEXUS Tool Exchange treats every tool like a versioned product with a **tool genome**:

- source and license;
- pinned version or commit;
- supported platforms;
- inputs, outputs, commands, and known limits;
- security, reliability, usefulness, mobile quality, openness, documentation, performance, and agent-compatibility traits;
- test evidence and release gates;
- human and agent ratings.

The web app lets users and agents search tools, inspect evidence, copy machine-readable contracts, export the complete registry, and evolve high-quality tool bundles with a deterministic genetic algorithm.

## Why the genetic algorithm is safe

The algorithm does **not** mutate live source code or deploy builds. It recombines verified tool IDs into candidate stacks, scores capability coverage and quality, preserves lineage, and returns ranked bundles. Any code-generating agent remains isolated behind separate branches, tests, evidence, and draft pull requests.

## Supply chain

1. **Discover** — reuse a trustworthy open-source tool first.
2. **Quarantine** — verify source, license, hashes, dependencies, permissions, and platform claims.
3. **Prove** — run deterministic tests, security scans, mobile browser checks, recovery tests, and performance budgets.
4. **Package** — create an AI-readable contract, human instructions, evidence manifest, and portable static package.
5. **Rate** — combine evidence scores with Bayesian user/agent ratings so one fake vote cannot dominate.
6. **Evolve** — breed stronger tool stacks from measured traits.
7. **Promote** — release only when every required gate is current and green.

## Mobile-first today

- static GitHub Pages application;
- iPhone-sized browser verification;
- touch controls and safe-area layout;
- offline application shell;
- no subscriptions, trials, paid APIs, or proprietary model keys;
- JSON contracts that other agents can consume directly.

## Future Windows / ROG Ally X path

The same tool genome will gain platform-specific evidence for:

- signed PowerShell launchers;
- Windows Sandbox or container isolation;
- controller-first interfaces;
- local Ollama/Qwen execution;
- GPU and memory benchmarks;
- crash recovery and Ghost Rewind receipts;
- portable `.nexus-tool` packages;
- verified installation, repair, and uninstall paths.

A web-certified tool does not automatically become Windows-certified. Each platform receives separate evidence and ratings.

## Reputation and future sales

Version 1 uses **reputation credits**, not money. Credits are calculated from evidence, quality score, certification, and ratings. They help agents choose tools without allowing popularity to replace proof.

A later commercial exchange may offer support, hosted execution, private packages, enterprise verification, or paid commercial licenses. The open-source core, source provenance, and safety gates remain available without a subscription.

## Commands

```bash
cd nexus-tool-supply-chain
npm run check
python3 -m http.server 4175
```

Open `http://127.0.0.1:4175` in a browser.

## Main files

- `registry/tools.json` — current tool genomes.
- `schemas/tool-genome.schema.json` — machine-readable format.
- `src/genetic-market.js` — scoring, gating, contracts, and genetic evolution.
- `src/app.js` — marketplace interface.
- `tools/validate-registry.mjs` — fail-closed registry validation.
- `tests/` — deterministic and mobile browser checks.
- `docs/GOVERNANCE.md` — NEXUS/Samantha safety constitution for this product.
- `AGENTS.md` — rules for coding and web agents.
