# GENESIS // CODEHOOD FORTRESS

A browser-native evolutionary programming world. Tiny simulated people must survive, earn resources, reproduce, and discover executable programming modules through mutation, testing, selection, and social inheritance.

## What this version is

- A readable 96×48 fortress-style ASCII world with roads, doors, homes, farms, workshops, learning labs, trees, food, high ground, and flood water.
- Happy-face `☺` people instead of anonymous dots.
- Chunked simulation for thousands of agents without all-to-all world scans.
- An evolving survival-policy genome controlling forage/work/shelter/explore/rest/social/fight choices.
- A separate executable program genome running in the sandboxed CodeVM.
- Zero pre-solved program genomes.
- Concrete project modules such as movement, collision, bounce physics, scoring, distance, and scaling.
- Runnable projects that stay locked until every required module is independently evolved and verified.

## Real project ladder

1. **Happy Walker** — tiny movement game.
2. **Coin Chase** — movement + collision + scoring.
3. **Bounce Box** — movement + bounce physics.
4. **Range Inspector** — small verified numeric tool.
5. **Motion Lab** — simulation-oriented motion cartridge.

When a project is unlocked, it executes the civilization's verified genomes at runtime. It is not a canned animation pretending an agent wrote code.

## What “learned” means

A capability is never marked learned because an agent says so or because a progress bar reached a threshold. The evolved program must pass **96/96 deterministic verifier cases** inside the CodeVM. Failed, crashing, looping, or partially correct genomes remain unverified.

## What this is NOT yet

This is genetic program synthesis in a small executable language. It is **not yet an AI that has learned C, C++, Rust, JavaScript, or English syntax from scratch**. Calling CodeVM bytecode “C++ learning” would be fake.

The intended progression is:

```text
CodeVM execution semantics
        ↓
structured tiny C-like language
        ↓
variables / branches / loops / functions
        ↓
compile verified source to WebAssembly
        ↓
C
        ↓
C++ / Rust / JavaScript
        ↓
larger games, tools, and simulations
```

Each stage should only unlock after executable evidence proves the prior stage.

## Safe self-execution

Agent programs do not use `eval`, `new Function`, shell commands, or arbitrary native execution. The CodeVM enforces instruction, stack, register, numeric, jump, and divide-by-zero limits.

## Verification

```bash
cd genesis-codehood
npm test
npm run check
```

Tests cover the 12 project-skill verifiers, VM safety budgets, chunk scheduler, survival-brain shape, runnable project cartridges, and ASCII renderer dimensions.
