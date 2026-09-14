import {
  compileMorphologyToMjcf,
  DEFAULT_MORPHOLOGY,
  LEG_LAYOUT,
  mutateMorphology,
  validateMorphology,
} from './research/morphologyGenome.js';

export const ACTIVE_MORPHOLOGY = DEFAULT_MORPHOLOGY;
export const HEXAPOD_MJCF = compileMorphologyToMjcf(ACTIVE_MORPHOLOGY);

export const LEG_METADATA = Object.freeze(LEG_LAYOUT.map((leg) => Object.freeze({
  id: leg.id,
  x: ACTIVE_MORPHOLOGY.torso.halfLength * leg.longitudinal,
  side: leg.side,
  phase: leg.phase,
})));

export const ACTUATOR_COUNT = LEG_METADATA.length * 2;

export {
  compileMorphologyToMjcf,
  DEFAULT_MORPHOLOGY,
  mutateMorphology,
  validateMorphology,
};
