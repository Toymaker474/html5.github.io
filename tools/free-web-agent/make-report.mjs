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
  lines.push('The phone-sized browser test did not produce a result. Check the workflow log for the first failed step.');
} else if (mobile.passed) {
  lines.push('✅ The simulation opened in a phone-sized browser, the real simulation clock moved, the canvas rendered, and the basic mobile controls passed.');
} else {
  lines.push('❌ The simulation is not ready. The cloud test found these problems:');
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

lines.push(
  '',
  '## What the tools did',
  '',
  '- GitHub Actions supplied the temporary cloud computer.',
  '- Vite built the real GitHub.io simulation.',
  '- Playwright opened it as a touch phone and saved a screenshot.',
  '- Lighthouse checked web quality without uploading data to a paid service.',
  '- npm audit checked JavaScript packages.',
  '- Gitleaks checked the repository for accidentally committed passwords or keys.',
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
  'This agent may test, explain, and open/update a status issue. It cannot merge itself into the live site or silently publish model-written code.',
  '',
);

await writeFile('artifacts/web-agent-report.md', `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
