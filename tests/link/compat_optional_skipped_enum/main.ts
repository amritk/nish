// WP28 C1, `optional-chaining`: an enum assignment among a skipped call's
// arguments may not have run, so after the call `k` is `Kind.A | Kind.B`, as
// tsc has it, and comparing it with `Kind.A` is no disjoint comparison. It is
// a link program, not a case, because Node's type stripping cannot run an
// `enum`, so `tests/compat-erasure.js` could not compare it with Node.

import { Cell, Kind } from "./cell";

// The receiver is a parameter, so neither dialect nor tsc knows it is missing.
const held = (z: Cell | null): void => {
  let k: Kind = Kind.A;
  z?.take((k = Kind.B));
  console.log(k === Kind.A ? "skipped" : "ran");
};

export const main = (): void => {
  held(new Cell());
  held(null);
};
