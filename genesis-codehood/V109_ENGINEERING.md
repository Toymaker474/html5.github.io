# GENESIS V109 — PHYSICAL BIOSPHERE ENGINE

## Prime directive
GENESIS is an artificial-life / physical biosphere simulation, not a gameplay system. No quests, loot, scripted encounters, spawn events, combat-state shortcuts, crafting recipes, arbitrary damage-over-time, or visual effects that invent simulation outcomes. The authoritative state lives in simulation systems. Rendering only observes that state.

## Locked architecture
WORLD SEED -> GEOLOGY -> MATTER/THERMAL/FLUIDS -> SOIL/CHEMISTRY -> FLORA/FUNGI -> CREATURE ANATOMY -> PHYSIOLOGY -> SENSORS -> BELIEF/MEMORY -> AUTONOMOUS INTENTION -> MOTOR/CONTACT CONTROL -> PHYSICAL ACTION -> WORLD CHANGE -> LOOP.

## V109.1 — Matter kernel [ACTIVE]
Inputs: existing V104 fine material grid, weather, heat, terrain contacts.
Outputs: per-cell porosity, hardness, saturation, mobile sediment, flow tendency, organic fraction, lithology.
Rules:
- Materials retain mass-state meaning; no decorative-only matter.
- Rain enters exposed porous material as infiltration.
- Saturation moves through porous substrate by local potential/permeability.
- Dirt can become mud from sustained saturation.
- Weak saturated exposed material can erode into mobile sediment.
- Saturated porous seams can create actual water cells in adjacent cavities.
- Low-flow sediment can deposit as new dirt/sand.
Acceptance: measurable erosion, seepage, deposition and drainage occur without scripted events; no NaN/overflow; phone budget remains bounded.

## V109.2 — Geological world generator [FOUNDATION ACTIVE]
Inputs: world seed.
Outputs: uplift field, lithology/strata, faults, hardness, porosity, aquifer potential, drainage field.
Rules:
- Provinces are consequences of structure + water + heat, not biome paint labels.
- Faults reduce strength and raise permeability.
- Aquifers follow porous fractured routes.
- Future pass will replace the current initial V104 province seeding with pre-life accelerated geological settling.
Acceptance: different seeds produce materially different drainage, fracture and substrate maps before organisms are considered.

## V109.3 — 2.5D physical topology [FOUNDATION ACTIVE]
Depth bands: deep geology (-2), cave/rear plane (-1), main ecosystem (0), exposed/foreground shelves (+1), foreground occlusion (+2 future).
Current output: a depth-topology field derived from cavities, roofs and exposed surfaces.
Next requirement: creatures and loose matter gain explicit depth coordinates and may transition only through connected geometry. Occlusion, sound, smell and light must respect topology.
Acceptance: moving between depth bands changes reachable contacts and perception, not just rendering parallax.

## V109.4 — Anatomy compiler [PLANNED]
Input: genome + species body blueprint.
Output: rigid/soft masses, joints, tendons, muscles, organs, jaws, manipulators, sensors and material envelope.
No generic three-node body underneath every species.
Required body architectures: armored arthropod, hexapod insect, arachnid, vertebrate crawler, biped manipulator, soft-body slug/worm, hydrostatic jelly/tentacle organism, colonial organism.
Acceptance: crab, beetle, biped and jelly use fundamentally different topology and failure modes.

## V109.5 — Muscle/contact locomotion [PLANNED]
The AI may never set creature position or velocity directly.
Intent -> motor controller -> muscle activation -> joint forces -> contact forces -> motion.
End effectors use SEARCH -> APPROACH -> TOUCH -> LOAD -> GRIP -> HOLD -> SLIP/RELEASE.
Hands, claws, feet, hooks and adhesive pads share contact infrastructure but have distinct physical mechanisms.
Acceptance: slipping, stumbling, limping, hanging and recovery occur as solver outcomes without animation states.

## V109.6 — Physical mouths / ingestion [PLANNED]
Mouths are geometry and actuators, not range-damage functions.
Orient skull -> open jaw -> contact -> close -> stress/tissue response -> hold/release -> ingest physical mass.
Mandibles, shearing jaws, rasping mouths, filter structures and tentacle-fed mouths are separate mechanisms.
Acceptance: a bite targets the anatomical part actually contacted; prey may escape when resisting force exceeds grip.

## V109.7 — Physiology / local injury / death [PLANNED]
Track anatomical-region structure, temperature, hydration, perfusion, oxygen proxy, pain and functional capacity.
Circulation uses a lightweight vascular graph rather than millions of internal fluid particles.
Death is system failure: brain destruction, circulation failure, respiratory failure, thermal damage, dehydration, starvation or catastrophic structural failure.
Same body transitions to uncontrolled ragdoll; no corpse object swap.
Acceptance: localized injury produces localized functional impairment; e.g. damaged leg changes gait because force capacity changed.

## V109.8 — Decomposition / material conversion [PLANNED, existing V102/V107 bridge retained]
Cooling -> tissue breakdown -> scavenging/fungal digestion -> exposed skeleton/shell -> weathering -> organic/mineral soil.
Jelly/hydrostatic bodies may collapse into gel/fluid material instead of leaving conventional skeletons.
Heat changes tissue material properties rather than applying fake DPS.
Acceptance: mass is accounted for across carcass, scavengers, detritus and soil within bounded approximation error.

## V109.9 — Living flora / fungi v2 [PLANNED, V107 plant rigs retained]
Seed stored energy -> root growth -> water/nutrient acquisition -> shoot/stem -> leaf area -> photosynthesis proxy -> reproduction.
Roots are physical branching constraints in soil and affect slope stability.
Specific leaves/stems can be eaten or broken.
Fungi are primarily underground resource networks; visible mushrooms are fruiting structures of that network.
Acceptance: plant survival and shape depend on substrate, water, damage and light; no floating plants or random resurrection.

## V109.10 — Sensory physics [PLANNED]
No creature may read another creature's hidden coordinates.
Vision: FOV, occlusion, contrast/motion sensitivity.
Sound: event propagation and uncertain source estimate.
Chemical/smell: advected/diffused concentration field in air/water.
Touch: contact manifold.
Vibration: solid-surface propagation approximation.
Output is uncertain observations with confidence.
Acceptance: agents can be wrong about source location and identity for physical reasons.

## V109.11 — Autonomous agent [PLANNED]
Observations -> belief/memory model -> internal needs -> available affordances -> outcome estimates -> intention -> motor request.
No FORAGE/ATTACK/FLEE gameplay state is authoritative.
Needs may include energy deficit, hydration, pain, thermal discomfort, fatigue, fear, curiosity, reproductive drive, social attachment and territorial pressure.
Memory stores what/where/when/confidence/value/outcome/associated individual.
Learning updates predicted value from experience; offspring inherit parameters, not memories.
Acceptance: two genetically similar creatures develop measurably different behavior from different histories.

## V109.12 — Emergent social/material intelligence [PLANNED]
No FORM_TRIBE() and no crafting recipes.
Provide recognition, attachment, communication, carrying, manipulation, shared shelter use and physical construction.
Tools exist because material properties provide affordances: mass, hardness, edge radius, fracture toughness, flexibility and tension.
A net is a physical tension graph. A shelter is assembled matter. A sharp stone works because its edge interacts mechanically with material.
Acceptance: repeated physical/social outcomes can produce persistent groups and reuse of useful object configurations without scripted faction creation.

## V109.13 — Simulation LOD [PLANNED]
Near camera: full anatomy/contact/physiology.
Nearby: reduced articulated physics + full agent.
Distant: lower-frequency individual physical/environment state.
Very distant: conservative population/resource transport state.
LOD may reduce numerical resolution but may not invent outcomes or silently teleport resources/organisms.
Acceptance: zoom/camera transitions preserve conserved quantities and identity/state within defined error bounds.

## V109.14 — GPU render extraction [PLANNED]
Simulation snapshot -> surface extraction -> material classification -> GPU geometry -> lighting -> atmosphere -> camera.
Wet shell highlights require simulated wetness. Cracks require structural damage. Mud on limbs requires mud contact. Plant deformation comes from plant physics. Jelly surface shape comes from pressure/body nodes. Bioluminescent light requires active luminous tissue.
Acceptance: disabling a simulation property removes its visual consequence; renderer cannot change authoritative state.

## V109.15 — Scientific observatory GUI [PLANNED]
ANATOMY: live masses/joints/muscles/organs/wounds.
BEHAVIOR: current observations, uncertainty, memories, competing intentions.
GENETICS: inherited morphology/physiology parameters.
VITALS: circulation proxy, hydration, energy reserve, temperature, stress/pain.
WORLD: matter composition, water flow, heat, soil nutrients, geology.
SIM VISION: only what selected organism currently perceives/remembers.
No gameplay score or fake telemetry.

## Verification constitution
Every increment must define acceptance tests before implementation. Syntax success is not runtime success. Runtime success is not visual success. Public GitHub Pages source wiring must be verified separately from Safari rendering. Claims must state what was actually observed. Unknown/missing/conflicting evidence blocks a PASS.

## Current build status
ACTIVE NOW: V109.1 matter properties/hydrology/sediment, V109.2 geology-field foundation, V109.3 depth-topology foundation.
BRIDGED FROM PREVIOUS ENGINE: V102 decomposition, V104 material grid, V105 heat/continuum, V107 morphology/living surfaces/anatomy, V108 observatory rendering.
NOT YET CLAIMED COMPLETE: muscle-driven locomotion, true physical mouth ingestion, physiology/circulation, full sensory fields, autonomous affordance agent, physical social construction, simulation LOD conservation, GPU renderer.
