import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');

const [html, productCss, kitCss, integrationCss] = await Promise.all([
  readFile(join(root, 'src/index.html'), 'utf8'),
  readFile(join(root, 'src/style.css'), 'utf8'),
  readFile(join(root, 'shared/videogames-kit/styles/game-ui.css'), 'utf8'),
  readFile(join(root, 'shared/videogames-kit/styles/integration.css'), 'utf8'),
]);

const bundle = await build({
  entryPoints: [join(root, 'src/main.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  minify: true,
  legalComments: 'none',
});
const script = bundle.outputFiles[0]?.text;
if (!script) throw new Error('Empty JavaScript bundle');
new Script(script);

const output = html
  .replace('/* INLINE_CSS */', () => `${kitCss}\n${integrationCss}\n${productCss}`)
  .replace('/* INLINE_JS */', () => script);

const bytes = Buffer.byteLength(output, 'utf8');
if (bytes > 180000) throw new Error(`HTML budget exceeded: ${bytes} bytes (limit 180000)`);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(join(dist, 'index.html'), output, 'utf8');
await cp(join(root, 'site-privacy'), join(dist, 'site-privacy'), { recursive: true });
await cp(join(root, 'site-privacy/privacy.html'), join(dist, 'privacy.html'));
for (const file of ['ads.txt', 'robots.txt', '_headers', 'icon.svg', 'site.webmanifest']) {
  await cp(join(root, 'public', file), join(dist, file));
}
await writeFile(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://spelling.giacomel.info/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
</urlset>
`, 'utf8');

const receipt = {
  generated_at: new Date().toISOString(),
  bytes,
  sha256: createHash('sha256').update(output, 'utf8').digest('hex'),
  script_bytes: Buffer.byteLength(script, 'utf8'),
  css_bytes: Buffer.byteLength(productCss + kitCss + integrationCss, 'utf8'),
};
await mkdir(join(root, 'artifacts'), { recursive: true });
await writeFile(join(root, 'artifacts/build.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log(`Build: ${bytes} bytes (HTML+CSS+JS), SHA256 ${receipt.sha256}`);
