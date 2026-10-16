// A `Mutex` written as an object literal in a return: the function's return
// type gives the literal its class.
import { Mutex, MutexGuard } from "nish/threads";
const make = (g: MutexGuard<i32>): Mutex<i32> => {
  return { guard: g };
};
export const main = (): i32 => {
  return 0;
};
