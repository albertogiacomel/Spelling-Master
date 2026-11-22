import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const kitRoot = resolve(root, '..', 'videogames-kit');
const commit = 'a2ea2f89926ea9029aae7e15002f4154e7c54a86';
const host = 'spelling.giacomel.info';
const destination = join(root, 'site-privacy');
const files = [
  'runtime.js',
  'site.css',
  'favicon.svg',
  'design-tokens.css',
  'fonts/inter-latin.woff2',
  'fonts/OFL.txt',
  'fonts/provenance.json',
  'privacy.html',
  '.gitattributes',
  'vendor/klaro-0.7.21/klaro-no-css.js',
  'vendor/klaro-0.7.21/klaro.min.css',
  'vendor/klaro-0.7.21/LICENSE',
  'vendor/klaro-0.7.21/provenance.json',
];

const manifest = {
  name: 'giacomel-site-privacy',
  version: '1.2.0',
  site: host,
  source: { repository: 'albertogiacomel/videogames-kit', commit, dirty: false },
  files: [],
};

for (const path of files) {
  const data = execFileSync('git', ['show', `${commit}:site-privacy/${path}`], { cwd: kitRoot });
  const target = join(destination, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  manifest.files.push({ path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}

await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`Vendored ${manifest.files.length} privacy assets for ${host}`);
