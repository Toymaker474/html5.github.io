# GENESIS // CODEHOOD

A browser-native evolutionary programming civilization. Thousands of tiny simulated humanoid agents compete for simulated credits by writing, testing, criticizing, optimizing, and shipping **real executable programs** inside a sandboxed virtual machine.

This project intentionally does **not** use a language-model API and does **not** fake code execution. Agent genomes are executable VM programs. Their rewards come from deterministic execution results.

## What is real in this version

- ASCII/terminal-style humanoid city visualization.
- Builders, critics, testers, optimizers, architects, and security agents.
- Mutation, crossover, lineages, economic rewards, and inheritance.
- Flooding that changes movement, energy use, and economic survival.
- Abstract/non-graphic street conflict and simulated murder events.
- A persistent civilization skill library.
- Program artifacts created by successful agents.
- An in-app program console that executes selected agent/artifact programs.
- Deterministic verification tests plus runtime/instruction limits.
- Browser local-save and JSON state export.

## Safe self-execution model

GENESIS does **not** run arbitrary JavaScript, shell commands, native machine code, `eval()`, or `new Function()`.

Agent programs run in `src/vm.js`, a deliberately tiny stack VM. The VM enforces:

- instruction budget,
- stack-depth limit,
- finite numeric values,
- bounded registers,
- checked jumps,
- divide-by-zero failure,
- deterministic test harnesses.

That means an evolved program can crash **inside the VM** without crashing the webpage or gaining access to browser APIs.

## Run

No build step is required. Serve this directory with any static web server or through GitHub Pages.

For a local server:

```bash
python -m http.server 8080
```

Then open `/genesis-codehood/`.

## Tests

Node 20+:

```bash
cd genesis-codehood
npm test
npm run check
```

The test suite verifies every embedded seed program across 96 deterministic input pairs and confirms that infinite loops are terminated by the VM instruction budget.

## Project structure

```text
genesis-codehood/
├── index.html
├── styles.css
├── package.json
├── README.md
├── src/
│   ├── vm.js          # sandboxed executable instruction machine
│   ├── tasks.js       # curricula + deterministic verification
│   ├── evolution.js   # genomes, agents, mutation, crossover, critics
│   └── main.js        # world simulation + UI + persistence
└── tests/
    └── vm.test.mjs
```

## Next architecture milestone

The next performance step is to move the VM/evolution hot loop to C++ and compile it to WebAssembly while leaving the UI in JavaScript. The VM contract should remain the security boundary so evolved programs never become arbitrary native code.

## Design rule

A capability is not considered learned because an agent says it learned it. It must execute and pass the verifier.
