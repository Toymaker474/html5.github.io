---
name: micro-cosmos
description: Open an interactive pocket science lab with live fluid waves, orbital gravity, reaction-diffusion chemistry, and wave physics. Use when the user asks for a tiny physics app, science toy, fluid sim, space sim, chemistry pattern, waves, or a cool interactive simulation.
metadata:
  homepage: https://toymaker474.github.io/html5.github.io/micro-cosmos/
---

# Micro Cosmos

A tiny interactive science app that runs inside the AI Edge Gallery chat preview.

## Prompts / Triggers
- "Open Micro Cosmos"
- "Make a tiny fluid sim"
- "Show me a gravity sandbox"
- "Run reaction diffusion"
- "Make a wave lab"
- "Give me a cool physics mini app"

## Instructions

Call the `run_js` tool with:
- script name: `index.html`
- data: a JSON string with these fields:
  - `mode`: String. One of `fluid`, `gravity`, `reaction`, `waves`.
  - `intensity`: Number from 0.5 to 2.0. Default 1.0.
  - `seed`: Integer. Default 42.

Choose the mode from the user's request. If they just ask to open the app, use `fluid`.
After the tool succeeds, tell the user to tap the preview card and interact with the simulation.
