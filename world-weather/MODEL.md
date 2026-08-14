# GENESIS world atmosphere + hydrology v1

This is a from-scratch deterministic C++ surface-world model at **192×128 = 24,576 cells**. It is a higher-resolution planetary surface layer that sits conceptually above the active 3D material volume; it does not pretend the full 3D material voxel grid has already been expanded to this resolution.

## Simulated state

Each surface cell carries elevation, temperature, humidity, cloud condensate, pressure anomaly, horizontal wind, vertical vorticity diagnostic, rainfall, soil moisture, mobile surface water, discharge memory, river-channel state and tornado diagnostic strength.

Atmospheric pressure relaxes toward a temperature/moisture-dependent target and diffuses spatially. Pressure gradients accelerate horizontal wind, which is damped and receives a latitude-dependent Coriolis-like term. Humidity/cloud state is transported by the resolved wind using a bounded nearest-cell upwind step. Humidity above a temperature-dependent saturation threshold condenses into cloud water. Cloud water above a precipitation threshold becomes rain.

Rain is partitioned between infiltration and mobile surface water. Surface water follows local hydraulic head (terrain elevation + water depth) and transfers conservatively to the lowest cardinal neighbour. A decaying discharge accumulator identifies persistent concentrated flow; a river cell is diagnosed only when both discharge and mobile water are high enough.

A tornado is **not spawned or animated by a timer**. A tornado cell is diagnosed only when the same cell simultaneously has strong resolved vertical vorticity, a pressure deficit, deep cloud condensate, active rain and sufficient wind speed. The supercell test helper changes only initial pressure/wind/moisture/temperature fields; it never writes tornado state.

## Resolution

- atmosphere/hydrology: 192×128 (24,576 cells)
- active volumetric material solver remains a separate 3D kernel and is not falsely relabelled as 192×128×N
- this surface layer is intended to drive future high-resolution terrain/weather rendering and provide rainfall/runoff boundary conditions to the 3D volume

## Truth boundary

This is not DNS, mesoscale NWP, LES, a validated compressible Navier–Stokes atmosphere, or a research tornado forecast model. Vertical air structure is parameterized into a 2D surface-layer model; cloud microphysics is reduced; runoff uses local four-neighbour hydraulic routing; river channels are emergent discharge diagnostics rather than an erosion-resolved fluvial geomorphology model. Tornado output is a physically motivated resolved-field diagnostic, not proof of real-world tornado predictability.

No external weather, fluid, game, physics, rendering or simulation library is used.
