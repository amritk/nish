// A `Mutex` written as an object literal in argument position: the
// parameter's type gives the literal its class.
import { Mutex, MutexGuard } from "nish/threads";
const take = (m: Mutex<i32>): i32 => 0;
const wrap = (g: MutexGuard<i32>): i32 => take({ guard: g });
export const main = (): i32 => {
  return 0;
};
