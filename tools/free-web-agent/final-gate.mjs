// SPDX-License-Identifier: MIT
import { readFile, writeFile } from 'node:fs/promises';

const readJson = async file => {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
};

const mobile = await readJson('artifacts/mobile/mobile-audit.json');
const bundle = await readJson('artifacts/bundle-budget.json');
const foundry = await readJson('artifacts/tool-foundry-report.json');
const npmAudit = await readJson('artifacts/npm-audit.json');
const leaks = await readJson('gitleaks-report.json');

const failures = [];
if (!mobile) failures.push('The phone-sized browser test did not finish.');
else if (!mobile.passed) failures.push(...(mobile.failures || ['The phone-sized browser test failed.']));

if (!bundle) failures.push('The mobile download-size check did not finish.');
else if (!bundle.passed) failures.push(...(bundle.failures || ['The mobile download-size check failed.']));

if (!foundry) failures.push('The open-source Tool Foundry did not produce a report.');
else if (!foundry.passed) failures.push(`Required tools are missing: ${(foundry.missingRequired || []).join(', ')}`);

if (!npmAudit) {
  failures.push('The npm dependency-security scan did not produce a readable report.');
} else {
  const vulnerabilities = npmAudit.metadata?.vulnerabilities || {};
  const highOrCritical = Number(vulnerabilities.high || 0) + Number(vulnerabilities.critical || 0);
  if (highOrCritical > 0) failures.push(`npm reports ${highOrCritical} high or critical package vulnerability finding(s).`);
}

if (!Array.isArray(leaks)) failures.push('The secret scan did not produce a readable report.');
else if (leaks.length > 0) failures.push(`The secret scanner still reports ${leaks.length} possible credential leak(s).`);

const result = {
  schema: 'nexus.free-web-agent.final-gate.v2',
  passed: failures.length === 0,
  failures,
  checkedCommit: process.env.GITHUB_SHA || null,
  workflowRun: process.env.GITHUB_RUN_ID || null,
};
await writeFile('artifacts/final-gate.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
