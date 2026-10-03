// `"nish".noPanic` reaches the modules it lists and no others: `clean.ts` is
// held to no panic site and passes, while `util.ts` and this entry keep
// theirs and compile. The exit code is 1 + 2 + 3 = 6.
import { firstField } from "./clean";
import { pick } from "./util";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  return firstField(xs, 0) + pick(xs, 1) + xs[2];
};
