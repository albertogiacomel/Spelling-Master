import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const url = process.env.GAME_PUBLIC_URL || 'https://spelling.giacomel.info/';
if (new URL(url).protocol !== 'https:') throw new Error('GAME_PUBLIC_URL must use HTTPS');

const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
assert.equal(response.status, 200, `HTTP ${response.status}`);
const received = Buffer.from(await response.arrayBuffer());
const local = await readFile(join(root, 'dist/index.html'));
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');

assert.equal(hash(received), hash(local), 'Public HTML differs from the verified local build');
const html = received.toString('utf8');
assert.ok(html.includes('id="spelling-runtime"'));
assert.ok(html.includes('site-privacy/runtime.js'));
assert.ok(html.includes('data-site-profile="game"'));

for (const name of ['runtime.js', 'site.css', 'design-tokens.css', 'manifest.json']) {
  const asset = await fetch(new URL(`site-privacy/${name}`, url), { signal: AbortSignal.timeout(20000) });
  assert.equal(asset.status, 200, `Missing ${name}`);
  const bytes = Buffer.from(await asset.arrayBuffer());
  assert.equal(hash(bytes), hash(await readFile(join(root, 'dist/site-privacy', name))), `${name} differs`);
}

const privacy = await fetch(new URL('privacy.html', url), { signal: AbortSignal.timeout(20000) });
assert.equal(privacy.status, 200);
const ads = await fetch(new URL('ads.txt', url), { signal: AbortSignal.timeout(20000) });
assert.equal(ads.status, 200);
assert.ok((await ads.text()).includes('pub-8896739816580918'));

const report = {
  timestamp: new Date().toISOString(),
  url,
  status: 'PASS',
  bytes: received.length,
  sha256: hash(received),
  checked: ['index.html', 'site-privacy/runtime.js', 'site-privacy/site.css', 'site-privacy/design-tokens.css', 'site-privacy/manifest.json', 'privacy.html', 'ads.txt'],
};
await mkdir(join(root, 'artifacts'), { recursive: true });
await writeFile(join(root, 'artifacts/live.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
