// Stage registry, in play order. Each stage module is plain data plus a build(kit) for its scenery.
import austin from './austin.js';
import la from './la.js';

export const ORDER = [austin, la];
export const STAGES = Object.fromEntries(ORDER.map((s) => [s.id, s]));
