# OUROBOROS ECO — Physical Life Experiment

A separate browser artificial-life experiment for GitHub Pages.

## Hard rule

The renderer does not animate organisms. It draws the particle positions produced by the simulation. Locomotion emerges from forces applied by muscle oscillators to articulated bodies under drag, gravity and geometric constraints.

There are no quests, scripted encounters, difficulty managers, spawn-on-boredom rules, sprite animation state machines, or visual locomotion cycles.

## Current simulation

- articulated organisms built from point masses
- segment length constraints and bending constraints
- internal muscle oscillator generates lateral forces
- fluid drag converts body deformation into locomotion
- physical world bounds and seabed collision
- energy/metabolism and starvation
- local sensing of food and smaller organisms
- finite plant energy and regrowth
- physical-range feeding and predation
- health, death and inherited mutation
- reproduction paid from parent energy
- renderer reads solved body geometry directly
- 120 Hz fixed simulation timestep

This is an artificial-life model, not validated biomechanics or biology.
