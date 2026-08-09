# NEXUS Morphogenesis V1

A browser artificial-life experiment with one shared creature ruleset and evolvable body plans.

## Files

- `index.html` — app shell and load order
- `styles.css` — mobile UI
- `js/core.js` — world, camera, utilities, runtime state
- `js/spatial.js` — spatial hash for nearby-life queries
- `js/genetics.js` — morphology genome and inherited neural controller
- `js/entities.js` — food, articulated creatures, body renderer, combat/reproduction
- `js/evolution.js` — selection and generation turnover
- `js/render.js` — ocean rendering and HUD
- `js/audio.js` — procedural WebAudio
- `js/ui.js` — controls, pan/zoom, genetic storm
- `js/main.js` — runtime self-tests and animation loop

No CDN or external runtime dependency. Carnivory is an evolved strategy inside the same creature class, not a privileged predator class.
