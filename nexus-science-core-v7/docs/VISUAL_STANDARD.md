# NEXUS V7 Visual Standard

## Design premise

NEXUS should look like a premium experimental instrument built by robotics engineers and industrial designers. It should not look like an AI-generated dashboard, a generic cyberpunk HUD, or an asset-store science-fiction scene.

## Material language

- **Graphite ceramic** — main structural shells; dark, dense, low-saturation.
- **Dark titanium** — articulated limbs, pivots and load-bearing components.
- **Machined bronze** — power core and actuator-adjacent parts; used sparingly.
- **Contact elastomer** — feet, seals and impact surfaces; matte and visibly non-metallic.
- **Optical glass** — containment and inspection surfaces; low-opacity and physically restrained.
- **Basalt composite** — laboratory floor and calibration plane.

Material differences must correspond to function. Do not recolor parts merely for visual variety.

## Lighting

- one warm directional key light;
- one neutral ambient laboratory light;
- contact shadows for grounding;
- no rotating rainbow lights;
- no full-screen bloom by default;
- emissive intensity tied to measured power, contact or temperature.

## Interface

- compact instrument typography;
- tabular numerals for measured values;
- thin mechanical dividers;
- dark opaque panels with limited blur;
- bronze reserved for authority, selected state and energy systems;
- red reserved for failures and unsafe values;
- green reserved for verified pass states;
- every number includes a unit when space allows.

## Motion

- robot motion comes from MuJoCo only;
- camera follow is damped but derived from the authoritative root body;
- UI animation is limited to state transitions and confirmation feedback;
- no idle floating, breathing, pulsing or wobble unless a physical model produces it.

## Scientific graphics

Every graph or field must declare:

- quantity;
- units;
- range;
- sampling interval;
- whether it is measured or derived;
- exact source state.

The MAP-Elites panel uses cell occupancy and normalized elite fitness. Empty cells remain visibly empty; no decorative noise is permitted.

## Mobile requirements

At 430 × 932:

- primary controls stay above the safe-area inset;
- all buttons are at least 42 CSS pixels tall;
- identity and research panels do not overlap;
- the robot remains visible between interface regions;
- the camera can orbit and pinch without dragging the page;
- quality scales before scientific timestep or state validity is reduced.

## Rejection criteria

Reject a visual change when it introduces:

- arbitrary gradients;
- excessive glass cards;
- cyan-and-purple neon as the default palette;
- fake scan lines that reduce readability;
- unexplained particles;
- nonfunctional gauges;
- text too small for the target phone;
- borrowed visual identity from another game or laboratory product;
- visual complexity that hides whether the scientific system works.
