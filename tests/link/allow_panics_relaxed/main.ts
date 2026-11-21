// `--allow-panics` with no `noPanic` list: nothing is in the no-panic scope,
// so the unproven index in `util.ts` compiles with its bounds check, and the
// program runs. `no_panic_default` is the same index refused without the flag.
import { pick } from "./util";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  return pick(xs, parseInt("1"));
};
