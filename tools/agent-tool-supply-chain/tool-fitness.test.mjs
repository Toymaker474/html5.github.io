// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import {
  calculateToolFitness,
  confidentRating,
  reliabilityScore,
  selectCandidates,
} from './tool-fitness.mjs';

assert.equal(reliabilityScore({ verifiedRuns: 0, failedRuns: 0 }), 0.8);
assert.ok(reliabilityScore({ verifiedRuns: 100, failedRuns: 0 }) > reliabilityScore({ verifiedRuns: 1, failedRuns: 0 }));
assert.equal(confidentRating({ score: 5, evidenceBoundCount: 0 }), 0.5);
assert.equal(confidentRating({ score: 5, evidenceBoundCount: 25 }), 1);

const safeBase = {
  gates: {
    correctnessPassed: true,
    safetyPassed: true,
    licensePassed: true,
    artifactEvidenceBound: true,
    mobileRequired: true,
    mobilePassed: true,
    destructive: false,
  },
  ratings: {
    verifiedRuns: 30,
    failedRuns: 2,
    human: { score: 4.5, evidenceBoundCount: 20 },
    agentCompatibility: { score: 4.7, evidenceBoundCount: 25 },
    mobileQuality: { score: 4.2, evidenceBoundCount: 18 },
    clarity: { score: 4.6, evidenceBoundCount: 25 },
    security: { score: 5, evidenceBoundCount: 25 },
    reuse: { score: 4.1, evidenceBoundCount: 14 },
  },
  metrics: {
    correctnessRatio: 1,
    accessibilityRatio: 0.9,
    performanceRatio: 0.8,
    evidenceCompleteness: 1,
    deterministicCoverage: 0.95,
    complexityPenalty: 0.15,
    permissionPenalty: 0,
    regressionPenalty: 0,
  },
};

const safe = calculateToolFitness(safeBase);
assert.equal(safe.eligible, true);
assert.ok(Number.isFinite(safe.fitness));

const popularButUnsafe = calculateToolFitness({
  ...safeBase,
  gates: { ...safeBase.gates, safetyPassed: false },
  ratings: {
    ...safeBase.ratings,
    human: { score: 5, evidenceBoundCount: 1000 },
  },
});
assert.equal(popularButUnsafe.eligible, false);
assert.equal(popularButUnsafe.fitness, Number.NEGATIVE_INFINITY);

const regression = calculateToolFitness({
  ...safeBase,
  metrics: { ...safeBase.metrics, regressionPenalty: 0.8 },
});
assert.ok(regression.fitness < safe.fitness);

const selection = selectCandidates([
  { id: 'mobile-a', deviceClass: 'mobile', ...safeBase },
  { id: 'mobile-b', deviceClass: 'mobile', ...safeBase, metrics: { ...safeBase.metrics, performanceRatio: 0.7 } },
  { id: 'handheld-a', deviceClass: 'handheld', ...safeBase, metrics: { ...safeBase.metrics, performanceRatio: 0.75 } },
  { id: 'unsafe', deviceClass: 'desktop', ...safeBase, gates: { ...safeBase.gates, safetyPassed: false } },
], { maximum: 2 });

assert.equal(selection.selected.length, 2);
assert.equal(new Set(selection.selected.map(item => item.candidate.deviceClass)).size, 2);
assert.equal(selection.rejected.length, 1);
console.log('tool-fitness tests passed');
