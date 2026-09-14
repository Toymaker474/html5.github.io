# Edge Forge Brain — Google AI Edge Gallery Skill

A mobile-first Agent Skill that gives a local Gemma model:
- persistent skill memory (`/learn`, `/memory`)
- self-contained HTML/JS program generation and sandboxed execution (`/make`, `/run`)
- an interactive neural flying-agent lab using a genetic algorithm (`/fly`, `/train`)
- saved champion-brain stats (`/brain`)
- export/reset helpers

## Important distinction
This skill does **not** fine-tune Gemma's model weights. `/learn` stores persistent skill memory. `/train` evolves a separate small neural network that controls the flying agent.

## Folder layout
edge-forge-brain/
  SKILL.md
  .nojekyll
  scripts/index.html
  assets/program.html
  assets/fly.html

## Easiest iPhone install: GitHub Pages
1. Put this entire folder in a GitHub repository.
2. Enable GitHub Pages from the repository's main branch/root.
3. Keep the included `.nojekyll` file.
4. In Google AI Edge Gallery: Agent Skills → Skills → + → Load skill from URL.
5. Enter the Pages URL for this folder, without `/SKILL.md`.

Example:
https://toymaker474.github.io/html5.github.io/edge-forge-brain

Verify first that this opens as plain text:
https://toymaker474.github.io/html5.github.io/edge-forge-brain/SKILL.md

## Try
/help
/learn I like high-agency science simulations
/make a touch-controlled particle gravity sandbox
/run
/train fast
/brain
