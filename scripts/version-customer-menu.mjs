import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [site, release] = process.argv.slice(2);
if (!site || !/^[a-f0-9]{40}$/.test(release || '')) {
  throw new Error('Usage: node scripts/version-customer-menu.mjs <site> <commit-sha>');
}

const page = join(site, 'menu/index.html');
const html = readFileSync(page, 'utf8');
// The menu's <base href="../"> resolves its script and stylesheet URLs to the site root.
const assets = /(<(?:script|link)\b[^<>]*?\s(?:src|href)=")((?:js|css)\/[\w./-]+\.(?:js|css))(?:\?[^"#]*)?(")/g;
const versions = new Map();
const versioned = html.replace(assets, (_, prefix, path, suffix) => {
  if (!versions.has(path)) {
    const hash = createHash('sha256').update(readFileSync(join(site, path))).digest('hex').slice(0, 16);
    versions.set(path, hash);
  }
  return `${prefix}${path}?v=${versions.get(path)}${suffix}`;
});
writeFileSync(page, versioned);
// Release changes activate the worker and retire legacy app shell caches.
appendFileSync(join(site, 'umma-menu-sw.js'), `\n// GitHub Pages release ${release}\n`);
