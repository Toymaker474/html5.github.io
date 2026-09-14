// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG_PATH = 'tools/free-web-agent/capabilities.json';
const OUTPUT_ROOT = 'artifacts/generated-tools';

const read = async file => readFile(file, 'utf8').catch(() => '');
const sha256 = text => createHash('sha256').update(text).digest('hex');

const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(file => !file.startsWith('node_modules/') && !file.includes('/dist/'));

const searchableFiles = trackedFiles.filter(file =>
  file === 'package.json' ||
  file.endsWith('/package.json') ||
  file.startsWith('.github/workflows/') ||
  file.startsWith('tools/free-web-agent/'));

const searchableText = (await Promise.all(searchableFiles.map(read))).join('\n');
const catalog = JSON.parse(await read(CATALOG_PATH));
await mkdir(OUTPUT_ROOT, { recursive: true });

const templates = {
  'bundle-budget': `// SPDX-License-Identifier: MIT
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = 'nexus-science-core-v7/dist';
const limits = {
  totalBytes: 28 * 1024 * 1024,
  largestJavaScriptBytes: 6 * 1024 * 1024,
  largestWasmBytes: 12 * 1024 * 1024,
};

async function walk(directory) {
  const output = [];
  for (const name of await readdir(directory)) {
    const file = path.join(directory, name);
    const info = await stat(file);
    if (info.isDirectory()) output.push(...await walk(file));
    else output.push({ file, bytes: info.size });
  }
  return output;
}

const files = await walk(root);
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const largest = extension => files
  .filter(file => file.file.endsWith(extension))
  .sort((a, b) => b.bytes - a.bytes)[0] || { file: null, bytes: 0 };
const largestJavaScript = largest('.js');
const largestWasm = largest('.wasm');
const failures = [];
if (totalBytes > limits.totalBytes) failures.push('The complete phone download is above the 28 MB safety budget.');
if (largestJavaScript.bytes > limits.largestJavaScriptBytes) failures.push('The largest JavaScript file is above the 6 MB safety budget.');
if (largestWasm.bytes > limits.largestWasmBytes) failures.push('The largest WebAssembly file is above the 12 MB safety budget.');
const report = {
  schema: 'nexus.bundle-budget.v1',
  limits,
  totalBytes,
  largestJavaScript,
  largestWasm,
  fileCount: files.length,
  failures,
  passed: failures.length === 0,
};
await writeFile('artifacts/bundle-budget.json', JSON.stringify(report, null, 2) + '\\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
`,
  'evidence-manifest': `// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function walk(directory) {
  const output = [];
  for (const name of await readdir(directory).catch(() => [])) {
    const file = path.join(directory, name);
    if (file.endsWith('evidence-manifest.json')) continue;
    const info = await stat(file);
    if (info.isDirectory()) output.push(...await walk(file));
    else output.push(file);
  }
  return output;
}

const files = (await walk('artifacts')).sort();
const records = [];
for (const file of files) {
  const bytes = await readFile(file);
  records.push({
    file,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const manifest = {
  schema: 'nexus.evidence-manifest.v1',
  sourceCommit: process.env.GITHUB_SHA || null,
  workflowRun: process.env.GITHUB_RUN_ID || null,
  files: records,
};
await writeFile('artifacts/evidence-manifest.json', JSON.stringify(manifest, null, 2) + '\\n');
console.log(JSON.stringify(manifest, null, 2));
`,
};

const results = [];
const generated = [];
for (const capability of catalog.capabilities) {
  const found = capability.evidenceTokens.every(token => searchableText.includes(token));
  if (found) {
    results.push({ ...capability, status: 'found' });
    continue;
  }

  const template = capability.generate ? templates[capability.generate] : null;
  if (!template) {
    results.push({ ...capability, status: capability.required ? 'missing-required' : 'missing-optional' });
    continue;
  }

  const filename = `${capability.generate}.mjs`;
  const outputPath = path.join(OUTPUT_ROOT, filename);
  await writeFile(outputPath, template);
  generated.push({
    capability: capability.id,
    file: outputPath,
    command: `node ${outputPath}`,
    sha256: sha256(template),
    license: capability.license,
  });
  results.push({ ...capability, status: 'generated', generatedFile: outputPath });
}

const missingRequired = results.filter(item => item.status === 'missing-required');
const report = {
  schema: 'nexus.tool-foundry-report.v1',
  policy: catalog.policy,
  inspectedFiles: searchableFiles.length,
  capabilities: results,
  generated,
  missingRequired: missingRequired.map(item => item.id),
  passed: missingRequired.length === 0,
};

await writeFile('artifacts/tool-foundry-report.json', JSON.stringify(report, null, 2) + '\n');
const markdown = [
  '# NEXUS Tool Foundry',
  '',
  report.passed
    ? '✅ Every required capability was found or generated.'
    : '❌ A required capability is still missing.',
  '',
  '| Capability | Result | Tool |',
  '|---|---|---|',
  ...results.map(item => `| ${item.id} | ${item.status} | ${item.preferredTool || item.generatedFile || 'NEXUS must build it'} |`),
  '',
  '## Generated tools',
  '',
  ...(generated.length
    ? generated.map(item => `- \`${item.command}\` — SHA-256 \`${item.sha256}\``)
    : ['- None needed.']),
  '',
].join('\n');
await writeFile('artifacts/tool-foundry-report.md', markdown);
console.log(markdown);
if (!report.passed) process.exitCode = 1;
