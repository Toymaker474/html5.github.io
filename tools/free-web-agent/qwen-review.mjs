import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readText = async (path, limit = 14_000) => {
  try {
    const text = await readFile(path, 'utf8');
    return text.length > limit ? `${text.slice(0, limit)}\n...[cut for safety]` : text;
  } catch {
    return '[file unavailable]';
  }
};

const mobileAudit = await readText('artifacts/mobile/mobile-audit.json', 9_000);
const packageJson = await readText('nexus-science-core-v7/package.json', 4_000);
const mainSource = await readText('nexus-science-core-v7/src/main.js', 12_000);
const cameraSource = await readText('nexus-science-core-v7/src/mobileCameraFraming.js', 12_000);

const prompt = `You are the independent open-source NEXUS web reviewer.
Use normal human language. Do not pretend you ran anything beyond the evidence below.
Do not propose subscriptions, paid APIs, fake telemetry, or visual tricks.
Do not write code and do not approve release.

Return exactly these headings:
WHAT LOOKS GOOD
WHAT MAY BE BROKEN
BEST NEXT SMALL STEP
MOBILE WARNING

Focus on real simulation correctness, iPhone usability, performance, and whether the evidence supports its claims.

MOBILE TEST EVIDENCE:
${mobileAudit}

PACKAGE:
${packageJson}

MAIN SOURCE EXCERPT:
${mainSource}

MOBILE CAMERA SOURCE EXCERPT:
${cameraSource}`;

const response = await fetch('http://127.0.0.1:11434/api/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen2.5-coder:0.5b-instruct-q4_K_M',
    stream: false,
    options: {
      temperature: 0.1,
      num_ctx: 16384,
      num_predict: 700,
      seed: 474,
    },
    messages: [
      { role: 'system', content: 'Be factual, cautious, brief, and easy to understand.' },
      { role: 'user', content: prompt },
    ],
  }),
});

if (!response.ok) {
  throw new Error(`Ollama returned HTTP ${response.status}: ${await response.text()}`);
}

const payload = await response.json();
const review = payload?.message?.content?.trim();
if (!review) throw new Error('Qwen returned an empty review.');

await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/open-source-ai-review.md',
  `**Model:** Qwen2.5-Coder 0.5B, running inside this GitHub job through Ollama.\n\n${review}\n`,
);
console.log(review);
