// The `nish:unsafe` functions take exactly the arguments `runtime/nish.d.ts`
// declares, with the arity wording every builtin uses.
import { uncheckedGet, uncheckedSet, wrappingAdd } from "nish:unsafe";

export const f = (xs: i32[], a: i32): i32 => {
  const x = uncheckedGet(xs);
  uncheckedSet(xs, 0);
  return x + wrappingAdd(a, a, a);
};
