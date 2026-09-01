// SPDX-License-Identifier: MIT
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readJson = async path => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
};

await mkdir('artifacts', { recursive: true });
const mobile = await readJson('artifacts/mobile/mobile-audit.json');
const bundle = await readJson('artifacts/bundle-budget.json');
const foundry = await readJson('artifacts/tool-foundry-report.json');
const leaks = await readJson('gitleaks-report.json');
const aiText = await readFile('artifacts/open-source-ai-review.md', 'utf8').catch(() => '');
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : 'Not available';

const lines = [
  '# NEXUS free web-agent status',
  '',
  `**Checked commit:** \`${process.env.GITHUB_SHA || 'unknown'}\``,
  `**Cloud run:** ${runUrl}`,
  '',
  '## Plain-language result',
  '',
];

if (!mobile) {
  lines.push('The phone-sized browser test did not produce a result. Check the first failed workflow step.');
} else if (mobile.passed) {
  lines.push('✅ The simulation opened in a phone-sized touch browser, the real simulation clock moved, the canvas rendered, and the basic mobile controls passed.');
} else {
  lines.push('❌ The simulation is not ready. The cloud phone test found these problems:');
  for (const failure of mobile.failures || []) lines.push(`- ${failure}`);
}

if (mobile) {
  lines.push(
    '',
    '## Mobile facts',
    '',
    `- Screen tested: **${mobile.viewport?.width || '?'} × ${mobile.viewport?.height || '?'}**`,
    `- Simulation time reached: **${Number(mobile.runtimeTime || 0).toFixed(2)} seconds**`,
    `- Connected legs reported: **${mobile.connectedLegs || 0}**`,
    `- Smallest visible control: **${mobile.minimumVisibleButtonHeight || 0}px**`,
    `- Sideways overflow: **${mobile.horizontalOverflowPixels || 0}px**`,
    `- Browser errors: **${(mobile.diagnostics || []).filter(item => item.level === 'error').length}**`,
  );
}

lines.push('', '## Download-size check', '');
if (!bundle) {
  lines.push('The download-size tool did not finish.');
} else {
  lines.push(
    `- Complete built site: **${(bundle.totalBytes / 1024 / 1024).toFixed(2)} MB**`,
    `- Largest JavaScript file: **${(bundle.largestJavaScript?.bytes / 1024 / 1024).toFixed(2)} MB**`,
    `- Largest WebAssembly file: **${(bundle.largestWasm?.bytes / 1024 / 1024).toFixed(2)} MB**`,
    `- Result: **${bundle.passed ? 'PASS' : 'FAIL'}**`,
  );
}

lines.push('', '## Open-source Tool Foundry', '');
if (!foundry) {
  lines.push('The Tool Foundry did not finish.');
} else {
  const generated = foundry.generated || [];
  lines.push(
    `- Required capabilities ready: **${foundry.passed ? 'yes' : 'no'}**`,
    `- Reusable tools generated during this run: **${generated.length}**`,
  );
  for (const tool of generated) lines.push(`- Built \`${tool.file}\` for **${tool.capability}**.`);
  if ((foundry.missingRequired || []).length) {
    lines.push(`- Still missing: **${foundry.missingRequired.join(', ')}**`);
  }
}

lines.push('', '## Security check', '');
if (!Array.isArray(leaks)) {
  lines.push('The secret scan did not produce a readable report.');
} else if (leaks.length === 0) {
  lines.push('✅ No unapproved passwords or API keys were reported.');
} else {
  lines.push(`❌ The scanner reports **${leaks.length} possible credential leak(s)**. The live release must remain blocked until they are explained or removed.`);
}

lines.push(
  '',
  '## What the tools did',
  '',
  '- GitHub Actions supplied the temporary cloud computer.',
  '- Vite built the real GitHub.io simulation.',
  '- Playwright opened it as a touch phone and saved a screenshot.',
  '- Lighthouse checked web quality without uploading data to a paid service.',
  '- npm audit checked JavaScript packages.',
  '- Gitleaks checked Git history for accidentally committed passwords or keys.',
  '- NEXUS Tool Foundry created missing reusable checks from source-controlled templates.',
  '- The evidence tool hashed reports and screenshots so results stay tied together.',
  '',
  '## Open-source AI review',
  '',
);

if (aiText.trim()) lines.push(aiText.trim());
else lines.push('The small Qwen web model did not produce a review during this run. No fake local-agent answer was substituted.');

lines.push(
  '',
  '## Safety rule',
  '',
  'This agent may build, test, explain, generate isolated tools, and update one status issue. It cannot merge itself into the live site or silently publish AI-written code.',
  '',
);

await writeFile('artifacts/web-agent-report.md', `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
