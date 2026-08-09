# GENESIS // CODEHOOD FORTRESS

A browser-native evolutionary programming world. Tiny simulated people must survive, earn resources, reproduce, and discover executable programs through mutation, testing, selection, and social inheritance.

## What is real now

- A readable 96×48 fortress-style ASCII world with roads, doors, homes, farms, workshops, labs, trees, food, high ground, and flooding.
- Happy-face `☺` people instead of anonymous dots.
- Chunked simulation for thousands of agents without all-to-all world scans.
- An evolving survival-policy genome controlling forage/work/shelter/explore/rest/social/fight choices.
- **TinyC source-code genomes** represented as structured syntax trees.
- TinyC supports variables `a`/`b`, constants, `+`, `-`, `*`, `min`, `max`, equality, greater-than, absolute value, negation, and return expressions.
- Each TinyC candidate is compiled into the sandboxed CodeVM and actually executed.
- Zero solved programs are loaded.
- A capability is learned only after the evolved source compiles and passes 96/96 deterministic verifier cases.
- Runnable projects stay locked until every required evolved module is verified.

## Example of what an agent can genuinely evolve

```c
int step_right(int a, int b) {
  return (a + 1);
}
```

The grammar and available operators are designed by us; that source solution is not preloaded. Mutation and crossover operate on the program tree, compilation produces VM instructions, and the verifier decides whether the behavior is correct.

## Real project ladder

1. **Happy Walker** — tiny movement game.
2. **Coin Chase** — movement + collision + scoring.
3. **Bounce Box** — movement + bounce physics.
4. **Range Inspector** — small verified tool.
5. **Motion Lab** — simulation-oriented cartridge.

When a project is unlocked, it calls the civilization's verified evolved TinyC modules at runtime.

## What this is NOT yet

TinyC is intentionally small. It is not yet full C, C++, Rust, JavaScript, or an English-speaking language learner. It does not yet invent whole multi-file applications, APIs, classes, memory allocators, or arbitrary game architectures from scratch.

The next honest progression is:

```text
TinyC expressions                     ← CURRENT
        ↓
statements + local variables
        ↓
if / loops / functions
        ↓
arrays + structured memory
        ↓
compile source to WebAssembly
        ↓
C subset
        ↓
C++ / Rust / JavaScript targets
        ↓
multi-file games, tools, simulations
```

Each stage should unlock only after executable evidence proves the previous stage.

## Safe self-execution

Generated code does not use `eval`, `new Function`, shell commands, or arbitrary native execution. TinyC compiles into CodeVM, which enforces instruction, stack, register, numeric, jump, and divide-by-zero limits.

## Verification

```bash
cd genesis-codehood
npm test
npm run check
```

Tests cover TinyC AST generation/mutation/crossover/compilation, all 12 project-skill verifiers, VM safety budgets, chunk scheduling, survival-brain shape, runnable project cartridges, and ASCII renderer dimensions.
