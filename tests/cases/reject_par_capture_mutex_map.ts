// A lock is shared only by the rules of its own block (NL2496), so an arrow
// passed to a data-parallel form cannot capture a `Map` whose values are
// locks, even to ask it only `has`.
import { Mutex, parallelFrom } from "nish/threads";

export const main = (): i32 => {
  const locks = new Map<i32, Mutex<i32>>();
  locks.set(1, new Mutex<i32>(4));
  const ys = parallelFrom(2, (i) => (locks.has(i) ? 1 : 0) + i);
  console.log(`${ys[1]}`);
  return 0;
};
