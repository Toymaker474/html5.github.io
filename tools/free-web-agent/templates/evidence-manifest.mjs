// SPDX-License-Identifier: MIT
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
await writeFile('artifacts/evidence-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
