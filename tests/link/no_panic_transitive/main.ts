// `"nish".noPanic` follows calls out of the scope: `pkg_pick` is a dependency,
// so its index is not this package's to prove, and the call into it is
// refused instead (NL2458), naming the callee and the site it reaches.
import { second } from "pkg_pick";

export const main = (): i32 => {
  const xs: i32[] = [4, 5];
  return second(xs);
};
