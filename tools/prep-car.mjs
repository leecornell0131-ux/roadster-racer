// Strips a downloaded car before packing: drops interior/badge/plate primitives by material or node
// name so the packed file is small and carries no trademarks. Run with the gltf-transform libs on NODE_PATH.
// usage: node tools/prep-car.mjs in.glb out.glb '<material regex>' ['<node regex>'] [strip]
// strip: drop normals/tangents so split (flat-shaded) vertices weld and simplify; the game rebuilds creased normals
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
const [, , input, output, matRe = '^$', nodeRe = '^$', strip] = process.argv;
const M = new RegExp(matRe, 'i'), N = new RegExp(nodeRe, 'i');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
let dropped = 0;
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  for (const p of mesh.listPrimitives()) {
    const mn = p.getMaterial()?.getName() || '';
    if (strip) for (const a of ['NORMAL', 'TANGENT']) p.setAttribute(a, null);
    if (M.test(mn) || N.test(node.getName()) || N.test(mesh.getName())) { mesh.removePrimitive(p); dropped++; }
  }
  if (!mesh.listPrimitives().length) node.setMesh(null);
}
await doc.transform(prune());
await io.write(output, doc);
console.log('dropped', dropped, 'primitives');
