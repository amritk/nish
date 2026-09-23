// An object literal sets every field of the interface it takes its type from,
// and `Pair` is no exception: leaving out `second` is refused, not zeroed.
// `std/pair` by its path rather than as `nish/pair`, which std/README.md says
// means the same thing: tests/self/reject_oracle.js runs a dump binary from
// build/self/, which has no std/ beside it for a `nish/` specifier to find.
import { Pair } from "../../std/pair";

const half = (at: i32): Pair<i32, boolean> => ({ first: at });

export const test = (): number => half(1).first;
