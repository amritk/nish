// NL2521: a parallel body answering a member type the template's zero fill
// cannot hold.
import { parallelMap } from "nish/threads";

enum Kind {
  Scalar,
  Array,
}

export const main = (): i32 => {
  const ys = parallelMap([1, 2], (x: i32): Kind.Array => Kind.Array);
  return ys.length;
};
