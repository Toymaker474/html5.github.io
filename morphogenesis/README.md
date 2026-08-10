# NEXUS Morphogenesis V1

Experimental browser artificial life with inherited morphology, inherited neural weights, adaptive cognition, articulated motion, finite feeding, and an inherited living-art layer.

## Current implementation

- Five correlated developmental body families seed coherent anatomy instead of independently randomizing every visible part.
- Body motion is solved in creature-local space with a flexible segmented spine, heading dynamics, turn inertia, and four locomotion modes: tail undulation, limb paddling, ray-like fin waves, and bell-style pulses.
- The core renderer builds one continuous tissue envelope around the articulated spine. Skin gradients, inherited stripes/spots/lateral patterns, belly shading, fins, fleshy two-joint limbs, toes, gills, eyes, whiskers, dorsal spines, tail membranes, and wounds are anchored to anatomical stations.
- `living_art.js` adds inherited visual/physiological traits for skin gloss, iridescence, caustic response, photophores, breathing depth/rate, gill pulse, eye tracking, jaw-muscle emphasis, scar tone, fin-vein intensity, and lateral bioluminescence.
- Breathing now subtly deforms the thoracic body radius; gill openings pulse with respiration and stress; eyes track remembered/current targets; bite contact produces short muscular recoil; healed wounds can remain as fading scars.
- Moving caustic streaks and specular highlights follow articulated body stations instead of being fixed screen-space stickers. Rare lineages can evolve lateral photophores whose brightness reacts to cognitive arousal.
- The world presentation adds soft moving light shafts, depth haze, particulate water, and a restrained vignette without adding external assets or CDN dependencies.
- Eyes still retain inherited size/spread/pupil traits and a blink cycle. Jaws are filled upper/lower structures rotating around a shared hinge; teeth remain attached to the jaw bones.
- Jaws use an explicit open → hold → close → recover cycle. Living-prey damage is only evaluated during the closing phase and only when the mouth is physically in range.
- Plankton is captured at the mouth, visibly moved toward the gut, stored in a stomach, and digested over time. Capture/swallow does not instantly create usable energy.
- Dead creatures create finite carcasses. A carcass bite removes finite biomass and creates a visible morsel that must be swallowed before it reaches the stomach.
- Bites create localized wounds. Wounds reduce locomotor performance, trigger a startle/escape response, remain visible on the body, and heal gradually according to inherited regeneration.
- The cognition layer adds inherited curiosity, fear bias, memory span, learning rate, persistence, social bias, ambush tendency, rest bias, and risk tolerance. Creatures can forage, hunt, scavenge, flee, school, rest, or explore with persistent targets and short-term spatial memories.
- Generation turnover uses offspring/survival-focused fitness plus a bounded phenotype-novelty term. At least one strong representative of each surviving developmental family is preserved, and a gene bank is retained for fail-soft population recovery.
- Predation thresholds, energy conversion, locomotion approximations, environmental productivity, cognition state mechanics, and visual physiology remain authored simulation rules. This is an artificial-life experiment, not validated animal biomechanics or canonical GENESIS biological evolution.

## Verification

`model.test.mjs` deterministically checks developmental ranges, multi-plan diversity, local-space spine stability, all four locomotion modes, closing-jaw food contact, delayed swallowing, localized wounds/startle, finite carcass consumption, gene-bank archiving, and diversity-preserving generation selection.

`cognition.test.mjs` checks persistent behavior state selection, threat memory, hunger-driven foraging, target persistence, and lifetime reinforcement updates.

`living_art.test.mjs` checks inherited living-art traits, breathing deformation, target-tracking state, bite recoil, persistent scar recording, renderer chaining, and HUD integration.

The browser boot sequence is only a runtime sanity check. GitHub Actions provides repository-side automated tests; neither should be described as scientific validation or iPhone Safari verification.

## Files

- `index.html` — app shell and load order
- `styles.css` — mobile UI
- `js/core.js` — world, camera, utilities, runtime state
- `js/spatial.js` — spatial hash
- `js/genetics.js` — developmental morphology genome and inherited neural controller
- `js/entities.js` — plankton, carcasses, articulated creatures, wounds, jaw/swallow mechanics and organic core renderer
- `js/evolution.js` — diversity-aware selection, gene bank, productivity and generation turnover
- `js/render.js` — ocean presentation and HUD
- `js/cognition.js` — memory, persistent behavior states, target choice, and lifetime reinforcement
- `js/living_art.js` — inherited skin/lighting/physiology presentation layer
- `js/audio.js` — procedural WebAudio
- `js/ui.js` — controls, pan/zoom and mutation storm
- `js/main.js` — runtime sanity checks and animation loop
- `model.test.mjs` — deterministic model tests
- `cognition.test.mjs` — deterministic cognition tests
- `living_art.test.mjs` — deterministic living-art tests

No CDN or external runtime dependency.
