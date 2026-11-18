import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid build target');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ['index.html', 'src']) {
  await stat(path.join(root, entry));
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}
for (const entry of ['styles.css', 'style.css', 'assets', 'manifest.webmanifest', 'manifest.json', 'favicon.svg', 'favicon.ico', 'sw.js']) {
  try {
    await stat(path.join(root, entry));
    await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
try { await cp(path.join(root, 'public'), output, { recursive: true }); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

// Public user guides only; Worker source and local configuration stay outside dist.
try {
  const guideNames = (await readdir(path.join(root, 'docs'))).filter(name => /^[A-Z][A-Z_]*\.md$/.test(name));
  if (guideNames.length) await mkdir(path.join(output, 'docs'), { recursive: true });
  for (const name of guideNames) await cp(path.join(root, 'docs', name), path.join(output, 'docs', name));
} catch (error) { if (error.code !== 'ENOENT') throw error; }

await writeFile(path.join(output, '.nojekyll'), '');
// Hash navigation keeps lesson URLs valid below any GitHub project prefix.
await writeFile(path.join(output, '404.html'), await readFile(path.join(output, 'index.html')));
console.log('Built static website: dist/');
