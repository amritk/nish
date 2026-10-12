// Probe (negative): two mutexes nested in a fixed order — refused, one lock at a time.
import { Mutex } from "nish/threads";

export const main = (): i32 => {
  const a = new Mutex<i32>(0);
  const b = new Mutex<i32>(0);
  using g = a.lock();
  using h = b.lock();
  g.value = g.value + 1;
  h.value = h.value + 1;
  return 0;
};
