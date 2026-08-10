# NEXUS Morphogenesis V1

Experimental browser artificial life with a shared creature ruleset, inherited morphology, inherited neural weights, articulated motion, and finite feeding.

## Current implementation

- Five correlated developmental body families seed coherent anatomy instead of independently randomizing every visible part.
- Body motion is solved in creature-local space with a flexible segmented spine, heading dynamics, turn inertia, and four locomotion modes: tail undulation, limb paddling, ray-like fin waves, and bell-style pulses.
- The renderer builds one continuous tissue envelope around the articulated spine. Skin gradients, inherited stripes/spots/lateral patterns, belly shading, fins, fleshy two-joint limbs, toes, gills, eyes, whiskers, dorsal spines, tail membranes, and wounds are all anchored to anatomical stations.
- Eyes have inherited size/spread/pupil traits and a blink cycle. Jaws are filled upper/lower structures rotating around a shared hinge; teeth stay attached to the jaw bones.
- Jaws use an explicit open → hold → close → recover cycle. Living-prey damage is only evaluated during the closing phase and only when the mouth is physically in range.
- Plankton is captured at the mouth, visibly moved toward the gut, stored in a stomach, and digested over time. Capture/swallow does not instantly create usable energy.
- Dead creatures create finite carcasses. A carcass bite removes finite biomass and creates a visible morsel that must be swallowed before it reaches the stomach.
- Bites create localized wounds. Wounds reduce locomotor performance, trigger a startle/escape response, remain visible on the body, and heal gradually according to inherited regeneration.
- Predatory behavior is hunger-sensitive and pays extra metabolic costs for carnivory, jaws, armor, sensing, and muscle. Prey can flee, startle, school, armor up, or out-reproduce predators.
- Generation turnover uses offspring/survival-focused fitness plus a bounded phenotype-novelty term. At least one strong representative of each surviving developmental family is preserved, and a gene bank is retained for fail-soft population recovery.
- Carnivory, aggression, jaw geometry, gape, bite speed, sensing, body form, muscle, armor, locomotion, patterns, startle response and other traits are inherited and mutable.
- Predation thresholds, energy conversion, locomotion approximations, and environmental productivity remain authored simulation rules. This is an artificial-life experiment, not validated animal biomechanics or canonical GENESIS biological evolution.

## Verification

`model.test.mjs` deterministically checks developmental ranges, multi-plan diversity, local-space spine stability, all four locomotion modes, closing-jaw food contact, delayed swallowing, localized wounds/startle, finite carcass consumption, gene-bank archiving, and diversity-preserving generation selection.

The browser boot sequence is only a runtime sanity check. GitHub Actions provides the repository-side automated test; neither should be described as scientific validation or iPhone Safari verification.

## Files

- `index.html` — app shell and load order
- `styles.css` — mobile UI
- `js/core.js` — world, camera, utilities, runtime state
- `js/spatial.js` — spatial hash
- `js/genetics.js` — developmental morphology genome and inherited neural controller
- `js/entities.js` — plankton, carcasses, articulated creatures, wounds, jaw/swallow mechanics and organic renderer
- `js/evolution.js` — diversity-aware selection, gene bank, productivity and generation turnover
- `js/render.js` — ocean presentation and HUD
- `js/audio.js` — procedural WebAudio
- `js/ui.js` — controls, pan/zoom and mutation storm
- `js/main.js` — runtime sanity checks and animation loop
- `model.test.mjs` — deterministic model tests

No CDN or external runtime dependency.
