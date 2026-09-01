# NEXUS V7 AI Extension Protocol

## Objective

An AI agent may extend NEXUS V7 only by preserving the separation between scientific authority, derived metrics, presentation, and evidence. A feature is not considered implemented because a button, label, graph, particle effect, or animated mesh exists.

## Required reading order

1. `nexus.project.json`
2. `README.md`
3. The authoritative module being changed
4. The corresponding GitHub Actions acceptance gate

## Authority hierarchy

1. **MuJoCo state** — body poses, velocities, contacts, constraints, forces, actuator state and sensors.
2. **Deterministic derived metrics** — displacement, energy, stability, duty factor, fitness and archive descriptors.
3. **Experiment records** — genome, seed, environment, duration, metrics and acceptance result.
4. **Babylon presentation** — meshes, materials, camera, lighting and state-bound visual effects.
5. **Interface labels** — never authoritative by themselves.

A lower level may display or summarize a higher level. It may not silently create, override or fabricate higher-level state.

## Change protocol

### 1. Declare the scientific claim

Write one sentence that can be tested. Example:

> Foot contact changes the neural CPG phase response and measurably alters actuator targets.

Bad claim:

> The feet feel more alive.

### 2. Identify authoritative inputs and outputs

Specify:

- source sensor or state array;
- units;
- update frequency;
- deterministic transformation;
- actuator, metric or visualization receiving the result.

### 3. Implement the smallest complete vertical path

For a new sensor:

```text
MJCF sensor
  → MuJoCo sensor address
  → runtime observation
  → controller input
  → actuator response
  → measured test
  → labeled visualization
```

Skipping any link means the feature remains incomplete.

### 4. Add failure behavior

Missing sensors, invalid geometry, unsupported backends, non-finite values and incompatible schemas must produce a clear failure. Do not replace them with zeros or visual approximations unless the fallback is explicitly specified and tested.

### 5. Add evidence

Evidence must bind to the exact branch commit and include:

- production build result;
- browser boot result;
- scientific metrics relevant to the claim;
- console and page errors;
- screenshot for visual changes;
- deterministic seed when applicable.

## Prohibited shortcuts

- moving Babylon meshes directly to simulate locomotion;
- displaying random values as sensor activity;
- using CSS animation as evidence of simulated dynamics;
- naming a weighted sum a “neural network” without state, topology and inputs;
- claiming evolution from one random mutation;
- evaluating only distance while ignoring energy, falling and stability;
- allowing malformed morphology to reach MuJoCo;
- hiding renderer fallback or device limitations;
- adding generic neon gradients, holograms or glass cards without scientific meaning;
- copying third-party robot meshes into the acceptance path.

## Definition of done

A change is done only when:

- the scientific path is complete;
- its state is inspectable;
- failure is explicit;
- automated evidence passes;
- mobile interaction remains usable;
- the visual treatment follows `VISUAL_STANDARD.md`;
- the project contract is updated when architecture changes.
