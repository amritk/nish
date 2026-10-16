// A `Mutex` and its guard written as object literals: the literal message,
// not the fresh-value rule of `new Mutex`, names what is wrong.
import { Mutex, MutexGuard } from "nish/threads";
export const main = (): i32 => {
  const g: MutexGuard<i32> = { value: 0, word: 0 };
  const m: Mutex<i32> = { guard: g };
  return 0;
};
