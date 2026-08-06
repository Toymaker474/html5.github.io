// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const catalogPath = 'tools/free-web-agent/capabilities.json';
const templateRoot = 'tools/free-web-agent/templates';
const outputRoot = 'artifacts/generated-tools';
const excludedEvidenceFiles = new Set([
  catalogPath,
  'tools/free-web-agent/tool-foundry.mjs',
  'tools/free-web-agent/tool-foundry-v2.mjs',
  'tools/free-web-agent/OPEN_SOURCE_TOOL_FOUNDRY.md',
]);

const read = file => readFile(file, 'utf8').catch(() => '');
const hashFile = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);
const evidenceFiles = trackedFiles.filter(file =>
  !excludedEvidenceFiles.has(file) &&
  !file.startsWith(`${templateRoot}/`) &&
  (file.endsWith('/package.json') ||
    file === 'package.json' ||
    file.startsWith('.github/workflows/') ||
    file.startsWith('tools/free-web-agent/')));
const evidenceText = (await Promise.all(evidenceFiles.map(read))).join('\n');
const catalog = JSON.parse(await read(catalogPath));
await mkdir(outputRoot, { recursive: true });

const results = [];
const generated = [];
for (const capability of catalog.capabilities) {
  const trackedImplementation = capability.generate
    ? trackedFiles.includes(`tools/free-web-agent/${capability.generate}.mjs`)
    : false;
  const tokenEvidence = capability.evidenceTokens.every(token => evidenceText.includes(token));
  const found = trackedImplementation || tokenEvidence;

  if (found) {
    results.push({ ...capability, status: 'found' });
    continue;
  }

  if (!capability.generate) {
    results.push({
      ...capability,
      status: capability.required ? 'missing-required' : 'missing-optional',
    });
    continue;
  }

  const source = path.join(templateRoot, `${capability.generate}.mjs`);
  const destination = path.join(outputRoot, `${capability.generate}.mjs`);
  const sourceText = await read(source);
  if (!sourceText) {
    results.push({ ...capability, status: 'missing-required-template' });
    continue;
  }

  await copyFile(source, destination);
  const record = {
    capability: capability.id,
    source,
    file: destination,
    command: `node ${destination}`,
    sha256: await hashFile(destination),
    license: capability.license,
  };
  generated.push(record);
  results.push({ ...capability, status: 'generated', generatedFile: destination });
}

const missingRequired = results.filter(item =>
  item.status === 'missing-required' || item.status === 'missing-required-template');
const manifest = {
  schema: 'nexus.generated-tools-manifest.v2',
  sourceCommit: process.env.GITHUB_SHA || null,
  tools: generated,
};
const report = {
  schema: 'nexus.tool-foundry-report.v2',
  policy: catalog.policy,
  inspectedFiles: evidenceFiles.length,
  capabilities: results,
  generated,
  missingRequired: missingRequired.map(item => item.id),
  passed: missingRequired.length === 0,
};

await writeFile(`${outputRoot}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
await writeFile('artifacts/tool-foundry-report.json', JSON.stringify(report, null, 2) + '\n');
const markdown = [
  '# NEXUS Tool Foundry v2',
  '',
  report.passed
    ? '✅ Every required capability was found or built from an open-source template.'
    : '❌ A required capability is still missing.',
  '',
  '| Capability | Result | Tool |',
  '|---|---|---|',
  ...results.map(item => `| ${item.id} | ${item.status} | ${item.preferredTool || item.generatedFile || 'missing'} |`),
  '',
  '## Tools built this run',
  '',
  ...(generated.length
    ? generated.map(item => `- \`${item.command}\` — SHA-256 \`${item.sha256}\``)
    : ['- None were needed.']),
  '',
].join('\n');
await writeFile('artifacts/tool-foundry-report.md', markdown);
console.log(markdown);
if (!report.passed) process.exitCode = 1;
