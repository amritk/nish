// NL2521: `parallelMap` zero-fills the array its workers write, so a body
// answering a member type other than the 0 is refused at the call rather than
// inside `std/threads.ts`.
import { parallelMap } from "nish/threads";

enum Kind {
  Scalar,
  Array,
}

export const test = (): number => {
  const ys = parallelMap([1, 2], (x: i32): Kind.Array => Kind.Array);
  return ys.length;
};
