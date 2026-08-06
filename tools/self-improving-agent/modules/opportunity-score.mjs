// SPDX-License-Identifier: MIT

/**
 * Rank one possible improvement without allowing the model to decide safety.
 * Higher values mean the opportunity is more useful and easier to verify.
 */
export function scoreOpportunity({
  userImpact = 0,
  repeatedPain = 0,
  evidenceStrength = 0,
  testability = 0,
  reusePotential = 0,
  mobileValue = 0,
  uncertainty = 0,
  changeRisk = 0,
} = {}) {
  const clamp = value => Math.max(0, Math.min(5, Number(value) || 0));
  const benefit =
    clamp(userImpact) * 3 +
    clamp(repeatedPain) * 2 +
    clamp(evidenceStrength) * 2 +
    clamp(testability) * 3 +
    clamp(reusePotential) * 2 +
    clamp(mobileValue) * 2;
  const penalty = clamp(uncertainty) * 3 + clamp(changeRisk) * 4;
  return Math.round((benefit - penalty) * 100) / 100;
}

export function rankOpportunities(opportunities = []) {
  return opportunities
    .map(item => ({ ...item, score: scoreOpportunity(item.metrics) }))
    .sort((left, right) => right.score - left.score || String(left.id).localeCompare(String(right.id)));
}
