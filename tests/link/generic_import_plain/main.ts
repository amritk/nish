// The other side of the same rule: a type-argument list on an imported name
// that is not a template. Pass 1 cannot tell the two apart — it resolves this
// annotation before a single import is bound — so the refusal is made when the
// import binds, where the answer is known.
import { Point } from "./lib";

export const xOf = (p: Point<i32>): i32 => p.x;

export const main = (): i32 => 0;
