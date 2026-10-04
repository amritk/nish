// `"nish".noPanic` follows calls out of the scope: `pkg_pick` is a dependency,
// so its index is not this package's to prove, and the call into it is
// refused instead (NL2458), naming the callee and the site it reaches.
import { pick } from "pkg_pick";

export const main = (): i32 => {
  const xs: i32[] = [4, 5];
  return pick(xs, parseInt("1"));
};
