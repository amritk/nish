// The arrow form of the same rule: `() => sumOf(xs)` answers `i32`, and a
// `spawn` with no destination has nowhere to put it.
import { scope } from "nish/threads";

const sumOf = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

export const main = (): i32 => {
  const xs: i32[] = [1, 2];
  {
    using s = scope();
    s.spawn(() => sumOf(xs));
  }
  return 0;
};
