// The same rule for a class element: a `Box` built on a worker thread would sit
// in an arena freed when that thread exits, so the reduce is refused at the call.
import { parallelReduce } from "nish/threads";

class Box {
  v: i32 = 0;
}

const pick = (a: Box, b: Box): Box => (a.v >= b.v ? a : b);

export const main = (): i32 => {
  const xs: Box[] = [new Box(), new Box()];
  return parallelReduce(xs, pick, new Box()).v;
};
