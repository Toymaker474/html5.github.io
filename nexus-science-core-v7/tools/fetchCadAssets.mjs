import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(projectRoot, 'public', 'cad');
const sourceRepository = 'MakeYourPet/hexapod';
const sourceCommit = '7d8fc8034d715d1c9373f48281ecfa500c994d8b';
const sourceRoot = `https://raw.githubusercontent.com/${sourceRepository}/${sourceCommit}`;

const assets = Object.freeze([
  { id: 'frame', path: 'STL/frame.stl' },
  { id: 'top-cover', path: 'STL/top-cover4.stl' },
  { id: 'bottom-cover', path: 'STL/bottom-cover-flat.stl' },
  { id: 'coxa-left', path: 'STL/left-coxa2.stl' },
  { id: 'coxa-right', path: 'STL/right-coxa2.stl' },
  { id: 'femur-left', path: 'STL/left-femur.stl' },
  { id: 'femur-right', path: 'STL/right-femur.stl' },
  { id: 'tibia-left', path: 'STL/left-tibia.stl' },
  { id: 'tibia-right', path: 'STL/right-tibia.stl' },
  { id: 'foot-tip', path: 'STL/tip.stl' },
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function gitBlobSha1(bytes) {
  const prefix = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(prefix).update(bytes).digest('hex');
}

function assertStl(bytes, id) {
  if (bytes.length < 512) throw new Error(`${id}: asset is implausibly small (${bytes.length} bytes).`);
  const leading = bytes.subarray(0, Math.min(bytes.length, 256)).toString('utf8').toLowerCase();
  if (leading.includes('<html') || leading.includes('<!doctype')) {
    throw new Error(`${id}: received HTML instead of CAD data.`);
  }

  const ascii = leading.trimStart().startsWith('solid') && leading.includes('facet');
  if (ascii) return 'ascii-stl';
  if (bytes.length < 84) throw new Error(`${id}: incomplete binary STL header.`);

  const triangleCount = bytes.readUInt32LE(80);
  const expectedLength = 84 + triangleCount * 50;
  if (triangleCount < 4 || expectedLength > bytes.length) {
    throw new Error(`${id}: invalid binary STL triangle table (${triangleCount} triangles, ${bytes.length} bytes).`);
  }
  return 'binary-stl';
}

async function fetchImmutableAsset(asset) {
  const url = `${sourceRoot}/${asset.path.split('/').map(encodeURIComponent).join('/')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'NEXUS-V7-reproducible-asset-builder' },
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`${asset.id}: source returned HTTP ${response.status}.`);

  const bytes = Buffer.from(await response.arrayBuffer());
  const encoding = assertStl(bytes, asset.id);
  const fileName = `${asset.id}.stl`;
  const outputPath = join(outputDirectory, fileName);
  await writeFile(outputPath, bytes);

  return Object.freeze({
    id: asset.id,
    file: fileName,
    bytes: bytes.length,
    triangles: encoding === 'binary-stl' ? bytes.readUInt32LE(80) : null,
    encoding,
    sha256: sha256(bytes),
    gitBlobSha1: gitBlobSha1(bytes),
    sourcePath: asset.path,
    sourceUrl: url,
  });
}

async function existingManifestIsComplete() {
  try {
    const manifest = JSON.parse(await readFile(join(outputDirectory, 'manifest.json'), 'utf8'));
    if (manifest.sourceCommit !== sourceCommit || manifest.assets.length !== assets.length) return false;
    for (const asset of manifest.assets) {
      const bytes = await readFile(join(outputDirectory, asset.file));
      if (sha256(bytes) !== asset.sha256) return false;
    }
    return true;
  } catch {
    return false;
  }
}

await mkdir(outputDirectory, { recursive: true });
if (await existingManifestIsComplete()) {
  console.log(`CAD assets already verified at ${sourceCommit}.`);
  process.exit(0);
}

const resolvedAssets = [];
for (const asset of assets) resolvedAssets.push(await fetchImmutableAsset(asset));

const manifest = Object.freeze({
  schema: 'nexus.cad-asset-manifest.v1',
  sourceRepository,
  sourceCommit,
  license: 'MIT',
  attribution: 'Original hexapod CAD by MakeYourPet.com; adapted as a visual shell for NEXUS V7.',
  generatedAt: new Date().toISOString(),
  assets: resolvedAssets,
});

await writeFile(join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(
  join(outputDirectory, 'ATTRIBUTION.txt'),
  [
    'NEXUS V7 CAD VISUAL SOURCE',
    '',
    'Original CAD: MakeYourPet Hexapod',
    `Repository: https://github.com/${sourceRepository}`,
    `Pinned source commit: ${sourceCommit}`,
    'License: MIT',
    'Copyright (c) 2022 MakeYourPet.com',
    '',
    'The NEXUS physics model, controller, experiments, renderer integration, materials, optimization and interface are separate project work.',
    '',
  ].join('\n'),
  'utf8',
);

console.log(JSON.stringify(manifest, null, 2));
