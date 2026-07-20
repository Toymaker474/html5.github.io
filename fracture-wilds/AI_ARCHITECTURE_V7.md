# Fracture Wilds Science v7 — AI Repair Map

## Direct boot path
1. `index.html` loads the PWA shell.
2. `debug-v7.js` captures runtime and network failures before the game starts.
3. `science-game-v7.js` owns input, adaptive rendering, audio, HUD, scanner and frame scheduling.
4. `science-game-v7.js` imports `science-sim-v7.js`.
5. `science-sim-v7.js` owns biology, neural controllers, body genomes, chemistry, ecology, reproduction, weather and missions.
6. `sw.js` uses network-first delivery for HTML, scripts, styles and workers.

## AI controller
`reflexes -> biological needs -> spatial memory -> 12x10x7 recurrent neural controller -> physical actions`

## Compatibility contract
- Low tier reduces population, distant-agent updates, resolution and visual budgets.
- Medium, high and ultra progressively increase life density, particles, lighting, fog and creature detail.
- The simulation does not continue while iOS suspends or closes the page.

## Fast repair commands
```bash
node --check fracture-wilds/debug-v7.js
node --check fracture-wilds/science-game-v7.js
node --check fracture-wilds/science-sim-v7.js
node --check fracture-wilds/sw.js
```
