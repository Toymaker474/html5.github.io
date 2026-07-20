# Fracture Wilds v6 AI Debug Map

Public boot path:

`index.html → debug.js → game.js → sim.js`

- `game.js`: controls, HUD, renderer and animation loop.
- `sim.js`: procedural tiles, physics, creature brains, predator/prey AI, food, dens and rain.
- `debug.js`: global error capture, asset latency tests, cache repair and JSON report export.
- `sw.js`: network-first scripts, styles and workers with offline fallback.

Quick checks:

```bash
node --check fracture-wilds/debug.js
node --check fracture-wilds/game.js
node --check fracture-wilds/sim.js
node --check fracture-wilds/sw.js
```
