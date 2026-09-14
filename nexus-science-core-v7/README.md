# NEXUS Science Core V7

## Purpose

V7 replaces the browser-game physics architecture with a research-grade robotics and artificial-life stack. Three.js and hand-authored transform motion are not authoritative simulation components.

## Authoritative stack

| Layer | Technology | Responsibility |
|---|---|---|
| Robot dynamics | Google DeepMind MuJoCo 3.10 WASM | Contacts, constraints, articulated bodies, actuators, tendons, friction, sensors, soft contacts, deformables |
| Browser renderer | Babylon.js 9 | WebGPU/WebGL2 rendering, materials, cameras, touch input, post-processing, UI |
| Artificial life | TypeScript now; Rust/WASM planned | Genome, morphology compiler, neural controller, energy economy, reproduction, mutation, ecology |
| Model format | MJCF | Authoritative robot body, joints, actuators, sensors, materials and physical parameters |
| Visual assets | Original glTF/GLB | Render meshes bound to MuJoCo bodies; never used as the source of physics truth |
| Persistence | IndexedDB + deterministic snapshots | Experiments, genome lineage, seeds, rollback and stable-state recovery |

## Non-negotiable rules

1. MuJoCo state is authoritative. Babylon meshes only display MuJoCo body and geometry transforms.
2. No procedural wiggle, sliding-body locomotion, decorative sensors or fake neural activity.
3. A motor moves only through a MuJoCo actuator applying force or torque to a modeled joint.
4. A sensor reads MuJoCo state, contacts, forces, ray results or environmental fields.
5. Energy is debited from measured actuator effort and power, not from a timer.
6. Reproduction compiles a mutated genome into a new MJCF morphology and validates it before spawning.
7. Invalid morphologies, unstable solvers, NaNs, missing sensors and failed model compilation fail closed.
8. Original render meshes may be complex, but collision and inertial geometry must be independently validated.
9. The iPhone profile uses single-threaded MuJoCo WASM and adaptive population limits.
10. The ROG Ally X profile may use native MuJoCo/Webots tooling for larger experiments and offline training.

## Planned architecture

```text
Genome
  -> Morphology compiler
      -> MJCF model
          -> MuJoCo model validation
              -> MuJoCo simulation state
                  -> sensors
                      -> neural controller
                          -> actuator commands
                              -> MuJoCo step
                                  -> Babylon transform bridge
                                      -> rendered machine ecology
```

## First verified vertical slice

The first V7 milestone is one original hexapod machine with:

- six independently actuated two-joint legs;
- joint limits, damping, friction and realistic mass/inertia;
- foot-contact sensors and body orientation sensing;
- oscillator-based neural controller with mutable weights;
- measured actuator power and battery depletion;
- stable walking, falling, recovery and shutdown states;
- Babylon WebGPU renderer with WebGL2 fallback;
- deterministic reset and state snapshot;
- no borrowed robot mesh in the acceptance test.

## Later scientific systems

- MuJoCo flex bodies for cables, tissue-like structures and deformable shells;
- tendons and muscle-like actuators;
- evolution of morphology and control networks;
- material conductivity and thermal fields coupled through custom engine state;
- particle fluids handled by a separate compute subsystem, not decorative sprites;
- batched native experiments on the ROG Ally X, with selected individuals replayed in browser mode.

## Device policy

### iPhone 16 Pro Max

- single-threaded `@mujoco/mujoco` WASM;
- Babylon WebGL2 baseline, optional WebGPU after capability validation;
- low/medium population and fixed-step physics;
- touch-first camera and controls;
- no dependency on SharedArrayBuffer headers.

### ASUS ROG Ally X

- browser V7 for parity testing;
- native MuJoCo Python/C++ or Webots for larger populations, debugging and scientific tooling;
- controller-first front end;
- optional parallel training outside the browser.

## Release gate

V7 cannot replace V6 until automated tests prove:

- MuJoCo loads on mobile-sized Chromium and Safari-compatible single-thread mode;
- every visual body is bound to a MuJoCo body or geom;
- motors, contacts and sensors produce non-zero verified data;
- the robot can move without direct position or rotation animation;
- pause, reset, snapshot and restore preserve authoritative state;
- no console errors, NaNs, unstable energy growth or hidden fallback simulation;
- the build remains playable at the iPhone quality profile.
