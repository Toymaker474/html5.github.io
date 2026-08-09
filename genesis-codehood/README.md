# GENESIS // CODEHOOD ZERO

A chunked browser-native evolutionary programming civilization. Thousands of tiny ASCII humanoid agents must survive a world with food scarcity, jobs, shelter, flooding, danger, reproduction, and abstract street conflict while evolving executable programs in a sandboxed VM.

## The important rule: zero solved programs

This build starts with **no solved programming genomes**. The simulation defines:

- a tiny instruction set,
- deterministic programming objectives/tests,
- survival action primitives,
- environmental rules.

Agents evolve the instruction sequences that solve programming tasks and the numerical policy weights that choose survival behavior. A skill is only labeled learned after the evolved program passes all 96 deterministic verifier cases.

That is not the same thing as unconstrained general intelligence: the world primitives and objectives are designed. But the successful program genomes, lineages, survival strategies, and artifacts are not scripted outcomes.

## Chunked world

The logical world is 1200×800 units split into a 12×8 grid of **96 chunks**. The scheduler processes chunks in small batches and performs a complete occupancy rebuild at the end of each world sweep. This avoids global all-agent neighbor scans and makes larger populations practical in a browser.

Each chunk tracks local population, food, jobs, shelter, danger, flood pressure, births/deaths, and programming attempts. The UI shows both boot progress and live chunk-sweep progress.

## Two evolving genomes per agent

1. **Program genome** — instructions for the sandbox VM. Personal bests are retained, mutated, crossed over, tested, criticized, and inherited.
2. **Survival brain** — 63 evolving weights mapping observations (hunger, flood, food, jobs, shelter, danger, crowding, poverty) to actions (forage, work, shelter, explore, rest, socialize, fight).

Programming success matters to survival because verified work earns simulated credits and successful lineages can afford reproduction.

## Programming curriculum

The zero-seed curriculum contains 12 tasks across five levels. New levels unlock only after the civilization verifies enough earlier skills. No solution program for these tasks is embedded in the runtime.

## Safe self-execution

Agent programs execute only inside `src/vm.js`. The VM has hard instruction, stack, register, numeric, jump, and divide-by-zero limits. It does not use `eval`, `new Function`, shell execution, or arbitrary browser/native code.

## Run

Static hosting is enough:

```bash
python -m http.server 8080
```

Open `/genesis-codehood/`.

## Verify

```bash
npm test
npm run check
```

Tests validate the task verifiers, VM guardrails, chunk grid, occupancy rebuild, scheduler, and survival-brain shape.

## Files

```text
genesis-codehood/
├── index.html
├── styles.css
├── package.json
├── README.md
├── src/
│   ├── vm.js
│   ├── tasks.js
│   ├── brain.js
│   ├── world.js
│   ├── evolution.js
│   └── main.js
└── tests/
    ├── vm.test.mjs
    └── world.test.mjs
```
