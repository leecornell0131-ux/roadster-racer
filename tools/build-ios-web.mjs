// Builds ios-app/web/: the game files the iPhone app bundles and serves itself (app://game/...).
// Same page as index.html, but three.js comes from node_modules instead of jsdelivr, so the app
// starts without waiting on a CDN. Run `npm ci` first.
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';
const out = 'ios-app/web';
const three = 'node_modules/three';
if (!existsSync(three)) { console.error('node_modules/three is missing: run npm ci'); process.exit(1); }
rmSync(out, { recursive: true, force: true });
mkdirSync(out + '/vendor/three/build', { recursive: true });
cpSync('src', out + '/src', { recursive: true });
cpSync('assets', out + '/assets', { recursive: true });
// Paid models that can't live in this public repo (e.g. the Alt-Man head) come from the private
// licensed/ submodule. Without access it stays empty and the game just skips those heads.
const licensed = existsSync('licensed') ? readdirSync('licensed').filter((f) => f.endsWith('.json')) : [];
for (const f of licensed) cpSync('licensed/' + f, out + '/assets/props/' + f);
cpSync(three + '/build/three.module.js', out + '/vendor/three/build/three.module.js');
// examples/jsm minus libs/ (18 MB of wasm decoders the game doesn't load), plus the one lib it does
const jsm = three + '/examples/jsm';
cpSync(jsm, out + '/vendor/three/examples/jsm', { recursive: true, filter: (p) => !p.startsWith(jsm + '/libs') });
cpSync(jsm + '/libs/meshopt_decoder.module.js', out + '/vendor/three/examples/jsm/libs/meshopt_decoder.module.js');
const html = readFileSync('index.html', 'utf8')
  .replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', './vendor/three/build/three.module.js')
  .replace('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/', './vendor/three/examples/jsm/');
if (html.includes('cdn.jsdelivr.net/npm/three')) { console.error('index.html importmap changed: update tools/build-ios-web.mjs'); process.exit(1); }
writeFileSync(out + '/index.html', html);
console.log(out, 'ready, licensed:', licensed.join(', ') || 'none', ', three', JSON.parse(readFileSync(three + '/package.json', 'utf8')).version);
