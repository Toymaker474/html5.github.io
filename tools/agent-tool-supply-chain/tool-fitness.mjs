// SPDX-License-Identifier: MIT

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const normalizeFiveStar = value => clamp(value, 0, 5) / 5;

/**
 * Bayesian-smoothed reliability. New tools do not receive a perfect score
 * from one lucky run; the prior assumes 8 successes and 2 failures.
 */
export function reliabilityScore({ verifiedRuns = 0, failedRuns = 0 } = {}) {
  const successes = Math.max(0, Number(verifiedRuns) || 0);
  const failures = Math.max(0, Number(failedRuns) || 0);
  return (successes + 8) / (successes + failures + 10);
}

export function ratingConfidence(count = 0) {
  // Confidence rises gradually and reaches 1.0 at 25 evidence-bound ratings.
  return clamp(Number(count) || 0, 0, 25) / 25;
}

export function confidentRating({ score = 0, evidenceBoundCount = 0 } = {}) {
  const confidence = ratingConfidence(evidenceBoundCount);
  // Unknown ratings stay neutral rather than unfairly destroying new tools.
  return 0.5 * (1 - confidence) + normalizeFiveStar(score) * confidence;
}

/**
 * Calculate fitness for one immutable tool artifact.
 * Required gates run before any popularity or aesthetic score is considered.
 */
export function calculateToolFitness(candidate = {}) {
  const gates = candidate.gates || {};
  const failures = [];

  if (gates.correctnessPassed !== true) failures.push('correctness gate failed or missing');
  if (gates.safetyPassed !== true) failures.push('safety gate failed or missing');
  if (gates.licensePassed !== true) failures.push('license gate failed or missing');
  if (gates.artifactEvidenceBound !== true) failures.push('evidence is not bound to the exact artifact');
  if (gates.mobileRequired === true && gates.mobilePassed !== true) failures.push('required mobile gate failed or missing');
  if (gates.destructive === true) failures.push('destructive capability is not eligible for autonomous selection');

  if (failures.length > 0) {
    return {
      eligible: false,
      fitness: Number.NEGATIVE_INFINITY,
      failures,
      components: {},
    };
  }

  const ratings = candidate.ratings || {};
  const metrics = candidate.metrics || {};
  const reliability = reliabilityScore(ratings);
  const human = confidentRating(ratings.human);
  const agentCompatibility = confidentRating(ratings.agentCompatibility);
  const mobileQuality = confidentRating(ratings.mobileQuality);
  const clarity = confidentRating(ratings.clarity);
  const security = confidentRating(ratings.security);
  const reuse = confidentRating(ratings.reuse);

  const correctness = clamp(metrics.correctnessRatio, 0, 1);
  const accessibility = clamp(metrics.accessibilityRatio, 0, 1);
  const performance = clamp(metrics.performanceRatio, 0, 1);
  const evidenceCompleteness = clamp(metrics.evidenceCompleteness, 0, 1);
  const deterministicCoverage = clamp(metrics.deterministicCoverage, 0, 1);
  const complexityPenalty = clamp(metrics.complexityPenalty, 0, 1);
  const permissionPenalty = clamp(metrics.permissionPenalty, 0, 1);
  const regressionPenalty = clamp(metrics.regressionPenalty, 0, 1);

  const components = {
    correctness,
    reliability,
    human,
    agentCompatibility,
    mobileQuality,
    clarity,
    security,
    reuse,
    accessibility,
    performance,
    evidenceCompleteness,
    deterministicCoverage,
    complexityPenalty,
    permissionPenalty,
    regressionPenalty,
  };

  const benefit =
    correctness * 22 +
    reliability * 14 +
    evidenceCompleteness * 10 +
    deterministicCoverage * 8 +
    agentCompatibility * 10 +
    mobileQuality * 8 +
    human * 7 +
    clarity * 6 +
    security * 6 +
    reuse * 4 +
    accessibility * 3 +
    performance * 2;

  const penalty =
    complexityPenalty * 8 +
    permissionPenalty * 14 +
    regressionPenalty * 20;

  return {
    eligible: true,
    fitness: Math.round((benefit - penalty) * 100) / 100,
    failures: [],
    components,
  };
}

export function selectCandidates(candidates = [], { diversityKey = 'deviceClass', maximum = 3 } = {}) {
  const evaluated = candidates.map(candidate => ({
    candidate,
    result: calculateToolFitness(candidate),
  }));

  const eligible = evaluated
    .filter(item => item.result.eligible)
    .sort((left, right) =>
      right.result.fitness - left.result.fitness ||
      String(left.candidate.id).localeCompare(String(right.candidate.id)));

  const selected = [];
  const represented = new Set();
  for (const item of eligible) {
    if (selected.length >= maximum) break;
    const key = item.candidate[diversityKey] || 'default';
    if (!represented.has(key)) {
      represented.add(key);
      selected.push(item);
    }
  }

  for (const item of eligible) {
    if (selected.length >= maximum) break;
    if (!selected.includes(item)) selected.push(item);
  }

  return {
    selected,
    rejected: evaluated.filter(item => !item.result.eligible),
    rankedEligible: eligible,
  };
}
