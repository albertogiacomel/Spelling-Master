import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const kitRoot = resolve(root, '..', 'videogames-kit');
const commit = 'a2ea2f89926ea9029aae7e15002f4154e7c54a86';
const destination = join(root, 'shared', 'videogames-kit');
const tree = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, 'src', 'styles', 'adapters'], {
  cwd: kitRoot,
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean).sort();

if (tree.some((path) => !/^(?:src|styles|adapters)\/[a-z0-9_.-]+$/iu.test(path))) {
  throw new Error('Unexpected kit path in pinned tree');
}

const files = [];
for (const path of tree) {
  const data = execFileSync('git', ['show', `${commit}:${path}`], { cwd: kitRoot });
  const target = join(destination, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  files.push({ path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}

await writeFile(join(destination, 'README.md'), await readFile(join(kitRoot, 'README.md')));
await writeFile(join(destination, '.gitattributes'), '*.js text eol=lf\n');
await writeFile(join(destination, 'manifest.json'), JSON.stringify({
  name: '@albertogiacomel/videogames-kit',
  version: '0.3.0',
  source: { repository: 'albertogiacomel/videogames-kit', commit, dirty: false },
  files,
}, null, 2) + '\n', 'utf8');

console.log(`Vendored ${files.length} kit files at ${commit.slice(0, 7)}`);
