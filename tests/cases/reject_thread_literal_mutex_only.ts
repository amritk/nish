// A `Mutex` written as an object literal around a guard its parameter gives:
// only `new Mutex(v)` makes one, and the literal message says so.
import { Mutex, MutexGuard } from "nish/threads";
const wrap = (g: MutexGuard<i32>): Mutex<i32> => {
  const m: Mutex<i32> = { guard: g };
  return m;
};
export const main = (): i32 => {
  return 0;
};
