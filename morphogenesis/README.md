# NEXUS Morphogenesis V1

Experimental browser artificial life with inherited morphology, inherited neural weights, adaptive cognition, articulated motion, finite feeding, and a deliberately authored creature-rendering layer.

## Current implementation

- Five correlated developmental body families seed coherent anatomy instead of independently randomizing every visible part.
- `kinetic_creatures.js` replaces the generic one-envelope creature presentation with five authored silhouette families: eel swimmer, lizard/amphibious swimmer, ray glider, armored hunter, and bell/softbody form.
- Genetics still control body proportions, color, pattern, eyes, limbs, fins, jaws, teeth, tail, armor, wounds, photophores and motion, but each body family enforces its own visual grammar so organisms read as animals rather than arbitrary geometry.
- The rendering direction follows the same discipline as the repository's Kinetic Wild experiment: strong readable silhouette first, coherent anatomy second, state animation third, restrained effects last. It does not copy Kinetic Wild assets or simulation code.
- Body motion is solved in creature-local space with a flexible segmented spine, heading dynamics, turn inertia, and four locomotion modes: tail undulation, limb paddling, ray-like fin waves, and bell-style pulses.
- Lizard-like forms use paired articulated limbs and toes; eel forms emphasize continuous body curvature and a designed tail; ray forms use a coherent wing membrane; armored forms use repeated plate anatomy; bell forms use a pulsing softbody silhouette and trailing tentacles.
- Eyes track current cognition targets when available. Jaws use the real `mouthOpen` bite state, so the drawn mouth opens/closes with the feeding mechanism rather than playing an unrelated animation.
- `living_art.js` still supplies inherited breathing, gill, scar, gloss, iridescence and bioluminescent state used by the authored renderer.
- Jaws use an explicit open → hold → close → recover cycle. Living-prey damage is only evaluated during the closing phase and only when the mouth is physically in range.
- Plankton is captured at the mouth, moved toward the gut, stored in a stomach, and digested over time. Dead creatures create finite carcasses; bites remove finite biomass.
- Bites create localized wounds. Wounds reduce locomotor performance, trigger a startle/escape response, remain visible, and heal according to inherited regeneration.
- The cognition layer adds inherited curiosity, fear bias, memory span, learning rate, persistence, social bias, ambush tendency, rest bias, and risk tolerance. Creatures can forage, hunt, scavenge, flee, school, rest, or explore with persistent targets and short-term spatial memories.
- Generation turnover uses offspring/survival-focused fitness plus a bounded phenotype-novelty term. Strong representatives of surviving developmental families are preserved, and a gene bank is retained for fail-soft population recovery.
- Predation thresholds, energy conversion, locomotion approximations, environmental productivity, cognition mechanics, and visual anatomy remain authored simulation rules. This is an artificial-life experiment, not validated animal biomechanics or canonical GENESIS biological evolution.

## Verification

`model.test.mjs` checks developmental ranges, multi-plan diversity, local-space spine stability, locomotion modes, closing-jaw food contact, delayed swallowing, localized wounds/startle, finite carcass consumption, gene-bank archiving, and diversity-preserving generation selection.

`cognition.test.mjs` checks persistent behavior state selection, threat memory, hunger-driven foraging, target persistence, and lifetime reinforcement updates.

`living_art.test.mjs` checks inherited living-art traits, breathing deformation, target-tracking state, bite recoil, persistent scar recording, renderer chaining, and HUD integration.

`kinetic_creatures.test.mjs` checks that all five authored body-family renderers exist, eye tracking remains tied to cognition, jaws remain tied to live mouth state, wounds/photophores remain represented, geometry is deterministic from simulation state, and the module loads after living-art state.

GitHub Actions provides repository-side automated tests. These checks do not constitute scientific validation or iPhone Safari visual-quality verification.

## Files

- `index.html` — app shell and load order
- `styles.css` — mobile UI
- `js/core.js` — world, camera, utilities, runtime state
- `js/spatial.js` — spatial hash
- `js/genetics.js` — developmental morphology genome and inherited neural controller
- `js/entities.js` — plankton, carcasses, articulated creatures, wounds, jaw/swallow mechanics and core simulation
- `js/evolution.js` — diversity-aware selection, gene bank, productivity and generation turnover
- `js/render.js` — ocean presentation and HUD
- `js/cognition.js` — memory, behavior states, target choice, and lifetime reinforcement
- `js/living_art.js` — inherited physiology/presentation state
- `js/kinetic_creatures.js` — authored five-family creature renderer
- `js/audio.js` — procedural WebAudio
- `js/ui.js` — controls, pan/zoom and mutation storm
- `js/main.js` — runtime sanity checks and animation loop
- `model.test.mjs` — deterministic model tests
- `cognition.test.mjs` — deterministic cognition tests
- `living_art.test.mjs` — deterministic living-art tests
- `kinetic_creatures.test.mjs` — authored-renderer contract test

No CDN or external runtime dependency.
