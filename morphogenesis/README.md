# NEXUS Morphogenesis V1

Experimental browser artificial life with a shared creature ruleset, inherited morphology, and inherited neural weights.

## Current implementation

- Correlated developmental body plans seed coherent anatomy instead of independently randomizing every visible part.
- Body motion is solved in creature-local space with a flexible segmented spine.
- The renderer builds one continuous tissue silhouette around that spine, then attaches fins, limbs, armor, eyes, whiskers, tail membrane, and jaws at deterministic anatomical stations.
- Jaws use an explicit open → hold → close → recover cycle.
- Feeding is contact-gated: plankton is captured at the mouth, visibly moved toward the gut, then added to a stomach store and digested over time.
- Dead creatures create finite carcasses. Scavengers/predatory lineages must bite carcasses to transfer finite food into the stomach.
- Living-prey damage only occurs during the closing phase of a jaw bite and only when the mouth is physically in range.
- Carnivory, aggression, jaw size, gape, bite speed, sensing, body form, muscle, armor and other traits are inherited and mutable.
- The predation mechanism and its thresholds remain authored simulation rules; this is not claimed as open-ended biological evolution or a validated animal biomechanics model.

## Files

- `index.html` — app shell and load order
- `styles.css` — mobile UI
- `js/core.js` — world, camera, utilities, runtime state
- `js/spatial.js` — spatial hash
- `js/genetics.js` — developmental morphology genome and inherited neural controller
- `js/entities.js` — food, carcasses, articulated creatures, jaw/feeding mechanics
- `js/evolution.js` — selection, world stepping and generation turnover
- `js/render.js` — ocean rendering and HUD
- `js/audio.js` — procedural WebAudio
- `js/ui.js` — controls, pan/zoom and mutation storm
- `js/main.js` — runtime sanity checks and animation loop

No CDN or external runtime dependency.
