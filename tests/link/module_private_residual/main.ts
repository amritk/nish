import { fromNested } from "./lib/util";
import { fromFlat } from "./lib_util";

// `lib/util.ts` and `lib_util.ts` each keep a private `helper`, and both
// paths qualify to `lib_util`, so the two would share `@lib_util$.helper`.
// The clash check runs over the qualified symbols and refuses it (WP57 S1).
export const main = (): number => {
  return fromNested(1) + fromFlat(2);
};
