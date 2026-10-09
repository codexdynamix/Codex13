// Packages the built frontend plus the PHP API into a Hostinger public_html ZIP.
// Usage: npm run build && npm run package:hostinger
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(projectRoot, 'artifacts/codex-dynamics');
const publicDir = path.join(appDir, 'public');
const distDir = path.join(appDir, 'dist/public');
const outFile = path.resolve(process.argv[2] || path.join(appDir, 'dist/hostinger-public_html.zip'));
const PRIVATE_API_ENTRIES = new Set(['data', 'config.php']);

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error(`No frontend build found in ${distDir}. Run "npm run build" first.`);
  process.exit(1);
}

function addDirectory(directory, target, excludePrivateData = false) {
  for (const name of fs.readdirSync(directory)) {
    if (excludePrivateData && PRIVATE_API_ENTRIES.has(name)) continue;
    const source = path.join(directory, name);
    if (fs.statSync(source).isDirectory()) addDirectory(source, target.folder(name), excludePrivateData);
    else target.file(name, fs.readFileSync(source));
  }
}

const zip = new JSZip();
addDirectory(distDir, zip);
for (const file of ['README-HOSTINGER.txt', '.htaccess']) {
  const source = path.join(publicDir, file);
  if (fs.existsSync(source)) zip.file(file, fs.readFileSync(source));
}
zip.remove('api');
addDirectory(path.join(publicDir, 'api'), zip.folder('api'), true);

const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, archive);
console.log(`Wrote ${path.relative(process.cwd(), outFile)} (${(archive.length / 1024 / 1024).toFixed(1)} MB)`);
