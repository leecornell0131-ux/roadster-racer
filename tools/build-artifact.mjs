// Builds dist/artifact.html: the page fragment (no doctype/html/head/body) for a claude.ai artifact.
// Browsers keep old copies of src/*.js between publishes (same URLs), so every module gets a
// content-hash query through the import map: relative imports resolve to the mapped, versioned URL.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const html = readFileSync('index.html', 'utf8');
let body = html.split('<!-- ARTIFACT-START -->')[1].split('<!-- ARTIFACT-END -->')[0]
  .replace('</head>\n<body>\n', '');
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
walk('src');
const ver = (p) => createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 10);
const map = Object.fromEntries(files.map((p) => ['./' + p, './' + p + '?v=' + ver(p)]));
body = body.replace('"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"',
  (m) => m + ',\n' + Object.entries(map).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n'));
body = body.replace('<script type="module" src="src/game.js"></script>', `<script type="module" src="${map['./src/game.js']}"></script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', body.trim() + '\n');
console.log('dist/artifact.html', body.length, 'bytes,', files.length, 'versioned modules');
