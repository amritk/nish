// R1: a literal is fresh only all the way down. `[row]` is a new array, but
// `row` is still the program's, so `row[0] = 9` would skip the lock.
import { Mutex } from "nish/threads";

export const main = (): i32 => {
  const row: i32[] = [0, 0];
  const m = new Mutex<i32[][]>([row]);
  row[0] = 9;
  using g = m.lock();
  return g.value[0][0];
};
