# GENESIS Physical Creature V1

This is a deliberately narrow vertical slice. It does **not** claim full biology, learning, evolution, fluid dynamics, or a living world.

## Implemented state
- Eight persistent 2D point masses with position, velocity, mass, structural integrity, skin integrity, flesh mass, temperature, hydration and accumulated damage.
- Seven skeleton distance constraints and six persistent joint records with integrity/angle limits.
- Eight lumped muscle actuators. The authored controller outputs activations; actuators produce joint torque and internal stance forces. The controller does not assign body position or velocity.
- Ground collision + friction + gravity.
- Explicit authored pelvis-height PD stabilizer (`brain.stabilizerAssist`). This is assistance, not learned balance.
- Persistent scalar blood volume; wounds cause blood loss. Blood volume affects muscle output and consciousness.
- Persistent lung integrity/ventilation/oxygen proxy. Torso damage can reduce respiratory function.
- Physical food body. Food must contact a closing jaw, remain captured, then physically approach a throat target before it enters stomach inventory.
- Stomach mass/digestible energy/indigestible mass. Digestion releases energy gradually; waste is tracked separately.
- Energy expenditure from basal metabolism and muscle activation.
- Death from circulatory failure, prolonged hypoxia, or energy failure.

## Approximations
- 2D point-mass + projected-distance skeleton; not rigid-body FEM.
- Muscles are lumped joint-torque actuators, not anatomical fiber/tendon models.
- Blood is a scalar circulation proxy, not a transported fluid.
- Lungs are a state model, not gas exchange CFD.
- Digestion is a lumped inventory/release model, not biochemical digestion.
- The controller is an authored oscillator/reflex controller. It does **not** learn.
- The balance stabilizer is explicitly authored assistance.

## Automated tests in this slice
A. body invariants
B. muscle forces produce net body movement
C. damaged limb reduces measured locomotion
D. food cannot create energy without ingestion
E. physical capture/swallow precedes gradual digestion energy release
F. blood loss changes creature state and can cause death
F2. respiratory damage lowers oxygenation
N. deterministic replay for the same seed

Not built in this slice: fluid-body coupling, evolution, learning, chunk persistence, plants, civilizations, GPU compute.
