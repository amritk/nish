// WP15 §2.4, the build-mode rule is not a licence: a `--link` build takes an
// exported function's entry facts from every call site in the program, across
// modules, and joins them. The first call proves `1 < 3` and the second proves
// nothing, so `pick` keeps its check and the second call panics with
// `index out of range: 5 >= 3` after printing 20.
import { pick } from "./pick";

const at = (i: i32): i32 => pick(i);

export const main = (): number => {
  console.log(`${pick(1)}`);
  console.log(`${at(5)}`);
  return 0;
};
