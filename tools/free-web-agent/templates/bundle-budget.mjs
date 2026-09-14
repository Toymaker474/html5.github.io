// SPDX-License-Identifier: MIT
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
await writeFile('artifacts/bundle-budget.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
