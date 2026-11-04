#!/usr/bin/env node
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = resolve(root, 'app/vendor');
const chunks = resolve(outdir, 'enhancement-chunks');
await mkdir(chunks, { recursive: true });
const reactBitsLicense = await readFile(resolve(root, 'docs/third-party/react-bits-LICENSE.md'), 'utf8');
const result = await build({
  absWorkingDir: root,
  entryPoints: { enhancements: 'app/enhancements/index.jsx' }, outdir,
  chunkNames: 'enhancement-chunks/[name]-[hash]', splitting: true, metafile: true,
  bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['es2020'],
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'text' }, legalComments: 'eof', sourcemap: false,
  banner: { js: `/*! Naarad optional enhancements. React Bits AnimatedContent:\n${reactBitsLicense}\nSource and adaptations: /docs/third-party/react-bits.md\n*/` },
});
const assets = Object.keys(result.metafile.outputs).map((path) => `/${path}`).sort();
const sizes = {};
for (const asset of assets) {
  const bytes = await readFile(resolve(root, asset.slice(1)));
  sizes[asset] = { bytes: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
  console.log(`${asset}: ${sizes[asset].bytes} bytes; ${sizes[asset].gzip} bytes gzip`);
}
// Only this build's dedicated generated chunk directory is pruned. Other
// vendor assets remain untouched; failure above preserves the prior manifest.
for (const name of await readdir(chunks)) {
  const path = resolve(chunks, name);
  if (name.endsWith('.js') && !assets.includes(`/${relative(root, path)}`)) await unlink(path);
}
await writeFile(resolve(outdir, 'enhancements-manifest.json'), `${JSON.stringify({
  version: 1, entry: '/app/vendor/enhancements.js', assets, sizes,
}, null, 2)}\n`);
