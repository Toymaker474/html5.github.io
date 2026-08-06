// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import { createAgentContract, evaluateGates, evolveToolBundles, scoreTool } from '../src/genetic-market.js';

const registry = JSON.parse(await readFile(new URL('../registry/tools.json', import.meta.url), 'utf8'));
const errors = [];
const ids = new Set();
const requiredMetrics = [
  'reliability',
  'usefulness',
  'security',
  'agentCompatibility',
  'mobileQuality',
  'documentation',
  'openness',
  'performance',
];
const requiredGates = [
  'sourcePinned',
  'licenseVerified',
  'testsPassing',
  'hashRecorded',
  'humanDocs',
  'agentContract',
];

if (registry.schema !== 'nexus.tool-registry.v1') errors.push('Registry schema is not nexus.tool-registry.v1.');
if (!Array.isArray(registry.tools) || registry.tools.length < 4) errors.push('Registry must contain at least four tools.');
if (registry.currency?.realMoney !== false) errors.push('Version 1 must use reputation credits, not real money.');

for (const [index, tool] of (registry.tools || []).entries()) {
  const label = tool?.id || `tool[${index}]`;
  if (!tool?.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tool.id)) errors.push(`${label}: invalid id.`);
  if (ids.has(tool.id)) errors.push(`${label}: duplicate id.`);
  ids.add(tool.id);

  if (!tool.name || !tool.summary || !tool.category || !tool.version) errors.push(`${label}: missing basic metadata.`);
  if (tool.source?.openSource !== true) errors.push(`${label}: source must be open source.`);
  if (!String(tool.source?.url || '').startsWith('https://github.com/')) errors.push(`${label}: source must point to GitHub.`);
  if (!tool.source?.license || !tool.source?.pinned) errors.push(`${label}: license and pin are required.`);
  if (tool.cost?.free !== true || tool.cost?.subscription !== false || tool.cost?.trial !== false) {
    errors.push(`${label}: only fully free tools with no subscription or trial are accepted.`);
  }

  for (const field of ['platforms', 'capabilities', 'inputs', 'outputs', 'limits', 'evidence']) {
    if (!Array.isArray(tool[field]) || tool[field].length === 0) errors.push(`${label}: ${field} must be a non-empty array.`);
  }

  for (const metric of requiredMetrics) {
    const value = tool.metrics?.[metric];
    if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`${label}: metric ${metric} must be 0-100.`);
  }

  for (const gate of requiredGates) {
    if (typeof tool.gates?.[gate] !== 'boolean') errors.push(`${label}: gate ${gate} must be boolean.`);
  }

  if (!Number.isFinite(tool.ratings?.average) || tool.ratings.average < 0 || tool.ratings.average > 100) {
    errors.push(`${label}: rating average must be 0-100.`);
  }
  if (!Number.isInteger(tool.ratings?.count) || tool.ratings.count < 0) errors.push(`${label}: rating count must be a positive integer.`);

  const score = scoreTool(tool);
  if (!Number.isFinite(score) || score < 0 || score > 100) errors.push(`${label}: calculated score is invalid.`);
  const contract = createAgentContract(tool);
  if (contract.id !== tool.id || !contract.quality?.gate) errors.push(`${label}: agent contract generation failed.`);
}

const bundlesA = evolveToolBundles(registry.tools, {
  seed: 474,
  generations: 12,
  populationSize: 24,
  bundleSize: 4,
  results: 5,
});
const bundlesB = evolveToolBundles(registry.tools, {
  seed: 474,
  generations: 12,
  populationSize: 24,
  bundleSize: 4,
  results: 5,
});

if (bundlesA.length !== 5) errors.push('Genetic engine did not produce five bundles.');
if (JSON.stringify(bundlesA) !== JSON.stringify(bundlesB)) errors.push('Genetic engine is not deterministic for the same seed.');
for (const bundle of bundlesA) {
  if (new Set(bundle.toolIds).size !== bundle.toolIds.length) errors.push(`${bundle.id}: duplicate tool in bundle.`);
  if (bundle.fitness < 0 || bundle.fitness > 100) errors.push(`${bundle.id}: invalid fitness.`);
}

const summary = {
  schema: registry.schema,
  toolCount: registry.tools?.length || 0,
  certifiedCount: registry.tools?.filter(tool => evaluateGates(tool).passed).length || 0,
  evolvedBundles: bundlesA.length,
  topBundleFitness: bundlesA[0]?.fitness || 0,
  errors,
  passed: errors.length === 0,
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
