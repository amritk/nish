// A `Pair` is ordered: `Pair<i32, string>` is not `Pair<string, i32>`, so the
// swapped instantiation is refused at the return rather than read as the
// same two fields.
// `std/pair` by its path rather than as `nish/pair`, which std/README.md says
// means the same thing: tests/self/reject_oracle.js runs a dump binary from
// build/self/, which has no std/ beside it for a `nish/` specifier to find.
import { Pair } from "../../std/pair";

const counted = (): Pair<string, i32> => {
  const p: Pair<i32, string> = { first: 3, second: "three" };
  return p;
};

export const test = (): number => counted().second;
