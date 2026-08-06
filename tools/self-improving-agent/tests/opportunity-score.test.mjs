// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { rankOpportunities, scoreOpportunity } from '../modules/opportunity-score.mjs';

assert.equal(scoreOpportunity(), 0);
assert.ok(scoreOpportunity({ userImpact: 5, testability: 5 }) > 0);
assert.ok(scoreOpportunity({ userImpact: 5, testability: 5, changeRisk: 5 }) < scoreOpportunity({ userImpact: 5, testability: 5 }));

const ranked = rankOpportunities([
  { id: 'risky', metrics: { userImpact: 5, testability: 1, changeRisk: 5 } },
  { id: 'safe', metrics: { userImpact: 4, testability: 5, reusePotential: 5, changeRisk: 1 } },
]);
assert.equal(ranked[0].id, 'safe');
console.log('opportunity-score tests passed');
