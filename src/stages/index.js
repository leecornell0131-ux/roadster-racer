// Stage registry, in play order. Each stage module is plain data plus a build(kit) for its scenery.
import austin from './austin.js';
import la from './la.js';
import sf from './sf.js';
import metaverse from './metaverse.js';

export const ORDER = [austin, la, sf, metaverse];
export const STAGES = Object.fromEntries(ORDER.map((s) => [s.id, s]));
