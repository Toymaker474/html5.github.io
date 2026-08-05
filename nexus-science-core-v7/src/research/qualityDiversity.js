const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function hash32(value) {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export class DeterministicRandom {
  constructor(seed = 0x4e455855) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = hash32(this.state + 0x9e3779b9);
    return this.state / 4294967296;
  }

  integer(maxExclusive) {
    return Math.floor(this.next() * Math.max(1, maxExclusive));
  }
}

/**
 * MAP-Elites archive using two behavioral descriptors:
 *  - contact duty factor: how much of the gait cycle is grounded
 *  - normalized stability: how upright the body remains
 *
 * Fitness is deliberately separate from descriptors so the archive preserves
 * multiple viable locomotion strategies rather than collapsing to one gait.
 */
export class QualityDiversityArchive {
  constructor({ binsX = 12, binsY = 12, seed = 0x4d415045 } = {}) {
    this.binsX = binsX;
    this.binsY = binsY;
    this.random = new DeterministicRandom(seed);
    this.cells = new Map();
    this.insertions = 0;
    this.replacements = 0;
  }

  descriptorToCell(descriptor) {
    const x = clamp(Math.floor(clamp(descriptor.contactDuty, 0, 0.999999) * this.binsX), 0, this.binsX - 1);
    const y = clamp(Math.floor(clamp(descriptor.stability, 0, 0.999999) * this.binsY), 0, this.binsY - 1);
    return { x, y, key: `${x}:${y}` };
  }

  consider(candidate) {
    if (!Number.isFinite(candidate.fitness)) {
      return { accepted: false, reason: 'non-finite-fitness' };
    }

    const cell = this.descriptorToCell(candidate.descriptor);
    const incumbent = this.cells.get(cell.key);
    if (incumbent && incumbent.fitness >= candidate.fitness) {
      return { accepted: false, reason: 'dominated', cell, incumbent };
    }

    const elite = Object.freeze({
      ...candidate,
      descriptor: Object.freeze({ ...candidate.descriptor }),
      metrics: Object.freeze({ ...candidate.metrics }),
      genome: structuredClone(candidate.genome),
      cell: Object.freeze(cell),
    });
    this.cells.set(cell.key, elite);
    this.insertions += 1;
    if (incumbent) this.replacements += 1;
    return { accepted: true, reason: incumbent ? 'replacement' : 'new-cell', cell, elite };
  }

  selectParent() {
    const elites = [...this.cells.values()];
    if (!elites.length) return null;

    // Uniform cell sampling protects diversity. The deterministic RNG makes an
    // experiment replayable from its seed and event log.
    return elites[this.random.integer(elites.length)];
  }

  get coverage() {
    return this.cells.size / (this.binsX * this.binsY);
  }

  get best() {
    let best = null;
    for (const elite of this.cells.values()) {
      if (!best || elite.fitness > best.fitness) best = elite;
    }
    return best;
  }

  snapshot() {
    return {
      schema: 'nexus.map-elites.v1',
      binsX: this.binsX,
      binsY: this.binsY,
      coverage: this.coverage,
      insertions: this.insertions,
      replacements: this.replacements,
      randomState: this.random.state,
      elites: [...this.cells.values()].map((elite) => ({
        ...elite,
        genome: structuredClone(elite.genome),
      })),
    };
  }
}
