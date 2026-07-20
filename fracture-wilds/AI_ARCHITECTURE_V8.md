# Fracture Wilds Organism v8 — Repair Map

## Boot path
1. `index.html` loads the mobile field interface.
2. `debug-v8.js` captures runtime failures and tests every public asset.
3. `organism-game-v8.js` owns input, audio, HUD, adaptive quality and the fixed-step loop.
4. `organism-render-v8.js` owns terrain chunks, plants, segmented creatures, atmosphere, water and device LOD.
5. `organism-world-v8.js` owns ecology, animal behavior, collisions, weather, research and nutrient cycling.
6. `organism-creatures-v8.js` owns genomes, body state, feet, gait state and the 14→12→8 recurrent controller.
7. `organism-plants-v8.js` owns soil water, nutrients, roots, biomass, fruit, grazing, seed dispersal and decay.
8. `organism-core-v8.js` owns constants, deterministic noise, biomes, animal roles and plant species.

## Creature decision stack
`reflex and reaction delay → health / hunger / thirst / fatigue / fear → spatial memory → activity cycle → recurrent brain → slow physical intent → acceleration / stride / footing`

## Plant cycle
`soil moisture + nutrients + temperature + light → photosynthesis → biomass + roots → fruit → wind dispersal → seedlings → grazing / aging → organic matter → mineral nutrients`

## Performance contract
- Low: about 54 creatures and 180 plants with simplified lighting and distant-agent throttling.
- Medium: about 78 creatures and 280 plants.
- High: about 104 creatures and 390 plants.
- Ultra: about 132 creatures and 520 plants with higher resolution, fog, glow and organism detail.
- Physics remains fixed at 60 Hz. Rendering follows the display refresh rate and changes quality automatically.
- iOS suspension pauses the biosphere; no background evolution is claimed.

## Fast checks
```bash
node --check fracture-wilds/organism-core-v8.js
node --check fracture-wilds/organism-plants-v8.js
node --check fracture-wilds/organism-creatures-v8.js
node --check fracture-wilds/organism-world-v8.js
node --check fracture-wilds/organism-render-v8.js
node --check fracture-wilds/organism-game-v8.js
```
