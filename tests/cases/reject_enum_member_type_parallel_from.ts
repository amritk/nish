// NL2516: `parallelFrom` zero-fills the array its workers write, so a body
// answering a member type other than the 0 is refused at the call.
import { parallelFrom } from "nish/threads";

enum Kind {
  Scalar,
  Array,
}

export const test = (): number => {
  const ys = parallelFrom(2, (i: i32): Kind.Array => Kind.Array);
  return ys.length;
};
