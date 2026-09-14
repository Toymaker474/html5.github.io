---
name: neuro-fly-wasm
description: Launch and evolve a native WebAssembly neuro-ecology lab where flies have recurrent brains, forage, avoid a predator, reproduce, and fly through an incompressible wind field. Use for fly brain, artificial life, evolution, neural agents, wind simulation, embodied AI, or complex science mini-app requests.
metadata:
  homepage: https://toymaker474.github.io/html5.github.io/neuro-fly-wasm/
---

# NeuroFly WASM Lab

This skill runs a **C simulation compiled to WebAssembly**. The HTML files are only the Gallery-required loader/UI shell; the simulation, neural controller, ecology, predator, reproduction, and wind solver live in the WASM engine.

## What is simulated

- Up to 64 embodied flies.
- A 12-neuron recurrent controller per fly.
- Bilateral odor sensing, obstacle sensing, predator danger, local wind, and social sensing.
- Food/energy metabolism.
- Birth and death.
- Circular obstacles.
- A moving predator.
- A 40×24 incompressible wind field with advection, diffusion, Jacobi pressure solve, and projection.
- Deterministic genomes from integer seeds.
- Headless scoring so the local model can test/evolve brains before launching the visual lab.

## Brain modes

- `forager`: biases the circuit toward odor-guided food seeking.
- `explorer`: more exploratory turning.
- `swarm`: stronger response to nearby flies.
- `chaos`: highly variable recurrent activity.

## Tool protocol

Call the `run_js` tool with:
- script name: `index.html`
- data: a JSON string with these fields:
  - `action`: `probe`, `evolve`, or `launch`.
  - `seed`: Integer genome seed. Default 42.
  - `population`: Integer 4–48. Default 24.
  - `mode`: `forager`, `explorer`, `swarm`, or `chaos`.
  - `mutation`: Number 0–1. Default 0.18.
  - `wind`: Number 0–3. Default 1.0.
  - `rounds`: Integer 1–3. Used by `evolve`. Default 2.

## Agent interaction loop

For a normal request to create/open the lab, **do not launch immediately**.

1. First call `run_js` with `action: evolve` and choose parameters from the user's request.
2. Read the returned `bestSeed`, `score`, `food`, `births`, and `deaths`.
3. If the score is poor or deaths dominate, adjust **one** of `mode`, `mutation`, or `wind` and call `evolve` one more time.
4. Then call `run_js` with `action: launch`, using the best seed and final parameters.
5. Tell the user to tap the preview card.

This two-stage loop is important: the model is supposed to **measure the program first, then choose what to launch**.

If the user asks to test a specific brain seed, use `action: probe` and report the returned metrics.

## Example

User: "Make a smart fly brain that survives strong wind."

First tool call:
- action: evolve
- seed: 42
- population: 24
- mode: forager
- mutation: 0.22
- wind: 2.2
- rounds: 2

Then use the best returned seed in a second `launch` call.
