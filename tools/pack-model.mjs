// Packs a downloaded .glb for the game: simplify, meshopt-compress, and embed the
// binary buffer so the result is one .json file (artifacts can't serve .glb).
// usage: node tools/pack-model.mjs in.glb assets/cars/name.json [simplifyRatio] [simplifyError] [textureSize]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [, , input, output, ratio = '0.1', error = '0.0008', texSize = '1024'] = process.argv;
const dir = mkdtempSync(join(tmpdir(), 'pack-'));
const cli = process.env.GLTF_TRANSFORM || 'gltf-transform';
const opt = join(dir, 'opt.glb');
execFileSync(cli, ['optimize', input, opt, '--compress', 'meshopt', '--simplify-ratio', ratio, '--simplify-error', error, '--simplify-lock-border', process.env.LOCK_BORDER || 'true',
  '--texture-compress', 'webp', '--texture-size', texSize, '--palette', 'false', '--instance', 'false', '--join', 'false', '--flatten', 'false'], { stdio: 'inherit' });
// unpack the GLB container ourselves (gltf-transform copy would decode meshopt): JSON chunk + BIN chunk as a data URI
const glb = readFileSync(opt);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen;
if (binStart < glb.length) {
  const binLen = glb.readUInt32LE(binStart);
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + glb.subarray(binStart + 8, binStart + 8 + binLen).toString('base64');
}
writeFileSync(output, JSON.stringify(json));
console.log(output, (readFileSync(output).length / 1e6).toFixed(2), 'MB');
