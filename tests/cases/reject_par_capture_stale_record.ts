// NL2290 through a capture: `first` is the address of an inline record of
// `ps`, the `push` may move that storage, and the body reads `first` where
// the call runs it.
import { parallelMap } from "nish/threads";

interface P {
  v: i32;
}

const f = (xs: i32[]): i32 => {
  const ps: P[] = [{ v: 1 }];
  const first = ps[0];
  ps.push({ v: 2 });
  ps[0].v = 9;
  return parallelMap(xs, (x) => first.v + x)[0];
};

export const main = (): i32 => f([1, 2]);
