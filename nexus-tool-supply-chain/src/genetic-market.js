// SPDX-License-Identifier: MIT

const METRIC_WEIGHTS = Object.freeze({
  reliability: 0.20,
  usefulness: 0.18,
  security: 0.16,
  agentCompatibility: 0.14,
  mobileQuality: 0.12,
  documentation: 0.08,
  openness: 0.07,
  performance: 0.05,
});

const REQUIRED_GATES = Object.freeze([
  'sourcePinned',
  'licenseVerified',
  'testsPassing',
  'hashRecorded',
  'humanDocs',
  'agentContract',
]);

export function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

export function bayesianRating(ratings = {}, priorMean = 75, priorWeight = 8) {
  const count = Math.max(0, Number(ratings.count) || 0);
  const average = clamp(ratings.average);
  return ((average * count) + (priorMean * priorWeight)) / (count + priorWeight);
}

export function evaluateGates(tool) {
  const gates = tool.gates || {};
  const failed = REQUIRED_GATES.filter(gate => gates[gate] !== true);
  return {
    passed: failed.length === 0,
    failed,
    tier: failed.length === 0
      ? 'CERTIFIED'
      : failed.length <= 2
        ? 'VERIFIED-PENDING'
        : 'QUARANTINE',
  };
}

export function scoreTool(tool) {
  const metrics = tool.metrics || {};
  let weighted = 0;
  for (const [metric, weight] of Object.entries(METRIC_WEIGHTS)) {
    weighted += clamp(metrics[metric]) * weight;
  }

  const rating = bayesianRating(tool.ratings);
  const gate = evaluateGates(tool);
  const evidenceBonus = clamp((tool.evidence?.length || 0) * 2, 0, 10);
  const portabilityBonus = clamp((tool.platforms?.length || 0) * 1.5, 0, 8);
  const failurePenalty = gate.failed.length * 7;
  const paidPenalty = tool.cost?.free === true ? 0 : 35;

  return clamp(
    weighted * 0.78 +
    rating * 0.14 +
    evidenceBonus +
    portabilityBonus -
    failurePenalty -
    paidPenalty,
  );
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function unique(values) {
  return [...new Set(values)];
}

function sampleWithoutReplacement(values, count, random) {
  const pool = [...values];
  const output = [];
  while (pool.length && output.length < count) {
    output.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return output;
}

function calculateBundleFitness(ids, toolsById) {
  const tools = ids.map(id => toolsById.get(id)).filter(Boolean);
  if (!tools.length) return 0;

  const averageQuality = tools.reduce((sum, tool) => sum + scoreTool(tool), 0) / tools.length;
  const capabilities = unique(tools.flatMap(tool => tool.capabilities || []));
  const platforms = unique(tools.flatMap(tool => tool.platforms || []));
  const categories = unique(tools.map(tool => tool.category));
  const certifiedCount = tools.filter(tool => evaluateGates(tool).passed).length;
  const freeCount = tools.filter(tool => tool.cost?.free === true).length;

  const coverageBonus = Math.min(20, capabilities.length * 1.8);
  const platformBonus = Math.min(10, platforms.length * 2);
  const diversityBonus = Math.min(8, categories.length * 1.5);
  const certificationBonus = (certifiedCount / tools.length) * 8;
  const freeBonus = (freeCount / tools.length) * 6;

  return clamp(
    averageQuality * 0.62 +
    coverageBonus +
    platformBonus +
    diversityBonus +
    certificationBonus +
    freeBonus,
  );
}

function tournament(population, toolsById, random, size = 3) {
  const contenders = sampleWithoutReplacement(population, Math.min(size, population.length), random);
  return contenders.sort((a, b) =>
    calculateBundleFitness(b.ids, toolsById) - calculateBundleFitness(a.ids, toolsById))[0];
}

function crossover(parentA, parentB, allIds, bundleSize, random) {
  const mixed = unique([
    ...parentA.ids.filter(() => random() >= 0.5),
    ...parentB.ids.filter(() => random() >= 0.5),
  ]);
  for (const id of sampleWithoutReplacement(allIds, allIds.length, random)) {
    if (mixed.length >= bundleSize) break;
    if (!mixed.includes(id)) mixed.push(id);
  }
  return mixed.slice(0, bundleSize);
}

function mutate(ids, allIds, random, mutationRate) {
  const output = [...ids];
  if (random() >= mutationRate || !output.length) return output;
  const available = allIds.filter(id => !output.includes(id));
  if (!available.length) return output;
  output[Math.floor(random() * output.length)] = available[Math.floor(random() * available.length)];
  return unique(output);
}

export function evolveToolBundles(tools, options = {}) {
  const eligible = tools.filter(tool => tool.cost?.free === true && tool.source?.openSource === true);
  if (eligible.length < 2) return [];

  const populationSize = Math.max(8, Number(options.populationSize) || 32);
  const generations = Math.max(1, Number(options.generations) || 24);
  const bundleSize = Math.min(
    eligible.length,
    Math.max(2, Number(options.bundleSize) || 4),
  );
  const mutationRate = Math.min(0.8, Math.max(0, Number(options.mutationRate) || 0.18));
  const random = mulberry32(Number(options.seed) || 474);
  const allIds = eligible.map(tool => tool.id);
  const toolsById = new Map(eligible.map(tool => [tool.id, tool]));

  let population = Array.from({ length: populationSize }, (_, index) => ({
    ids: sampleWithoutReplacement(allIds, bundleSize, random),
    lineage: [`seed-${index + 1}`],
  }));

  for (let generation = 1; generation <= generations; generation += 1) {
    population.sort((a, b) =>
      calculateBundleFitness(b.ids, toolsById) - calculateBundleFitness(a.ids, toolsById));
    const eliteCount = Math.max(2, Math.floor(populationSize * 0.16));
    const next = population.slice(0, eliteCount).map(candidate => ({
      ids: [...candidate.ids],
      lineage: [...candidate.lineage, `elite-g${generation}`],
    }));

    while (next.length < populationSize) {
      const parentA = tournament(population, toolsById, random);
      const parentB = tournament(population, toolsById, random);
      let ids = crossover(parentA, parentB, allIds, bundleSize, random);
      ids = mutate(ids, allIds, random, mutationRate);
      while (ids.length < bundleSize) {
        const candidate = allIds[Math.floor(random() * allIds.length)];
        if (!ids.includes(candidate)) ids.push(candidate);
      }
      next.push({
        ids,
        lineage: [
          `g${generation}`,
          parentA.lineage.at(-1),
          parentB.lineage.at(-1),
        ],
      });
    }
    population = next;
  }

  const deduplicated = new Map();
  for (const candidate of population) {
    const ids = [...candidate.ids].sort();
    const key = ids.join('|');
    const fitness = calculateBundleFitness(ids, toolsById);
    const current = deduplicated.get(key);
    if (!current || fitness > current.fitness) {
      deduplicated.set(key, {
        id: `bundle-${String(deduplicated.size + 1).padStart(2, '0')}`,
        toolIds: ids,
        fitness: Number(fitness.toFixed(2)),
        capabilities: unique(ids.flatMap(id => toolsById.get(id)?.capabilities || [])).sort(),
        platforms: unique(ids.flatMap(id => toolsById.get(id)?.platforms || [])).sort(),
        lineage: candidate.lineage,
      });
    }
  }

  return [...deduplicated.values()]
    .sort((a, b) => b.fitness - a.fitness)
    .slice(0, Math.max(1, Number(options.results) || 8));
}

export function createAgentContract(tool) {
  return {
    schema: 'nexus.agent-tool-contract.v1',
    id: tool.id,
    name: tool.name,
    version: tool.version,
    purpose: tool.summary,
    license: tool.source?.license,
    source: tool.source?.url,
    platforms: tool.platforms,
    capabilities: tool.capabilities,
    inputs: tool.inputs,
    outputs: tool.outputs,
    command: tool.command,
    limits: tool.limits,
    quality: {
      score: Number(scoreTool(tool).toFixed(2)),
      gate: evaluateGates(tool),
      evidence: tool.evidence,
    },
  };
}
