// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  bayesianRating,
  createAgentContract,
  evaluateGates,
  evolveToolBundles,
  scoreTool,
} from '../src/genetic-market.js';

const registry = JSON.parse(await readFile(new URL('../registry/tools.json', import.meta.url), 'utf8'));
const tools = registry.tools;

test('Bayesian ratings resist one-vote score manipulation', () => {
  const onePerfectVote = bayesianRating({ average: 100, count: 1 });
  const manyStrongVotes = bayesianRating({ average: 92, count: 100 });
  assert.ok(onePerfectVote < 80);
  assert.ok(manyStrongVotes > 90);
});

test('fully gated free tools score higher than otherwise identical paid tools', () => {
  const base = structuredClone(tools[0]);
  const paid = structuredClone(base);
  paid.id = 'paid-copy';
  paid.cost.free = false;
  paid.cost.subscription = true;
  assert.ok(scoreTool(base) > scoreTool(paid));
});

test('missing gates place a tool into quarantine or pending status', () => {
  const tool = structuredClone(tools[0]);
  tool.gates.testsPassing = false;
  assert.equal(evaluateGates(tool).tier, 'VERIFIED-PENDING');
  tool.gates.licenseVerified = false;
  tool.gates.hashRecorded = false;
  assert.equal(evaluateGates(tool).tier, 'QUARANTINE');
});

test('agent contracts preserve operational facts and quality evidence', () => {
  const contract = createAgentContract(tools[0]);
  assert.equal(contract.schema, 'nexus.agent-tool-contract.v1');
  assert.equal(contract.id, tools[0].id);
  assert.ok(contract.command.length > 2);
  assert.ok(contract.quality.score >= 0 && contract.quality.score <= 100);
  assert.ok(Array.isArray(contract.quality.evidence));
});

test('genetic evolution is deterministic and produces unique tool stacks', () => {
  const options = {
    seed: 474,
    generations: 18,
    populationSize: 30,
    bundleSize: 4,
    results: 6,
  };
  const first = evolveToolBundles(tools, options);
  const second = evolveToolBundles(tools, options);
  assert.deepEqual(first, second);
  assert.equal(first.length, 6);
  for (const bundle of first) {
    assert.equal(new Set(bundle.toolIds).size, bundle.toolIds.length);
    assert.ok(bundle.fitness >= 0 && bundle.fitness <= 100);
    assert.ok(bundle.capabilities.length >= bundle.toolIds.length);
  }
});

test('the genetic engine excludes tools that are paid or closed source', () => {
  const modified = structuredClone(tools);
  modified[0].cost.free = false;
  modified[1].source.openSource = false;
  const bundles = evolveToolBundles(modified, {
    seed: 474,
    generations: 8,
    populationSize: 18,
    bundleSize: 4,
    results: 4,
  });
  assert.ok(bundles.every(bundle => !bundle.toolIds.includes(modified[0].id)));
  assert.ok(bundles.every(bundle => !bundle.toolIds.includes(modified[1].id)));
});
