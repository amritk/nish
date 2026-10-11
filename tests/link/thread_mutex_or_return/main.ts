// WP29 P3: the lock is released at a `return` and at an `orReturn` after the
// value is computed and before control leaves (unlike a scope's join, which
// runs before a `return`'s value), so `return Ok(g.value.n)` reads under the
// lock, and the `Err` that `orReturn` hands back is built before the release.
// `main.ll` pins that order. The second `addOk` locks the same `Mutex`
// again, so a path that kept the lock would wait on itself and never print.
// Native only: under Node `orReturn` throws (docs/RUN_UNDER_NODE.md).
import { Mutex } from "nish/threads";

class Tally {
  n: i32 = 0;
}

const addOk = (m: Mutex<Tally>, r: Result<i32, i32>): Result<i32, i32> => {
  using g = m.lock();
  const v = r.orReturn();
  g.value.n = g.value.n + v;
  return Ok(g.value.n);
};

export const main = (): i32 => {
  const m = new Mutex<Tally>(new Tally());
  const first = addOk(m, Err(7));
  const second = addOk(m, Ok(5));
  const third = addOk(m, Ok(4));
  console.log(`${first.unwrapOr(-1)} ${second.unwrapOr(-1)} ${third.unwrapOr(-1)}`);
  return 0;
};
