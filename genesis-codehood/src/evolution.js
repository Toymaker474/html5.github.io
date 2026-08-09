import { crossoverPrograms, mutateProgram, randomProgram, cloneProgram } from './vm.js';
import { TASKS, VERIFY_CASES, evaluateProgram, SEED_PROGRAMS } from './tasks.js';

export const ROLES = Object.freeze(['BUILDER','CRITIC','TESTER','OPTIMIZER','ARCHITECT','SECURITY']);
export const TASK_NAMES = Object.freeze(Object.keys(TASKS));

export function seededLibrary() {
  const library = {};
  for (const [task, code] of Object.entries(SEED_PROGRAMS)) {
    const program = code.map(op => ({op,arg:0}));
    const report = evaluateProgram(program, task);
    library[task] = { task, program, report, author: 'SEED-EVOLUTION', version: 1, tick: 0 };
  }
  return library;
}

export function createAgent(id, rng = Math.random, parent = null, library = {}) {
  const task = TASK_NAMES[(rng() * TASK_NAMES.length) | 0];
  let program = randomProgram(rng);
  if (parent) program = mutateProgram(parent.program, rng);
  else if (library[task] && rng() < 0.42) program = mutateProgram(library[task].program, rng);
  return {
    id,
    label: `A-${String(id).padStart(5,'0')}`,
    role: ROLES[(rng()*ROLES.length)|0],
    task,
    program,
    generation: parent ? parent.generation + 1 : 0,
    money: parent ? 40 : 20 + rng()*80,
    energy: 65 + rng()*35,
    skill: parent ? parent.skill*0.92 : 0,
    age: 0,
    alive: true,
    x: rng(), y: rng(), tx: rng(), ty: rng(),
    vx: 0, vy: 0,
    risk: rng() < 0.035 ? 0.8 + rng()*0.8 : rng()*0.15,
    lastJob: 0,
    lastConflict: 0,
    lineage: parent ? parent.id : null,
    stats: { jobs:0, verified:0, critiques:0, conflicts:0 }
  };
}

export function scoreCandidate(agent, library, rng = Math.random) {
  const task = TASKS[agent.task];
  const sample = [];
  for (let i=0;i<24;i++) sample.push(VERIFY_CASES[(rng()*VERIFY_CASES.length)|0]);
  const report = evaluateProgram(agent.program, agent.task, sample);
  const correctness = report.passRate;
  const efficiency = 1 / (1 + report.avgSteps * 0.025 + agent.program.length * 0.03);
  const score = correctness * 1000 + efficiency * 100;
  const pay = correctness > 0.60 ? (4 + correctness * task.reward * 0.22) : 0;
  agent.money += pay;
  agent.skill = Math.min(100, agent.skill + correctness * 0.65);
  agent.stats.jobs += 1;

  if (report.verified) {
    const full = evaluateProgram(agent.program, agent.task, VERIFY_CASES);
    if (full.verified) {
      const prior = library[agent.task];
      const better = !prior || agent.program.length < prior.program.length || full.avgSteps < prior.report.avgSteps;
      if (better) {
        library[agent.task] = {
          task: agent.task,
          program: cloneProgram(agent.program),
          report: full,
          author: agent.label,
          version: (prior?.version ?? 0) + 1,
          tick: 0
        };
      }
      agent.money += task.reward;
      agent.stats.verified += 1;
      return { report: full, score, pay: pay + task.reward, shipped: true, improved: better };
    }
  }

  if (report.passRate < 0.35 && library[agent.task] && rng() < 0.20) {
    agent.program = crossoverPrograms(agent.program, library[agent.task].program, rng);
  } else {
    agent.program = mutateProgram(agent.program, rng);
  }
  return { report, score, pay, shipped: false, improved: false };
}

export function critiqueAgent(critic, target) {
  const full = evaluateProgram(target.program, target.task, VERIFY_CASES);
  if (!full.verified) {
    critic.money += 5;
    critic.skill = Math.min(100, critic.skill + 0.18);
    critic.stats.critiques += 1;
    return full.firstFailure;
  }
  return null;
}
